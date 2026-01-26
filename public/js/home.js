// public/js/home.js

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.QUIZZAS_CONFIG;

const topicsGrid = document.getElementById("topicsGrid");
const topicCount = document.getElementById("topicCount");
const questionCount = document.getElementById("questionCount");
const statusText = document.getElementById("statusText");
const reloadBtn = document.getElementById("reloadBtn");

document.getElementById("year").textContent = new Date().getFullYear();

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function renderLoading() {
  topicsGrid.innerHTML = `
    <div class="card cardWide">
      <h3>Loading topics…</h3>
      <p class="muted">Fetching live data from Supabase.</p>
    </div>
  `;
}

function renderError(msg) {
  topicsGrid.innerHTML = `
    <div class="card cardWide">
      <h3>Could not load topics</h3>
      <p class="muted">${esc(msg)}</p>
    </div>
  `;
}

function renderEmpty() {
  topicsGrid.innerHTML = `
    <div class="card cardWide">
      <h3>No topics found</h3>
      <p class="muted">Add rows to the topics table in Supabase.</p>
    </div>
  `;
}

function topicCard(topicName) {
  const href = `/public/quiz.html?topic=${encodeURIComponent(topicName)}`;
  return `
    <div class="card">
      <h3>${esc(topicName)}</h3>
      <p class="muted">Practice questions in this topic.</p>
      <a class="btn small" href="${href}">Practice</a>
    </div>
  `;
}

async function loadHome() {
  try {
    statusText.textContent = "Loading…";
    renderLoading();

    const topics = await restGet("topics?select=id,name&order=name.asc");
    const questions = await restGet("questions?select=id");

    topicCount.textContent = String(topics.length);
    questionCount.textContent = String(questions.length);
    statusText.textContent = "Online";

    if (!topics.length) {
      renderEmpty();
      return;
    }

    topicsGrid.innerHTML = topics.map(t => topicCard(t.name)).join("");
  } catch (e) {
    topicCount.textContent = "0";
    questionCount.textContent = "0";
    statusText.textContent = "Error";
    renderError(e?.message || "Unknown error");
  }
}

reloadBtn.addEventListener("click", loadHome);
loadHome();
