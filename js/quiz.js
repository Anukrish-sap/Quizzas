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
  const modeSelect = document.getElementById("modeSelect");
  const clearProgressBtn = document.getElementById("clearProgressBtn");

  const startBtn = document.getElementById("startBtn");
  const setupMsg = document.getElementById("setupMsg");

  const countInput = document.getElementById("countInput");
  const maxCountLabel = document.getElementById("maxCountLabel");
  const availableLabel = document.getElementById("availableLabel");

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
    `;
    document.head.appendChild(style);
  }
  ensureFeedbackStyles();

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

  function shuffleArray(arr) {
    const a = Array.isArray(arr) ? arr.slice() : [];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function clampInt(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, Math.floor(x)));
  }

  function getChosenCount(maxAvailableForMode) {
    if (!countInput) return maxAvailableForMode;

    const parsed = Number(countInput.value);
    if (!Number.isFinite(parsed)) return 0;

    return clampInt(parsed, 0, maxAvailableForMode);
  }

  function updateCountUI(totalMaxForTopic, availableForMode) {
    if (!countInput) return;

    const totalSafe = Math.max(0, Number(totalMaxForTopic) || 0);
    const availableSafe = Math.max(0, Number(availableForMode) || 0);

    if (maxCountLabel) maxCountLabel.textContent = String(totalSafe);
    if (availableLabel) availableLabel.textContent = `Available: ${availableSafe}`;

    countInput.min = "0";
    countInput.max = String(availableSafe);

    const raw = Number(countInput.value);
    if (Number.isFinite(raw) && raw > availableSafe) countInput.value = String(availableSafe);
  }

  function attemptKey(topicId) {
    return `quizzas:lastAttempt:topic:${Number(topicId)}`;
  }

  function loadLastAttempt(topicId) {
    try {
      const raw = localStorage.getItem(attemptKey(topicId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveLastAttempt(topicId) {
    try {
      const payload = {
        topicId: Number(topicId),
        savedAt: Date.now(),
        answers: {},
      };

      for (const q of questions) {
        const a = answers[q.id];
        payload.answers[q.id] = {
          answerId: typeof a === "number" ? a : null,
          correct: correctness[q.id] === true,
          skipped: a === null,
        };
      }

      localStorage.setItem(attemptKey(topicId), JSON.stringify(payload));
    } catch {}
  }

  function clearLastAttempt(topicId) {
    try {
      localStorage.removeItem(attemptKey(topicId));
    } catch {}
  }

  function filterQuestionsByMode(allQuestions, topicId, mode) {
    if (mode === "full") return allQuestions;

    const last = loadLastAttempt(topicId);
    if (!last || !last.answers) return [];

    if (mode === "wrong") return allQuestions.filter((q) => last.answers[q.id]?.correct === false);
    if (mode === "unanswered") return allQuestions.filter((q) => last.answers[q.id]?.answerId == null);

    return allQuestions;
  }

  if (!window.supabase?.createClient) {
    setMsg(setupMsg, "❌ Supabase CDN not loaded.");
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

      const hasAnswer = selected !== undefined && selected !== null;
      const isWrong = hasAnswer && correctOpt && selected !== correctOpt.id;

      if (isWrong && correctOpt && optId === correctOpt.id) b.classList.add("correctAnswer");
      if (isWrong && optId === selected) b.classList.add("wrongAnswer");
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

    if (!q._shuffledOptions) q._shuffledOptions = shuffleArray(q.options || []);
    const opts = q._shuffledOptions;

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

    if (selected !== undefined && selected !== null) {
      const correctOpt = correctOptionFor(q);
      if (correctness[q.id] === true) {
        setMsg(quizMsg, "✅ Correct!", true);
      } else {
        const correctText = correctOpt ? correctOpt.option_text : "—";
        setMsg(quizMsg, `❌ Wrong! Correct answer: ${correctText}`, false);
      }
      applyVisualFeedback(q);
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

    const correctOpt = correctOptionFor(q);
    if (correctness[q.id] === true) {
      setMsg(quizMsg, "✅ Correct!", true);
    } else {
      const correctText = correctOpt ? correctOpt.option_text : "—";
      setMsg(quizMsg, `❌ Wrong! Correct answer: ${correctText}`, false);
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
    const topicId = Number(topicSelect?.value);
    if (topicId) saveLastAttempt(topicId);

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

    if (reason === "ended") setMsg(resultMsg, "Quiz ended early.", false);
    else setMsg(resultMsg, "Quiz finished ✅", true);
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

  async function fetchTopicQuestionIds(topicId) {
    const { data, error } = await sb.from("questions").select("id").eq("topic_id", Number(topicId));
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data.map((x) => x.id) : [];
  }

  async function updateAvailabilityFor(topicId) {
    const mode = modeSelect?.value || "full";

    try {
      const allIds = await fetchTopicQuestionIds(topicId);
      const totalMaxForTopic = allIds.length;

      if (mode === "full") {
        updateCountUI(totalMaxForTopic, totalMaxForTopic);
        return;
      }

      const last = loadLastAttempt(topicId);
      if (!last || !last.answers) {
        updateCountUI(totalMaxForTopic, 0);
        return;
      }

      let availableForMode = 0;

      if (mode === "wrong") {
        for (const id of allIds) if (last.answers[id]?.correct === false) availableForMode++;
      } else if (mode === "unanswered") {
        for (const id of allIds) if (last.answers[id]?.answerId == null) availableForMode++;
      }

      updateCountUI(totalMaxForTopic, availableForMode);
    } catch {
      updateCountUI(0, 0);
    }
  }

  async function loadTopics() {
    if (!topicSelect) return;

    topicSelect.innerHTML = `<option value="">Loading topics...</option>`;

    const { data, error } = await sb.from("topics").select("id,name").order("name", { ascending: true });

    if (error) {
      topicSelect.innerHTML = `<option value="">Failed to load topics</option>`;
      setMsg(setupMsg, "Failed to load topics: " + error.message);
      if (maxCountLabel) maxCountLabel.textContent = "—";
      if (availableLabel) availableLabel.textContent = "Available: —";
      return;
    }

    if (!data || data.length === 0) {
      topicSelect.innerHTML = `<option value="">No topics yet</option>`;
      if (maxCountLabel) maxCountLabel.textContent = "—";
      if (availableLabel) availableLabel.textContent = "Available: —";
      return;
    }

    topicSelect.innerHTML = data.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

    topicSelect.selectedIndex = 0;

    const firstTopicId = topicSelect.value;
    if (firstTopicId) await updateAvailabilityFor(firstTopicId);
  }

  async function fetchAllOptionsForQuestions(qIds) {
    const all = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await sb
        .from("options")
        .select("id, question_id, option_text, is_correct, option_order")
        .in("question_id", qIds)
        .order("option_order", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw new Error(error.message);

      all.push(...(data || []));
      if (!data || data.length < pageSize) break;

      from += pageSize;
    }
    return all;
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
    const oData = await fetchAllOptionsForQuestions(qIds);

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

      const mode = modeSelect?.value || "full";
      const filtered = filterQuestionsByMode(loaded, topicId, mode);

      if (!filtered.length) {
        if (mode === "wrong") setMsg(setupMsg, "No wrong questions found from your last attempt for this topic.");
        else if (mode === "unanswered")
          setMsg(setupMsg, "No unanswered questions found from your last attempt for this topic.");
        else setMsg(setupMsg, "No questions in this topic yet.");
        return;
      }

      const shuffled = shuffleArray(filtered);

      const chosenCount = getChosenCount(shuffled.length);
      if (chosenCount === 0) {
        setMsg(setupMsg, "❌ You can’t start a quiz with 0 questions.");
        return;
      }

      questions = shuffled.slice(0, chosenCount);

      for (const q of questions) delete q._shuffledOptions;

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

  clearProgressBtn?.addEventListener("click", async () => {
    const topicId = topicSelect?.value;
    if (!topicId) return setMsg(setupMsg, "Pick a topic first.");
    clearLastAttempt(topicId);
    setMsg(setupMsg, "Saved progress cleared for this topic.", true);
    await updateAvailabilityFor(topicId);
  });

  topicSelect?.addEventListener("change", async () => {
    setMsg(setupMsg, "");
    const topicId = topicSelect.value;
    if (!topicId) {
      if (maxCountLabel) maxCountLabel.textContent = "—";
      if (availableLabel) availableLabel.textContent = "Available: —";
      return;
    }
    await updateAvailabilityFor(topicId);
  });

  modeSelect?.addEventListener("change", async () => {
    setMsg(setupMsg, "");
    const topicId = topicSelect.value;
    if (!topicId) return;
    await updateAvailabilityFor(topicId);
  });

  countInput?.addEventListener("input", () => {
    const maxAttr = Number(countInput.max);
    const maxAvailableForMode = Number.isFinite(maxAttr) && maxAttr >= 0 ? maxAttr : 0;
    const raw = Number(countInput.value);
    if (Number.isFinite(raw) && raw > maxAvailableForMode) countInput.value = String(maxAvailableForMode);
  });

  resetAll();
  loadTopics();
})();
