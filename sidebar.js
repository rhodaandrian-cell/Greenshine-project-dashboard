// sidebar.js
// ─────────────────────────────────────────────────────────────
// Shared left navigation for every Greenshine page.
// Each page includes:  <aside id="appSidebar" class="sidebar"></aside>
// and  <script src="sidebar.js"></script>
//
// To add or rename a nav item, edit NAV_ITEMS below once — it updates
// across every page. The active page is highlighted automatically by
// matching the current filename.
// ─────────────────────────────────────────────────────────────
(() => {
  const NAV_ITEMS = [
    { href: "index.html",      label: "Dashboard",  icon: "grid" },
    { href: "students.html",   label: "Students",   icon: "users" },
    { href: "receipts.html",   label: "Receipts",   icon: "receipt" },
    { href: "calculator.html", label: "Calculator", icon: "calc" },
    { href: "messages.html",   label: "Alerts",     icon: "bell" },
    { href: "faq.html",        label: "Help & FAQ", icon: "help" },
  ];

  // Minimal inline SVG icons (stroke uses currentColor so they theme cleanly).
  const ICONS = {
    grid:    '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
    users:   '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    calc:    '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h2M16 18h0"/>',
    bell:    '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    help:    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  };

  function currentFile() {
    const path = window.location.pathname;
    const file = path.substring(path.lastIndexOf("/") + 1);
    return file === "" ? "index.html" : file;
  }

  function buildSidebar() {
    const aside = document.getElementById("appSidebar");
    if (!aside) return;

    const active = currentFile();

    const links = NAV_ITEMS.map((item) => {
      const isActive = item.href === active;
      return `
        <a class="sidebar-link ${isActive ? "is-active" : ""}" href="${item.href}" ${isActive ? 'aria-current="page"' : ""}>
          <span class="sidebar-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[item.icon] || ""}</svg>
          </span>
          <span class="sidebar-label">${item.label}</span>
        </a>`;
    }).join("");

    aside.innerHTML = `
      <div class="sidebar-head">
        <div class="logo-mark" aria-hidden="true"></div>
        <div class="sidebar-brand">
          <strong>Greenshine</strong>
          <span>Finance System</span>
        </div>
      </div>
      <nav class="sidebar-nav">${links}</nav>
      <div class="sidebar-foot">
        <button id="sidebarLogout" class="sidebar-link sidebar-logout" type="button">
          <span class="sidebar-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </span>
          <span class="sidebar-label">Sign out</span>
        </button>
      </div>`;

    // Mobile toggle (the button lives in the topbar as #sidebarToggle).
    const toggle = document.getElementById("sidebarToggle");
    toggle?.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
    });

    // Close the drawer when a link is tapped on mobile.
    aside.querySelectorAll(".sidebar-link").forEach((el) => {
      el.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    });

    // Sign out clears the session and returns to login.
    document.getElementById("sidebarLogout")?.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("greenshine_session_v1");
        sessionStorage.removeItem("greenshine_session_v1_user");
      } catch {}
      window.location.replace("login.html");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildSidebar);
  } else {
    buildSidebar();
  }
})();