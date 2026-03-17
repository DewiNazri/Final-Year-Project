console.log("auth.js loaded");

// ===============================
// Supabase Init
// ===============================
if (!window._supabase) {
  window._supabase = window.supabase.createClient(
    "https://zvbothmzwenoenpmgcnv.supabase.co",
    "sb_publishable_ANaaTi-B_y9JbUGrTxTrwg_jkWSQlIC"
  );
}
const sb = window._supabase;

// ===============================
// Bootstrap Modal
// ===============================
let authModal = null;
document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("authModal");
  if (modalEl) authModal = new bootstrap.Modal(modalEl);
});

// ===============================
// Navbar Elements
// ===============================
const navAuthBtn = document.getElementById("navAuthBtn");
const navProfile = document.getElementById("navProfile");

// ===============================
// Update Navbar (CORE LOGIC)
// ===============================
async function updateNavbarAuth() {
  const { data: { session } } = await sb.auth.getSession();

  if (!navAuthBtn) return;

  if (session) {
    // Logged in
    navAuthBtn.textContent = "Logout";
    navAuthBtn.dataset.state = "logout";
    navProfile?.classList.remove("d-none");
  } else {
    // Not logged in
    navAuthBtn.textContent = "Login";
    navAuthBtn.dataset.state = "login";
    navProfile?.classList.add("d-none");
  }
}

// ===============================
// Login / Logout Button
// ===============================
if (navAuthBtn) {
  navAuthBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (navAuthBtn.dataset.state === "login") {
      authModal?.show();
    } else {
      // LOGOUT
      await sb.auth.signOut();
      await updateNavbarAuth();

      // Redirect after logout
      window.location.href = "index.html";
    }
  });
}


// ===============================
// SIGN UP
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(signupForm);
      const username = formData.get("username");
      const email = formData.get("email");
      const password = formData.get("password");

      // ✅ ADDED: check if email already exists in your "users" table
      const { data: existing, error: checkErr } = await sb
        .from("users")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (checkErr) return alert(checkErr.message);
      if (existing) return alert("This email is already registered");

      const { data, error } = await sb.auth.signUp({ email, password });

      // ✅ ADDED: if Supabase Auth says already registered, show your message
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          return alert("This email is already registered");
        }
        return alert(error.message);
      }

      const { error: insertError } = await sb.from("users").insert({
        user_id: data.user.id,
        username,
        email,
        role: "user",
      });

      if (insertError) return alert(insertError.message);

      alert("Registration successful! Please sign in.");
      signupForm.reset();
      document.getElementById("goSignin")?.click();
    });
  }



  // ===============================
  // SIGN IN
  // ===============================
  const signinForm = document.getElementById("signinForm");
  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData(signinForm);
      const email = formData.get("email");
      const password = formData.get("password");

      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return alert(error.message);

      // get role from your "users" table
      const userId = data.user.id;
      const { data: u, error: uErr } = await sb
        .from("users")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (uErr) {
        console.error(uErr);
        alert("Login ok, but cannot read role.");
        window.location.href = "/index.html";
        return;
      }

      authModal?.hide();
      await updateNavbarAuth();

      // redirect by role
      if (u.role === "admin") {
        window.location.href = "/Admin/dashboard.html";
      } else {
        window.location.href = "/index.html";
      }
    });
  }


  // ===============================
  // INITIAL CHECK (IMPORTANT)
  // ===============================
  updateNavbarAuth();
});

// ===============================
// Password Eye Toggle (Sign In / Sign Up)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const toggleButtons = document.querySelectorAll(".toggle-password");
  if (!toggleButtons.length) return;

  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      if (!targetId) return;

      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      // icon swap (Font Awesome)
      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-eye", !isPassword);
        icon.classList.toggle("fa-eye-slash", isPassword);
      }

      btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    });
  });

  
});



// ===============================
// Take Quiz Button Protection
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const takeQuizBtn = document.getElementById("takeQuizBtn");

  if (!takeQuizBtn) return;

  takeQuizBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
      authModal?.show();
    } else {
      window.location.href = "diagnostics.html";
    }
  });
});
