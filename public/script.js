/* ============================================
   Bloom AI — Interactive Logic (with Vertex AI)
   ============================================ */
let appState = { topic: "", currentDoc: 0, mastery: 0, lastQuestions: [], lastAnswer: "", isUsingAI: true };
const FALLBACK_DOCUMENTS = [{ title: "topic_placeholder 入门指南", content: '<h3>什么是 topic_placeholder？</h3><p>让我们从最基础的概念开始。在这份定制化学习文档中，我将为你建立对该领域的<strong>基本认知框架</strong>。</p><h3>核心概念</h3><p>每个领域都有它的<strong>第一性原理</strong>——最基本的、不可再分的概念基石。</p><p>AI 交互式学习的优势在于：</p><ul><li>根据你的反馈精准调节难度</li><li>不浪费时间在你已经掌握的内容上</li><li>不跳过你还不理解的内容</li><li>始终保持在你的「最近发展区」学习</li></ul><h3>学习路径规划</h3><p>根据 Benjamin Bloom 的 2 Sigma 理论，掌握学习法的关键是：<strong>确保你对当前内容达到 80-90% 的理解度之后，再进入下一阶段</strong>。请认真回答下面的诊断问题。</p>', questions: ["你目前对 topic_placeholder 这个领域的了解程度如何？", "你学习这个主题的目标是什么？", "在你接触 topic_placeholder 的过程中，有没有什么特别困惑的问题？"], difficultyLevel: 1, masteryEstimate: 0 }];

document.addEventListener("DOMContentLoaded", () => { initNavbar(); initAnimations(); initStatsCounter(); initApp(); });

function initNavbar() {
    const navbar = document.getElementById("navbar");
    window.addEventListener("scroll", () => { navbar.classList.toggle("scrolled", window.scrollY > 50); });
}

function initAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add("visible");
                    entry.target.querySelectorAll(".bar").forEach((bar) => { setTimeout(() => { bar.style.width = bar.dataset.width + "%"; }, 300); });
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });
    document.querySelectorAll("[data-animate]").forEach((el) => observer.observe(el));
}

function initStatsCounter() {
    const observer = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { animateCounters(); observer.unobserve(entry.target); } }); }, { threshold: 0.5 });
    const s = document.querySelector(".hero-stats"); if (s) observer.observe(s);
}

function animateCounters() {
    document.querySelectorAll(".stat-value").forEach((counter) => {
        const target = parseInt(counter.dataset.target), duration = 2000, startTime = performance.now();
        function update(t) { const p = Math.min((t - startTime) / duration, 1); counter.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(update); }
        requestAnimationFrame(update);
    });
}

function initApp() {
    const startBtn = document.getElementById("start-btn"), topicInput = document.getElementById("topic-input"), submitAnswer = document.getElementById("submit-answer");
    if (startBtn) startBtn.addEventListener("click", startLearning);
    if (topicInput) topicInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startLearning(); });
    if (submitAnswer) submitAnswer.addEventListener("click", handleAnswer);
    document.querySelectorAll(".topic-tag").forEach((tag) => { tag.addEventListener("click", () => { topicInput.value = tag.dataset.topic; topicInput.focus(); }); });
}

function startLearning() {
    const topicInput = document.getElementById("topic-input"), topic = topicInput.value.trim();
    if (!topic) { topicInput.style.borderColor = "#ef4444"; setTimeout(() => { topicInput.style.borderColor = ""; }, 1500); return; }
    appState = { topic, currentDoc: 0, mastery: 0, lastQuestions: [], lastAnswer: "", isUsingAI: true };
    generateDocument();
}

