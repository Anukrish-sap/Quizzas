// public/js/admin.js

const SUPABASE_URL = "https://ywqkgttthlpytpwaxwpr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nrvv6YM3tKg0NZL1Bkvk0w_tlVWRoEA";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Elements
const sessionCard = document.getElementById("sessionCard");
const adminActions = document.getElementById("adminActions");

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const logoutBtn = document.getElementById("logoutBtn");

const authMsg = document.getElementById("authMsg");
const sessionText = document.getElementById("sessionText");
const roleText = document.getElementById("roleText");

// Admin elements
const topicSelect = document.getElementById("topicSelect");
const topicName = document.getElementById("topicName");
const createTopicBtn = document.getElementById("createTopicBtn");
const topicMsg = document.getElementById("topicMsg");

const questionText = document.getElementById("questionText");
const explanation = document.getElementById("explanation");
const optA = document.getElementById("optA");
const optB = document.getElementById("optB");
const optC = document.getElementById("optC");
const optD = document.getElementById("optD");
const correctOpt = document.getElementById("correctOpt");
const addQuestionBtn = document.getElementById("addQuestionBtn");
const questionMsg = document.getElementById("questionMsg");

function setMsg(el, text, ok = false) {
  if (!el) return;
  el.textContent = text || "";
  el.style.color = ok ? "rgba(124,255,78,0.95)" : "rgba(255,120,120,0.95)";
  if (!text) el.style.color = "";
}

function setLoggedOutUI() {
  sessionCard.style.display = "none";
  adminActions.style.display = "none";

  logoutBtn.style.display = "none";
  loginBtn.style.display = "";
  signupBtn.style.display = "";

  if (sessionText) sessionText.textContent = "—";
  if (roleText) roleText.textContent = "—";

  setMsg(authMsg, "");
  setMsg(topicMsg, "");
  setMsg(questionMsg, "");
}

function setLoggedInUI(userEmail) {
  sessionCard.style.display = "";
  adminActions.style.display = "";

  logoutBtn.style.display = "";
  loginBtn.style.display = "none";
  signupBtn.style.display = "none";

  if (sessionText) sessionText.textContent = "Active";
  if (roleText) roleText.textContent = "Admin";

  setMsg(authMsg, `Logged in as ${userEmail}`, true);
}

async function loadTopics() {
  topicSelect.innerHTML = `<option value="">Loading topics...</option>`;

  const { data, error } = await supabase
    .from("topics")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) {
    topicSelect.innerHTML = `<option value="">Failed to load topics</option>`;
    return;
  }

  if (!data || data.length === 0) {
    topicSelect.innerHTML = `<option value="">No topics yet</option>`;
    return;
  }

  topicSelect.innerHTML = data.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
}

// Auth
async function logIn() {
  setMsg(authMsg, "");
  const email = (emailEl.value || "").trim();
  const password = passwordEl.value || "";

  if (!email || !password) return setMsg(authMsg, "Enter email and password.");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return setMsg(authMsg, error.message);

  setLoggedInUI(data.user.email);
  await loadTopics();
}

async function signUp() {
  setMsg(authMsg, "");
  const email = (emailEl.value || "").trim();
  const password = passwordEl.value || "";

  if (!email || !password) return setMsg(authMsg, "Enter email and password.");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/public/admin.html`,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered")) {
      return setMsg(authMsg, "That email is already registered. Please log in instead.");
    }
    return setMsg(authMsg, error.message);
  }

  // If confirmation is enabled: no session until email is confirmed
  if (!data.session) {
    return setMsg(authMsg, "Signup created. Check your email to confirm, then log in.", true);
  }

  setLoggedInUI(data.user.email);
  await loadTopics();
}

async function logOut() {
  await supabase.auth.signOut();
  setLoggedOutUI();
}

// Admin actions
async function createTopic() {
  setMsg(topicMsg, "");
  const name = (topicName.value || "").trim();
  if (!name) return setMsg(topicMsg, "Enter a topic name.");

  const { error } = await supabase.from("topics").insert([{ name }]);

  if (error) return setMsg(topicMsg, error.message);

  setMsg(topicMsg, "Topic created.", true);
  topicName.value = "";
  await loadTopics();
}

async function addQuestion() {
  setMsg(questionMsg, "");

  const topic_id = topicSelect.value;
  const qText = (questionText.value || "").trim();
  const expl = (explanation.value || "").trim();
  const A = (optA.value || "").trim();
  const B = (optB.value || "").trim();
  const C = (optC.value || "").trim();
  const D = (optD.value || "").trim();
  const correct = (correctOpt.value || "A").toUpperCase();

  if (!topic_id) return setMsg(questionMsg, "Pick a topic.");
  if (!qText) return setMsg(questionMsg, "Enter a question.");
  if (!A || !B || !C || !D) return setMsg(questionMsg, "Fill all options A–D.");

  const { data: qData, error: qErr } = await supabase
    .from("questions")
    .insert([{ topic_id: Number(topic_id), question_text: qText, explanation: expl }])
    .select("id")
    .single();

  if (qErr) return setMsg(questionMsg, qErr.message);

  const qid = qData.id;
  const options = [
    { question_id: qid, option_text: A, is_correct: correct === "A", option_order: 1 },
    { question_id: qid, option_text: B, is_correct: correct === "B", option_order: 2 },
    { question_id: qid, option_text: C, is_correct: correct === "C", option_order: 3 },
    { question_id: qid, option_text: D, is_correct: correct === "D", option_order: 4 },
  ];

  const { error: oErr } = await supabase.from("options").insert(options);
  if (oErr) return setMsg(questionMsg, oErr.message);

  setMsg(questionMsg, "Question added.", true);

  questionText.value = "";
  explanation.value = "";
  optA.value = "";
  optB.value = "";
  optC.value = "";
  optD.value = "";
  correctOpt.value = "A";
}

// Events
loginBtn.addEventListener("click", logIn);
signupBtn.addEventListener("click", signUp);
logoutBtn.addEventListener("click", logOut);

createTopicBtn.addEventListener("click", createTopic);
addQuestionBtn.addEventListener("click", addQuestion);

// Init
(async function init() {
  const { data } = await supabase.auth.getSession();

  if (data.session?.user) {
    setLoggedInUI(data.session.user.email);
    await loadTopics();
  } else {
    setLoggedOutUI();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      setLoggedInUI(session.user.email);
      await loadTopics();
    } else {
      setLoggedOutUI();
    }
  });
})();
