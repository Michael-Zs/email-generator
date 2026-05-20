#!/usr/bin/env npx tsx
/**
 * 保研邮件生成器
 *
 * 用法：
 *   npx tsx src/gen.ts "导师简介文本"
 *   npx tsx src/gen.ts -i intro.txt
 *   npx tsx src/gen.ts --batch teachers.json
 */

import { config as dotenvConfig } from "dotenv";
import OpenAI from "openai";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");

dotenvConfig({ path: resolve(PROJECT_ROOT, ".env") });

const PROMPT_FILE = resolve(PROJECT_ROOT, "prompt.md");
const OUTPUT_DIR = resolve(PROJECT_ROOT, "emails");
const LIST_FILE = resolve(PROJECT_ROOT, "sent", "list.txt");

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4/";

interface GenerateResult {
  university: string;
  name: string;
  direction: string;
  email: string;
  subject: string;
  body: string;
}

// ── CLI ──────────────────────────────────────────────────────

function parseArgs(args: string[]): {
  intro?: string;
  batchFile?: string;
  model: string;
  addToList: boolean;
} {
  let introFile = "";
  let model = "glm-5.1";
  let addToList = false;
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-i": case "--intro": introFile = args[++i]; break;
      case "-m": case "--model": model = args[++i]; break;
      case "-l": addToList = true; break;
      case "--batch": return { batchFile: resolve(args[++i]), model, addToList };
      case "-h": case "--help":
        showHelp(); process.exit(0);
      default: positional.push(args[i]);
    }
  }

  const intro = introFile
    ? readFileSync(resolve(introFile), "utf-8")
    : positional.length > 0
      ? positional.join(" ")
      : readFileSync(0, "utf-8");

  if (!intro?.trim()) {
    showHelp();
    process.exit(1);
  }

  return { intro: intro.trim(), model, addToList };
}

function showHelp() {
  console.log(`
保研邮件生成器

用法：
  npx tsx src/gen.ts                （粘贴简介后 Ctrl+D）
  npx tsx src/gen.ts "导师简介文本"
  npx tsx src/gen.ts -i intro.txt
  npx tsx src/gen.ts --batch teachers.json

选项：
  -i, --intro       导师简介文件路径
  -m, --model       模型名称（默认：glm-4-flash）
  -l                生成后添加到 sent/list.txt
      --batch       批量模式，传入 JSON 文件

批量模式 JSON 格式（每项就是一段导师简介）：
  [
    "周小彬，南京大学，研究方向：空中机器人设计、运动规划...",
    "何祥坤，电子科技大学，研究方向：..."
  ]

示例：
  npx tsx src/gen.ts "周小彬，南京大学，研究方向：空中机器人、运动规划"
  npx tsx src/gen.ts -i intro.txt
  npx tsx src/gen.ts --batch teachers.json
`);
}

// ── List 检查 ────────────────────────────────────────────────

function readList(): string[] {
  if (!existsSync(LIST_FILE)) return [];
  return readFileSync(LIST_FILE, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function findInList(name: string): string | null {
  return readList().find((line) => line.includes(name)) ?? null;
}

function appendToList(entry: string) {
  const dir = dirname(LIST_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const lines = readList();
  lines.push(entry);
  writeFileSync(LIST_FILE, lines.join("\n") + "\n", "utf-8");
}

// ── 核心 ─────────────────────────────────────────────────────

function createClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: ZHIPU_BASE_URL });
}

const SYSTEM_PROMPT = [
  "你是一个专业的保研邮件写作助手。",
  "根据提供的导师简介、学生简历和邮件模板，生成一封定制化的保研申请邮件。",
  "",
  "你需要从导师简介中提取学校、姓名、研究方向，然后生成邮件。",
  "",
  "请严格以 JSON 格式输出以下字段：",
  '- "university": 学校简称（如：南大、电科、同济）',
  '- "name": 导师姓名',
  '- "direction": 研究方向（简要概括）',
  '- "email": 导师邮箱（从简介中提取，没有则为空字符串）',
  '- "subject": 邮件主题',
  '- "body": 邮件正文',
  "",
  "只输出 JSON，不要输出其他内容。",
].join("\n");

async function generate(intro: string, model: string): Promise<GenerateResult> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.error("错误：请设置 ZHIPU_API_KEY 环境变量");
    console.error("  export ZHIPU_API_KEY=your_key");
    process.exit(1);
  }

  const promptTemplate = readFileSync(PROMPT_FILE, "utf-8");
  const prompt = promptTemplate.replace(
    "<teacher_intro>\n\n</teacher_intro>",
    `<teacher_intro>\n${intro}\n</teacher_intro>`,
  );

  const client = createClient(apiKey);
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  let text = resp.choices[0].message.content?.trim() ?? "";

  if (text.includes("```json")) {
    text = text.split("```json")[1].split("```")[0].trim();
  } else if (text.includes("```")) {
    text = text.split("```")[1].split("```")[0].trim();
  }

  // GLM 可能在 JSON 字符串值里留原始换行，转义后再解析
  text = text.replace(/(?<=":[\s]*"[^"]*)\n/g, "\\n");

  try {
    return JSON.parse(text);
  } catch {
    console.error("原始返回：\n", text);
    throw new Error("LLM 返回的 JSON 无法解析");
  }
}

// ── 保存 ─────────────────────────────────────────────────────

function save(result: GenerateResult): string {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const filename = `${result.university}-${result.name}.md`;
  const filepath = resolve(OUTPUT_DIR, filename);
  const date = new Date().toISOString().split("T")[0];

  const content = [
    "---",
    `university: ${result.university}`,
    `name: ${result.name}`,
    `direction: ${result.direction}`,
    `email: ${result.email}`,
    `date: ${date}`,
    "---",
    "",
    "## Subject",
    "",
    result.subject,
    "",
    "## Body",
    "",
    result.body,
    "",
  ].join("\n");

  writeFileSync(filepath, content, "utf-8");
  return filepath;
}

// ── 输出 ─────────────────────────────────────────────────────

function printResult(filepath: string, r: GenerateResult) {
  const sep = "─".repeat(50);
  console.log(`已保存到：${filepath}\n`);
  console.log(sep);
  console.log(`Subject: ${r.subject}`);
  console.log(sep);
  console.log(r.body);
  console.log(sep);
}

// ── 批量 ─────────────────────────────────────────────────────

async function runBatch(batchFile: string, model: string) {
  const intros: string[] = JSON.parse(readFileSync(batchFile, "utf-8"));

  for (const intro of intros) {
    process.stderr.write(`\n▶ 处理中...\n`);
    try {
      const result = await generate(intro, model);
      const filepath = save(result);
      printResult(filepath, result);
    } catch (err: any) {
      console.error(`  ✗ 失败：${err.message}`);
    }
  }
}

// ── 入口 ─────────────────────────────────────────────────────

async function main() {
  const { intro, batchFile, model, addToList } = parseArgs(process.argv.slice(2));

  if (batchFile) return runBatch(batchFile, model);

  process.stderr.write("正在生成邮件...\n");

  try {
    const result = await generate(intro!, model);

    const existing = findInList(result.name);
    if (existing) {
      console.error(`已在列表中：${existing}，跳过生成`);
      process.exit(0);
    }

    const filepath = save(result);
    printResult(filepath, result);

    if (addToList) {
      appendToList(`${result.university}-${result.name}`);
      console.error(`已添加到 sent/list.txt`);
    }
  } catch (err: any) {
    console.error(err.status
      ? `API 错误 (${err.status}): ${err.message}`
      : `错误：${err.message}`);
    process.exit(1);
  }
}

main();
