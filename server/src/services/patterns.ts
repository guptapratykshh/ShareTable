import mongoose from "mongoose";
import { config } from "../config.js";
import { converseText } from "./llm.js";
import { Claim } from "../models/Claim.js";
import { Donation } from "../models/Donation.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_BUCKETS = ["Breakfast", "Lunch", "Evening", "Dinner", "Late night"] as const;

export type PatternSection = { heading: string; body: string };

export type PatternAnalysis = {
  title: string;
  summary: string;
  sections: PatternSection[];
  source: "llm" | "stats";
};

type DayRow = { day: string; meals: number; count: number; average: number };
type TimeRow = { period: string; meals: number; count: number };

export type PatternFacts = {
  observed: number;
  weeklyAverage: number;
  mealsDonated: number;
  mealsRescued: number;
  mealsExpired: number;
  rescueRate: number;
  averageListingSize: number;
  busiestDay: DayRow | null;
  busiestDayShare: number;
  peakDay: DayRow | null;
  peakTime: TimeRow | null;
  topCategory: { category: string; meals: number; share: number } | null;
  byDay: DayRow[];
  byTime: TimeRow[];
  byCategory: { category: string; meals: number; share: number }[];
  note: string;
};

function pickPeak<T extends { count: number }>(rows: T[], score: (row: T) => number, minCount: number) {
  const eligible = rows.filter((row) => row.count >= minCount);
  const pool = eligible.length ? eligible : rows.filter((row) => row.count > 0);
  return [...pool].sort((a, b) => score(b) - score(a) || b.count - a.count)[0] ?? null;
}

function timeBucket(date: Date) {
  const h = date.getHours();
  if (h < 10) return "Breakfast";
  if (h < 14) return "Lunch";
  if (h < 17) return "Evening";
  if (h < 21) return "Dinner";
  return "Late night";
}

function emptyPatterns(observed: number) {
  return {
    ready: false,
    minDonations: config.patternMinDonations,
    observed,
    insights: [],
    analysis: null as PatternAnalysis | null,
    byDay: [],
    byTime: [],
    byCategory: [],
  };
}

function parseAnalysisJson(raw: string): Omit<PatternAnalysis, "source"> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[0]) as {
      title?: unknown;
      summary?: unknown;
      sections?: unknown;
    };
    if (typeof data.title !== "string" || typeof data.summary !== "string" || !Array.isArray(data.sections)) {
      return null;
    }
    const sections = data.sections
      .filter(
        (section): section is PatternSection =>
          Boolean(section) &&
          typeof section === "object" &&
          typeof (section as PatternSection).heading === "string" &&
          typeof (section as PatternSection).body === "string",
      )
      .map((section) => ({ heading: section.heading.trim(), body: section.body.trim() }))
      .filter((section) => section.heading && section.body)
      .slice(0, 6);
    if (!data.title.trim() || !data.summary.trim() || sections.length < 1) return null;
    return { title: data.title.trim(), summary: data.summary.trim(), sections };
  } catch {
    return null;
  }
}

export function statisticalAnalysis(facts: PatternFacts): PatternAnalysis {
  const busiest = facts.busiestDay;
  const peakTime = facts.peakTime;
  const top = facts.topCategory;
  const title = busiest ? `${busiest.day} carries the most surplus.` : "Your surplus history, in numbers.";
  const summary = busiest
    ? `${busiest.day} accounts for ${busiest.meals} of ${facts.mealsDonated} meals (${facts.busiestDayShare}%) across ${busiest.count} listings, average ${busiest.average} meals. Weekly listing average is ${facts.weeklyAverage} meals over ${facts.observed} donations.`
    : `Recorded history covers ${facts.observed} donations and ${facts.mealsDonated} meals. These are observations from your listings, not predictions.`;

  const sections: PatternSection[] = [
    {
      heading: "When surplus is listed",
      body: busiest
        ? `${busiest.day} has the most meals (${busiest.meals} across ${busiest.count} listings). A day with one listing is an outlier, not a repeating pattern.`
        : `No single day stands out yet across ${facts.observed} donations.`,
    },
    {
      heading: "Time of day",
      body: peakTime
        ? `${peakTime.period} has the most meals (${peakTime.meals} in ${peakTime.count} listings). ` +
          (facts.byTime
            .filter((row) => row.count > 0)
            .map((row) => `${row.period}: ${row.meals} meals in ${row.count} listings`)
            .join(". ") || "")
        : "Not enough timed listings to compare periods.",
    },
    {
      heading: "What gets shared",
      body: top
        ? `${top.category} is ${top.share}% of recorded surplus (${top.meals} meals).`
        : "Category mix is still too thin to summarize.",
    },
    {
      heading: "Rescue conversion",
      body: `${facts.mealsRescued} of ${facts.mealsDonated} donated meals were confirmed picked up (${facts.rescueRate}%). ${facts.mealsExpired} meals sat in expired listings. Average listing size is ${facts.averageListingSize} meals.`,
    },
  ];

  return { title, summary, sections, source: "stats" };
}

