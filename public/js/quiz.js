(function () {
  if (window.__QUIZ_JS_RUNNING__) return;
  window.__QUIZ_JS_RUNNING__ = true;

  const SUPABASE_URL = "https://ywqkgttthlpytpwaxwpr.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cWtndHR0aGxweXRwd2F4d3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NjQ0NTIsImV4cCI6MjA4NDM0MDQ1Mn0.RzCeAl7ouzH5weMLKGiJUPx_1GQvQOe3DP50JR4NbFE";

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
  const endBtn = document.getElementById("endBtn");

  const finalScore = document.getElementById("finalScore");
  const finalProgress = document.getElementById("finalProgress");
  const restartBtn = document.getElementById("restartBtn");
  const resultMsg = document.getElementById("resultMsg");

  function ensureFeedbackStyles() {
    if (document.getElementById("quiz-feedback-styles")) return;
    const style = document.createElement("style");
    style.id = "quiz-feedback-styles";
    style.textContent = `
      #optionsWrap button.correctAnswer{
        border-color: rgba(124,255,78,0.85) !important;
        background: rgba(124,255,78,0.14) !important;
      }
      #optionsWrap button.wrongAnswer{
        border-color: rgba(255,120,120,0.85) !important;
        background: rgba(255,120,120,0.12) !important;
      }
      #optionsWrap button.placeholderOption{
        opacity: 0.45 !important;
        cursor: not-allowed !important;
      }
    `;
    document.head.appendChild(style);
  }
  ensureFeedbackStyles();

  // ✅ NEW: message helper with explicit type
  function setMsg(el, text, type = "none") {
    if (!el) return;
    el.textContent = text || "";
    if (!text) {
      el.style.color = "";
      return;
    }
    if (type === "ok") el.style.color = "rgba(124,255,78,0.95)";
    else if (type === "bad") el.style.color = "rgba(255,120,120,0.95)";
    else el.style.color = "rgba(220,220,220,0.9)";
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

  // ✅ shuffle helper (Fisher-Yates)
  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ✅ ensures exactly 4 displayed options (pads missing)
  function buildDisplayOptions(realOptions) {
    const opts = Array.isArray(realOptions) ? realOptions.slice() : [];

    // If some options are blank strings, they still render but look empty.
    // We keep them but label them "(blank)" so you can spot the bad CSV quickly.
    for (const o of opts) {
      if (o && (o.option_text === null || o.option_text === undefined || String(o.option_text).trim() === "")) {
        o.option_text = "(blank option text)";
      }
    }

    // Pad up to 4 placeholders if DB returned less than 4
    while (opts.length < 4) {
      opts.push({
        __placeholder: true,
        id: null,
        option_text: "Missing option (fix CSV/import)",
        is_correct: false,
        option_order: 999,
      });
    }

    // If DB returned more than 4, keep all (or uncomment next line to hard-cap)
    // return opts.slice(0, 4);
    return opts;
  }

  if (!window.supabase?.createClient) {
    setMsg(setupMsg, "❌ Supabase CDN not loaded.", "bad");
    return;
  }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let questions = [];
  let index = 0;

  const answers = Object.create(null);
  const correctness = Object.create(null);
  const locked = Object.create(null);

  function totalCount() {
    return questions.length;
  }
  function attemptedCount() {
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

  function correctOptionFor(q) {
    return (q.options || []).find((o) => !!o.is_correct) || null;
  }

  function applyVisualFeedback(q) {
    if (!q || !optionsWrap) return;
    const selected = answers[q.id];
    const correctOpt = correctOptionFor(q);

    const btns = optionsWrap.querySelectorAll("button[data-opt-id]");
    btns.forEach((b) => {
      b.classList.remove("correctAnswer", "wrongAnswer");
      const optId = Number(b.getAttribute("data-opt-id"));
      if (!Number.isFinite(optId)) return;

      if (correctOpt && optId === correctOpt.id) b.classList.add("correctAnswer");
      if (
        selected !== undefined &&
        selected !== null &&
        correctOpt &&
        selected !== correctOpt.id &&
        optId === selected
      ) {
        b.classList.add("wrongAnswer");
      }
    });
  }

  function renderQuestion() {
    if (!questions.length) return;

    const q = questions[index];
    questionTitle.textContent = q.question_text || "—";

    if (optionsWrap) {
      optionsWrap.style.display = "grid";
      optionsWrap.style.gridTemplateColumns = "1fr 1fr";
      optionsWrap.style.gap = "10px";
      optionsWrap.style.marginTop = "10px";
    }

    const selected = answers[q.id];

    // ✅ shuffle ONCE per question, but only for real options
    if (!q._shuffledOptions) {
      const real = (q.options || []).slice();
      q._shuffledOptions = shuffleArray(real);
    }

    const displayOpts = buildDisplayOptions(q._shuffledOptions);

    optionsWrap.innerHTML = displayOpts
      .map((opt) => {
        const isPlaceholder = !!opt.__placeholder;
        const optId = isPlaceholder ? "" : String(opt.id);
        const isSelected = !isPlaceholder && selected === opt.id;

        const clsBase = isSelected ? "btn" : "btn secondary";
        const cls = isPlaceholder ? `${clsBase} placeholderOption` : clsBase;

        const disabled = locked[q.id] || isPlaceholder ? "disabled" : "";

        return `
          <button
            type="button"
            class="${cls}"
            data-opt-id="${optId}"
            ${disabled}
            style="width:100%; text-align:left; padding:14px; border-radius:14px;"
          >
            ${escapeHtml(opt.option_text)}
          </button>
        `;
      })
      .join("");

    if (selected !== undefined && selected !== null) {
      const correctOpt = correctOptionFor(q);
      if (correctness[q.id] === true) {
        setMsg(quizMsg, "✅ Correct!", "ok"); // ✅ ALWAYS GREEN
      } else {
        const correctText = correctOpt ? correctOpt.option_text : "—";
        setMsg(quizMsg, `❌ Wrong! Correct answer: ${correctText}`, "bad");
      }
      applyVisualFeedback(q);
    } else if (selected === null) {
      setMsg(quizMsg, "Skipped.", "bad");
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

    const correctOpt = correctOptionFor(q);
    if (correctness[q.id] === true) {
      setMsg(quizMsg, "✅ Correct!", "ok");
    } else {
      const correctText = correctOpt ? correctOpt.option_text : "—";
      setMsg(quizMsg, `❌ Wrong! Correct answer: ${correctText}`, "bad");
    }

    renderQuestion();
  }

  function skipCurrentAndGoNext() {
    const q = questions[index];
    if (!q) return;

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
    finalProgress.textContent = `Right: ${right} • Wrong: ${wrong} • Skipped: ${skipped} • Unanswered: ${unanswered} • Total: ${total}`;

    if (reason === "ended") setMsg(resultMsg, "Quiz ended early.", "bad");
    else setMsg(resultMsg, "Quiz finished ✅", "ok");
  }

  function endEarly() {
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

  async function loadTopics() {
    if (!topicSelect) return;

    topicSelect.innerHTML = `<option value="">Loading topics...</option>`;

    const { data, error } = await sb.from("topics").select("id,name").order("name", { ascending: true });

    if (error) {
      topicSelect.innerHTML = `<option value="">Failed to load topics</option>`;
      setMsg(setupMsg, "Failed to load topics: " + error.message, "bad");
      return;
    }

    if (!data || data.length === 0) {
      topicSelect.innerHTML = `<option value="">No topics yet</option>`;
      return;
    }

    topicSelect.innerHTML = data.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
  }

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
      .in("question_id", qIds);

    if (oErr) throw new Error(oErr.message);

    const optionsByQ = new Map();
    for (const opt of oData || []) {
      if (!optionsByQ.has(opt.question_id)) optionsByQ.set(opt.question_id, []);
      optionsByQ.get(opt.question_id).push(opt);
    }

    return qData.map((q) => ({
      ...q,
      options: (optionsByQ.get(q.id) || []).slice().sort((a, b) => (a.option_order ?? 0) - (b.option_order ?? 0)),
    }));
  }

  async function start() {
    setMsg(setupMsg, "");
    const topicId = topicSelect?.value;
    if (!topicId) return setMsg(setupMsg, "Pick a topic first.", "bad");

    startBtn.disabled = true;
    startBtn.textContent = "Starting...";

    try {
      const loaded = await loadQuizForTopic(topicId);
      if (!loaded.length) {
        setMsg(setupMsg, "No questions in this topic yet.", "bad");
        return;
      }

      // reset shuffle state
      loaded.forEach((q) => {
        delete q._shuffledOptions;
      });

      questions = loaded;
      index = 0;

      hide(setupCard);
      show(quizCard);
      hide(resultCard);

      renderQuestion();
      setNavButtons();
    } catch (e) {
      setMsg(setupMsg, "Failed to start quiz: " + (e.message || "Unknown error"), "bad");
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = "Start";
    }
  }

  startBtn?.addEventListener("click", start);

  optionsWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-opt-id]");
    if (!btn) return;
    if (btn.disabled) return;

    const raw = btn.getAttribute("data-opt-id");
    const optId = Number(raw);
    if (!Number.isFinite(optId)) return; // ignore placeholders

    applyAnswer(optId);
  });

  backBtn?.addEventListener("click", () => {
    const q = questions[index];
    if (q) locked[q.id] = false;
    goBack();
  });

  skipBtn?.addEventListener("click", skipCurrentAndGoNext);
  nextBtn?.addEventListener("click", goNext);
  finishBtn?.addEventListener("click", () => finish("completed"));
  endBtn?.addEventListener("click", endEarly);

  restartBtn?.addEventListener("click", async () => {
    resetAll();
    await loadTopics();
  });

  resetAll();
  loadTopics();
})();