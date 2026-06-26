// login.js
// ─────────────────────────────────────────────────────────────
// Greenshine Academy login logic.
//
// IMPORTANT — these credentials live in the browser, so anyone who
// views the page source (or the GitHub repo) can read them. This is
// suitable only for a trusted admin device, NOT as real protection
// for sensitive data on a public URL. For real security the password
// check must happen on a server the user cannot see.
//
// The session key MUST match session.js and sidebar.js.
// ─────────────────────────────────────────────────────────────
(function () {

  const CREDENTIALS = [
    { username: "admin",   password: "greenshine2025" },
    { username: "finance", password: "finance2025"    },
  ];

  const SESSION_KEY = "greenshine_session_v1";

  // Already signed in → go straight to the dashboard.
  if (sessionStorage.getItem(SESSION_KEY) === "true") {
    window.location.replace("index.html");
    return;
  }

  document.addEventListener("DOMContentLoaded", () => {

    const yrEl = document.getElementById("yr");
    if (yrEl) yrEl.textContent = new Date().getFullYear();

    const loginUser     = document.getElementById("loginUser");
    const loginPass     = document.getElementById("loginPass");
    const btnLogin      = document.getElementById("btnLogin");
    const loginError    = document.getElementById("loginError");
    const loginErrorMsg = document.getElementById("loginErrorMsg");
    const btnTogglePw   = document.getElementById("btnTogglePw");

    // ── Show / hide password ───────────────────────────────
    btnTogglePw?.addEventListener("click", () => {
      const isPassword = loginPass.type === "password";
      loginPass.type = isPassword ? "text" : "password";
      btnTogglePw.textContent = isPassword ? "🙈" : "👁";
    });

    // ── Error helpers ──────────────────────────────────────
    function showError(msg) {
      if (loginErrorMsg) loginErrorMsg.textContent = msg;
      loginError?.classList.add("visible");
      if (loginPass) loginPass.value = "";
      loginPass?.focus();
    }

    function hideError() {
      loginError?.classList.remove("visible");
    }

    // ── Attempt login ──────────────────────────────────────
    function attemptLogin() {
      hideError();

      const user = String(loginUser?.value || "").trim().toLowerCase();
      const pass = String(loginPass?.value || "");

      if (!user) { showError("Please enter your username."); loginUser?.focus(); return; }
      if (!pass) { showError("Please enter your password."); loginPass?.focus(); return; }

      // Loading state
      if (btnLogin) {
        btnLogin.disabled  = true;
        btnLogin.innerHTML = '<span class="spinner"></span>Signing in…';
      }

      setTimeout(() => {
        const match = CREDENTIALS.find(
          (c) => c.username === user && c.password === pass
        );

        if (match) {
          sessionStorage.setItem(SESSION_KEY, "true");
          sessionStorage.setItem(SESSION_KEY + "_user", match.username);
          window.location.replace("index.html");
        } else {
          if (btnLogin) {
            btnLogin.disabled    = false;
            btnLogin.textContent = "Sign In";
          }
          showError("Incorrect username or password. Please try again.");
        }
      }, 500);
    }

    // ── Listeners ──────────────────────────────────────────
    btnLogin?.addEventListener("click", attemptLogin);

    [loginUser, loginPass].forEach((el) => {
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") attemptLogin();
      });
      el?.addEventListener("input", hideError);
    });

  });

})();