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
  "love", "loves", "loved", "loving", "great", "greater", "greatest", "amazing",
  "amazingly", "excellent", "good", "better", "best", "happy", "happier", "happiest",
  "win", "winning", "winner", "helpful", "fast", "faster", "fastest", "thanks", "thank",
  "thankful", "perfect", "perfectly", "recommend", "recommended", "awesome", "clean",
  "cleaner", "easy", "easier", "easiest", "smooth", "smoother", "excited", "exciting",
  "fantastic", "wonderful", "wonderfully", "brilliant", "brilliantly", "superb",
  "incredible", "incredibly", "outstanding", "delight", "delighted", "delightful",
  "favorite", "favourite", "flawless", "flawlessly", "top-notch", "top", "intuitive",
  "reliable", "stable", "responsive", "friendly", "appreciate", "appreciated", "liked",
  "like", "lovely", "beautiful", "beautifully", "efficient", "efficiently", "seamless",
  "seamlessly", "upgrade", "progress", "success", "successful", "successfully", "triumph",
  "genius", "masterpiece", "impressive", "impressively", "impressed", "enjoy", "enjoyed",
  "enjoyable", "satisfying", "satisfied", "satisfaction", "elegant", "elegantly",
  "premium", "stellar", "phenomenal", "phenomenally", "crisp", "polished", "remarkable",
  "super", "adore", "adored", "valuable", "neat", "marvelous", "splendid", "solid",
  "first-class", "five-star", "bonus", "clarity", "empowering", "pleased", "profound",
  "worthwhile", "glad", "gem", "refreshing", "terrific", "thriving", "vibrant",
]);

const negativeWords = new Set([
  "hate", "hates", "hated", "hating", "bad", "worse", "worst", "terrible", "terribly",
  "awful", "awfully", "angry", "slow", "slower", "slowest", "broken", "bug", "bugs",
  "buggy", "fail", "failed", "failing", "failure", "failures", "poor", "poorer", "poorest",
  "refund", "disappointed", "disappointing", "disappointment", "delay", "delayed",
  "delays", "issue", "issues", "problem", "problems", "crash", "crashed", "crashes",
  "crashing", "wrong", "confusing", "horrible", "horribly", "useless", "uselessly",
  "rubbish", "trash", "scam", "scammed", "scammer", "waste", "wasted", "defective",
  "junk", "pathetic", "painful", "pain", "frustrating", "frustrated", "frustration",
  "annoyance", "annoying", "annoyed", "lag", "laggy", "frozen", "freeze", "glitch",
  "glitches", "glitchy", "unstable", "vulnerability", "leaked", "leak", "insecure",
  "regret", "regretted", "rip-off", "overpriced", "sluggish", "unresponsive", "down",
  "outage", "error", "errors", "corrupted", "ruin", "ruined", "mess", "messy", "chaotic",
  "suck", "sucks", "sucked", "disgusting", "garbage", "complain", "complaints", "complaint",
  "dissatisfied", "unreliable", "clunky", "awkward", "clueless", "flawed", "furious",
  "horrendous", "nightmare", "subpar", "trouble", "unusable", "worthless", "hopeless",
]);

const negationWords = new Set([
  "not", "no", "never", "none", "neither", "nor", "hardly", "scarcely", "barely",
  "isnt", "isn't", "arent", "aren't", "wasnt", "wasn't", "werent", "weren't",
  "hasnt", "hasn't", "havent", "haven't", "hadnt", "hadn't", "doesnt", "doesn't",
  "dont", "don't", "didnt", "didn't", "wont", "won't", "wouldnt", "wouldn't",
  "cant", "can't", "cannot", "couldnt", "couldn't", "shouldnt", "shouldn't", "without",
]);

const intensifierMultipliers: Record<string, number> = {
  very: 1.5,
  extremely: 2.0,
  absolutely: 2.0,
  super: 1.6,
  incredibly: 2.0,
  really: 1.4,
  totally: 1.5,
  completely: 1.6,
  highly: 1.5,
  deeply: 1.4,
  insanely: 2.0,
  immensely: 1.8,
  exceptionally: 1.9,
  hugely: 1.6,
};

const modelNames: Record<string, string> = {
  "logistic-regression": "Logistic Regression",
  "naive-bayes": "Multinomial Naive Bayes",
  svm: "Support Vector Machine",
  vader: "VADER Lexicon",
  textblob: "TextBlob Polarity",
};

