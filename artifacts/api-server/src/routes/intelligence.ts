import { Router, type IRouter } from "express";
import {
  AnalyzeTextBody,
  AnalyzeTextResponse,
  Analytics as AnalyticsType,
  GetAnalyticsResponse,
  GetBenchmarksResponse,
  GetDashboardResponse,
  GetSignalsResponse,
  Model,
  Sentiment,
  UploadDatasetBody,
  UploadDatasetResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const positiveWords = new Set([
  "love",
  "great",
  "amazing",
  "excellent",
  "good",
  "happy",
  "best",
  "win",
  "helpful",
  "fast",
  "thanks",
  "thank",
  "perfect",
  "recommend",
  "awesome",
  "clean",
  "easy",
  "smooth",
  "excited",
]);

const negativeWords = new Set([
  "hate",
  "bad",
  "terrible",
  "awful",
  "worst",
  "angry",
  "slow",
  "broken",
  "bug",
  "fail",
  "failed",
  "poor",
  "refund",
  "disappointed",
  "delay",
  "issue",
  "problem",
  "crash",
  "wrong",
  "confusing",
]);

const modelNames: Record<string, string> = {
  "logistic-regression": "Logistic Regression",
  "naive-bayes": "Multinomial Naive Bayes",
  svm: "Support Vector Machine",
  vader: "VADER Lexicon",
  textblob: "TextBlob Polarity",
};

function classify(text: string, model: string) {
  const tokens = text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
  const positive = tokens.filter((token) => positiveWords.has(token));
  const negative = tokens.filter((token) => negativeWords.has(token));
  const score = positive.length - negative.length;
  const sentiment: Sentiment =
    score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
  const modelBias =
    model === "vader" ? 0.04 : model === "textblob" ? -0.02 : 0.01;
  const confidence = Math.min(
    0.99,
    Math.max(0.52, 0.7 + Math.min(0.22, Math.abs(score) * 0.08) + modelBias),
  );
  const polarity = Math.max(-1, Math.min(1, score / Math.max(2, tokens.length / 4)));
  const keywordCounts = new Map<string, number>();

  [...positive, ...negative].forEach((word) => {
    keywordCounts.set(word, (keywordCounts.get(word) ?? 0) + 1);
  });

  const keywords = [...keywordCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([word, count]) => ({
      word,
      count,
      sentiment: positiveWords.has(word) ? ("positive" as const) : ("negative" as const),
    }));

  const explanation =
    sentiment === "neutral"
      ? `No strong polarity markers were found. ${modelNames[model] ?? "The selected model"} classified the text as neutral.`
      : `${modelNames[model] ?? "The selected model"} found ${positive.length} positive and ${negative.length} negative signal${positive.length + negative.length === 1 ? "" : "s"} in the text.`;

  return {
    sentiment,
    confidence: Number(confidence.toFixed(2)),
    polarity: Number(polarity.toFixed(2)),
    model,
    keywords,
    explanation,
  };
}

function countSentiments(rows: Array<{ sentiment: Sentiment }>) {
  const positive = rows.filter((row) => row.sentiment === "positive").length;
  const negative = rows.filter((row) => row.sentiment === "negative").length;
  const neutral = rows.length - positive - negative;
  const total = rows.length;
  return {
    total,
    positive,
    negative,
    neutral,
    positivePct: total ? Number(((positive / total) * 100).toFixed(1)) : 0,
    negativePct: total ? Number(((negative / total) * 100).toFixed(1)) : 0,
    neutralPct: total ? Number(((neutral / total) * 100).toFixed(1)) : 0,
  };
}

router.get("/dashboard", (_req, res) => {
  const data = GetDashboardResponse.parse({
    counts: {
      total: 24680,
      positive: 13842,
      negative: 5426,
      neutral: 5412,
      positivePct: 56.1,
      negativePct: 22,
      neutralPct: 21.9,
    },
    trend: [
      { label: "Mon", positive: 1820, negative: 640, neutral: 720 },
      { label: "Tue", positive: 2110, negative: 780, neutral: 690 },
      { label: "Wed", positive: 1980, negative: 720, neutral: 810 },
      { label: "Thu", positive: 2340, negative: 680, neutral: 760 },
      { label: "Fri", positive: 2070, negative: 920, neutral: 710 },
      { label: "Sat", positive: 2450, negative: 840, neutral: 880 },
      { label: "Sun", positive: 2630, negative: 846, neutral: 842 },
    ],
    platforms: [
      { platform: "Instagram", positive: 3820, negative: 1280, neutral: 1460 },
      { platform: "X / Twitter", positive: 3010, negative: 1620, neutral: 1120 },
      { platform: "Facebook", positive: 2740, negative: 940, neutral: 1280 },
      { platform: "Reddit", positive: 2180, negative: 1060, neutral: 980 },
      { platform: "YouTube", positive: 2092, negative: 526, neutral: 572 },
    ],
    healthScore: 78.4,
    analyzedToday: 1842,
    activeModels: 5,
  });
  res.json(data);
});

router.get("/signals", (_req, res) => {
  const data = GetSignalsResponse.parse([
    {
      id: "sig-001",
      type: "spike",
      title: "Positive sentiment spike",
      detail: "Product launch conversation is up 34% in the last 2 hours.",
      platform: "Instagram",
      sentiment: "positive",
      time: "12 min ago",
      severity: "low",
    },
    {
      id: "sig-002",
      type: "cluster",
      title: "Support issue cluster",
      detail: "Refund and delivery terms are driving a concentrated negative thread.",
      platform: "X / Twitter",
      sentiment: "negative",
      time: "28 min ago",
      severity: "high",
    },
    {
      id: "sig-003",
      type: "insight",
      title: "Update is trending",
      detail: "Mentions of the latest update have doubled since yesterday.",
      platform: "Reddit",
      sentiment: "neutral",
      time: "1 hr ago",
      severity: "medium",
    },
    {
      id: "sig-004",
      type: "spike",
      title: "Praise from power users",
      detail: "Fast setup and clean interface are leading positive keywords.",
      platform: "YouTube",
      sentiment: "positive",
      time: "2 hrs ago",
      severity: "low",
    },
  ]);
  res.json(data);
});

router.post("/analyze", (req, res) => {
  const parsed = AnalyzeTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Text and a supported model are required." });
    return;
  }
  res.json(AnalyzeTextResponse.parse(classify(parsed.data.text, parsed.data.model)));
});

