# Bloom AI 🌱

基于 Benjamin Bloom 2 Sigma 理论的 AI 交互式学习平台

## 简介

Bloom AI 将教育心理学家 Benjamin Bloom 的 2 Sigma 研究与 AI 大模型结合，让每个人都能享受一对一定制化辅导，学习效率超越 98% 的人。

## 核心原理

1984 年，Benjamin Bloom 证明了：**一对一辅导 + 掌握学习法** 可以让学生领先平均值两个标准差（2 Sigma），即超越 98% 的同龄人。

Bloom AI 将这套方法产品化：
- 输入任何想学的主题
- AI 生成定制化学习文档
- 回答诊断问题
- AI 根据回答自动调整难度
- 循环递进，快速掌握

## 技术栈

- **前端**: HTML + CSS + JavaScript (原生)
- **后端**: Vercel Serverless Functions
- **AI**: Google Vertex AI (Gemini 2.0 Flash)
- **部署**: Vercel

## 本地开发

```bash
npm install
# 设置环境变量后
vercel dev
```

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `GCP_SERVICE_ACCOUNT_KEY` | Google Cloud 服务账号 JSON |
| `GCP_PROJECT_ID` | Google Cloud 项目 ID |
| `GCP_LOCATION` | Vertex AI 区域 (默认 us-central1) |
