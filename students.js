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

  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const els = {
    btnSyncNow: byId("btnSyncNow"),
    btnApplyFilters: byId("btnApplyFilters"),
    btnResetFilters: byId("btnResetFilters"),
    btnDownloadAllStatements: byId("btnDownloadAllStatements"),
    btnDownloadInvalidStudents: byId("btnDownloadInvalidStudents"),

    filterGrade: byId("filterGrade"),
    filterTerm: byId("filterTerm"),
    studentSearch: byId("studentSearch"),
    studentStatusFilter: byId("studentStatusFilter"),

    studentsCount: byId("studentsCount"),
    countUnder: byId("countUnder"),
    countFull: byId("countFull"),
    countOver: byId("countOver"),
    lastSync: byId("lastSync"),

    statementsTbody: $("#studentStatementsTable tbody"),
  };

  let termInitialized = false;

  function money(n) {
    return App.money ? App.money(n) : Number(n || 0).toLocaleString();
  }

  function escapeHtml(v) {
    return App.escapeHtml ? App.escapeHtml(v) : String(v ?? "");
  }

  function currentFilters() {
    const grade = els.filterGrade?.value ?? "";
    const term = els.filterTerm?.value ?? "";
    const q = String(els.studentSearch?.value || "").trim().toLowerCase();
    const status = els.studentStatusFilter?.value || "ALL";

    return {
      grade: grade === "" ? null : Number(grade),
      term: term === "" ? null : Number(term),
      query: q,
      status,
    };
  }

  function populateFilters() {
    if (els.filterGrade) {
      const current = els.filterGrade.value;
      els.filterGrade.innerHTML = `<option value="">All Grades</option>`;
      (App.CONFIG.GRADES || []).forEach((g) => {
        const opt = document.createElement("option");
        opt.value = String(g);
        opt.textContent = String(g);
        els.filterGrade.appendChild(opt);
      });
      els.filterGrade.value = current || "";
    }

    if (els.filterTerm) {
      const current = els.filterTerm.value;
      els.filterTerm.innerHTML = `<option value="">All Terms</option>`;
      (App.CONFIG.TERMS || []).forEach((t) => {
        const opt = document.createElement("option");
        opt.value = String(t);
        opt.textContent = String(t);
        els.filterTerm.appendChild(opt);
      });
      if (!termInitialized) {
        els.filterTerm.value = String(App.CONFIG.DEFAULT_TERM || 1);
        termInitialized = true;
      } else {
        els.filterTerm.value = current || "";
      }
    }
  }

  function allStudentRows() {
    const baseRows = App.computeLiveFinanceRows?.() || App.state.students || [];
    return App.computeBalances(baseRows);
  }

  function filteredStudents() {
    const { grade, term, query, status } = currentFilters();
    let rows = allStudentRows();

    if (grade !== null) rows = rows.filter((r) => Number(r.grade) === grade);
    if (term !== null) rows = rows.filter((r) => Number(r.term) === term);
    if (status !== "ALL") rows = rows.filter((r) => String(r.status || "") === status);
    if (query) {
      rows = rows.filter((r) => {
        return (
          String(r.student || "").toLowerCase().includes(query) ||
          String(r.admNo || "").toLowerCase().includes(query)
        );
      });
    }
    return rows;
  }

  function renderCounts(allRows) {
    const validRows = (allRows || []).filter((r) => r.hasIdentity !== false);
    const under = validRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) > 0).length;
    const full = validRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) === 0).length;
    const over = validRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) < 0).length;

    if (els.studentsCount) els.studentsCount.textContent = String((allRows || []).length);
    if (els.countUnder) els.countUnder.textContent = String(under);
    if (els.countFull) els.countFull.textContent = String(full);
    if (els.countOver) els.countOver.textContent = String(over);
  }

  function renderStudentStatements(rows) {
    if (!els.statementsTbody) return;

    const sorted = rows.slice().sort((a, b) => {
      const aBal = a.hasIdentity === false ? Number.POSITIVE_INFINITY : Number(a.computedBalance ?? a.balance ?? 0);
      const bBal = b.hasIdentity === false ? Number.POSITIVE_INFINITY : Number(b.computedBalance ?? b.balance ?? 0);

      const aRank = a.hasIdentity === false ? 3 : aBal > 0 ? 0 : aBal === 0 ? 1 : 2;
      const bRank = b.hasIdentity === false ? 3 : bBal > 0 ? 0 : bBal === 0 ? 1 : 2;

      if (aRank !== bRank) return aRank - bRank;
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
      const balanceValue = Number(r.computedBalance ?? r.balance ?? 0);

      const tr = document.createElement("tr");
      if (canGenerate) {
        if (balanceValue > 0) tr.classList.add("status-underpaid");
        else if (balanceValue < 0) tr.classList.add("status-overpaid");
        else tr.classList.add("status-fully-paid");
      }

      tr.innerHTML = `
        <td>${escapeHtml(r.student || "UNDEFINED")}</td>
        <td>${escapeHtml(r.admNo || "UNDEFINED")}</td>
        <td>${escapeHtml(r.grade)}</td>
        <td>${escapeHtml(r.term)}</td>
        <td>${r.displayBalanceBF || "UNDEFINED"}</td>
        <td><strong>${r.displayTotalPaid || "UNDEFINED"}</strong></td>
        <td>${App.isBlank?.(r.schoolFeesRaw) ? "UNDEFINED" : `KES ${money(r.schoolFees || 0)}`}</td>
        <td>${r.displayComputedBalance || "UNDEFINED"}</td>
        <td>${escapeHtml(r.status || "UNDEFINED")}</td>
        <td class="row-inline">
          <button class="btn btn-primary" type="button" data-action="statement" ${canGenerate ? "" : "disabled"}>Fee Statement PDF</button>
          <button class="btn" type="button" data-action="receipts" ${canGenerate ? "" : "disabled"}>View Receipts</button>
        </td>
      `;

      tr.querySelector('[data-action="statement"]')?.addEventListener("click", () => {
        if (!canGenerate) return;
        App.generateStudentStatementPDF?.(r);
      });

      tr.querySelector('[data-action="receipts"]')?.addEventListener("click", () => {
        if (!canGenerate) return;
        window.Records?.openReceiptsModal?.(r);
      });

      els.statementsTbody.appendChild(tr);
    });

    window.Animations?.tableRefresh?.("#studentStatementsTable tbody tr");
  }

  function refreshAll() {
    populateFilters();
    const allRows = allStudentRows();
    const rows = filteredStudents();
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
    if (els.filterGrade) els.filterGrade.value = "";
    if (els.filterTerm) els.filterTerm.value = String(App.CONFIG.DEFAULT_TERM || 1);
    if (els.studentSearch) els.studentSearch.value = "";
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

  (async () => {
    const ok = await App.syncAll({ notifyNewReceipts: false });
    if (ok) {
      window.App?.truthDetectChanges?.();
      if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
    }
    refreshAll();
  })();
});