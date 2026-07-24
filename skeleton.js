// skeleton.js
// ─────────────────────────────────────────────────────────────
// Shared in-page loading state. Replaces the old full-screen
// #loadingOverlay: the page shell (sidebar, topbar, layout) is
// visible and usable immediately, and only the content area shows
// a shimmer placeholder while the first sync runs.
//
// Include on every page that previously used the overlay:
//   <script src="skeleton.js"></script>   (after sidebar.js)
//
// API (all no-ops if the relevant elements aren't on the page):
//   App.skeleton.start()        → show shimmer + nav/status loading
//   App.skeleton.stop()         → clear loading state
//   App.skeleton.tableRows(sel, cols, n)  → fill a tbody with n shimmer rows
//   App.skeleton.metaValues()   → shimmer the .meta-value cells
// ─────────────────────────────────────────────────────────────
(() => {
  const App = (window.App = window.App || {});

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function skHtml(width, height) {
    const w = width  || "60%";
    const h = height || "13px";
    return `<span class="skeleton" style="width:${w};height:${h};"></span>`;
  }

  // A spread of natural-looking widths so rows don't look uniform.
  const COL_WIDTHS = ["70%", "55%", "34%", "46%", "60%", "64%", "58%", "50%", "44%", "62%"];

  // Fill a table body with shimmer rows matching the column count.
  function tableRows(tbodySelector, cols, n = 6) {
    const tbody = $(tbodySelector);
    if (!tbody) return;
    let out = "";
    for (let i = 0; i < n; i++) {
      let cells = "";
      for (let c = 0; c < cols; c++) {
        cells += `<td>${skHtml(COL_WIDTHS[c % COL_WIDTHS.length])}</td>`;
      }
      out += `<tr class="sk-row">${cells}</tr>`;
    }
    tbody.innerHTML = out;
  }

  // Shimmer every .meta-value on the page (KPI + meta strip numbers).
  // Cells that hold a .badge (e.g. the "Viewing" term badge) are left alone —
  // shimmering them would destroy the badge element the page updates later.
  function metaValues() {
    $$(".meta-value").forEach((el) => {
      if (el.querySelector(".badge")) return;
      el.innerHTML = skHtml("64%", "22px");
    });
    $$(".kpi-value").forEach((el) => {
      el.innerHTML = skHtml("70%", "22px");
    });
  }

  // Swap the active sidebar icon for a small spinner and pulse the status dot.
  function setChromeLoading(on) {
    const activeIco = $(".sidebar-link.is-active .sidebar-ico");
    if (activeIco) {
      if (on) {
        if (activeIco.dataset.skIcon == null) activeIco.dataset.skIcon = activeIco.innerHTML;
        activeIco.innerHTML = '<span class="nav-spin" aria-hidden="true"></span>';
        activeIco.closest(".sidebar-link")?.classList.add("is-loading");
      } else if (activeIco.dataset.skIcon != null) {
        activeIco.innerHTML = activeIco.dataset.skIcon;
        delete activeIco.dataset.skIcon;
        activeIco.closest(".sidebar-link")?.classList.remove("is-loading");
      }
    }

    const dot = $(".status-pill .dot");
    if (dot) dot.classList.toggle("loading", !!on);
  }

  function start() {
    setChromeLoading(true);
  }

  function stop() {
    setChromeLoading(false);
  }

  App.skeleton = { start, stop, tableRows, metaValues, skHtml };
})();