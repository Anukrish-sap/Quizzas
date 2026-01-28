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

  // NEW: end early button (add to HTML)
  const endBtn = document.getElementById("endBtn");

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

  function show(el) {
    if (el) el.style.display = "";
  }
  function hide(el) {
    if (el) el.style.display = "none";
  }

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
  let questions = [];
  let index = 0;

  // answers[qid] = optionId | null (null = skipped) | undefined (unanswered)
  const answers = Object.create(null);

  // correctness[qid] = true|false|null (null = skipped/unanswered)
  const correctness = Object.create(null);

  // lock after selecting answer so they can’t change it unless they go Back
  const locked = Object.create(null);

  function totalCount() {
    return questions.length;
  }

  function attemptedCount() {
    // selected option (NOT skipped)
    return questions.filter((q) => typeof answers[q.id] === "number").length;
  }

  function skippedCount() {
    return questions.filter((q) => answers[q.id] === null).length;
  }

  function unansweredCount() {
    return questions.filter((q) => answers[q.id] === undefined).length;
  }

  function rightCount() {
    let r = 0;
    for (const q of questions) if (correctness[q.id] === true) r++;
    return r;
  }

  function wrongCount() {
    // wrong = attempted - right
    return attemptedCount() - rightCount();
  }

  function score() {
    return rightCount();
  }

  function updateTopBar() {
    const total = totalCount();
    progressText.textContent = `Question ${Math.min(index + 1, total)} / ${total}`;
    scoreText.textContent = `Score: ${score()}`;
  }

  function setNavButtons() {
    backBtn.disabled = index === 0;

    const q = questions[index];
    const selectedAnswer = q ? answers[q.id] : undefined;

    // ✅ Next/Finish only enabled if user selected an answer (NOT skip)
    const canNext = selectedAnswer !== undefined && selectedAnswer !== null;

    const last = index === totalCount() - 1;
    if (last) {
      hide(nextBtn);
      show(finishBtn);
      finishBtn.disabled = !canNext;
    } else {
      show(nextBtn);
      hide(finishBtn);
      nextBtn.disabled = !canNext;
    }
  }

  function renderQuestion() {
    if (!questions.length) return;

    const q = questions[index];
    questionTitle.textContent = q.question_text || "—";

    // 2x2 layout
    if (optionsWrap) {
      optionsWrap.style.display = "grid";
      optionsWrap.style.gridTemplateColumns = "1fr 1fr";
      optionsWrap.style.gap = "10px";
    }

    const selected = answers[q.id]; // optionId | null | undefined
    const opts = (q.options || [])
      .slice()
      .sort((a, b) => (a.option_order ?? 0) - (b.option_order ?? 0));

    optionsWrap.innerHTML = opts
      .map((opt) => {
        const isSelected = selected === opt.id;
        const cls = isSelected ? "btn" : "btn secondary";
        const disabled = locked[q.id] ? "disabled" : "";

        return `
          <button
            type="button"
            class="${cls}"
            data-opt-id="${opt.id}"
            ${disabled}
            style="width:100%; text-align:left; padding:14px; border-radius:14px;"
          >
            ${escapeHtml(opt.option_text)}
          </button>
        `;
      })
      .join("");

    // feedback
    if (selected !== undefined && selected !== null) {
      setMsg(quizMsg, correctness[q.id] ? "✅ Correct!" : "❌ Wrong!", correctness[q.id] === true);
    } else if (selected === null) {
      setMsg(quizMsg, "Skipped.", false);
    } else {
      setMsg(quizMsg, "");
    }

    updateTopBar();
    setNavButtons();
  }

  function applyAnswer(optionId) {
    const q = questions[index];
    if (!q) return;

    if (locked[q.id]) return;

    answers[q.id] = optionId;

    const opt = (q.options || []).find((o) => o.id === optionId);
    correctness[q.id] = opt ? !!opt.is_correct : null;

    locked[q.id] = true;

    setMsg(quizMsg, correctness[q.id] ? "✅ Correct!" : "❌ Wrong!", correctness[q.id] === true);

    renderQuestion();
  }

  function skipCurrentAndGoNext() {
    const q = questions[index];
    if (!q) return;

    // only mark skipped if not already answered
    if (answers[q.id] === undefined) {
      answers[q.id] = null;
      correctness[q.id] = null;
      locked[q.id] = false;
    }

    goNext();
  }

  function goNext() {
    if (index < totalCount() - 1) {
      index++;
      renderQuestion();
    } else {
      finish("completed");
    }
  }

  function goBack() {
    if (index > 0) {
      index--;
      renderQuestion();
    }
  }

  function finish(reason = "completed") {
    hide(quizCard);
    hide(setupCard);
    show(resultCard);

    const total = totalCount();
    const right = rightCount();
    const wrong = wrongCount();
    const skipped = skippedCount();
    const unanswered = unansweredCount();

    finalScore.textContent = `${right} / ${total}`;

    // ✅ what you asked: right / wrong / skipped (and unanswered if ended early)
    finalProgress.textContent = `Right: ${right} • Wrong: ${wrong} • Skipped: ${skipped} • Unanswered: ${unanswered} • Total: ${total}`;

    if (reason === "ended") {
      setMsg(resultMsg, "Quiz ended early.", false);
    } else {
      setMsg(resultMsg, "Quiz finished ✅", true);
    }
  }

  function endEarly() {
    // just finish with reason "ended"
    finish("ended");
  }

  function resetAll() {
    questions = [];
    index = 0;

    for (const k of Object.keys(answers)) delete answers[k];
    for (const k of Object.keys(correctness)) delete correctness[k];
    for (const k of Object.keys(locked)) delete locked[k];

    show(setupCard);
    hide(quizCard);
    hide(resultCard);

    setMsg(setupMsg, "");
    setMsg(quizMsg, "");
    setMsg(resultMsg, "");

    if (optionsWrap) optionsWrap.innerHTML = "";
    questionTitle.textContent = "—";
    progressText.textContent = "Question — / —";
    scoreText.textContent = "Score: 0";
  }

  // ===== LOAD TOPICS =====
  async function loadTopics() {
    if (!topicSelect) return;

    topicSelect.innerHTML = `<option value="">Loading topics...</option>`;

    const { data, error } = await sb.from("topics").select("id,name").order("name", { ascending: true });

    if (error) {
      topicSelect.innerHTML = `<option value="">Failed to load topics</option>`;
      setMsg(setupMsg, "Failed to load topics: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      topicSelect.innerHTML = `<option value="">No topics yet</option>`;
      return;
    }

    topicSelect.innerHTML = data.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  }

  // ===== LOAD QUESTIONS + OPTIONS =====
  async function loadQuizForTopic(topicId) {
    const { data: qData, error: qErr } = await sb
      .from("questions")
      .select("id, question_text, explanation")
      .eq("topic_id", Number(topicId))
      .order("id", { ascending: true });

    if (qErr) throw new Error(qErr.message);
    if (!qData || qData.length === 0) return [];

    const qIds = qData.map((q) => q.id);

    const { data: oData, error: oErr } = await sb
      .from("options")
      .select("id, question_id, option_text, is_correct, option_order")
      .in("question_id", qIds)
      .order("option_order", { ascending: true });

    if (oErr) throw new Error(oErr.message);

    const optionsByQ = new Map();
    for (const opt of oData || []) {
      if (!optionsByQ.has(opt.question_id)) optionsByQ.set(opt.question_id, []);
      optionsByQ.get(opt.question_id).push(opt);
    }

    return qData.map((q) => ({
      ...q,
      options: optionsByQ.get(q.id) || [],
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

      hide(setupCard);
      show(quizCard);
      hide(resultCard);

      renderQuestion();
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

  optionsWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-opt-id]");
    if (!btn) return;
    if (btn.disabled) return;

    const optId = Number(btn.getAttribute("data-opt-id"));
    if (!Number.isFinite(optId)) return;

    applyAnswer(optId);
  });

  backBtn?.addEventListener("click", () => {
    // allow re-answer when coming back
    const q = questions[index];
    if (q) locked[q.id] = false;
    goBack();
  });

  skipBtn?.addEventListener("click", skipCurrentAndGoNext);

  nextBtn?.addEventListener("click", goNext);

  finishBtn?.addEventListener("click", () => finish("completed"));

  // NEW: end early
  endBtn?.addEventListener("click", endEarly);

  restartBtn?.addEventListener("click", async () => {
    resetAll();
    await loadTopics();
  });

  // ===== INIT =====
  resetAll();
  loadTopics();
})();