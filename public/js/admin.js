// public/js/admin.js

(function () {
  const $ = (id) => document.getElementById(id);

  const sessionText = $("sessionText");
  const roleText = $("roleText");
  const globalMsg = $("globalMsg");

  const authSection = $("authSection");
  const adminSection = $("adminSection");

  const emailEl = $("email");
  const passwordEl = $("password");
  const signInBtn = $("signInBtn");
  const signUpBtn = $("signUpBtn");
  const signOutBtn = $("signOutBtn");
  const authMsg = $("authMsg");

  const newTopicName = $("newTopicName");
  const createTopicBtn = $("createTopicBtn");
  const topicMsg = $("topicMsg");

  const topicSelect = $("topicSelect");
  const questionText = $("questionText");
  const explanationText = $("explanationText");
  const optA = $("optA");
  const optB = $("optB");
  const optC = $("optC");
  const optD = $("optD");
  const correctSelect = $("correctSelect");
  const addQuestionBtn = $("addQuestionBtn");
  const questionMsg = $("questionMsg");

  $("yearAdmin").textContent = new Date().getFullYear();

  function setText(el, txt) {
    if (!el) return;
    el.textContent = txt || "";
  }

  function required(value, label) {
    const v = String(value ?? "").trim();
    if (!v) throw new Error(`${label} is required.`);
    return v;
  }

  // Hard fail checks (this is what will tell us why buttons do nothing)
  if (!window.QUIZZAS_CONFIG) {
    setText(globalMsg, "ERROR: /public/js/config.js did not load. Check the file path and Live Server root.");
    console.error("QUIZZAS_CONFIG missing. config.js not loaded.");
    return;
  }
  if (!window.supabase) {
    setText(globalMsg, "ERROR: Supabase library did not load. Check your internet or the CDN script tag.");
    console.error("window.supabase missing. supabase-js CDN not loaded.");
    return;
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.QUIZZAS_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function fetchIsAdmin(uid) {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      // If profiles RLS is wrong, show it clearly
      console.error("profiles select error:", error);
      return false;
    }
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
    setText(authMsg, "");
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
      setText(globalMsg, "You are signed in, but not an admin. Ask the owner to set profiles.is_admin=true for your UUID.");
      return;
    }

    authSection.style.display = "none";
    adminSection.style.display = "";
    await refreshTopics();
  }

  // Auth handlers
  signUpBtn.addEventListener("click", async () => {
    try {
      setText(authMsg, "");
      const email = required(emailEl.value, "Email");
      const password = required(passwordEl.value, "Password");

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      // Some projects require email confirmation; data.user may exist but session may be null.
      if (data.session) {
        setText(authMsg, "Signed up and signed in.");
      } else {
        setText(authMsg, "Signed up. If email confirmation is enabled, confirm your email before signing in.");
      }

      await updateUI();
    } catch (e) {
      console.error(e);
      setText(authMsg, e?.message || String(e));
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
      console.error(e);
      setText(authMsg, e?.message || String(e));
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
      console.error(e);
      setText(globalMsg, e?.message || String(e));
    }
  });

  // Admin: create topic
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
      console.error(e);
      setText(topicMsg, e?.message || String(e));
    }
  });

  // Admin: add question + options
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

      // Insert 4 options (option_order = 0..3)
      const question_id = qData.id;
      const optRows = options.map((text, i) => ({
        question_id,
        option_text: text,
        option_order: i,
        is_correct: i === correctIndex,
      }));

      const { error: oErr } = await supabase.from("options").insert(optRows);
      if (oErr) throw oErr;

      // Clear
      questionText.value = "";
      explanationText.value = "";
      optA.value = "";
      optB.value = "";
      optC.value = "";
      optD.value = "";
      correctSelect.value = "0";

      setText(questionMsg, "Question added successfully.");
    } catch (e) {
      console.error(e);
      setText(questionMsg, e?.message || String(e));
    }
  });

  // Live session updates
  supabase.auth.onAuthStateChange(() => {
    updateUI().catch((e) => {
      console.error(e);
      setText(globalMsg, e?.message || String(e));
    });
  });

  // Init
  updateUI().catch((e) => {
    console.error(e);
    setText(globalMsg, e?.message || String(e));
  });
})();
