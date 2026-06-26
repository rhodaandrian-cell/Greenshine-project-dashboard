// session.js
// ─────────────────────────────────────────────────────────────
// Session guard. Included in the <head> of every protected page.
// If there is no active session, it immediately redirects to the
// login page. Because it runs in the <head> before the body, the
// protected content never meaningfully renders for a logged-out user.
//
// NOTE: window.location.replace() does not halt the rest of the
// page's scripts, so page scripts (e.g. dashboard.js) also re-check
// this same key and bail out early. Keep the key in sync across
// session.js, login.js and sidebar.js.
// ─────────────────────────────────────────────────────────────
(function () {
  const SESSION_KEY = "greenshine_session_v1";

  if (sessionStorage.getItem(SESSION_KEY) !== "true") {
    window.location.replace("login.html");
  }
})();