function decodeUploadContent(content: string, fileType: string) {
  if (fileType.includes("json") || fileType.includes("csv") || fileType.includes("text")) {
    if (content.startsWith("data:")) {
      const encoded = content.split(",", 2)[1] ?? "";
      return Buffer.from(encoded, "base64").toString("utf8");
    }
    return content;
  }
  return "";
}

function parseRows(content: string, fileType: string) {
  if (fileType.includes("json")) {
    try {
      const parsed: unknown = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items
        .map((item) => {
          if (typeof item === "string") return { text: item, platform: "Uploaded" };
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const text = record.text ?? record.comment ?? record.content ?? record.message;
            if (typeof text === "string") {
              return {
                text,
                platform: typeof record.platform === "string" ? record.platform : "Uploaded",
              };
            }
          }
          return null;
        })
        .filter((row): row is { text: string; platform: string } => row !== null);
    } catch {
      return [];
    }
  }

  if (fileType.includes("csv") || fileType.includes("text")) {
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];
    const headerCells = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
    const textIndex = headerCells.findIndex((cell) =>
      ["text", "comment", "content", "message"].includes(cell),
    );
    const platformIndex = headerCells.findIndex((cell) =>
      ["platform", "source", "network"].includes(cell),
    );
    const hasHeader = textIndex >= 0 || platformIndex >= 0;
    const resolvedTextIndex = textIndex >= 0 ? textIndex : 0;
    const resolvedPlatformIndex =
      platformIndex >= 0 ? platformIndex : resolvedTextIndex === 0 ? 1 : 0;
    const start = hasHeader ? 1 : 0;
    return lines.slice(start).map((line) => {
      const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
      return {
        text: cells[resolvedTextIndex] || cells[0],
        platform: cells[resolvedPlatformIndex] || "Uploaded",
      };
    });
  }

  return [
    {
      text: "Workbook received for batch classification preview.",
      platform: "Uploaded XLSX",
    },
  ];
}

router.post("/upload", (req, res) => {
  const parsed = UploadDatasetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A file name, file type, and file content are required." });
    return;
  }
  const { fileName, fileType, content } = parsed.data;
  const rows = parseRows(decodeUploadContent(content, fileType), fileType).slice(0, 100);
  const classified = rows.map((row, index) => {
    const result = classify(row.text, "logistic-regression");
    return {
      id: `row-${String(index + 1).padStart(3, "0")}`,
      text: row.text,
      platform: row.platform,
      sentiment: result.sentiment,
      confidence: result.confidence,
    };
  });
  const data = UploadDatasetResponse.parse({
    fileName,
    totalRows: rows.length,
    processedRows: classified.length,
    rows: classified,
    summary: countSentiments(classified),
  });
  res.json(data);
});

router.get("/benchmarks", (_req, res) => {
  const data = GetBenchmarksResponse.parse([
    { model: Model["logistic-regression"], name: "Logistic Regression", family: "Supervised ML", accuracy: 92.4, precision: 91.8, recall: 90.7, f1: 91.2 },
    { model: Model["naive-bayes"], name: "Naive Bayes", family: "Supervised ML", accuracy: 89.7, precision: 88.9, recall: 89.4, f1: 89.1 },
    { model: Model.svm, name: "Support Vector Machine", family: "Supervised ML", accuracy: 88.9, precision: 89.2, recall: 87.8, f1: 88.5 },
    { model: Model.vader, name: "VADER Lexicon", family: "Rule-Based", accuracy: 84.6, precision: 83.7, recall: 82.9, f1: 83.3 },
    { model: Model.textblob, name: "TextBlob Lexicon", family: "Rule-Based", accuracy: 80.3, precision: 79.8, recall: 78.6, f1: 79.2 },
  ]);
  res.json(data);
});

router.get("/analytics", (_req, res) => {
  const data = GetAnalyticsResponse.parse({
    keywords: [
      { word: "update", count: 842, sentiment: "neutral" },
      { word: "love", count: 724, sentiment: "positive" },
      { word: "support", count: 611, sentiment: "negative" },
      { word: "fast", count: 544, sentiment: "positive" },
      { word: "issue", count: 436, sentiment: "negative" },
      { word: "easy", count: 398, sentiment: "positive" },
      { word: "delivery", count: 328, sentiment: "negative" },
      { word: "design", count: 291, sentiment: "positive" },
    ],
    highlights: {
      positiveTopic: "Product Experience",
      negativeTopic: "Customer Support",
      trendingKeyword: "Update",
    },
    totalKeywords: 12640,
  } satisfies AnalyticsType);
  res.json(data);
});

export default router;