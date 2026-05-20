# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

保研邮件生成器 — 根据导师简介、学生简历和邮件模板，通过智谱 AI (GLM) API 批量生成定制化的保研申请邮件。

## 运行命令

```bash
# 安装依赖
cd gen-email && npm install

# 单个导师 — 命令行传入简介文本
npx tsx src/gen.ts "导师简介文本"

# 单个导师 — 从文件读取简介
npx tsx src/gen.ts -i intro.txt

# 单个导师 — 标准输入粘贴后 Ctrl+D
npx tsx src/gen.ts

# 单个导师 — 生成后自动记录到 sent/list.txt（避免重复生成）
npx tsx src/gen.ts -l

# 批量模式 — 传入 JSON 数组文件
npx tsx src/gen.ts --batch teachers.json

# 切换模型
npx tsx src/gen.ts -m glm-4-flash "导师简介"
```

## 架构

项目结构简单，核心逻辑集中在 `gen-email/src/gen.ts` 一个文件中：

- **入口**：`gen.ts` 解析 CLI 参数，决定单条或批量模式
- **API 调用**：通过 OpenAI SDK 兼容接口调用智谱 API（baseURL: `https://open.bigmodel.cn/api/paas/v4/`）
- **Prompt 组装**：读取 `prompt.md` 模板，将导师简介填入 `<teacher_intro>` 标签
- **输出解析**：LLM 返回 JSON（含 university/name/direction/email/subject/body），经清洗后解析
- **文件保存**：生成结果写入 `emails/{学校}-{姓名}.md`（YAML frontmatter + 邮件内容）
- **去重机制**：`sent/list.txt` 记录已处理的导师，避免重复生成

环境变量 `ZHIPU_API_KEY` 在 `.env` 中配置，运行时由 dotenv 加载。
