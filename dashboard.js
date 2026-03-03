// dashboard.js (safe + fixed)
document.addEventListener("DOMContentLoaded", () => {
  // ===== Hard guards =====
  const App = window.App;
  if (!App) {
    console.error("[Dashboard] window.App not found. Ensure data.js is loaded before dashboard.js.");
    return;
  }
  if (typeof App.syncAll !== "function") {
    console.error("[Dashboard] App.syncAll is not a function. Ensure data.js loaded correctly.");
    return;
  }
  if (typeof App.computeBalances !== "function") {
    console.error("[Dashboard] App.computeBalances not found. Ensure installments.js loads before dashboard.js.");
    return;
  }

  const hasChart = typeof window.Chart === "function";

  // ===== Elements (safe getters) =====
  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const els = {
    btnSyncNow: byId("btnSyncNow"),
    btnExportPayments: byId("btnExportPayments"),
    btnClearSeen: byId("btnClearSeen"),

    btnApplyFilters: byId("btnApplyFilters"),
    btnResetFilters: byId("btnResetFilters"),
    filterGrade: byId("filterGrade"),
    filterTerm: byId("filterTerm"),
    receiptSearch: byId("receiptSearch"),

    studentsCount: byId("studentsCount"),
    paymentsCount: byId("paymentsCount"),
    lastSync: byId("lastSync"),

    kpiExpected: byId("kpiExpected"),
    kpiCollected: byId("kpiCollected"),
    kpiOutstanding: byId("kpiOutstanding"),
    kpiRate: byId("kpiRate"),

    countUnder: byId("countUnder"),
    countFull: byId("countFull"),
    countOver: byId("countOver"),
    countToday: byId("countToday"),

    latestReceiptsTbody: $("#latestReceiptsTable tbody"),
    defaultersTbody: $("#defaultersTable tbody"),
    paymentsTbody: $("#paymentsTable tbody"),
    statementsTbody: $("#studentStatementsTable tbody"),

    btnDownloadAllStatements: byId("btnDownloadAllStatements"),

    chartGrade: byId("chartGrade"),
    chartTerm: byId("chartTerm"),
    chartPieStatus: byId("chartPieStatus"),
    chartPieMethods: byId("chartPieMethods"),
  };

  // Modal
  const receiptModal = byId("receiptModal");
  const btnCloseReceiptModal = byId("btnCloseReceiptModal");
  const receiptModalTitle = byId("receiptModalTitle");
  const receiptModalMeta = byId("receiptModalMeta");
  const receiptModalTbody = $("#receiptModalTable tbody");

  // Charts
  let gradeChart = null;
  let termChart = null;
  let pieStatusChart = null;
  let pieMethodsChart = null;

  // Filter defaults
  let termInitialized = false;

  function setSelectOptions(selectEl, values, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);

    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      selectEl.appendChild(opt);
    });
  }

  function populateFilters() {
    setSelectOptions(els.filterGrade, App.CONFIG.GRADES, "All Grades");
    setSelectOptions(els.filterTerm, App.CONFIG.TERMS, "All Terms");

    if (!termInitialized && els.filterTerm) {
      els.filterTerm.value = String(App.CONFIG.DEFAULT_TERM);
      termInitialized = true;
    }
  }

  function currentFilters() {
    const g = els.filterGrade?.value ?? "";
    const t = els.filterTerm?.value ?? "";
    return {
      grade: g === "" ? null : Number(g),
      term: t === "" ? null : Number(t),
    };
  }

  function filteredStudents() {
    const { grade, term } = currentFilters();
    let view = [...(App.state.students || [])];
    if (grade !== null) view = view.filter((s) => Number(s.grade) === grade);
    if (term !== null) view = view.filter((s) => Number(s.term) === term);
    return view;
  }

  function groupBy(rows, keyFn) {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      const v = m.get(k) || { expected: 0, collected: 0, outstanding: 0 };
      v.expected += Number(r.fees || 0);
      v.collected += Number(r.collected || 0);
      v.outstanding += Math.max(Number(r.balance || 0), 0);
      m.set(k, v);
    }
    return m;
  }

  // ===== KPI =====
  function renderKPIs(balanceRows) {
    const expected = balanceRows.reduce((a, r) => a + Number(r.fees || 0), 0);
    const collected = balanceRows.reduce((a, r) => a + Number(r.collected || 0), 0);
    const outstanding = balanceRows.reduce((a, r) => a + Math.max(Number(r.balance || 0), 0), 0);
    const rate = expected > 0 ? (collected / expected) * 100 : 0;

    if (els.kpiExpected) els.kpiExpected.textContent = `KES ${App.money(expected)}`;
    if (els.kpiCollected) els.kpiCollected.textContent = `KES ${App.money(collected)}`;
    if (els.kpiOutstanding) els.kpiOutstanding.textContent = `KES ${App.money(outstanding)}`;
    if (els.kpiRate) els.kpiRate.textContent = `${rate.toFixed(1)}%`;

    window.Animations?.pulseKpis?.();
  }

  // ===== CHARTS =====
  function renderCharts(balanceRows) {
    if (!hasChart) {
      return;
    }

    if (els.chartGrade) {
      const byGrade = groupBy(balanceRows, (r) => String(r.grade));
      const labels = [...byGrade.keys()].sort((a, b) => Number(a) - Number(b));
      const data = labels.map((k) => byGrade.get(k));

      gradeChart?.destroy?.();
      gradeChart = new Chart(els.chartGrade, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Expected", data: data.map((d) => d.expected) },
            { label: "Collected", data: data.map((d) => d.collected) },
            { label: "Outstanding", data: data.map((d) => d.outstanding) },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: "#eaf1ff" } } },
          scales: {
            x: { ticks: { color: "#9bb0c7" }, grid: { color: "rgba(255,255,255,.06)" } },
            y: { ticks: { color: "#9bb0c7" }, grid: { color: "rgba(255,255,255,.06)" } },
          },
        },
      });
    }

    if (els.chartTerm) {
      const byTerm = groupBy(balanceRows, (r) => String(r.term));
      const labels = [...byTerm.keys()].sort((a, b) => Number(a) - Number(b));
      const data = labels.map((k) => byTerm.get(k));

      termChart?.destroy?.();
      termChart = new Chart(els.chartTerm, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: "Expected", data: data.map((d) => d.expected) },
            { label: "Collected", data: data.map((d) => d.collected) },
            { label: "Outstanding", data: data.map((d) => d.outstanding) },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: "#eaf1ff" } } },
          scales: {
            x: { ticks: { color: "#9bb0c7" }, grid: { color: "rgba(255,255,255,.06)" } },
            y: { ticks: { color: "#9bb0c7" }, grid: { color: "rgba(255,255,255,.06)" } },
          },
        },
      });
    }

    if (els.chartPieStatus && typeof App.countStatus === "function") {
      const { under, full, over } = App.countStatus(balanceRows);
      pieStatusChart?.destroy?.();
      pieStatusChart = new Chart(els.chartPieStatus, {
        type: "pie",
        data: {
          labels: ["Underpaid", "Fully Paid", "Overpaid"],
          datasets: [{ data: [under, full, over] }],
        },
        options: { responsive: true, plugins: { legend: { labels: { color: "#eaf1ff" } } } },
      });
    }

    if (els.chartPieMethods && typeof App.countPaymentMethods === "function") {
      const map = App.countPaymentMethods();
      const labels = [...map.keys()].sort((a, b) => map.get(b) - map.get(a)).slice(0, 10);
      const data = labels.map((k) => map.get(k));

      pieMethodsChart?.destroy?.();
      pieMethodsChart = new Chart(els.chartPieMethods, {
        type: "pie",
        data: { labels, datasets: [{ data }] },
        options: { responsive: true, plugins: { legend: { labels: { color: "#eaf1ff" } } } },
      });
    }
  }

  // ===== TABLES =====
  function renderTodaysReceiptsFront() {
    if (!els.latestReceiptsTbody) return;

    const rowsToday = (App.state.payments || [])
      .filter((p) => App.isToday?.(p.date))
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));

    if (els.countToday) els.countToday.textContent = String(rowsToday.length);

    els.latestReceiptsTbody.innerHTML = "";
    if (!rowsToday.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted">No receipts recorded today.</td>`;
      els.latestReceiptsTbody.appendChild(tr);
      return;
    }

    for (const p of rowsToday.slice(0, 15)) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${App.escapeHtml(p.date)}</td>
        <td>${App.escapeHtml(p.receiptNo)}</td>
        <td>${App.escapeHtml(p.student)}</td>
        <td>${App.escapeHtml(p.grade)}</td>
        <td>${App.escapeHtml(p.term)}</td>
        <td>KES ${App.money(p.amount)}</td>
        <td><button class="btn btn-primary" type="button">Download</button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => App.generateReceiptPDF?.(p));
      els.latestReceiptsTbody.appendChild(tr);
    }
  }

  function renderDefaulters(balanceRows) {
    if (!els.defaultersTbody) return;

    const top = [...balanceRows]
      .sort((a, b) => Math.max(b.balance, 0) - Math.max(a.balance, 0))
      .slice(0, 20);

    els.defaultersTbody.innerHTML = "";
    for (const r of top) {
      const outstanding = Math.max(Number(r.balance || 0), 0);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${App.escapeHtml(r.student)}</td>
        <td>${App.escapeHtml(r.grade)}</td>
        <td>${App.escapeHtml(r.term)}</td>
        <td>KES ${App.money(r.fees)}</td>
        <td>KES ${App.money(r.collected)}</td>
        <td>KES ${App.money(outstanding)}</td>
        <td>${Number(r.rate || 0).toFixed(1)}%</td>
      `;
      els.defaultersTbody.appendChild(tr);
    }
  }

  function renderPaymentsTable() {
    if (!els.paymentsTbody) return;

    const q = (els.receiptSearch?.value || "").trim().toLowerCase();

    const rows = (App.state.payments || [])
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .filter((p) => {
        if (!q) return true;
        return (
          String(p.student).toLowerCase().includes(q) ||
          String(p.receiptNo).toLowerCase().includes(q) ||
          String(p.ref).toLowerCase().includes(q)
        );
      });

    els.paymentsTbody.innerHTML = "";
    for (const p of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${App.escapeHtml(p.date)}</td>
        <td>${App.escapeHtml(p.receiptNo)}</td>
        <td>${App.escapeHtml(p.student)}</td>
        <td>${App.escapeHtml(p.grade)}</td>
        <td>${App.escapeHtml(p.term)}</td>
        <td>KES ${App.money(p.amount)}</td>
        <td>${App.escapeHtml(p.method)}</td>
        <td>${App.escapeHtml(p.ref)}</td>
        <td>${App.escapeHtml(p.receivedBy)}</td>
        <td><button class="btn btn-primary" type="button">Receipt PDF</button></td>
      `;
      tr.querySelector("button").addEventListener("click", () => App.generateReceiptPDF?.(p));
      els.paymentsTbody.appendChild(tr);
    }
  }

  // ===== MODAL =====
  function openReceiptsModal(student, grade, term) {
    if (!receiptModal || !receiptModalTbody || typeof App.getReceiptsForStudentTerm !== "function") return;

    const list = App.getReceiptsForStudentTerm(student, grade, term);

    if (receiptModalTitle) receiptModalTitle.textContent = "Receipts (Installments)";
    if (receiptModalMeta) receiptModalMeta.textContent = `${student} • Grade ${grade} • Term ${term} • ${list.length} receipt(s)`;

    receiptModalTbody.innerHTML = "";
    if (!list.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">No receipts found for this student in the selected term.</td>`;
      receiptModalTbody.appendChild(tr);
    } else {
      for (const p of list) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${App.escapeHtml(p.date)}</td>
          <td>${App.escapeHtml(p.receiptNo)}</td>
          <td>KES ${App.money(p.amount)}</td>
          <td>${App.escapeHtml(p.method)}</td>
          <td><button class="btn btn-primary" type="button">Download</button></td>
        `;
        tr.querySelector("button").addEventListener("click", () => App.generateReceiptPDF?.(p));
        receiptModalTbody.appendChild(tr);
      }
    }

    receiptModal.classList.remove("hidden");
  }

  function closeReceiptsModal() {
    receiptModal?.classList.add("hidden");
  }
  btnCloseReceiptModal?.addEventListener("click", closeReceiptsModal);
  receiptModal?.addEventListener("click", (e) => {
    if (e.target === receiptModal) closeReceiptsModal();
  });

  // ===== STATEMENTS TABLE =====
  function renderStudentStatements(balanceRows) {
    if (!els.statementsTbody) return;

    const sorted = [...balanceRows].sort((a, b) => {
      const aRank = a.balance > 0 ? 0 : a.balance === 0 ? 1 : 2;
      const bRank = b.balance > 0 ? 0 : b.balance === 0 ? 1 : 2;
      if (aRank !== bRank) return aRank - bRank;
      return Math.abs(b.balance) - Math.abs(a.balance);
    });

    els.statementsTbody.innerHTML = "";
    for (const r of sorted) {
      const status = r.balance > 0 ? "UNDERPAID" : r.balance === 0 ? "FULLY PAID" : "OVERPAID";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${App.escapeHtml(r.student)}</td>
        <td>${App.escapeHtml(r.grade)}</td>
        <td>${App.escapeHtml(r.term)}</td>
        <td>KES ${App.money(r.fees)}</td>
        <td><strong>KES ${App.money(r.collected)}</strong></td>
        <td>KES ${App.money(r.balance)}</td>
        <td>${status}</td>
        <td class="row-inline">
          <button class="btn btn-primary" type="button">Statement PDF</button>
          <button class="btn" type="button">View Receipts</button>
        </td>
      `;

      const btnStatement = tr.querySelectorAll("button")[0];
      const btnViewReceipts = tr.querySelectorAll("button")[1];

      btnStatement.addEventListener("click", () => App.generateStudentStatementPDF?.(r));
      btnViewReceipts.addEventListener("click", () => openReceiptsModal(r.student, r.grade, r.term));

      els.statementsTbody.appendChild(tr);
    }
  }

  // ===== REFRESH =====
  function refreshAll() {
    populateFilters();

    const studs = filteredStudents();
    const balanceRows = App.computeBalances(studs);

    if (els.studentsCount) els.studentsCount.textContent = String((App.state.students || []).length);
    if (els.paymentsCount) els.paymentsCount.textContent = String((App.state.payments || []).length);

    if (typeof App.countStatus === "function") {
      const statusCounts = App.countStatus(balanceRows);
      if (els.countUnder) els.countUnder.textContent = String(statusCounts.under);
      if (els.countFull) els.countFull.textContent = String(statusCounts.full);
      if (els.countOver) els.countOver.textContent = String(statusCounts.over);
    }

    renderKPIs(balanceRows);
    renderCharts(balanceRows);
    renderTodaysReceiptsFront();
    renderDefaulters(balanceRows);
    renderPaymentsTable();
    renderStudentStatements(balanceRows);
  }

  // ===== EVENTS =====
  els.btnSyncNow?.addEventListener("click", async () => {
    const ok = await App.syncAll({ notifyNewReceipts: true });
    if (ok) refreshAll();
  });

  els.btnExportPayments?.addEventListener("click", () => App.exportPaymentsPdf?.());

  els.btnClearSeen?.addEventListener("click", () => {
    if (!confirm("Reset seen receipts in this browser? You may get popups again for old receipts.")) return;
    localStorage.removeItem(App.CONFIG.SEEN_RECEIPTS_KEY);
    App.toast?.("Done", "Seen receipts reset. Next sync may show old popups again.");
  });

  els.btnApplyFilters?.addEventListener("click", () => refreshAll());

  els.btnResetFilters?.addEventListener("click", () => {
    if (els.filterGrade) els.filterGrade.value = "";
    if (els.filterTerm) els.filterTerm.value = String(App.CONFIG.DEFAULT_TERM);
    refreshAll();
  });

  els.receiptSearch?.addEventListener("input", () => renderPaymentsTable());

  els.btnDownloadAllStatements?.addEventListener("click", () => {
    const studs = filteredStudents();
    const balanceRows = App.computeBalances(studs);
    if (!balanceRows.length) return alert("No students found for the selected filters.");
    App.generateAllStatementsPDF?.(balanceRows);
  });

  // ===== INIT =====
  window.Animations?.animateIntro?.();

  (async () => {
    const ok = await App.syncAll({ notifyNewReceipts: false });
    if (ok) {
      if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
      refreshAll();
    } else {
      refreshAll();
    }

    setInterval(async () => {
      const ok2 = await App.syncAll({ notifyNewReceipts: true });
      if (ok2) {
        if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
        refreshAll();
      }
    }, App.CONFIG.POLL_MS);
  })();
});