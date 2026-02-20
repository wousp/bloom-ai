/* ============================================
   Bloom AI — Interactive Logic (with Vertex AI)
   ============================================ */

// === App State ===
let appState = {
    topic: "",
    currentDoc: 0,
    mastery: 0,
    lastQuestions: [],
    lastAnswer: "",
    isUsingAI: true,
    sessionId: null, // Supabase session ID
};

// === Fallback content for when API is unavailable ===
const FALLBACK_DOCUMENTS = [
    {
        title: "topic_placeholder 入门指南",
        content: `<h3>什么是 topic_placeholder？</h3>
<p>让我们从最基础的概念开始。在这份定制化学习文档中，我将为你建立对该领域的<strong>基本认知框架</strong>。</p>
<h3>核心概念</h3>
<p>每个领域都有它的<strong>第一性原理</strong>——最基本的、不可再分的概念基石。在学习任何新领域时，首先要识别出这些基石，然后在它们之上构建更复杂的理解。</p>
<p>AI 交互式学习的优势在于：</p>
<ul>
<li>根据你的反馈精准调节难度</li>
<li>不浪费时间在你已经掌握的内容上</li>
<li>不跳过你还不理解的内容</li>
<li>始终保持在你的「最近发展区」学习</li>
</ul>
<h3>学习路径规划</h3>
<p>根据 Benjamin Bloom 的 2 Sigma 理论，掌握学习法的关键是：<strong>确保你对当前内容达到 80-90% 的理解度之后，再进入下一阶段</strong>。请认真回答下面的诊断问题——你的回答将决定下一份文档的难度和方向。</p>`,
        questions: [
            "你目前对 topic_placeholder 这个领域的了解程度如何？",
            "你学习这个主题的目标是什么？",
            "在你接触 topic_placeholder 的过程中，有没有什么特别困惑的问题？",
        ],
        difficultyLevel: 1,
        masteryEstimate: 0,
    },
];

// === DOM Ready ===
document.addEventListener("DOMContentLoaded", () => {
    initNavbar();
    initAnimations();
    initStatsCounter();
    initApp();
});

// === Navbar Scroll Effect ===
function initNavbar() {
    const navbar = document.getElementById("navbar");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });
}

// === Scroll Animations ===
function initAnimations() {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add("visible");
                        const bars = entry.target.querySelectorAll(".bar");
                        bars.forEach((bar) => {
                            setTimeout(() => {
                                bar.style.width = bar.dataset.width + "%";
                            }, 300);
                        });
                    }, index * 100);
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );
    document.querySelectorAll("[data-animate]").forEach((el) => observer.observe(el));
}

// === Stats Counter Animation ===
function initStatsCounter() {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );
    const statsSection = document.querySelector(".hero-stats");
    if (statsSection) observer.observe(statsSection);
}

function animateCounters() {
    document.querySelectorAll(".stat-value").forEach((counter) => {
        const target = parseInt(counter.dataset.target);
        const duration = 2000;
        const startTime = performance.now();
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            counter.textContent = Math.round(target * eased);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    });
}

// === Interactive Learning App ===
function initApp() {
    const startBtn = document.getElementById("start-btn");
    const topicInput = document.getElementById("topic-input");
    const submitAnswer = document.getElementById("submit-answer");
    const topicTags = document.querySelectorAll(".topic-tag");

    if (startBtn) startBtn.addEventListener("click", () => startLearning());
    if (topicInput) topicInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") startLearning();
    });
    if (submitAnswer) submitAnswer.addEventListener("click", () => handleAnswer());

    topicTags.forEach((tag) => {
        tag.addEventListener("click", () => {
            topicInput.value = tag.dataset.topic;
            topicInput.focus();
        });
    });
}

async function startLearning() {
    const topicInput = document.getElementById("topic-input");
    const topic = topicInput.value.trim();

    if (!topic) {
        topicInput.style.borderColor = "#ef4444";
        setTimeout(() => { topicInput.style.borderColor = ""; }, 1500);
        return;
    }

    // Check if user is logged in
    const user = typeof getCurrentUser === 'function' ? await getCurrentUser() : null;
    if (!user) {
        window._pendingLearningStart = true;
        if (typeof showAuthModal === 'function') showAuthModal();
        return;
    }

    appState.topic = topic;
    appState.currentDoc = 0;
    appState.mastery = 0;
    appState.lastQuestions = [];
    appState.lastAnswer = "";
    appState.isUsingAI = true;
    appState.sessionId = null;

    generateDocument();
}

