// public/js/admin.js

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.QUIZZAS_CONFIG;
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const sessionText = document.getElementById("sessionText");
const roleText = document.getElementById("roleText");
const globalMsg = document.getElementById("globalMsg");

const authSection = document.getElementById("authSection");
const adminSection = document.getElementById("adminSection");

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const signOutBtn = document.getElementById("signOutBtn");
const authMsg = document.getElementById("authMsg");

const newTopicName = document.getElementById("newTopicName");
const createTopicBtn = document.getElementById("createTopicBtn");
const topicMsg = document.getElementById("topicMsg");

const topicSelect = document.getElementById("topicSelect");
const questionText = document.getElementById("questionText");
const explanationText = document.getElementById("explanationText");
const optA = document.getElementById("optA");
const optB = document.getElementById("optB");
const optC = document.getElementById("optC");
const optD = document.getElementById("optD");
const correctSelect = document.getElementById("correctSelect");
const addQuestionBtn = document.getElementById("addQuestionBtn");
const questionMsg = document.getElementById("questionMsg");

document.getElementById("yearAdmin").textContent = new Date().getFullYear();

function setText(el, txt) {
  el.textContent = txt || "";
}

function required(value, label) {
  const v = String(value ?? "").trim();
  if (!v) throw new Error(`${label} is required.`);
  return v;
}

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

async function fetchIsAdmin(uid) {
  // profiles RLS must allow user to select their own row
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", uid)
    .maybeSingle();

  if (error) return false;
  return !!data?.is_admin;
}

async function refreshTopics() {
  const { data, error } = await supabase
    .from("topics")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) throw error;

  if (!data || data.length === 0) {
    topicSelect.innerHTML = `<option value="">No topics yet</option>`;
    return;
  }

  topicSelect.innerHTML = data.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
}

async function updateUI() {
  setText(globalMsg, "");
  const session = await getSession();

  if (!session) {
    sessionText.textContent = "Signed out";
    roleText.textContent = "—";
    authSection.style.display = "";
    adminSection.style.display = "none";
    return;
  }

  sessionText.textContent = "Signed in";

  const isAdmin = await fetchIsAdmin(session.user.id);
  roleText.textContent = isAdmin ? "Admin" : "User";

  if (!isAdmin) {
    authSection.style.display = "";
    adminSection.style.display = "none";
    setText(globalMsg, "You are signed in, but not marked as admin. Set profiles.is_admin=true for your user.");
    return;
  }

  authSection.style.display = "none";
  adminSection.style.display = "";
  await refreshTopics();
}

// AUTH
signUpBtn.addEventListener("click", async () => {
  try {
    setText(authMsg, "");
    const email = required(emailEl.value, "Email");
    const password = required(passwordEl.value, "Password");

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    setText(authMsg, "Signed up. If confirmations are enabled, check your email. Then sign in.");
    await updateUI();
  } catch (e) {
    setText(authMsg, e.message || String(e));
  }
});

signInBtn.addEventListener("click", async () => {
  try {
    setText(authMsg, "");
    const email = required(emailEl.value, "Email");
    const password = required(passwordEl.value, "Password");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    setText(authMsg, "Signed in.");
    await updateUI();
  } catch (e) {
    setText(authMsg, e.message || String(e));
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    setText(globalMsg, "");
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setText(globalMsg, "Signed out.");
    await updateUI();
  } catch (e) {
    setText(globalMsg, e.message || String(e));
  }
});

// CREATE TOPIC
createTopicBtn.addEventListener("click", async () => {
  try {
    setText(topicMsg, "");
    const name = required(newTopicName.value, "Topic name");

    const { error } = await supabase.from("topics").insert([{ name }]);
    if (error) throw error;

    newTopicName.value = "";
    setText(topicMsg, "Topic created.");
    await refreshTopics();
  } catch (e) {
    setText(topicMsg, e.message || String(e));
  }
});

// ADD QUESTION + OPTIONS
addQuestionBtn.addEventListener("click", async () => {
  try {
    setText(questionMsg, "");

    const topic_id = required(topicSelect.value, "Topic");
    const qText = required(questionText.value, "Question text");
    const explanation = String(explanationText.value || "").trim();

    const options = [
      required(optA.value, "Option A"),
      required(optB.value, "Option B"),
      required(optC.value, "Option C"),
      required(optD.value, "Option D"),
    ];

    const correctIndex = parseInt(correctSelect.value, 10);
    if (Number.isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error("Correct option must be A, B, C, or D.");
    }

    // Insert question
    const { data: qData, error: qErr } = await supabase
      .from("questions")
      .insert([{ topic_id, question_text: qText, explanation }])
      .select("id")
      .single();

    if (qErr) throw qErr;

    const question_id = qData.id;

    // Insert options with option_order = 0..3
    const optRows = options.map((text, i) => ({
      question_id,
      option_text: text,
      option_order: i,
      is_correct: i === correctIndex,
    }));

    const { error: oErr } = await supabase.from("options").insert(optRows);
    if (oErr) throw oErr;

    // Clear inputs
    questionText.value = "";
    explanationText.value = "";
    optA.value = "";
    optB.value = "";
    optC.value = "";
    optD.value = "";
    correctSelect.value = "0";

    setText(questionMsg, "Question added successfully.");
  } catch (e) {
    setText(questionMsg, e.message || String(e));
  }
});

// Listen for auth changes
supabase.auth.onAuthStateChange(async () => {
  await updateUI();
});

// Init
updateUI();
