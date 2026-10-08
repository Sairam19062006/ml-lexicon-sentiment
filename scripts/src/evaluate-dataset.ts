import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../..");
const datasetPath = path.resolve(workspaceRoot, "datasets/sentiment_benchmark_dataset.json");

interface DatasetItem {
  id: string;
  text: string;
  platform: string;
  groundTruth: "positive" | "negative" | "neutral";
  category: string;
}

interface AnalysisResult {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  polarity: number;
  model: string;
  keywords: Array<{ word: string; count: number; sentiment: string }>;
  explanation: string;
}

const API_BASE = process.env.API_BASE || "http://localhost:5000/api";
const MODELS = ["logistic-regression", "naive-bayes", "svm", "vader", "textblob"] as const;

async function runFetch<T>(endpoint: string, options: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = (await res.json().catch(() => null)) as T;
  return { status: res.status, data };
}

// ---------------------------------------------------------
// Constraint 1: API Boundary & Input Validation Tests
// ---------------------------------------------------------
async function testSystemConstraints() {
  console.log("\n========================================================");
  console.log("  PART 1: SYSTEM & SCHEMA CONSTRAINT VERIFICATION");
  console.log("========================================================\n");

  const constraints: Array<{ name: string; passed: boolean; detail: string }> = [];

  // Test 1: Empty text rejection
  const emptyTextRes = await runFetch<any>("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "", model: "logistic-regression" }),
  });
  constraints.push({
    name: "Constraint 1.1: Reject Empty String",
    passed: emptyTextRes.status === 400,
    detail: `HTTP status: ${emptyTextRes.status} (expected 400), response: ${JSON.stringify(emptyTextRes.data)}`,
  });

  // Test 2: Invalid Model Name rejection
  const invalidModelRes = await runFetch<any>("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Super clean interface", model: "unsupported-gpt-model" }),
  });
  constraints.push({
    name: "Constraint 1.2: Reject Invalid Model Enum",
    passed: invalidModelRes.status === 400,
    detail: `HTTP status: ${invalidModelRes.status} (expected 400)`,
  });

  // Test 3: Output Schema Conformance on valid payload
  const validRes = await runFetch<AnalysisResult>("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "The system is remarkably fast, reliable, and clean!", model: "vader" }),
  });
  const data = validRes.data;
  const isSchemaValid =
    validRes.status === 200 &&
    ["positive", "negative", "neutral"].includes(data.sentiment) &&
    typeof data.confidence === "number" &&
    data.confidence >= 0.5 &&
    data.confidence <= 1.0 &&
    typeof data.polarity === "number" &&
    data.polarity >= -1.0 &&
    data.polarity <= 1.0 &&
    Array.isArray(data.keywords) &&
    typeof data.explanation === "string" &&
    data.explanation.length > 0;

  constraints.push({
    name: "Constraint 1.3: Output Contract & Value Ranges",
    passed: isSchemaValid,
    detail: `Confidence: ${data?.confidence} ∈ [0.5, 1.0], Polarity: ${data?.polarity} ∈ [-1.0, 1.0], Sentiment: ${data?.sentiment}`,
  });

  // Test 4: CSV Upload Ingestion with quoted internal commas
  const sampleCsv = `text,platform\n"Fast, reliable and clean design!",Twitter\n"Broken, buggy and slow support",Reddit`;
  const uploadCsvRes = await runFetch<any>("/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: "test.csv", fileType: "text/csv", content: sampleCsv }),
  });
  const csvPassed =
    uploadCsvRes.status === 200 &&
    uploadCsvRes.data.totalRows === 2 &&
    uploadCsvRes.data.rows[0].text === "Fast, reliable and clean design!" &&
    uploadCsvRes.data.rows[0].platform === "Twitter";

  constraints.push({
    name: "Constraint 1.4: Batch CSV Ingestion & Quote Escaping",
    passed: csvPassed,
    detail: `Total processed: ${uploadCsvRes.data?.processedRows}/2, Preserved quoted commas: ${csvPassed}`,
  });

  // Test 5: JSON Upload Ingestion
  const sampleJson = JSON.stringify([
    { text: "Great product", platform: "Instagram" },
    { text: "Terrible lag", platform: "YouTube" },
  ]);
  const uploadJsonRes = await runFetch<any>("/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: "test.json", fileType: "application/json", content: sampleJson }),
  });
  const jsonPassed = uploadJsonRes.status === 200 && uploadJsonRes.data.totalRows === 2;

  constraints.push({
    name: "Constraint 1.5: Batch JSON Structure Ingestion",
    passed: jsonPassed,
    detail: `Total processed: ${uploadJsonRes.data?.processedRows}/2`,
  });

  for (const c of constraints) {
    const symbol = c.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${symbol} | ${c.name}`);
    console.log(`       └─ ${c.detail}`);
  }

  return constraints;
}

// ---------------------------------------------------------
// Constraint 2: Model Evaluation Against Benchmark Dataset
// ---------------------------------------------------------
interface Metrics {
  model: string;
  total: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  classMetrics: Record<string, { precision: number; recall: number; f1: number; support: number }>;
  confusionMatrix: Record<string, Record<string, number>>;
  categoryBreakdown: Record<string, { correct: number; total: number; accuracy: number }>;
}

async function evaluateDataset(): Promise<Record<string, Metrics>> {
  const rawData = fs.readFileSync(datasetPath, "utf-8");
  const dataset: DatasetItem[] = JSON.parse(rawData);

  console.log("\n========================================================");
  console.log(`  PART 2: EVALUATING DATASET (${dataset.length} LABELED SAMPLES)`);
  console.log("========================================================\n");

  const resultsByModel: Record<string, Metrics> = {};
  const classes: Array<"positive" | "negative" | "neutral"> = ["positive", "negative", "neutral"];

  for (const model of MODELS) {
    // Confusion Matrix: cm[actual][predicted]
    const cm: Record<string, Record<string, number>> = {
      positive: { positive: 0, negative: 0, neutral: 0 },
      negative: { positive: 0, negative: 0, neutral: 0 },
      neutral: { positive: 0, negative: 0, neutral: 0 },
    };

    const categoryStats: Record<string, { correct: number; total: number }> = {};

    let totalCorrect = 0;

    for (const item of dataset) {
      const res = await runFetch<AnalysisResult>("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, model }),
      });

      const predicted = res.data.sentiment;
      const actual = item.groundTruth;

      cm[actual][predicted] = (cm[actual][predicted] || 0) + 1;
      const isCorrect = predicted === actual;
      if (isCorrect) totalCorrect++;

      if (!categoryStats[item.category]) {
        categoryStats[item.category] = { correct: 0, total: 0 };
      }
      categoryStats[item.category].total += 1;
      if (isCorrect) categoryStats[item.category].correct += 1;
    }

    // Compute Per-Class Precision, Recall, F1
    const classMetrics: Record<string, { precision: number; recall: number; f1: number; support: number }> = {};
    let sumP = 0;
    let sumR = 0;
    let sumF1 = 0;

    for (const cls of classes) {
      const tp = cm[cls][cls];
      const fn = classes.reduce((sum, other) => (other !== cls ? sum + cm[cls][other] : sum), 0);
      const fp = classes.reduce((sum, other) => (other !== cls ? sum + cm[other][cls] : sum), 0);
      const support = tp + fn;

      const p = tp + fp > 0 ? tp / (tp + fp) : 0;
      const r = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = p + r > 0 ? (2 * p * r) / (p + r) : 0;

      classMetrics[cls] = { precision: p, recall: r, f1: f1, support };
      sumP += p;
      sumR += r;
      sumF1 += f1;
    }

    const macroP = sumP / classes.length;
    const macroR = sumR / classes.length;
    const macroF1 = sumF1 / classes.length;
    const overallAcc = totalCorrect / dataset.length;

    const categoryBreakdown: Record<string, { correct: number; total: number; accuracy: number }> = {};
    for (const [cat, stats] of Object.entries(categoryStats)) {
      categoryBreakdown[cat] = {
        correct: stats.correct,
        total: stats.total,
        accuracy: (stats.correct / stats.total) * 100,
      };
    }

    resultsByModel[model] = {
      model,
      total: dataset.length,
      accuracy: overallAcc * 100,
      precision: macroP * 100,
      recall: macroR * 100,
      f1: macroF1 * 100,
      classMetrics,
      confusionMatrix: cm,
      categoryBreakdown,
    };
  }

  // Print Summary Table
  console.log("----------------------------------------------------------------------------------");
  console.log("| Model Name             | Accuracy | Macro Prec | Macro Rec  | Macro F1   | Status   |");
  console.log("----------------------------------------------------------------------------------");
  for (const m of MODELS) {
    const r = resultsByModel[m];
    const status = r.accuracy >= 80 ? "EXCELLENT" : r.accuracy >= 70 ? "GOOD" : "NEEDS WORK";
    console.log(
      `| ${m.padEnd(22)} | ${r.accuracy.toFixed(1).padStart(7)}% | ${r.precision.toFixed(1).padStart(9)}% | ${r.recall.toFixed(1).padStart(9)}% | ${r.f1.toFixed(1).padStart(9)}% | ${status.padEnd(8)} |`
    );
  }
  console.log("----------------------------------------------------------------------------------\n");

  // Print Confusion Matrix for Top Model
  const topModel = Object.values(resultsByModel).sort((a, b) => b.f1 - a.f1)[0];
  console.log(`Confusion Matrix for Top Performer: [${topModel.model}]`);
  console.log("Actual \\ Pred  | Positive | Negative | Neutral |");
  console.log("----------------------------------------------");
  for (const actual of classes) {
    const row = topModel.confusionMatrix[actual];
    console.log(
      `${actual.padEnd(14)} | ${String(row.positive).padStart(8)} | ${String(row.negative).padStart(8)} | ${String(row.neutral).padStart(7)} |`
    );
  }
  console.log("\nCategory Accuracy Breakdown for Top Model:");
  for (const [cat, stats] of Object.entries(topModel.categoryBreakdown)) {
    console.log(`  - ${cat.padEnd(24)}: ${stats.correct}/${stats.total} (${stats.accuracy.toFixed(1)}%)`);
  }

  return resultsByModel;
}

async function main() {
  try {
    const constraints = await testSystemConstraints();
    const evaluation = await evaluateDataset();
    console.log("\n✓ Evaluation and constraint analysis completed successfully!\n");
  } catch (error) {
    console.error("Evaluation failed with error:", error);
    process.exit(1);
  }
}

main();
