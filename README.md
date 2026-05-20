# 保研邮件生成器

根据导师简介、学生简历和邮件模板，通过智谱 AI (GLM) 自动生成定制化的保研申请邮件。

## 快速开始

```bash
# 1. 安装依赖
cd gen-email && npm install

# 2. 配置 API Key
echo "ZHIPU_API_KEY=your_key" > ../.env

# 3. 编辑个人信息
# 修改 prompt.md 中的 <resume_doc> 和 <email_template>

# 4. 生成邮件
npx tsx src/gen.ts "周小彬，南京大学，研究方向：空中机器人、运动规划"
```

## 用法

```bash
# 命令行传入导师简介
npx tsx src/gen.ts "导师简介文本"

# 从文件读取简介
npx tsx src/gen.ts -i intro.txt

# 标准输入（粘贴后 Ctrl+D）
npx tsx src/gen.ts

# 生成后自动记录到 sent/list.txt（避免重复）
npx tsx src/gen.ts -l

# 批量模式（JSON 数组文件）
npx tsx src/gen.ts --batch teachers.json

# 指定模型
npx tsx src/gen.ts -m glm-4-flash "导师简介"
```

## 项目结构

```
.
├── .env              # API Key（不纳入版本控制）
├── prompt.md         # 简历 + 邮件模板
├── run.sh            # 快捷运行脚本
├── gen-email/
│   ├── src/gen.ts    # 核心逻辑
│   └── package.json
├── emails/           # 生成的邮件（自动创建）
└── sent/list.txt     # 已处理导师记录（自动创建）
```

## 自定义

编辑 `prompt.md` 填入个人信息：

- `<resume_doc>` — 个人简历
- `<email_template>` — 邮件模板
- 底部附上生成要求说明
