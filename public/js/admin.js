// ===============================
// Quizzas Admin – Auth + Admin UI
// ===============================

// Supabase client (from config.js)
const supabase = window.supabaseClient;

// Elements
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");

const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const signOutBtn = document.getElementById("signOutBtn");

const authMsg = document.getElementById("authMsg");
const globalMsg = document.getElementById("globalMsg");

const authSection = document.getElementById("authSection");
const adminSection = document.getElementById("adminSection");

const sessionText = document.getElementById("sessionText");
const roleText = document.getElementById("roleText");

// Admin inputs
const topicSelect = document.getElementById("topicSelect");
const newTopicName = document.getElementById("newTopicName");
const createTopicBtn = document.getElementById("createTopicBtn");

const questionText = document.getElementById("questionText");
const explanationText = document.getElementById("explanationText");

const optA = document.getElementById("optA");
const optB = document.getElementById("optB");
const optC = document.getElementById("optC");
const optD = document.getElementById("optD");

const correctSelect = document.getElementById("correctSelect");
const addQuestionBtn = document.getElementById("addQuestionBtn");

const topicMsg = document.getElementById("topicMsg");
const questionMsg = document.getElementById("questionMsg");

// Helpers
function setText(el, msg) {
  if (el) el.textContent = msg || "";
}

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value.trim();
}

// ===============================
// AUTH UI STATE (THIS IS THE KEY)
// ===============================
async function updateUI() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    // LOGGED IN
    authSection.style.display = "none";
    adminSection.style.display = "block";

    signInBtn.style.display = "none";
    signUpBtn.style.display = "none";
    signOutBtn.style.display = "inline-block";

    setText(sessionText, "Active");
    setText(roleText, "Admin");

    await loadTopics();
  } else {
    // LOGGED OUT
    authSection.style.display = "block";
    adminSection.style.display = "none";

    signInBtn.style.display = "inline-block";
    signUpBtn.style.display = "inline-block";
    signOutBtn.style.display = "none";

    setText(sessionText, "None");
    setText(roleText, "—");
  }
}

// ===============================
// AUTH ACTIONS
// ===============================
signInBtn.addEventListener("click", async () => {
  try {
    setText(authMsg, "");

    const email = required(emailEl.value, "Email");
    const password = required(passwordEl.value, "Password");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    setText(authMsg, "Logged in successfully.");
    await updateUI();
  } catch (e) {
    setText(authMsg, e.message);
  }
});

signUpBtn.addEventListener("click", async () => {
  try {
    setText(authMsg, "");

    const email = required(emailEl.value, "Email");
    const password = required(passwordEl.value, "Password");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/public/admin.html`,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already")) {
        setText(authMsg, "This email is already registered. Please log in.");
        return;
      }
      throw error;
    }

    if (data.session) {
      setText(authMsg, "Account created and logged in.");
      await updateUI();
    } else {
      setText(
        authMsg,
        "Account created. Check your email to confirm, then log in."
      );
    }
  } catch (e) {
    setText(authMsg, e.message);
  }
});

signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  setText(globalMsg, "Logged out.");
  await updateUI();
});

// ===============================
// ADMIN FUNCTIONS
// ===============================
async function loadTopics() {
  const { data, error } = await supabase
    .from("topics")
    .select("id,name")
    .order("name");

  if (error) return;

  topicSelect.innerHTML = "";
  data.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    topicSelect.appendChild(opt);
  });
}

createTopicBtn.addEventListener("click", async () => {
  try {
    setText(topicMsg, "");
    const name = required(newTopicName.value, "Topic name");

    const { error } = await supabase.from("topics").insert({ name });
    if (error) throw error;

    newTopicName.value = "";
    setText(topicMsg, "Topic created.");
    await loadTopics();
  } catch (e) {
    setText(topicMsg, e.message);
  }
});

addQuestionBtn.addEventListener("click", async () => {
  try {
    setText(questionMsg, "");

    const topic_id = topicSelect.value;
    const qText = required(questionText.value, "Question");

    const { data: q, error: qErr } = await supabase
      .from("questions")
      .insert({
        topic_id,
        question_text: qText,
        explanation: explanationText.value || "",
      })
      .select()
      .single();

    if (qErr) throw qErr;

    const options = [
      optA.value,
      optB.value,
      optC.value,
      optD.value,
    ];

    const correctIndex = Number(correctSelect.value);

    const rows = options.map((text, i) => ({
      question_id: q.id,
      option_text: text,
      is_correct: i === correctIndex,
      option_order: i + 1,
    }));

    const { error: oErr } = await supabase.from("options").insert(rows);
    if (oErr) throw oErr;

    questionText.value = "";
    explanationText.value = "";
    optA.value = optB.value = optC.value = optD.value = "";

    setText(questionMsg, "Question added successfully.");
  } catch (e) {
    setText(questionMsg, e.message);
  }
});

// ===============================
// INIT
// ===============================
document.getElementById("yearAdmin").textContent = new Date().getFullYear();
updateUI();

// React to auth changes instantly
supabase.auth.onAuthStateChange(() => {
  updateUI();
});
