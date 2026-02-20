const { GoogleAuth } = require("google-auth-library");

const PROJECT_ID = process.env.GCP_PROJECT_ID || "macbook-488008";
const LOCATION = process.env.GCP_LOCATION || "us-central1";
const MODEL_ID = "gemini-2.5-flash";
const ENDPOINT = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:generateContent`;

const SYSTEM_PROMPT = `你是 Bloom AI 的核心教学引擎，一个基于 Benjamin Bloom 的 2 Sigma 研究设计的 AI 导师。

## 你的核心原则
1. **掌握学习法**：确保学习者对当前内容达到 80-90% 的理解度，才推进到下一个难度级别。
2. **一对一辅导模式**：你主动发起定制化提问，学习者只需要回答你的问题。
3. **难度自适应**：根据学习者的回答质量，精准调节下一份学习文档的难度。
4. **苏格拉底式引导**：不直接告诉答案，而是通过提问引导思考。

## 输出格式要求
你必须返回一个 JSON 对象，格式如下（不要包含 markdown 代码块标记）：
{
  "title": "学习文档标题",
  "content": "HTML 格式的学习内容，使用 <h3>、<p>、<strong>、<ul>/<ol>/<li>、<blockquote> 等标签",
  "questions": ["诊断问题1", "诊断问题2", "诊断问题3"],
  "difficultyLevel": 1-10,
  "masteryEstimate": 0-100
}

## 内容生成规则
- 每份文档 600-1000 字
- 内容必须有深度，不能浮于表面
- 使用类比和比喻让抽象概念具体化
- 在关键概念处使用 <strong> 加粗
- 诊断问题必须是开放性的思考题，测试理解深度而非记忆能力`;

async function getAccessToken() {
    const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
    // Fix: Ensure newlines in private_key are correctly unescaped
    if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
}

module.exports = async (req, res) => {
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).end();
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        const { topic, docNumber, previousAnswers, previousQuestions } = req.body;
        if (!topic) return res.status(400).json({ error: "Topic is required" });

        let userMessage = "";
        if (docNumber === 1 || !previousAnswers) {
            userMessage = `请为以下主题生成第一份入门级学习文档。\n\n主题：${topic}\n\n这是学习者的第一份文档，你还不了解他们的水平。请从中等入门难度开始，涵盖该领域最核心的基础概念。在诊断问题中，设计能帮助你判断学习者当前水平的问题。`;
        } else {
            userMessage = `请为以下主题生成第 ${docNumber} 份学习文档。\n\n主题：${topic}\n\n学习者之前回答的诊断问题和答案如下：\n${previousQuestions.map((q, i) => `问题 ${i + 1}：${q}\n答案 ${i + 1}：${previousAnswers[i] || "（未回答）"}`).join("\n\n")}\n\n请根据以上回答分析学习者的理解深度，然后：\n- 如果回答显示出良好的理解 → 提升难度\n- 如果回答显示出理解不足 → 降低难度，用新的类比和角度重新解释\n- 如果回答混合 → 针对性地补强薄弱环节\n\n生成下一份难度合适的学习文档和新的诊断问题。`;
        }

        const accessToken = await getAccessToken();
        const response = await fetch(ENDPOINT, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: userMessage }] }],
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 4096, responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vertex AI error:", response.status, errorText);
            return res.status(502).json({ error: "AI service error", details: `Status ${response.status}` });
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        let parsedContent;
        try {
            const cleanText = generatedText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
            parsedContent = JSON.parse(cleanText);
        } catch (parseError) {
            console.error("JSON parse error:", parseError, "Raw:", generatedText);
            parsedContent = {
                title: `${topic} - 学习文档 #${docNumber}`,
                content: `<p>${generatedText.replace(/\n/g, "</p><p>")}</p>`,
                questions: ["你能用自己的话概括核心概念吗？", "哪些部分你觉得还不够清晰？", "你能举一个实际的例子吗？"],
                difficultyLevel: docNumber, masteryEstimate: 0
            };
        }

        return res.status(200).json(parsedContent);
    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: "Internal server error", message: error.message });
    }
};