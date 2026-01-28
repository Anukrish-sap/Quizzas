(function () {
  if (window.__QUIZ_JS_RUNNING__) return;
  window.__QUIZ_JS_RUNNING__ = true;

  // ===== SUPABASE CONFIG =====
  const SUPABASE_URL = "https://ywqkgttthlpytpwaxwpr.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cWtndHR0aGxweXRwd2F4d3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NjQ0NTIsImV4cCI6MjA4NDM0MDQ1Mn0.RzCeAl7ouzH5weMLKGiJUPx_1GQvQOe3DP50JR4NbFE";

  // ===== ELEMENTS =====
  const setupCard = document.getElementById("setupCard");
  const quizCard = document.getElementById("quizCard");
  const resultCard = document.getElementById("resultCard");

  const topicSelect = document.getElementById("topicSelect");
  const startBtn = document.getElementById("startBtn");
  const setupMsg = document.getElementById("setupMsg");

  const progressText = document.getElementById("progressText");
  const scoreText = document.getElementById("scoreText");
  const questionTitle = document.getElementById("questionTitle");
  const optionsWrap = document.getElementById("optionsWrap");
  const quizMsg = document.getElementById("quizMsg");

  const backBtn = document.getElementById("backBtn");
  const skipBtn = document.getElementById("skipBtn");
  const nextBtn = document.getElementById("nextBtn");
  const finishBtn = document.getElementById("finishBtn");

  const finalScore = document.getElementById("finalScore");
  const finalProgress = document.getElementById("finalProgress");
  const restartBtn = document.getElementById("restartBtn");
  const resultMsg = document.getElementById("resultMsg");

  // ===== HELPERS =====
  function setMsg(el, text, ok = false) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = ok ? "rgba(124,255,78,0.95)" : "rgba(255,120,120,0.95)";
    if (!text) el.style.color = "";
  }

  function show(el) { if (el) el.style.display = ""; }
  function hide(el) { if (el) el.style.display = "none"; }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== SUPABASE INIT =====
  if (!window.supabase?.createClient) {
    setMsg(setupMsg, "❌ Supabase CDN not loaded.");
    return;
  }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ===== QUIZ STATE =====
  /**
   * questions: [{ id, question_text, explanation, options:[{id, option_text, is_correct, option_order}] }]
   */
  let questions = [];
  let index = 0;

  // answers[qid] = optionId | null (null = skipped)
  const answers = Object.create(null);

  // correctness[qid] = true|false|null (null = not answered yet / skipped)
  const correctness = Object.create(null);

  let started = false;

  function totalCount() {
    return questions.length;
  }

  function answeredCount() {
    return questions.filter(q => answers[q.id] !== undefined).length; // includes skipped(null)
  }

  function skippedCount() {
    return questions.filter(q => answers[q.id] === null).length;
  }

  function score() {
    let s = 0;
    for (const q of questions) {
      if (correctness[q.id] === true) s++;
    }
    return s;
  }

  function updateTopBar() {
    const total = totalCount();
    progressText.textContent = `Question ${Math.min(index + 1, total)} / ${total}`;
    scoreText.textContent = `Score: ${score()}`;
  }

  function setNavButtons() {
    // Back disabled on first question
    backBtn.disabled = index === 0;

    // Next logic:
    // - Before start, everything hidden anyway
    // - After start: Next is disabled until user selects an answer OR hits Skip for current Q
    const q = questions[index];
    const hasDecision = q && answers[q.id] !== undefined; // includes null skip
    nextBtn.disabled = !hasDecision;

    // Last question: show Finish instead of Next
    const last = index === totalCount() - 1;
    if (last) {
      hide(nextBtn);
      show(finishBtn);
      finishBtn.disabled = !hasDecision; // must answer/skip final question
    } else {
      show(nextBtn);
      hide(finishBtn);
    }
  }

  function renderQuestion() {
    if (!questions.length) return;

    setMsg(quizMsg, "");

    const q = questions[index];
    questionTitle.textContent = q.question_text || "—";

    // render options as buttons (radio feel)
    const selected = answers[q.id]; // optionId | null | undefined
    const opts = q.options || [];

    optionsWrap.innerHTML = opts
      .sort((a, b) => (a.option_order ?? 0) - (b.option_order ?? 0))
      .map((opt) => {
        const isSelected = selected === opt.id;
        // use existing button classes
        const cls = isSelected ? "btn" : "btn secondary";
        return `
          <button
            type="button"
            class="${cls}"
            data-opt-id="${opt.id}"
            style="width:100%; text-align:left; padding:14px; border-radius:14px;"
          >
            ${escapeHtml(opt.option_text)}
          </button>
        `;
      })
      .join("");

    updateTopBar();
    setNavButtons();
  }

  function applyAnswer(optionId) {
    const q = questions[index];
    if (!q) return;

    answers[q.id] = optionId;

    const opt = (q.options || []).find(o => o.id === optionId);
    if (!opt) {
      correctness[q.id] = null;
    } else {
      correctness[q.id] = !!opt.is_correct;
    }
    renderQuestion();
  }

  function applySkip() {
    const q = questions[index];
    if (!q) return;
    answers[q.id] = null;
    correctness[q.id] = null;
    renderQuestion();
  }

  function goNext() {
    if (index < totalCount() - 1) {
      index++;
      renderQuestion();
    } else {
      finish();
    }
  }

  function goBack() {
    if (index > 0) {
      index--;
      renderQuestion();
    }
  }

  function finish() {
    hide(quizCard);
    hide(setupCard);
    show(resultCard);

    const total = totalCount();
    finalScore.textContent = `${score()} / ${total}`;
    finalProgress.textContent = `${answeredCount()} answered • ${skippedCount()} skipped • ${total} total`;

    setMsg(resultMsg, "Nice. You can restart any time.", true);
  }

  function resetAll() {
    questions = [];
    index = 0;
    started = false;

    for (const k of Object.keys(answers)) delete answers[k];
    for (const k of Object.keys(correctness)) delete correctness[k];

    // UI reset
    show(setupCard);
    hide(quizCard);
    hide(resultCard);

    setMsg(setupMsg, "");
    setMsg(quizMsg, "");
    setMsg(resultMsg, "");

    optionsWrap.innerHTML = "";
    questionTitle.textContent = "—";
    progressText.textContent = "Question — / —";
    scoreText.textContent = "Score: 0";
  }

  // ===== LOAD TOPICS =====
  async function loadTopics() {
    if (!topicSelect) return;

    topicSelect.innerHTML = `<option value="">Loading topics...</option>`;

    const { data, error } = await sb
      .from("topics")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) {
      topicSelect.innerHTML = `<option value="">Failed to load topics</option>`;
      setMsg(setupMsg, "Failed to load topics: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      topicSelect.innerHTML = `<option value="">No topics yet</option>`;
      return;
    }

    topicSelect.innerHTML = data
      .map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
      .join("");
  }

  // ===== LOAD QUESTIONS + OPTIONS =====
  async function loadQuizForTopic(topicId) {
    // Load questions
    const { data: qData, error: qErr } = await sb
      .from("questions")
      .select("id, question_text, explanation")
      .eq("topic_id", Number(topicId))
      .order("id", { ascending: true });

    if (qErr) throw new Error(qErr.message);

    if (!qData || qData.length === 0) {
      return [];
    }

    const qIds = qData.map(q => q.id);

    // Load options for all questions
    const { data: oData, error: oErr } = await sb
      .from("options")
      .select("id, question_id, option_text, is_correct, option_order")
      .in("question_id", qIds)
      .order("option_order", { ascending: true });

    if (oErr) throw new Error(oErr.message);

    const optionsByQ = new Map();
    for (const opt of (oData || [])) {
      if (!optionsByQ.has(opt.question_id)) optionsByQ.set(opt.question_id, []);
      optionsByQ.get(opt.question_id).push(opt);
    }

    return qData.map(q => ({
      ...q,
      options: optionsByQ.get(q.id) || []
    }));
  }

  // ===== START =====
  async function start() {
    setMsg(setupMsg, "");
    const topicId = topicSelect?.value;
    if (!topicId) return setMsg(setupMsg, "Pick a topic first.");

    startBtn.disabled = true;
    startBtn.textContent = "Starting...";

    try {
      const loaded = await loadQuizForTopic(topicId);

      if (!loaded.length) {
        setMsg(setupMsg, "No questions in this topic yet.");
        return;
      }

      questions = loaded;
      index = 0;
      started = true;

      hide(setupCard);
      show(quizCard);
      hide(resultCard);

      // Require answer/skip before next
      renderQuestion();
      // next/finish initially disabled
      setNavButtons();

    } catch (e) {
      setMsg(setupMsg, "Failed to start quiz: " + (e.message || "Unknown error"));
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = "Start";
    }
  }

  // ===== EVENTS =====
  startBtn?.addEventListener("click", start);

  // Option click (event delegation)
  optionsWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-opt-id]");
    if (!btn) return;
    const optId = Number(btn.getAttribute("data-opt-id"));
    if (!Number.isFinite(optId)) return;
    applyAnswer(optId);
  });

  backBtn?.addEventListener("click", goBack);

  skipBtn?.addEventListener("click", () => {
    applySkip();
    // auto move forward after skip (like Kahoot)
    // If you DON'T want auto move, delete next line:
    goNext();
  });

  nextBtn?.addEventListener("click", goNext);
  finishBtn?.addEventListener("click", finish);

  restartBtn?.addEventListener("click", async () => {
    resetAll();
    await loadTopics();
  });

  // ===== INIT =====
  resetAll();
  loadTopics();
})();