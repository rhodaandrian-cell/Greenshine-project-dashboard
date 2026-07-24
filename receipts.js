// receipts.js
document.addEventListener("DOMContentLoaded", () => {
  const App = window.App;
  if (!App) {
    console.error("[receipts.js] window.App not found. Load data.js first.");
    return;
  }

  // ── Session gate ─────────────────────────────────────────
  const SESSION_KEY = "greenshine_session_v1";
  if (sessionStorage.getItem(SESSION_KEY) !== "true") {
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const CURRENT_TERM = Number(App.CONFIG?.CURRENT_TERM) || 1;

  const els = {
    btnSyncNow:       byId("btnSyncNow"),
    btnExportPayments:byId("btnExportPayments"),
    btnMarkAllSeen:   byId("btnMarkAllSeen"),
    btnShowHidden:    byId("btnShowHidden"),

    receiptSearch:    byId("receiptSearch"),
    filterTerm:       byId("filterTerm"),
    filterMethod:     byId("filterMethod"),

    totalReceipts:    byId("totalReceipts"),
    newReceiptsCount: byId("newReceiptsCount"),
    shownReceipts:    byId("shownReceipts"),
    shownTotal:       byId("shownTotal"),

    lastSync:         byId("lastSync"),

    tbody:            $("#receiptsTable tbody"),
  };

  function money(n)      { return App.money ? App.money(n) : Number(n || 0).toLocaleString(); }
  function escapeHtml(v) { return App.escapeHtml ? App.escapeHtml(v) : String(v ?? ""); }

  // We capture the "seen" set ONCE on page load, so receipts that were new when
  // she arrived stay tagged NEW for the whole visit (rather than disappearing as
  // soon as the set is updated). The set is only written back when she leaves or
  // taps "Mark all as seen".
  let seenAtLoad = App.loadSeenSet();

  // ── Hidden receipts (local-only) ─────────────────────────
  // Receipt numbers the director has chosen to hide FROM THIS VIEW. They are
  // NOT deleted from the Google Sheet — only filtered out locally, and the
  // hide persists across refreshes and reloads (stored in localStorage).
  // A "Show hidden" toggle reveals them with a Restore button, so a misclick
  // is always reversible.
  const HIDDEN_KEY = "greenshine_hidden_receipts_v1";

  function loadHidden() {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); }
    catch { return new Set(); }
  }
  function saveHidden(set) {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
  }
  let hiddenSet = loadHidden();
  let showHidden = false; // when true, hidden rows are shown (with Restore)

  function isHidden(receiptNo) {
    const key = String(receiptNo || "").trim();
    return key !== "" && hiddenSet.has(key);
  }

  function hideReceipt(receiptNo) {
    const key = String(receiptNo || "").trim();
    if (!key) return;
    hiddenSet.add(key);
    saveHidden(hiddenSet);
    render();
  }

  function restoreReceipt(receiptNo) {
    const key = String(receiptNo || "").trim();
    hiddenSet.delete(key);
    saveHidden(hiddenSet);
    render();
  }

  function isNew(receiptNo) {
    const key = String(receiptNo || "").trim();
    return key !== "" && !seenAtLoad.has(key);
  }

  function populateTermFilter() {
    if (!els.filterTerm) return;
    const cur = els.filterTerm.value;
    els.filterTerm.innerHTML = `<option value="">All Terms</option>`;
    (App.CONFIG.TERMS || [1, 2, 3]).forEach((t) => {
      const o = document.createElement("option");
      o.value = String(t);
      o.textContent = `Term ${t}`;
      els.filterTerm.appendChild(o);
    });
    // Default to the current term on first load; preserve choice afterwards.
    els.filterTerm.value = els.filterTerm.dataset.userSet === "1" ? cur : String(CURRENT_TERM);
  }

  function allReceiptsSorted() {
    return (App.state.payments || [])
      .slice()
      .sort((a, b) =>
        (App.parseLooseDate?.(b.date)?.getTime?.() || 0) -
        (App.parseLooseDate?.(a.date)?.getTime?.() || 0)
      );
  }

  function filteredReceipts() {
    const q      = String(els.receiptSearch?.value || "").trim().toLowerCase();
    const term   = els.filterTerm?.value   ? Number(els.filterTerm.value)   : null;
    const method = els.filterMethod?.value ? String(els.filterMethod.value) : null;

    return allReceiptsSorted().filter((p) => {
      // Hidden rows: excluded normally; shown ONLY when the toggle is on
      // (and then we show only the hidden ones, so she can restore them).
      const hidden = isHidden(p.receiptNo);
      if (showHidden) { if (!hidden) return false; }
      else            { if (hidden)  return false; }

      if (term   !== null && Number(p.term) !== term)   return false;
      if (method !== null && String(p.method) !== method) return false;
      if (!q) return true;
      return (
        String(p.student   || "").toLowerCase().includes(q) ||
        String(p.receiptNo || "").toLowerCase().includes(q) ||
        String(p.admNo     || "").toLowerCase().includes(q) ||
        String(p.ref       || "").toLowerCase().includes(q)
      );
    });
  }

  function countNew() {
    return allReceiptsSorted().filter((p) => isNew(p.receiptNo)).length;
  }

  function render() {
    if (!els.tbody) return;

    const all   = App.state.payments || [];
    const rows  = filteredReceipts();
    const total = rows.reduce((s, p) => s + Number(p.amount || 0), 0);
    const hiddenCount = (App.state.payments || []).filter((p) => isHidden(p.receiptNo)).length;

    if (els.totalReceipts)    els.totalReceipts.textContent    = String(all.length);
    if (els.newReceiptsCount) els.newReceiptsCount.textContent = String(countNew());
    if (els.shownReceipts)    els.shownReceipts.textContent    = String(rows.length);
    if (els.shownTotal)       els.shownTotal.textContent       = `KES ${money(total)}`;

    // "Show hidden" toggle (only meaningful when something is hidden).
    if (els.btnShowHidden) {
      if (hiddenCount > 0 || showHidden) {
        els.btnShowHidden.classList.remove("hidden");
        els.btnShowHidden.textContent = showHidden
          ? "← Back to receipts"
          : `Show hidden (${hiddenCount})`;
      } else {
        els.btnShowHidden.classList.add("hidden");
      }
    }

    els.tbody.innerHTML = "";

    if (!rows.length) {
      const msg = showHidden ? "No hidden receipts." : "No receipts match your search.";
      els.tbody.innerHTML = `<tr><td colspan="10" class="muted">${msg}</td></tr>`;
      return;
    }

    rows.forEach((p) => {
      const tr = document.createElement("tr");
      const newTag = (!showHidden && isNew(p.receiptNo))
        ? ` <span class="badge" style="background:rgba(77,163,255,.18);border-color:rgba(77,163,255,.40);">NEW</span>`
        : "";

      const actions = showHidden
        ? `<button class="btn" type="button" data-act="restore">Restore</button>`
        : `<button class="btn btn-primary" type="button" data-act="pdf">Download</button>
           <button class="btn btn-danger" type="button" data-act="hide" title="Hide from this view (not deleted from the sheet)">Hide</button>`;

      tr.innerHTML = `
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(p.receiptNo)}${newTag}</td>
        <td>${escapeHtml(p.student)}</td>
        <td>${escapeHtml(p.grade)}</td>
        <td>Term ${escapeHtml(p.term)}</td>
        <td><strong>KES ${money(p.amount)}</strong></td>
        <td>${escapeHtml(p.method)}</td>
        <td>${escapeHtml(p.ref)}</td>
        <td>${escapeHtml(p.receivedBy)}</td>
        <td class="row-inline">${actions}</td>
      `;
      tr.querySelector('[data-act="pdf"]')?.addEventListener("click", () => App.generateReceiptPDF?.(p));
      tr.querySelector('[data-act="hide"]')?.addEventListener("click", () => hideReceipt(p.receiptNo));
      tr.querySelector('[data-act="restore"]')?.addEventListener("click", () => restoreReceipt(p.receiptNo));
      els.tbody.appendChild(tr);
    });

    window.Animations?.tableRefresh?.("#receiptsTable tbody tr");
  }

  // Persist the current payments as "seen" so the badge resets next visit.
  function markAllSeen({ rerender = true } = {}) {
    const seen = App.loadSeenSet();
    (App.state.payments || []).forEach((p) => {
      const key = String(p.receiptNo || "").trim();
      if (key) seen.add(key);
    });
    App.saveSeenSet(seen);
    if (rerender) {
      seenAtLoad = new Set(seen); // clear NEW tags immediately
      render();
    }
  }

  // ── Listeners ────────────────────────────────────────────
  els.btnSyncNow?.addEventListener("click", async () => {
    App.skeleton?.start?.();
    const ok = await App.syncAll({ notifyNewReceipts: false });
    if (ok) {
      window.App?.truthDetectChanges?.();
      render();
    }
    App.skeleton?.stop?.();
  });

  els.btnExportPayments?.addEventListener("click", () => App.exportPaymentsPdf?.());

  els.btnMarkAllSeen?.addEventListener("click", () => markAllSeen({ rerender: true }));

  els.btnShowHidden?.addEventListener("click", () => {
    showHidden = !showHidden;
    render();
  });

  els.receiptSearch?.addEventListener("input", render);

  els.filterTerm?.addEventListener("change", () => {
    els.filterTerm.dataset.userSet = "1";
    render();
  });
  els.filterMethod?.addEventListener("change", render);

  // When she leaves the page, mark everything seen so the count is accurate
  // next time. (Tags remain visible for the whole current visit.)
  window.addEventListener("beforeunload", () => markAllSeen({ rerender: false }));

  window.Animations?.animateIntro?.();

  // ── Boot ──────────────────────────────────────────────────
  // Shell shows instantly; the receipts table shimmers while data loads.
  App.skeleton?.start?.();
  App.skeleton?.metaValues?.();
  App.skeleton?.tableRows?.("#receiptsTable tbody", 10, 8);

  (async () => {
    try {
      const ok = await App.syncAll({ notifyNewReceipts: false });
      if (ok) window.App?.truthDetectChanges?.();
      // Recapture the seen set AFTER the first sync, so it reflects what existed
      // before this visit's fetch — receipts added since the last visit show NEW.
      seenAtLoad = App.loadSeenSet();
      populateTermFilter();
      render();
    } catch (e) {
      console.error("[receipts.js] Boot error:", e);
      populateTermFilter();
      render();
    } finally {
      App.skeleton?.stop?.();
    }

    setInterval(async () => {
      const ok2 = await App.syncAll({ notifyNewReceipts: false });
      if (ok2) {
        window.App?.truthDetectChanges?.();
        render();
      }
    }, App.CONFIG.POLL_MS || 15000);
  })();
});