// students.js
document.addEventListener("DOMContentLoaded", () => {
  const App = window.App;
  if (!App) {
    console.error("[students.js] window.App not found. Load data.js first.");
    return;
  }
  if (typeof App.computeBalances !== "function") {
    console.error("[students.js] App.computeBalances not found. Load balance.js before students.js.");
    return;
  }

  // ── Session gate ─────────────────────────────────────────
  const SESSION_KEY = "greenshine_session_v1";
  if (sessionStorage.getItem(SESSION_KEY) !== "true") {
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const els = {
    btnSyncNow:                byId("btnSyncNow"),
    btnApplyFilters:           byId("btnApplyFilters"),
    btnResetFilters:           byId("btnResetFilters"),
    btnDownloadAllStatements:  byId("btnDownloadAllStatements"),
    btnDownloadInvalidStudents:byId("btnDownloadInvalidStudents"),

    filterGrade:         byId("filterGrade"),
    filterTerm:          byId("filterTerm"),
    filterYear:          byId("filterYear"),
    studentSearch:       byId("studentSearch"),
    studentStatusFilter: byId("studentStatusFilter"),

    studentsCount: byId("studentsCount"),
    countUnder:    byId("countUnder"),
    countFull:     byId("countFull"),
    countOver:     byId("countOver"),
    lastSync:      byId("lastSync"),

    statementsTbody: $("#studentStatementsTable tbody"),

    loadingOverlay: byId("loadingOverlay"),
    loadingSub:     byId("loadingSub"),
  };

  // Reveal the loading overlay now that the session is confirmed.
  // (It starts with the --pending class, which keeps it invisible.)
  if (els.loadingOverlay) {
    els.loadingOverlay.classList.remove("loading-overlay--pending");
  }

  function hideLoading() {
    if (!els.loadingOverlay) return;
    els.loadingOverlay.classList.add("hidden");
    setTimeout(() => els.loadingOverlay.remove(), 500);
  }

  function money(n)     { return App.money     ? App.money(n)     : Number(n || 0).toLocaleString(); }
  function escapeHtml(v){ return App.escapeHtml ? App.escapeHtml(v) : String(v ?? ""); }

  function currentFilters() {
    const grade  = els.filterGrade?.value  ?? "";
    const term   = els.filterTerm?.value   ?? "";
    const year   = els.filterYear?.value   ?? "";
    const q      = String(els.studentSearch?.value || "").trim().toLowerCase();
    const status = els.studentStatusFilter?.value || "ALL";
    return {
      grade:  grade  === "" ? null : Number(grade),
      term:   term   === "" ? null : Number(term),
      year:   year   === "" ? null : Number(year),
      query: q,
      status,
    };
  }

  function populateFilters() {
    if (els.filterGrade) {
      const cur = els.filterGrade.value;
      els.filterGrade.innerHTML = `<option value="">All Grades</option>`;
      (App.CONFIG.GRADES || []).forEach((g) => {
        const o = document.createElement("option");
        o.value = String(g); o.textContent = `Grade ${g}`;
        els.filterGrade.appendChild(o);
      });
      els.filterGrade.value = cur || "";
    }

    if (els.filterTerm) {
      const cur = els.filterTerm.value;
      els.filterTerm.innerHTML = `<option value="">All Terms</option>`;
      (App.CONFIG.TERMS || []).forEach((t) => {
        const o = document.createElement("option");
        o.value = String(t); o.textContent = `Term ${t}`;
        els.filterTerm.appendChild(o);
      });
      els.filterTerm.value = cur !== undefined ? cur : String(App.CONFIG.DEFAULT_TERM ?? "");
    }

    if (els.filterYear) {
      const cur   = els.filterYear.value;
      const years = [...new Set((App.state.students || []).map((r) => r.year).filter(Boolean))].sort((a,b) => b - a);
      els.filterYear.innerHTML = `<option value="">All Years</option>`;
      years.forEach((y) => {
        const o = document.createElement("option");
        o.value = String(y); o.textContent = String(y);
        els.filterYear.appendChild(o);
      });
      els.filterYear.value = cur || "";
    }
  }

  function allStudentRows() {
    const base = App.computeLiveFinanceRows?.() || App.state.students || [];
    return App.computeBalances(base);
  }

  function filteredStudents() {
    const { grade, term, year, query, status } = currentFilters();
    let rows = allStudentRows();

    if (grade  !== null) rows = rows.filter((r) => Number(r.grade) === grade);
    if (term   !== null) rows = rows.filter((r) => Number(r.term)  === term);
    if (year   !== null) rows = rows.filter((r) => Number(r.year)  === year);
    if (status !== "ALL") rows = rows.filter((r) => String(r.status || "") === status);
    if (query) {
      rows = rows.filter((r) =>
        String(r.student || "").toLowerCase().includes(query) ||
        String(r.admNo   || "").toLowerCase().includes(query)
      );
    }
    return rows;
  }

  function renderCounts(allRows) {
    const valid = (allRows || []).filter((r) => r.hasIdentity !== false);
    const under = valid.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) > 0).length;
    const full  = valid.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) === 0).length;
    const over  = valid.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) < 0).length;

    // Count unique enrolled students from the register — deduplicate by ADM number
    const uniqueAdmNos = new Set(
      (App.state.register || [])
        .map((r) => String(r.admNo || "").trim())
        .filter((a) => a !== "")
    );
    const registerCount = uniqueAdmNos.size ||
      (App.state.register || []).filter((r) => String(r.student || "").trim()).length;
    if (els.studentsCount) els.studentsCount.textContent = String(registerCount);
    if (els.countUnder)    els.countUnder.textContent    = String(under);
    if (els.countFull)     els.countFull.textContent     = String(full);
    if (els.countOver)     els.countOver.textContent     = String(over);
  }

  function balClass(val) {
    if (val > 0) return "bal-under";
    if (val < 0) return "bal-over";
    return "bal-clear";
  }

  function renderStudentStatements(rows) {
    if (!els.statementsTbody) return;

    const sorted = rows.slice().sort((a, b) => {
      const aBal = a.hasIdentity === false ? Infinity : Number(a.computedBalance ?? a.balance ?? 0);
      const bBal = b.hasIdentity === false ? Infinity : Number(b.computedBalance ?? b.balance ?? 0);
      const aRk  = a.hasIdentity === false ? 3 : aBal > 0 ? 0 : aBal === 0 ? 1 : 2;
      const bRk  = b.hasIdentity === false ? 3 : bBal > 0 ? 0 : bBal === 0 ? 1 : 2;
      if (aRk !== bRk) return aRk - bRk;
      return Math.abs(bBal) - Math.abs(aBal);
    });

    els.statementsTbody.innerHTML = "";
    if (!sorted.length) {
      els.statementsTbody.innerHTML =
        `<tr><td colspan="10" class="muted">No students found for the selected filters.</td></tr>`;
      return;
    }

    sorted.forEach((r) => {
      const canGenerate = r.hasIdentity !== false;
      const balVal      = Number(r.computedBalance ?? r.balance ?? 0);

      const tr = document.createElement("tr");
      if (canGenerate) {
        if (balVal > 0)      tr.classList.add("status-underpaid");
        else if (balVal < 0) tr.classList.add("status-overpaid");
        else                 tr.classList.add("status-fully-paid");
      }

      tr.innerHTML = `
        <td>${escapeHtml(r.student || "UNDEFINED")}</td>
        <td>${escapeHtml(r.admNo   || "UNDEFINED")}</td>
        <td>${escapeHtml(r.grade)}</td>
        <td>Term ${escapeHtml(r.term)}</td>
        <td>${r.displayBalanceBF   || "UNDEFINED"}</td>
        <td><strong>${r.displayTotalPaid || "UNDEFINED"}</strong></td>
        <td>${App.isBlank?.(r.schoolFeesRaw) ? "UNDEFINED" : `KES ${money(r.schoolFees || 0)}`}</td>
        <td class="${balClass(balVal)}">${r.displayComputedBalance || "UNDEFINED"}</td>
        <td>${escapeHtml(r.status || "UNDEFINED")}</td>
        <td class="row-inline">
          <button class="btn btn-primary" type="button" data-action="statement" ${canGenerate ? "" : "disabled"}>Statement PDF</button>
          <button class="btn"            type="button" data-action="receipts"  ${canGenerate ? "" : "disabled"}>Receipts</button>
        </td>
      `;

      tr.querySelector('[data-action="statement"]')?.addEventListener("click", () => {
        if (canGenerate) App.generateStudentStatementPDF?.(r);
      });

      tr.querySelector('[data-action="receipts"]')?.addEventListener("click", () => {
        if (canGenerate) window.Records?.openReceiptsModal?.(r);
      });

      els.statementsTbody.appendChild(tr);
    });

    window.Animations?.tableRefresh?.("#studentStatementsTable tbody tr");
  }

  function refreshAll() {
    populateFilters();
    const allRows = allStudentRows();
    const rows    = filteredStudents();
    renderCounts(allRows);
    renderStudentStatements(rows);
  }

  window.refreshStudentsPage = refreshAll;

  els.btnSyncNow?.addEventListener("click", async () => {
    const ok = await App.syncAll({ notifyNewReceipts: true });
    if (ok) {
      window.App?.truthDetectChanges?.();
      if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
      refreshAll();
    }
  });

  els.btnApplyFilters?.addEventListener("click", refreshAll);

  els.btnResetFilters?.addEventListener("click", () => {
    if (els.filterGrade)         els.filterGrade.value         = "";
    if (els.filterTerm)          els.filterTerm.value          = "";
    if (els.filterYear)          els.filterYear.value          = "";
    if (els.studentSearch)       els.studentSearch.value       = "";
    if (els.studentStatusFilter) els.studentStatusFilter.value = "ALL";
    refreshAll();
  });

  els.studentSearch?.addEventListener("input", refreshAll);
  els.studentStatusFilter?.addEventListener("change", refreshAll);

  els.btnDownloadAllStatements?.addEventListener("click", () => {
    const rows = filteredStudents().filter((r) => r.hasIdentity !== false);
    if (!rows.length) return alert("No students found for the selected filters.");
    App.generateAllStatementsPDF?.(rows);
  });

  els.btnDownloadInvalidStudents?.addEventListener("click", () => {
    const allRows = App.computeLiveFinanceRows?.() || App.state.students || [];
    App.generateInvalidStudentsPDF?.(allRows);
  });

  window.Animations?.animateIntro?.();

  // ── Boot ──────────────────────────────────────────────────
  (async () => {
    try {
      const ok = await App.syncAll({ notifyNewReceipts: false });
      if (ok) {
        window.App?.truthDetectChanges?.();
        if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
      } else if (els.loadingSub) {
        els.loadingSub.textContent = "Couldn't reach Google Sheets — showing last saved data";
      }
      refreshAll();
    } catch (e) {
      console.error("[students.js] Boot error:", e);
      if (els.loadingSub) els.loadingSub.textContent = "Something went wrong — loading anyway";
      refreshAll();
    } finally {
      hideLoading();
    }
  })();
});