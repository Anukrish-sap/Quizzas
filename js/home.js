import { getSupabase } from "/public/js/supabaseClient.js";

const supabase = getSupabase();

const yearEl = document.getElementById("year");
yearEl.textContent = new Date().getFullYear();

const topicsGrid = document.getElementById("topicsGrid");
const topicCount = document.getElementById("topicCount");
const statusText = document.getElementById("statusText");
const reloadBtn = document.getElementById("reloadBtn");

async function loadTopics() {
  statusText.textContent = "Loading...";
  topicsGrid.innerHTML = "";

  const { data, error } = await supabase
    .from("topics")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) {
    statusText.textContent = "Error";
    topicsGrid.innerHTML = `<div class="muted">Failed to load topics.</div>`;
    topicCount.textContent = "—";
    return;
  }

  topicCount.textContent = String(data.length);
  statusText.textContent = "Online";

  if (data.length === 0) {
    topicsGrid.innerHTML = `<div class="muted">No topics yet.</div>`;
    return;
  }

  topicsGrid.innerHTML = data.map(t => `
    <div class="topicCard">
      <h3>${escapeHtml(t.name)}</h3>
      <p>Practice questions under this topic.</p>
      <a class="btn secondary" href="/public/quiz.html?topic=${t.id}">Practice</a>
    </div>
  `).join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

reloadBtn.addEventListener("click", loadTopics);

loadTopics();