async function generateDocument() {
    showLoading();
    const docNumber = appState.currentDoc + 1;
    try {
        const response = await fetch("/api/generate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic: appState.topic, docNumber, previousAnswers: appState.lastAnswer ? [appState.lastAnswer] : null, previousQuestions: appState.lastQuestions.length > 0 ? appState.lastQuestions : null })
        });
        if (!response.ok) throw new Error("API " + response.status);
        const doc = await response.json();
        if (doc.error) throw new Error(doc.error);
        if (doc.masteryEstimate !== undefined) appState.mastery = doc.masteryEstimate;
        showDocument(doc);
    } catch (error) {
        console.warn("AI API failed, using fallback:", error.message);
        appState.isUsingAI = false;
        const f = FALLBACK_DOCUMENTS[0];
        showDocument({ title: f.title.replace(/topic_placeholder/g, appState.topic), content: f.content.replace(/topic_placeholder/g, appState.topic), questions: f.questions.map(q => q.replace(/topic_placeholder/g, appState.topic)), difficultyLevel: f.difficultyLevel, masteryEstimate: f.masteryEstimate });
    }
}

function showLoading() {
    const s1 = document.getElementById("app-step-1"), s2 = document.getElementById("app-step-2"), ld = document.getElementById("app-loading");
    if (s1) s1.classList.add("hidden"); if (s2) s2.classList.add("hidden"); if (ld) ld.classList.remove("hidden");
}

function showDocument(doc) {
    const ld = document.getElementById("app-loading"); if (ld) ld.classList.add("hidden");
    const step2 = document.getElementById("app-step-2"), docBody = document.getElementById("doc-body"), questionsList = document.getElementById("questions-list"), answerInput = document.getElementById("answer-input");
    document.getElementById("doc-number").textContent = appState.currentDoc + 1;
    document.getElementById("doc-topic").textContent = appState.topic;
    docBody.innerHTML = doc.content;
    answerInput.value = "";
    appState.lastQuestions = doc.questions || [];
    questionsList.innerHTML = "";
    (doc.questions || []).forEach((q, i) => { const item = document.createElement("div"); item.className = "question-item"; item.innerHTML = '<div class="question-number">' + (i+1) + '</div><div class="question-text">' + q + '</div>'; questionsList.appendChild(item); });
    const mp = Math.min(appState.mastery, 100);
    document.getElementById("progress-fill").style.width = mp + "%";
    document.getElementById("progress-text").textContent = "掌握度: " + mp + "%";
    const eb = document.querySelector('.ai-status-badge'); if (eb) eb.remove();
    const badge = document.createElement('span'); badge.className = 'ai-status-badge';
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:0.7rem;padding:4px 10px;border-radius:100px;margin-left:8px;' + (appState.isUsingAI ? 'background:rgba(34,197,94,0.1);color:#22c55e;border:1px solid rgba(34,197,94,0.2);' : 'background:rgba(250,204,21,0.1);color:#facc15;border:1px solid rgba(250,204,21,0.2);');
    badge.textContent = appState.isUsingAI ? '✦ AI 实时生成' : '⚡ 演示模式';
    const dm = document.querySelector('.doc-meta'); if (dm) dm.appendChild(badge);
    step2.classList.remove("hidden");
    document.getElementById("demo").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleAnswer() {
    const answerInput = document.getElementById("answer-input"), answer = answerInput.value.trim();
    if (!answer) { answerInput.style.borderColor = "#ef4444"; setTimeout(() => { answerInput.style.borderColor = ""; }, 1500); return; }
    appState.lastAnswer = answer; appState.currentDoc++;
    generateDocument();
}

function resetApp() {
    appState = { topic: "", currentDoc: 0, mastery: 0, lastQuestions: [], lastAnswer: "", isUsingAI: true };
    const ac = document.querySelector(".app-container");
    if (ac && ac.dataset.original) { ac.innerHTML = ac.dataset.original; initApp(); }
    const s1 = document.getElementById("app-step-1"), s2 = document.getElementById("app-step-2"), ld = document.getElementById("app-loading"), ti = document.getElementById("topic-input");
    if (s1) s1.classList.remove("hidden"); if (s2) s2.classList.add("hidden"); if (ld) ld.classList.add("hidden"); if (ti) ti.value = "";
}

document.addEventListener("click", (e) => { const link = e.target.closest('a[href^="#"]'); if (link) { e.preventDefault(); const t = document.querySelector(link.getAttribute("href")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); } });