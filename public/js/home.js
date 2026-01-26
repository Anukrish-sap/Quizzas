// public/js/home.js

const SUPABASE_URL = "https://ywqkgttthlpytpwaxwpr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nrvv6YM3tKg0NZL1Bkvk0w_tlVWRoEA";

const topicsGrid = document.getElementById("topicsGrid");
const reloadBtn = document.getElementById("reloadBtn");
const topicCount = document.getElementById("topicCount");
const statusText = document.getElementById("statusText");

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(s) {
  statusText.textContent = s;
}

function renderLoading() {
  topicsGrid.innerHTML = `
    <div class="topicCard" style="grid-column: span 12">
      <h3>Loading topics…</h3>
      <p class="muted">Fetching from Supabase.</p>
    </div>
  `;
}

function renderError(msg) {
  topicsGrid.innerHTML = `
    <div class="topicCard" style="grid-column: span 12">
      <h3>Could not load topics</h3>
      <p class="muted">${escapeHtml(msg)}</p>
      <p class="muted">Check your RLS SELECT policies for topics/questions/options.</p>
    </div>
  `;
}

function renderEmpty() {
  topicsGrid.innerHTML = `
    <div class="topicCard" style="grid-column: span 12">
      <h3>No topics yet</h3>
      <p class="muted">Insert rows into the <strong>topics</strong> table in Supabase.</p>
    </div>
  `;
}

function topicCard(t) {
  const name = escapeHtml(t.name);
  const href = `./quiz.html?topic=${encodeURIComponent(t.name)}`;
  return `
    <article class="topicCard">
      <h3 style="margin:0;">${name}</h3>
      <p class="muted">Practice questions under this topic.</p>
      <div class="topicActions">
        <a class="btn" href="${href}">Practice</a>
      </div>
    </article>
  `;
}

async function fetchTopics() {
  const url = `${SUPABASE_URL}/rest/v1/topics?select=id,name&order=name.asc`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`REST ${res.status}: ${text}`);
  }

  return res.json();
}

async function loadTopics() {
  try {
    setStatus("Loading…");
    renderLoading();

    const topics = await fetchTopics();
    topicCount.textContent = String(topics.length);

    if (!topics.length) {
      setStatus("No topics");
      return renderEmpty();
    }

    topicsGrid.innerHTML = topics.map(topicCard).join("");
    setStatus("Online");
  } catch (e) {
    topicCount.textContent = "—";
    setStatus("Error");
    renderError(e?.message || "Unknown error");
  }
}

reloadBtn.addEventListener("click", loadTopics);
loadTopics();