async function generateDocument() {
    showLoading();

    const docNumber = appState.currentDoc + 1;

    try {
        // Call our Vertex AI backend
        const response = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                topic: appState.topic,
                docNumber: docNumber,
                previousAnswers: appState.lastAnswer ? [appState.lastAnswer] : null,
                previousQuestions: appState.lastQuestions.length > 0 ? appState.lastQuestions : null,
            }),
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const doc = await response.json();

        if (doc.error) {
            throw new Error(doc.error);
        }

        // Update mastery from AI's estimate
        if (doc.masteryEstimate !== undefined) {
            appState.mastery = doc.masteryEstimate;
        }

        showDocument(doc);

        // Save session to Supabase
        if (typeof saveSession === 'function') {
            const saved = await saveSession({
                id: appState.sessionId,
                topic: appState.topic,
                currentDoc: appState.currentDoc + 1,
                mastery: appState.mastery,
                isUsingAI: appState.isUsingAI
            });
            if (saved) appState.sessionId = saved.id;
        }
    } catch (error) {
        console.warn("AI API failed, using fallback:", error.message);
        appState.isUsingAI = false;

        // Use fallback content
        const fallback = FALLBACK_DOCUMENTS[0];
        const doc = {
            title: fallback.title.replace(/topic_placeholder/g, appState.topic),
            content: fallback.content.replace(/topic_placeholder/g, appState.topic),
            questions: fallback.questions.map((q) =>
                q.replace(/topic_placeholder/g, appState.topic)
            ),
            difficultyLevel: fallback.difficultyLevel,
            masteryEstimate: fallback.masteryEstimate,
        };
        showDocument(doc);
    }
}

function showLoading() {
    const step1 = document.getElementById("app-step-1");
    const step2 = document.getElementById("app-step-2");
    const loading = document.getElementById("app-loading");

    if (step1) step1.classList.add("hidden");
    if (step2) step2.classList.add("hidden");
    if (loading) loading.classList.remove("hidden");
}

function hideLoading() {
    const loading = document.getElementById("app-loading");
    if (loading) loading.classList.add("hidden");
}

function showDocument(doc) {
    hideLoading();

    const step2 = document.getElementById("app-step-2");
    const docNumber = document.getElementById("doc-number");
    const docTopic = document.getElementById("doc-topic");
    const docBody = document.getElementById("doc-body");
    const questionsList = document.getElementById("questions-list");
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    const answerInput = document.getElementById("answer-input");

    docNumber.textContent = appState.currentDoc + 1;
    docTopic.textContent = appState.topic;
    docBody.innerHTML = doc.content;
    answerInput.value = "";

    // Store questions for next round
    appState.lastQuestions = doc.questions || [];

    // Render questions
    questionsList.innerHTML = "";
    (doc.questions || []).forEach((q, i) => {
        const item = document.createElement("div");
        item.className = "question-item";
        item.innerHTML = `
            <div class="question-number">${i + 1}</div>
            <div class="question-text">${q}</div>
        `;
        questionsList.appendChild(item);
    });

    // Update progress
    const masteryPercent = Math.min(appState.mastery, 100);
    progressFill.style.width = masteryPercent + "%";
    progressText.textContent = \`掌握度: \${masteryPercent}%\`;

    // Show AI status indicator
    const existingBadge = document.querySelector('.ai-status-badge');
    if (existingBadge) existingBadge.remove();

    const badge = document.createElement('span');
    badge.className = 'ai-status-badge';
    badge.style.cssText = \`
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 0.7rem; padding: 4px 10px; border-radius: 100px;
        margin-left: 8px;
        \${appState.isUsingAI
            ? 'background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid rgba(34,197,94,0.2);'
            : 'background: rgba(250,204,21,0.1); color: #facc15; border: 1px solid rgba(250,204,21,0.2);'
        }
    \`;
    badge.textContent = appState.isUsingAI ? '✦ AI 实时生成' : '⚡ 演示模式';
    const docMeta = document.querySelector('.doc-meta');
    if (docMeta) docMeta.appendChild(badge);

    step2.classList.remove("hidden");

    document.getElementById("demo").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleAnswer() {
    const answerInput = document.getElementById("answer-input");
    const answer = answerInput.value.trim();

    if (!answer) {
        answerInput.style.borderColor = "#ef4444";
        setTimeout(() => { answerInput.style.borderColor = ""; }, 1500);
        return;
    }

    // Store user's answer for next AI call
    appState.lastAnswer = answer;
    appState.currentDoc++;

    // Save answer to Supabase
    if (typeof saveAnswer === 'function' && appState.sessionId) {
        await saveAnswer(appState.sessionId, {
            docNumber: appState.currentDoc,
            questions: appState.lastQuestions,
            answer: answer,
            aiResponse: null
        });
    }

    // Generate next document via AI
    generateDocument();
}

function resetApp() {
    appState = {
        topic: "", currentDoc: 0, mastery: 0,
        lastQuestions: [], lastAnswer: "", isUsingAI: true,
    };

    const appContainer = document.querySelector(".app-container");
    if (appContainer.dataset.original) {
        appContainer.innerHTML = appContainer.dataset.original;
        initApp();
    }

    const step1 = document.getElementById("app-step-1");
    const step2 = document.getElementById("app-step-2");
    const loading = document.getElementById("app-loading");
    if (step1) step1.classList.remove("hidden");
    if (step2) step2.classList.add("hidden");
    if (loading) loading.classList.add("hidden");
    const topicInput = document.getElementById("topic-input");
    if (topicInput) topicInput.value = "";
}

// === Smooth Scroll for Anchor Links ===
document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link) {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute("href"));
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
});
