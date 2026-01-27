import { getSupabase } from "/public/js/supabaseClient.js";

const supabase = getSupabase();

document.getElementById("year").textContent = new Date().getFullYear();

const topicPick = document.getElementById("topicPick");
const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");

const quizTopic = document.getElementById("quizTopic");
const quizHint = document.getElementById("quizHint");

const questionCard = document.getElementById("questionCard");
const questionText = document.getElementById("questionText");
const choices = document.getElementById("choices");
const feedback = document.getElementById("feedback");

let currentQuestions = [];
let currentIndex = -1;
let locked = false;

const params = new URLSearchParams(window.location.search);
const preTopic = params.get("topic");

async function loadTopics() {
  const { data, error } = await supabase
    .from("topics")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) {
    topicPick.innerHTML = `<option value="">Failed to load topics</option>`;
    return;
  }

  if (!data || data.length === 0) {
    topicPick.innerHTML = `<option value="">No topics yet</option>`;
    return;
  }

  topicPick.innerHTML = data.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");

  if (preTopic) {
    topicPick.value = preTopic;
  }
}

async function startQuiz() {
  const topicId = topicPick.value;
  if (!topicId) return;

  quizHint.textContent = "Loading questions...";
  nextBtn.disabled = true;

  const { data: qData, error: qErr } = await supabase
    .from("questions")
    .select("id,question_text,explanation")
    .eq("topic_id", Number(topicId))
    .order("id", { ascending: true });

  if (qErr) {
    quizHint.textContent = "Failed to load questions.";
    return;
  }

  if (!qData || qData.length === 0) {
    quizHint.textContent = "No questions in this topic yet.";
    questionCard.style.display = "none";
    return;
  }

  currentQuestions = qData;
  currentIndex = 0;
  quizTopic.textContent = `Topic: ${topicPick.options[topicPick.selectedIndex].text}`;
  quizHint.textContent = `Questions: ${currentQuestions.length}`;
  questionCard.style.display = "";
  await renderQuestion();
}

async function renderQuestion() {
  locked = false;
  feedback.textContent = "";
  choices.innerHTML = "";
  nextBtn.disabled = true;

  const q = currentQuestions[currentIndex];
  questionText.textContent = q.question_text;

  const { data: oData, error: oErr } = await supabase
    .from("options")
    .select("id, option_text, is_correct, option_order")
    .eq("question_id", q.id)
    .order("option_order", { ascending: true });

  if (oErr || !oData || oData.length === 0) {
    choices.innerHTML = `<div class="muted">No options found for this question.</div>`;
    return;
  }

  oData.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.textContent = opt.option_text;
    btn.addEventListener("click", () => chooseAnswer(btn, opt.is_correct, q.explanation, oData));
    choices.appendChild(btn);
  });
}

function chooseAnswer(btn, isCorrect, explanation, allOptions) {
  if (locked) return;
  locked = true;

  const buttons = [...choices.querySelectorAll("button.choice")];

  buttons.forEach((b, i) => {
    // mark correct one
    const correct = allOptions[i]?.is_correct;
    if (correct) b.classList.add("correct");
  });

  if (isCorrect) {
    btn.classList.add("correct");
    feedback.style.color = "rgba(124,255,78,0.95)";
    feedback.textContent = explanation ? `Correct. ${explanation}` : "Correct.";
  } else {
    btn.classList.add("wrong");
    feedback.style.color = "rgba(255,120,120,0.95)";
    feedback.textContent = explanation ? `Not quite. ${explanation}` : "Not quite.";
  }

  nextBtn.disabled = false;
}

function nextQuestion() {
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    feedback.style.color = "rgba(124,255,78,0.95)";
    feedback.textContent = "Finished! Pick another topic to practice more.";
    nextBtn.disabled = true;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", nextQuestion);

loadTopics();
