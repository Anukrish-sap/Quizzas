(function () {
  if (window.__ADMIN_JS_RUNNING__) return;
  window.__ADMIN_JS_RUNNING__ = true;

  const SUPABASE_URL = "https://ywqkgttthlpytpwaxwpr.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cWtndHR0aGxweXRwd2F4d3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NjQ0NTIsImV4cCI6MjA4NDM0MDQ1Mn0.RzCeAl7ouzH5weMLKGiJUPx_1GQvQOe3DP50JR4NbFE";

  // ===== Elements
  const authCard = document.getElementById("authCard");
  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const authMsg = document.getElementById("authMsg");

  const sessionCard = document.getElementById("sessionCard");
  const sessionText = document.getElementById("sessionText");
  const roleText = document.getElementById("roleText");

  const adminActions = document.getElementById("adminActions");

  const topicName = document.getElementById("topicName");
  const createTopicBtn = document.getElementById("createTopicBtn");
  const topicMsg = document.getElementById("topicMsg");

  const topicSelect = document.getElementById("topicSelect");
  const deleteTopicBtn = document.getElementById("deleteTopicBtn");
  const deleteTopicMsg = document.getElementById("deleteTopicMsg");

  const topicSelectForQuestion = document.getElementById("topicSelectForQuestion");
  const questionText = document.getElementById("questionText");
  const explanation = document.getElementById("explanation");
  const optA = document.getElementById("optA");
  const optB = document.getElementById("optB");
  const optC = document.getElementById("optC");
  const optD = document.getElementById("optD");
  const correctOpt = document.getElementById("correctOpt");
  const addQuestionBtn = document.getElementById("addQuestionBtn");
  const questionMsg = document.getElementById("questionMsg");

  const topicSelectForDeleteQ = document.getElementById("topicSelectForDeleteQ");
  const questionSelect = document.getElementById("questionSelect");
  const deleteQuestionBtn = document.getElementById("deleteQuestionBtn");
  const deleteQuestionMsg = document.getElementById("deleteQuestionMsg");

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function setMsg(el, text, ok = false) {
    if (!el) return;
    el.textContent = text || "";
    el.style.color = ok ? "rgba(124,255,78,0.95)" : "rgba(255,120,120,0.95)";
    if (!text) el.style.color = "";
  }

  function valid(email, password) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passOk = typeof password === "string" && password.length >= 6;
    return emailOk && passOk;
  }

  // ===== Supabase
  if (!window.supabase?.createClient) {
    setMsg(authMsg, "❌ Supabase CDN not loaded");
    return;
  }

  if (!window.__SB_CLIENT__) {
    window.__SB_CLIENT__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  const sb = window.__SB_CLIENT__;

  // ===== UI state
  function showLoggedOut() {
    if (authCard) authCard.style.display = "";
    if (sessionCard) sessionCard.style.display = "none";
    if (adminActions) adminActions.style.display = "none";
    setMsg(authMsg, "");
  }

  function showLoggedIn(email) {
    if (authCard) authCard.style.display = "none";

    if (sessionCard) sessionCard.style.display = "";
    if (adminActions) adminActions.style.display = "";

    if (sessionText) sessionText.textContent = "Active";
    if (roleText) roleText.textContent = "Admin";

    setMsg(authMsg, `Logged in as ${email}`, true);

    setMsg(topicMsg, "");
    setMsg(questionMsg, "");
    setMsg(deleteTopicMsg, "");
    setMsg(deleteQuestionMsg, "");

    loadTopicsEverywhere();
  }

  // ===== Load topics
  async function loadTopicsEverywhere() {
    const { data, error } = await sb.from("topics").select("id,name").order("name", { ascending: true });

    if (error) {
      setMsg(topicMsg, "Failed to load topics: " + error.message);
      return;
    }

    const options = (data || []).map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    const empty = `<option value="">No topics</option>`;

    if (topicSelect) topicSelect.innerHTML = data?.length ? options : empty;
    if (topicSelectForQuestion) topicSelectForQuestion.innerHTML = data?.length ? options : empty;
    if (topicSelectForDeleteQ) topicSelectForDeleteQ.innerHTML = data?.length ? options : empty;

    await loadQuestionsForTopic(topicSelectForDeleteQ?.value);
  }

  // ===== Load questions for delete list
  async function loadQuestionsForTopic(topicId) {
    if (!questionSelect) return;

    if (!topicId) {
      questionSelect.innerHTML = `<option value="">Pick a topic first</option>`;
      return;
    }

    const { data, error } = await sb
      .from("questions")
      .select("id,question_text")
      .eq("topic_id", Number(topicId))
      .order("id", { ascending: false });

    if (error) {
      questionSelect.innerHTML = `<option value="">Failed to load questions</option>`;
      setMsg(deleteQuestionMsg, "Failed to load questions: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      questionSelect.innerHTML = `<option value="">No questions in this topic</option>`;
      return;
    }

    questionSelect.innerHTML = data
      .map(q => `<option value="${q.id}">${q.question_text.slice(0, 80)}</option>`)
      .join("");
  }

  // ===== Auth
  async function logIn() {
    setMsg(authMsg, "");
    const email = (emailEl?.value || "").trim();
    const password = passwordEl?.value || "";

    if (!valid(email, password)) return setMsg(authMsg, "Invalid. Please input email and password.");

    setMsg(authMsg, "Logging in...", true);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return setMsg(authMsg, "Login failed: " + error.message);

    showLoggedIn(data.user.email);
  }

  async function signUp() {
    setMsg(authMsg, "");
    const email = (emailEl?.value || "").trim();
    const password = passwordEl?.value || "";

    if (!valid(email, password)) return setMsg(authMsg, "Invalid. Please input email and password.");

    setMsg(authMsg, "Creating account...", true);
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href },
    });

    if (error) return setMsg(authMsg, "Signup failed: " + error.message);
    setMsg(authMsg, "✅ Account created. Check your email to confirm.", true);
  }

  async function logOut() {
    await sb.auth.signOut();
    showLoggedOut();
  }

  // ===== Create topic
  async function createTopic() {
    setMsg(topicMsg, "");
    const name = (topicName?.value || "").trim();
    if (!name) return setMsg(topicMsg, "Enter a topic name.");

    const { error } = await sb.from("topics").insert([{ name }]);
    if (error) return setMsg(topicMsg, "Create failed: " + error.message);

    setMsg(topicMsg, "✅ Topic created", true);
    topicName.value = "";
    await loadTopicsEverywhere();
  }

  // ===== Delete topic
  async function deleteTopic() {
    setMsg(deleteTopicMsg, "");
    const id = topicSelect?.value;
    if (!id) return setMsg(deleteTopicMsg, "Pick a topic.");

    const { data: qRows, error: qErr } = await sb.from("questions").select("id").eq("topic_id", Number(id));
    if (qErr) return setMsg(deleteTopicMsg, "Failed loading questions: " + qErr.message);

    const qIds = (qRows || []).map(r => r.id);

    if (qIds.length) {
      const { error: delOptErr } = await sb.from("options").delete().in("question_id", qIds);
      if (delOptErr) return setMsg(deleteTopicMsg, "Failed deleting options: " + delOptErr.message);

      const { error: delQErr } = await sb.from("questions").delete().in("id", qIds);
      if (delQErr) return setMsg(deleteTopicMsg, "Failed deleting questions: " + delQErr.message);
    }

    const { error: delTopicErr } = await sb.from("topics").delete().eq("id", Number(id));
    if (delTopicErr) return setMsg(deleteTopicMsg, "Failed deleting topic: " + delTopicErr.message);

    setMsg(deleteTopicMsg, "✅ Topic deleted", true);
    await loadTopicsEverywhere();
  }

  // ===== Add question
  async function addQuestion() {
    setMsg(questionMsg, "");

    const topic_id = topicSelectForQuestion?.value;
    const qText = (questionText?.value || "").trim();
    const expl = (explanation?.value || "").trim();
    const A = (optA?.value || "").trim();
    const B = (optB?.value || "").trim();
    const C = (optC?.value || "").trim();
    const D = (optD?.value || "").trim();
    const correct = (correctOpt?.value || "A").toUpperCase();

    if (!topic_id) return setMsg(questionMsg, "Pick a topic.");
    if (!qText) return setMsg(questionMsg, "Enter a question.");
    if (!A || !B || !C || !D) return setMsg(questionMsg, "Fill all options A–D.");

    const { data: qData, error: qErr } = await sb
      .from("questions")
      .insert([{ topic_id: Number(topic_id), question_text: qText, explanation: expl }])
      .select("id")
      .single();

    if (qErr) return setMsg(questionMsg, "Failed adding question: " + qErr.message);

    const qid = qData.id;

    const options = [
      { question_id: qid, option_text: A, is_correct: correct === "A", option_order: 1 },
      { question_id: qid, option_text: B, is_correct: correct === "B", option_order: 2 },
      { question_id: qid, option_text: C, is_correct: correct === "C", option_order: 3 },
      { question_id: qid, option_text: D, is_correct: correct === "D", option_order: 4 },
    ];

    const { error: oErr } = await sb.from("options").insert(options);
    if (oErr) return setMsg(questionMsg, "Failed adding options: " + oErr.message);

    setMsg(questionMsg, "✅ Question added", true);

    questionText.value = "";
    explanation.value = "";
    optA.value = "";
    optB.value = "";
    optC.value = "";
    optD.value = "";
    correctOpt.value = "A";

    await loadQuestionsForTopic(topicSelectForDeleteQ?.value);
  }

  // ===== Delete question
  async function deleteQuestion() {
    setMsg(deleteQuestionMsg, "");
    const qid = questionSelect?.value;
    if (!qid) return setMsg(deleteQuestionMsg, "Pick a question.");

    const { error: delOptErr } = await sb.from("options").delete().eq("question_id", Number(qid));
    if (delOptErr) return setMsg(deleteQuestionMsg, "Failed deleting options: " + delOptErr.message);

    const { error: delQErr } = await sb.from("questions").delete().eq("id", Number(qid));
    if (delQErr) return setMsg(deleteQuestionMsg, "Failed deleting question: " + delQErr.message);

    setMsg(deleteQuestionMsg, "✅ Question deleted", true);
    await loadQuestionsForTopic(topicSelectForDeleteQ?.value);
  }

  // ===== Events
  if (loginBtn) loginBtn.addEventListener("click", logIn);
  if (signupBtn) signupBtn.addEventListener("click", signUp);
  if (logoutBtn) logoutBtn.addEventListener("click", logOut);

  if (createTopicBtn) createTopicBtn.addEventListener("click", createTopic);
  if (deleteTopicBtn) deleteTopicBtn.addEventListener("click", deleteTopic);

  if (addQuestionBtn) addQuestionBtn.addEventListener("click", addQuestion);
  if (deleteQuestionBtn) deleteQuestionBtn.addEventListener("click", deleteQuestion);

  if (topicSelectForDeleteQ) {
    topicSelectForDeleteQ.addEventListener("change", async () => {
      await loadQuestionsForTopic(topicSelectForDeleteQ.value);
    });
  }

  if (passwordEl) {
    passwordEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") logIn();
    });
  }

  // ===== Init session
  (async () => {
    const { data } = await sb.auth.getSession();
    if (data.session?.user) showLoggedIn(data.session.user.email);
    else showLoggedOut();

    sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) showLoggedIn(session.user.email);
      else showLoggedOut();
    });
  })();
})();