export async function analyzeDonorPatterns(facts: PatternFacts): Promise<PatternAnalysis> {
  const fallback = statisticalAnalysis(facts);
  if (!config.llmEnabled) return fallback;
  try {
    const text = await converseText(
      `You analyze ShareTable surplus-food donation history. Return JSON only with keys title, summary, sections.
title: short headline about the strongest repeating pattern.
summary: exactly two sentences for a dashboard card.
sections: 4 to 6 objects with heading and body covering timing, time of day, categories, rescue conversion, and outliers.

Rules:
- Use only the facts JSON. Keep every number exactly as given.
- Observations only, not predictions. Do not invent listings, recipients, dates, or causes.
- Headline busiestDay (most meals) if it has at least 2 listings. Do not headline a day with count 1; that is a single listing, not a pattern.
- Never combine a weekday with a time-of-day bucket unless the facts explicitly tie them together. byDay and byTime are separate.
- Mention peakTime only as a time-of-day observation.
- ${facts.note}

Facts JSON: ${JSON.stringify(facts)}`,
      1000,
    );
    const parsed = parseAnalysisJson(text);
    if (parsed) return { ...parsed, source: "llm" };
  } catch {
    // statistical fallback below
  }
  return fallback;
}

export async function donorPatterns(donorId: string) {
  const donorObj = new mongoose.Types.ObjectId(donorId);
  const donations = await Donation.find({ donorId: donorObj });
  if (donations.length < config.patternMinDonations) {
    return emptyPatterns(donations.length);
  }

  const mealsDonated = donations.reduce((sum, donation) => sum + donation.quantity, 0);
  const avg = mealsDonated / donations.length;
  const byDayMap = new Map<string, { meals: number; count: number }>();
  const byTimeMap = new Map<string, { meals: number; count: number }>();
  const byCatMap = new Map<string, number>();

  for (const donation of donations) {
    const when = donation.preparedAt || donation.createdAt;
    const day = DAY_NAMES[when.getDay()];
    const bucket = timeBucket(when);
    const dayRow = byDayMap.get(day) ?? { meals: 0, count: 0 };
    dayRow.meals += donation.quantity;
    dayRow.count += 1;
    byDayMap.set(day, dayRow);
    const timeRow = byTimeMap.get(bucket) ?? { meals: 0, count: 0 };
    timeRow.meals += donation.quantity;
    timeRow.count += 1;
    byTimeMap.set(bucket, timeRow);
    byCatMap.set(donation.category, (byCatMap.get(donation.category) ?? 0) + donation.quantity);
  }

  const byDay = DAY_NAMES.map((day) => ({
    day,
    meals: byDayMap.get(day)?.meals ?? 0,
    count: byDayMap.get(day)?.count ?? 0,
    average: byDayMap.get(day) ? Number((byDayMap.get(day)!.meals / byDayMap.get(day)!.count).toFixed(1)) : 0,
  }));
  const byTime = TIME_BUCKETS.map((period) => ({
    period,
    meals: byTimeMap.get(period)?.meals ?? 0,
    count: byTimeMap.get(period)?.count ?? 0,
  }));
  const byCategory = [...byCatMap.entries()]
    .map(([category, meals]) => ({
      category,
      meals,
      share: Number(((meals / mealsDonated) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.meals - a.meals);

  const donationIds = donations.map((donation) => donation._id);
  const [claimAgg] = await Claim.aggregate<{ rescued: number }>([
    { $match: { donationId: { $in: donationIds } } },
    {
      $group: {
        _id: null,
        rescued: { $sum: { $cond: [{ $eq: ["$status", "PICKED_UP"] }, "$quantity", 0] } },
      },
    },
  ]);

  const mealsRescued = claimAgg?.rescued ?? 0;
  const mealsExpired = donations.filter((donation) => donation.status === "EXPIRED").reduce((sum, donation) => sum + donation.quantity, 0);
  const busiestDay = pickPeak(byDay, (row) => row.meals, 2);
  const peakDay = pickPeak(byDay, (row) => row.average, 3);
  const peakTime = pickPeak(byTime, (row) => row.meals, 2);

  const facts: PatternFacts = {
    observed: donations.length,
    weeklyAverage: Number(avg.toFixed(1)),
    mealsDonated,
    mealsRescued,
    mealsExpired,
    rescueRate: mealsDonated ? Number(((mealsRescued / mealsDonated) * 100).toFixed(1)) : 0,
    averageListingSize: Number(avg.toFixed(1)),
    busiestDay,
    busiestDayShare: busiestDay && mealsDonated ? Number(((busiestDay.meals / mealsDonated) * 100).toFixed(1)) : 0,
    peakDay,
    peakTime,
    topCategory: byCategory[0] ?? null,
    byDay,
    byTime,
    byCategory,
    note: "Days or periods with count 1 are single listings, not repeating patterns. Prefer volume (meals) over a high average from one listing.",
  };

  const analysis = await analyzeDonorPatterns(facts);
  const insights = [
    {
      title: analysis.title,
      body: analysis.summary,
      explanation: analysis.summary,
      facts: {
        weeklyAverage: facts.weeklyAverage,
        observed: facts.observed,
        rescueRate: facts.rescueRate,
        ...(facts.busiestDay ? { day: facts.busiestDay.day, dayMeals: facts.busiestDay.meals, listings: facts.busiestDay.count } : {}),
        ...(facts.topCategory ? { category: facts.topCategory.category, share: facts.topCategory.share } : {}),
      } as Record<string, string | number>,
    },
  ];

  return {
    ready: true,
    minDonations: config.patternMinDonations,
    observed: donations.length,
    weeklyAverage: facts.weeklyAverage,
    mealsDonated: facts.mealsDonated,
    mealsRescued: facts.mealsRescued,
    mealsExpired: facts.mealsExpired,
    rescueRate: facts.rescueRate,
    averageListingSize: facts.averageListingSize,
    insights,
    analysis,
    byDay,
    byTime,
    byCategory,
  };
}