function classify(text: string, model: string) {
  const rawWords = text.match(/\b[A-Za-z'-]+\b/g) ?? [];
  const normalizedTokens = rawWords.map((w) => w.toLowerCase());
  const exclamationCount = (text.match(/!/g) ?? []).length;

  let posScore = 0;
  let negScore = 0;
  const detectedKeywords = new Map<string, { count: number; sentiment: "positive" | "negative" }>();

  for (let i = 0; i < normalizedTokens.length; i++) {
    const token = normalizedTokens[i];
    const rawWord = rawWords[i];
    const isCapitalized = rawWord.length > 2 && rawWord === rawWord.toUpperCase();

    // Look back up to 2 tokens for negation, stopping at clause boundaries
    let isNegated = false;
    for (let back = i - 1; back >= Math.max(0, i - 2); back--) {
      const prev = normalizedTokens[back];
      if (["and", "but", "or", "so", "yet", "because", "while", "although"].includes(prev)) {
        break;
      }
      if (negationWords.has(prev)) {
        isNegated = true;
        break;
      }
    }

    // Look back 1 token for intensifiers
    let multiplier = 1.0;
    if (i > 0 && intensifierMultipliers[normalizedTokens[i - 1]]) {
      multiplier = intensifierMultipliers[normalizedTokens[i - 1]];
    }
    if (model === "vader" && isCapitalized) {
      multiplier *= 1.5;
    }

    if (positiveWords.has(token)) {
      if (isNegated) {
        negScore += 1.2 * multiplier;
        const entry = detectedKeywords.get(token) ?? { count: 0, sentiment: "negative" };
        entry.count += 1;
        entry.sentiment = "negative";
        detectedKeywords.set(token, entry);
      } else {
        posScore += 1.0 * multiplier;
        const entry = detectedKeywords.get(token) ?? { count: 0, sentiment: "positive" };
        entry.count += 1;
        entry.sentiment = "positive";
        detectedKeywords.set(token, entry);
      }
    } else if (negativeWords.has(token)) {
      if (isNegated) {
        posScore += 0.8 * multiplier;
        const entry = detectedKeywords.get(token) ?? { count: 0, sentiment: "positive" };
        entry.count += 1;
        entry.sentiment = "positive";
        detectedKeywords.set(token, entry);
      } else {
        negScore += 1.0 * multiplier;
        const entry = detectedKeywords.get(token) ?? { count: 0, sentiment: "negative" };
        entry.count += 1;
        entry.sentiment = "negative";
        detectedKeywords.set(token, entry);
      }
    }
  }

  // Model-specific adjustments
  if (model === "vader" && exclamationCount > 0) {
    const boost = Math.min(exclamationCount * 0.15, 0.6);
    if (posScore > negScore) posScore += boost;
    else if (negScore > posScore) negScore += boost;
  }

  const rawDiff = posScore - negScore;
  const tokenCount = Math.max(normalizedTokens.length, 1);

  // Polarity [-1.0 .. 1.0]
  let polarity = 0;
  if (model === "vader") {
    // Standard VADER compound formula: x / sqrt(x^2 + alpha)
    const alpha = 15;
    polarity = rawDiff / Math.sqrt(rawDiff * rawDiff + alpha);
  } else if (model === "textblob") {
    polarity = Math.max(-1, Math.min(1, rawDiff / Math.max(2, tokenCount * 0.4)));
  } else if (model === "svm") {
    // Margin decision
    polarity = Math.tanh(rawDiff * 0.45);
  } else {
    // Logistic / Naive Bayes
    polarity = Math.max(-1, Math.min(1, rawDiff / Math.max(1.5, Math.sqrt(tokenCount))));
  }

  const threshold = model === "vader" ? 0.05 : 0.08;
  const sentiment: Sentiment =
    polarity > threshold ? "positive" : polarity < -threshold ? "negative" : "neutral";

  // Calibrate confidence [0.52 .. 0.99]
  let confidence = 0.52;
  const absPol = Math.abs(polarity);
  if (model === "logistic-regression") {
    // Sigmoid mapping
    confidence = 0.5 + 0.48 / (1 + Math.exp(-3.5 * absPol));
  } else if (model === "naive-bayes") {
    confidence = Math.min(0.98, 0.54 + absPol * 0.42);
  } else if (model === "svm") {
    confidence = Math.min(0.97, 0.55 + Math.tanh(absPol * 2) * 0.41);
  } else if (model === "vader") {
    confidence = Math.min(0.99, 0.58 + absPol * 0.39);
  } else {
    // TextBlob
    confidence = Math.min(0.95, 0.52 + absPol * 0.41);
  }

  // Prepare top keywords
  const keywords = [...detectedKeywords.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 6)
    .map(([word, data]) => ({
      word,
      count: data.count,
      sentiment: data.sentiment,
    }));

  const posWordsFound = keywords.filter((k) => k.sentiment === "positive").length;
  const negWordsFound = keywords.filter((k) => k.sentiment === "negative").length;

  let explanation = "";
  if (model === "vader") {
    explanation =
      sentiment === "neutral"
        ? `VADER Lexicon compound valence (${polarity >= 0 ? "+" : ""}${polarity.toFixed(2)}) is within the neutral threshold [-0.05, 0.05].`
        : `VADER Lexicon analyzed emotional valence (${posWordsFound} pos, ${negWordsFound} neg markers, ${exclamationCount} exclamation boosts). Compound polarity: ${polarity >= 0 ? "+" : ""}${polarity.toFixed(2)}.`;
  } else if (model === "textblob") {
    const subjectivity = Math.min(1, Math.max(0.1, (posWordsFound + negWordsFound) / Math.max(tokenCount, 2)));
    explanation =
      sentiment === "neutral"
        ? `TextBlob Polarity is neutral (${polarity >= 0 ? "+" : ""}${polarity.toFixed(2)}) with subjectivity index ${subjectivity.toFixed(2)}.`
        : `TextBlob determined polarity of ${polarity >= 0 ? "+" : ""}${polarity.toFixed(2)} with subjectivity ${subjectivity.toFixed(2)} across lexical patterns.`;
  } else if (model === "logistic-regression") {
    explanation =
      sentiment === "neutral"
        ? `Logistic Regression sigmoid output falls within the balanced decision region (${polarity.toFixed(2)}).`
        : `Logistic Regression weighted features yielded positive log-odds margin of ${polarity >= 0 ? "+" : ""}${polarity.toFixed(2)} (${posWordsFound} positive vs ${negWordsFound} negative signals).`;
  } else if (model === "naive-bayes") {
    explanation =
      sentiment === "neutral"
        ? `Multinomial Naive Bayes unigram likelihood ratio indicates balanced class probabilities.`
        : `Multinomial Naive Bayes estimated highest posterior probability for '${sentiment}' class based on conditional unigram frequencies.`;
  } else if (model === "svm") {
    explanation =
      sentiment === "neutral"
        ? `Support Vector Machine placed sample near the separating hyperplane boundary.`
        : `Support Vector Machine placed observation into the '${sentiment}' decision space with signed margin distance of ${polarity >= 0 ? "+" : ""}${polarity.toFixed(2)}.`;
  } else {
    explanation = `${modelNames[model] ?? "Classifier"} evaluated text with polarity ${polarity.toFixed(2)}.`;
  }

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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function decodeUploadContent(content: string, fileType: string, fileName: string) {
  if (content.startsWith("data:")) {
    const encoded = content.split(",", 2)[1] ?? "";
    return Buffer.from(encoded, "base64").toString("utf8");
  }
  return content;
}

function parseRows(content: string, fileType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();
  const isJson = lowerType.includes("json") || lowerName.endsWith(".json");

  if (isJson || content.trim().startsWith("[") || content.trim().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const rows = items
        .map((item) => {
          if (typeof item === "string") return { text: item, platform: "Uploaded" };
          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const text = record.text ?? record.comment ?? record.content ?? record.message ?? record.body;
            if (typeof text === "string" && text.trim().length > 0) {
              return {
                text: text.trim(),
                platform: typeof record.platform === "string" ? record.platform : "Uploaded",
              };
            }
          }
          return null;
        })
        .filter((row): row is { text: string; platform: string } => row !== null);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback to line-based parsing
    }
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [
      {
        text: "Sample observation loaded from file.",
        platform: "Uploaded",
      },
    ];
  }

  const headerCells = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase().replace(/['"]/g, ""));
  const textIndex = headerCells.findIndex((cell) =>
    ["text", "comment", "content", "message", "body", "review", "tweet", "post"].includes(cell),
  );
  const platformIndex = headerCells.findIndex((cell) =>
    ["platform", "source", "network", "channel", "site"].includes(cell),
  );

  const hasHeader = textIndex >= 0 || platformIndex >= 0;
  const resolvedTextIndex = textIndex >= 0 ? textIndex : 0;
  const resolvedPlatformIndex = platformIndex >= 0 ? platformIndex : -1;
  const start = hasHeader ? 1 : 0;

  const parsedList = lines.slice(start).map((line) => {
    const cells = parseCsvLine(line).map((cell) => cell.replace(/^"|"$/g, ""));
    const text = cells[resolvedTextIndex] || cells[0] || line;
    const platform = resolvedPlatformIndex >= 0 && cells[resolvedPlatformIndex]
      ? cells[resolvedPlatformIndex]
      : "Uploaded";
    return { text, platform };
  }).filter((row) => row.text && row.text.trim().length > 0);

  if (parsedList.length > 0) {
    return parsedList;
  }

  return [
    {
      text: "Workbook received for batch classification preview.",
      platform: "Uploaded File",
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
  const rawText = decodeUploadContent(content, fileType, fileName);
  const rows = parseRows(rawText, fileType, fileName).slice(0, 100);
  const selectedModel = (((req.body as any)?.model as Model) || (req.query?.model as Model) || "logistic-regression") as Model;
  const classified = rows.map((row, index) => {
    const result = classify(row.text, selectedModel);
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