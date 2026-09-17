import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import mongoose from "mongoose";
import { config } from "../config.js";
import { Donation } from "../models/Donation.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeBucket(date: Date) {
  const h = date.getHours();
  if (h < 10) return "Breakfast";
  if (h < 14) return "Lunch";
  if (h < 17) return "Evening";
  if (h < 21) return "Dinner";
  return "Late night";
}

export async function donorPatterns(donorId: string) {
  const donations = await Donation.find({ donorId: new mongoose.Types.ObjectId(donorId) });
  if (donations.length < config.patternMinDonations) {
    return {
      ready: false,
      minDonations: config.patternMinDonations,
      observed: donations.length,
      insights: [],
      byDay: [],
      byTime: [],
      byCategory: [],
    };
  }

  const avg = donations.reduce((s, d) => s + d.quantity, 0) / donations.length;
  const byDayMap = new Map<string, { meals: number; count: number }>();
  const byTimeMap = new Map<string, { meals: number; count: number }>();
  const byCatMap = new Map<string, number>();

  for (const d of donations) {
    const when = d.preparedAt || d.createdAt;
    const day = DAY_NAMES[when.getDay()];
    const bucket = timeBucket(when);
    const dayRow = byDayMap.get(day) ?? { meals: 0, count: 0 };
    dayRow.meals += d.quantity;
    dayRow.count += 1;
    byDayMap.set(day, dayRow);
    const timeRow = byTimeMap.get(bucket) ?? { meals: 0, count: 0 };
    timeRow.meals += d.quantity;
    timeRow.count += 1;
    byTimeMap.set(bucket, timeRow);
    byCatMap.set(d.category, (byCatMap.get(d.category) ?? 0) + d.quantity);
  }

  const byDay = DAY_NAMES.map((day) => ({
    day,
    meals: byDayMap.get(day)?.meals ?? 0,
    count: byDayMap.get(day)?.count ?? 0,
    average: byDayMap.get(day) ? Number((byDayMap.get(day)!.meals / byDayMap.get(day)!.count).toFixed(1)) : 0,
  }));
  const byTime = ["Breakfast", "Lunch", "Evening", "Dinner", "Late night"].map((period) => ({
    period,
    meals: byTimeMap.get(period)?.meals ?? 0,
    count: byTimeMap.get(period)?.count ?? 0,
  }));
  const totalMeals = donations.reduce((s, d) => s + d.quantity, 0);
  const byCategory = [...byCatMap.entries()]
    .map(([category, meals]) => ({
      category,
      meals,
      share: Number(((meals / totalMeals) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.meals - a.meals);

  const insights: { title: string; body: string; facts: Record<string, string | number> }[] = [];
  const friday = byDay.find((d) => d.day === "Friday");
  const others = donations.filter((d) => (d.preparedAt || d.createdAt).getDay() !== 5);
  const otherAvg = others.length ? others.reduce((s, d) => s + d.quantity, 0) / others.length : avg;
  if (friday && friday.count >= 5 && friday.average >= otherAvg * 1.5) {
    insights.push({
      title: "PATTERN DETECTED",
      body: "A recurring pattern was detected in your recent donation history. Friday evening produces more surplus food than your weekly average.",
      facts: {
        fridayAverage: friday.average,
        weeklyAverage: Number(otherAvg.toFixed(1)),
        observations: friday.count,
      },
    });
  } else {
    const peak = [...byDay].sort((a, b) => b.average - a.average)[0];
    if (peak && peak.count >= 5 && peak.average >= avg * 1.5) {
      insights.push({
        title: "PATTERN DETECTED",
        body: `A recurring pattern was detected in your recent donation history. ${peak.day} surplus is higher than your weekly average.`,
        facts: {
          day: peak.day,
          dayAverage: peak.average,
          weeklyAverage: Number(avg.toFixed(1)),
          observations: peak.count,
        },
      });
    }
  }

  const topCat = byCategory[0];
  if (topCat && topCat.share >= 30) {
    insights.push({
      title: "CATEGORY PATTERN",
      body: `${topCat.category} meals represent ${topCat.share}% of your recorded surplus. Observed across ${donations.length} donations.`,
      facts: { category: topCat.category, share: topCat.share, observations: donations.length },
    });
  }

  return {
    ready: true,
    minDonations: config.patternMinDonations,
    observed: donations.length,
    weeklyAverage: Number(avg.toFixed(1)),
    insights,
    byDay,
    byTime,
    byCategory,
    demoDataLabel: "Demo Data",
  };
}

export function patternExplanation(insight: { body: string; facts: Record<string, string | number> }) {
  return insight.body;
}

/** Optional Bedrock rephrase of backend facts. Numbers still come from MongoDB. */
export async function maybeRewriteInsight(body: string, facts: Record<string, string | number>) {
  if (!config.bedrockModelId) return body;
  try {
    const client = new BedrockRuntimeClient({ region: config.awsRegion });
    const command = new InvokeModelCommand({
      modelId: config.bedrockModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 180,
        messages: [
          {
            role: "user",
            content: `Rephrase this surplus-food observation in one or two sentences. Keep every number exactly as given. Do not predict future demand or invent facts.\n\nText: ${body}\nFacts JSON: ${JSON.stringify(facts)}`,
          },
        ],
      }),
    });
    const response = await client.send(command);
    const raw = new TextDecoder().decode(response.body);
    const json = JSON.parse(raw) as { content?: { text?: string }[] };
    const text = json.content?.[0]?.text?.trim();
    return text || body;
  } catch {
    return body;
  }
}
