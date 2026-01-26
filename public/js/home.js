const SUPABASE_URL = "https://ywqkgttthlpytpwaxwpr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nrvv6YM3tKg0NZL1Bkvk0w_tlVWRoEA";

const topicsGrid = document.getElementById("topicsGrid");
const reloadBtn = document.getElementById("reloadBtn");
const topicCount = document.getElementById("topicCount");
const statusText = document.getElementById("statusText");

document.getElementById("year").textContent = new Date().getFullYear();

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[m])
  );
}

async function loadTopics() {
  try {
    statusText.textContent = "Loading…";
    topicsGrid.innerHTML = "";

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/topics?select=id,name&order=name.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    const topics = await res.json();
    topicCount.textContent = topics.length;
    statusText.textContent = "Online";

    if (!topics.length) {
      topicsGrid.innerHTML = "<p class='muted'>No topics available.</p>";
      return;
    }

    topicsGrid.innerHTML = topics.map(t => `
      <div class="topicCard">
        <h3>${escapeHtml(t.name)}</h3>
        <p class="muted">Practice questions in this topic.</p>
        <a class="btn" href="/quiz.html?topic=${encodeURIComponent(t.name)}">Practice</a>
      </div>
    `).join("");

  } catch {
    statusText.textContent = "Error";
    topicsGrid.innerHTML = "<p class='muted'>Failed to load topics.</p>";
  }
}

reloadBtn.addEventListener("click", loadTopics);
loadTopics();
