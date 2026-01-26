// public/js/quiz.js

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.QUIZZAS_CONFIG;

// Footer year
document.getElementById("year2").textContent = new Date().getFullYear();

// DOM
const topicSelect = document.getElementById("topicSelect");
const searchBox = document.getElementById("searchBox");
const limitBox = document.getElementById("limitBox");
const reloadBtn = document.getElementById("reloadBtn");

const progressText = document.getElementById("progressText");
const scoreText = document.getElementById("scoreText");

const topicTag = document.getElementById("topicTag");
const questionText = document.getElementById("questionText");
const optionsWrap = document.getElementById("optionsWrap");
const feedbackBox = document.getElementById("feedbackBox");

const nextBtn = document.getElementById("nextBtn");
const skipBtn = document.getElementById("skipBtn");

const doneBox = document.getElementById("doneBox");
const finalLine = document.getElementById("finalLine");
const restartBtn = document.getElementById("restartBtn");

// State
let questions = [];
let idx = 0;
let score = 0;
let locked = false;

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getQueryParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

async function restGet(pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`REST ${res.status}: ${t}`);
  }
  return res.json();
}

function setEmpty(message) {
  progressText.textContent = "Question 0/0";
  topicTag.textContent = "—";
  questionText.textContent = message;
  optionsWrap.innerHTML = "";
  feedbackBox.textContent = "";
  nextBtn.disabled = true;
}

async function loadTopics() {
  const topics = await restGet("topics?select=id,name&order=name.asc");

  topicSelect.innerHTML =
    `<option value="ALL">All topics</option>` +
    topics.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");

  const topicName = getQueryParam("topic");
  if (topicName) {
    const match = topics.find(t => String(t.name).toLowerCase() === String(topicName).toLowerCase());
    if (match) topicSelect.value = String(match.id);
  }
}

async function loadQuestions() {
  doneBox.style.display = "none";
  feedbackBox.textContent = "";
  optionsWrap.innerHTML = "";
  questionText.textContent = "Loading questions…";
  progressText.textContent = "Loading…";
  nextBtn.disabled = true;

  const topicId = topicSelect.value;
  const search = (searchBox.value || "").trim().toLowerCase();
  const limit = Math.max(5, Math.min(200, parseInt(limitBox.value || "25", 10)));

  let qQuery = "questions?select=id,topic_id,question_text,explanation&order=created_at.desc";
  if (topicId !== "ALL") qQuery += `&topic_id=eq.${encodeURIComponent(topicId)}`;

  const qRows = await restGet(qQuery);
  if (!qRows.length) {
    questions = [];
    setEmpty("No questions found. Add questions in Supabase or via Admin.");
    return;
  }

  const tRows = await restGet("topics?select=id,name");
  const topicMap = new Map(tRows.map(t => [String(t.id), t.name]));

  const ids = qRows.map(r => r.id).join(",");
  const oRows = await restGet(
    `options?select=question_id,option_text,is_correct,option_order&question_id=in.(${ids})&order=question_id.asc,option_order.asc`
  );

  const optMap = new Map();
  for (const o of oRows) {
    const key = String(o.question_id);
    if (!optMap.has(key)) optMap.set(key, []);
    optMap.get(key).push(o);
  }

  let built = qRows.map(r => {
    const opts = optMap.get(String(r.id)) || [];
    const options = opts.map(x => x.option_text);
    const correctIndex = opts.findIndex(x => x.is_correct === true);

    return {
      id: r.id,
      topic: topicMap.get(String(r.topic_id)) || "Uncategorised",
      q: r.question_text,
      explain: r.explanation || "",
      options,
      correctIndex,
    };
  });

  if (search) {
    built = built.filter(q =>
      q.q.toLowerCase().includes(search) ||
      q.options.some(o => String(o).toLowerCase().includes(search))
    );
  }

  built = built.slice(0, limit);

  questions = built;
  idx = 0;
  score = 0;
  locked = false;
  scoreText.textContent = "0";

  if (!questions.length) {
    setEmpty("No questions match your filter.");
    return;
  }

  render();
}

function render() {
  locked = false;
  feedbackBox.textContent = "";
  nextBtn.disabled = true;

  const q = questions[idx];
  progressText.textContent = `Question ${idx + 1}/${questions.length}`;
  topicTag.textContent = q.topic;
  questionText.textContent = q.q;

  const labels = ["A", "B", "C", "D"];

  optionsWrap.innerHTML = q.options.map((opt, i) => `
    <div class="card optionCard" data-i="${i}">
      <div class="optionLabel">${labels[i] || "?"}</div>
      <div class="muted">${esc(opt)}</div>
    </div>
  `).join("");

  optionsWrap.querySelectorAll("[data-i]").forEach(card => {
    card.addEventListener("click", () => choose(parseInt(card.getAttribute("data-i"), 10), card));
  });
}

function choose(choiceIndex, cardEl) {
  if (locked) return;
  locked = true;

  const q = questions[idx];

  // Safety: if no correct option exists, prevent crash
  if (q.correctIndex < 0) {
    feedbackBox.textContent = "This question has no correct answer set in the database.";
    nextBtn.disabled = false;
    return;
  }

  const correct = choiceIndex === q.correctIndex;

  const cards = [...optionsWrap.querySelectorAll("[data-i]")];
  cards.forEach((c) => {
    const i = parseInt(c.getAttribute("data-i"), 10);
    if (i === q.correctIndex) c.classList.add("correct");
  });

  if (!correct) {
    cardEl.classList.add("wrong");
    feedbackBox.textContent = `Incorrect. Correct: ${q.options[q.correctIndex]}. ${q.explain}`;
  } else {
    score += 1;
    scoreText.textContent = String(score);
    feedbackBox.textContent = `Correct. ${q.explain}`;
  }

  nextBtn.disabled = false;
}

function next() {
  if (!questions.length) return;
  if (idx < questions.length - 1) {
    idx += 1;
    render();
  } else {
    finish();
  }
}

function skip() {
  if (!questions.length) return;
  if (idx < questions.length - 1) {
    idx += 1;
    render();
  } else {
    finish();
  }
}

function finish() {
  const total = questions.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  finalLine.textContent = `Final score: ${score}/${total} (${pct}%).`;
  doneBox.style.display = "block";
  questionText.textContent = "Quiz complete.";
  optionsWrap.innerHTML = "";
  feedbackBox.textContent = "";
  nextBtn.disabled = true;
}

// Events
reloadBtn.addEventListener("click", loadQuestions);
topicSelect.addEventListener("change", loadQuestions);
restartBtn.addEventListener("click", loadQuestions);

nextBtn.addEventListener("click", next);
skipBtn.addEventListener("click", skip);

searchBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadQuestions();
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "a") optionsWrap.querySelector('[data-i="0"]')?.click();
  if (k === "b") optionsWrap.querySelector('[data-i="1"]')?.click();
  if (k === "c") optionsWrap.querySelector('[data-i="2"]')?.click();
  if (k === "d") optionsWrap.querySelector('[data-i="3"]')?.click();
  if (k === "n" && !nextBtn.disabled) next();
  if (k === "s") skip();
});

// Init
(async function init() {
  try {
    await loadTopics();
    await loadQuestions();
  } catch (e) {
    setEmpty("Failed to load quiz.");
    feedbackBox.textContent = e?.message || String(e);
  }
})();
