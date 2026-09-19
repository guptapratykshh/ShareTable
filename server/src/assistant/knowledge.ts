export type KnowledgeEntry = {
  id: string;
  keywords: string[];
  answer: string;
};

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "pickup-window",
    keywords: [
      "pickup window",
      "how long",
      "1 hour",
      "one hour",
      "listing last",
      "listings expire",
      "listing expire",
      "hour to pick",
      "window",
    ],
    answer:
      "Each listing stays open for 1 hour. Pickup has to happen before that window ends. Meals left unclaimed after that do not count as rescued.",
  },
  {
    id: "radius",
    keywords: [
      "range of pickup",
      "pickup locations",
      "pickup location range",
      "how far",
      "coverage",
      "nearby radius",
      "matching radius",
      "kilometer",
      "km",
      "2.5",
      "4 km",
      "6 km",
      "expand",
      "range",
      "radius",
      "nearby",
      "distance",
    ],
    answer:
      "Matching uses distance only. Recipients within 2.5 km are notified first. If meals remain, the radius expands to 4 km and then 6 km. ShareTable never judges need.",
  },
  {
    id: "escalation",
    keywords: ["escalation", "expand the radius", "level 2", "level 3", "20 minutes", "40 minutes", "rescue expanded"],
    answer:
      "If meals are still waiting, the rescue radius expands from 2.5 km to 4 km after 20 minutes, then to 6 km after 40 minutes. Nearby lists use the listing's current radius.",
  },
  {
    id: "rescued",
    keywords: [
      "won't be counted",
      "will not be counted",
      "not count as rescued",
      "claimed vs rescued",
      "what counts",
      "count as rescued",
      "rescued",
      "impact",
    ],
    answer:
      "Rescued meals are counted only after pickup is recorded as PICKED_UP. A claim or reservation by itself does not count.",
  },
  {
    id: "matching",
    keywords: ["matching", "who gets", "how does match", "judge need", "need"],
    answer:
      "ShareTable matches surplus food to registered nearby recipients by distance. It does not rank or judge need.",
  },
  {
    id: "packaging",
    keywords: [
      "own containers",
      "bring my own",
      "provided in a packet",
      "in a packet",
      "packaging",
      "containers",
      "container",
      "packets",
      "packet",
      "boxes",
      "box",
      "tiffin",
      "packing",
    ],
    answer:
      "ShareTable does not provide packets, boxes, or containers. Packaging is whatever the donor prepared. Check the listing description, storage condition, and pickup instructions, and collect in person.",
  },
  {
    id: "no-delivery",
    keywords: ["delivery", "deliver", "drop off", "dropped off", "home delivery", "ship"],
    answer:
      "ShareTable is pickup only. There is no delivery. The recipient collects at the donor's pickup location.",
  },
  {
    id: "no-payment",
    keywords: ["payment", "pay", "price", "cost", "charge", "fee", "free"],
    answer: "There is no payment on ShareTable. Listings are surplus food, not a store.",
  },
  {
    id: "pickup-code",
    keywords: ["pickup code", "show at the door", "show at", "confirm pickup", "who confirms", "handoff"],
    answer:
      "The recipient shows their pickup code at the door. Only the donor records the handoff. Pickup codes are never included in late or instruction notifications.",
  },
  {
    id: "one-reservation",
    keywords: [
      "one reservation",
      "already have a reservation",
      "second claim",
      "claim again",
      "another reservation",
      "per listing",
    ],
    answer:
      "A recipient can have one open reservation per listing. Remaining meals stay available for other recipients until that pickup is recorded.",
  },
  {
    id: "food-safety",
    keywords: ["food safety", "safe to eat", "handled safely", "suitable for donation", "liability", "safety"],
    answer:
      "Donors confirm that the food is suitable for donation and has been handled safely. ShareTable only facilitates discovery, claiming, and pickup. It does not make food-safety or medical guarantees.",
  },
  {
    id: "diet",
    keywords: [
      "allergen list",
      "allergen",
      "allergens",
      "allergies",
      "allergic",
      "peanuts",
      "peanut",
      "vegetarian",
      "non-vegetarian",
      "non veg",
      "non-veg",
      "dietary",
      "category",
      "ingredients",
    ],
    answer:
      "Donors can declare allergens on each listing. Check Contains on the listing before you claim. An empty list means allergens were not declared, not that the food is free of peanuts or other allergens. ShareTable does not test meals and this is not a medical guarantee.",
  },
  {
    id: "quantity",
    keywords: ["how many meals are there", "predict", "meal count", "typed by", "quantity"],
    answer:
      "The donor types the surplus quantity. ShareTable does not predict how many meals exist.",
  },
  {
    id: "pickup-instructions",
    keywords: ["where do i go", "storage condition", "how to find", "entrance"],
    answer:
      "Pickup instructions and storage notes live on the listing. After you claim, you can see the pickup address and any instructions the donor wrote.",
  },
  {
    id: "assistant-actions",
    keywords: ["running late", "update instructions", "i've arrived", "what can you notify", "what can the assistant"],
    answer:
      "I can notify the other party that you are late, that pickup instructions changed, that you have arrived, or a short pickup message. Nothing is sent until you confirm.",
  },
  {
    id: "reliability",
    keywords: ["reliability", "score", "no-show", "track record", "ranking"],
    answer:
      "Reliability is calculated from completed claims, not from chat. It is operational history, not a ranking, and never hides food.",
  },
];

function keywordWeight(keyword: string) {
  return Math.max(1, keyword.trim().split(/\s+/).filter(Boolean).length);
}

export function matchKnowledge(message: string): KnowledgeEntry | undefined {
  const text = message.toLowerCase();
  let best: { entry: KnowledgeEntry; score: number } | undefined;
  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (text.includes(keyword)) score += keywordWeight(keyword);
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry;
}

export function knowledgeForPrompt() {
  return KNOWLEDGE.map((k) => `- ${k.id}: ${k.answer}`).join("\n");
}

export const UNKNOWN_FACT_REPLY =
  "I don't have that fact. I can explain pickup, range, packaging, and how rescued meals are counted.";
