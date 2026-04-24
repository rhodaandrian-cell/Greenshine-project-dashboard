// dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  const App = window.App;
  if (!App) {
    console.error("[dashboard.js] window.App not found. Load data.js first.");
    return;
  }
  if (typeof App.computeBalances !== "function") {
    console.error("[dashboard.js] App.computeBalances not found. Load balance.js before dashboard.js.");
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const els = {
    btnSyncNow:       byId("btnSyncNow"),
    btnExportPayments:byId("btnExportPayments"),
    btnClearSeen:     byId("btnClearSeen"),
    btnRecordPayment: byId("btnRecordPayment"),

    btnApplyFilters:  byId("btnApplyFilters"),
    btnResetFilters:  byId("btnResetFilters"),
    filterGrade:      byId("filterGrade"),
    filterTerm:       byId("filterTerm"),
    filterYear:       byId("filterYear"),
    receiptSearch:    byId("receiptSearch"),

    studentsCount:    byId("studentsCount"),
    paymentsCount:    byId("paymentsCount"),
    lastSync:         byId("lastSync"),

    kpiExpected:      byId("kpiExpected"),
    kpiCollected:     byId("kpiCollected"),
    kpiOutstanding:   byId("kpiOutstanding"),
    kpiRate:          byId("kpiRate"),

    countUnder:       byId("countUnder"),
    countFull:        byId("countFull"),
    countOver:        byId("countOver"),
    countToday:       byId("countToday"),

    currentTermBadge: byId("currentTermBadge"),

    latestReceiptsTbody: $("#latestReceiptsTable tbody"),
    defaultersTbody:     $("#defaultersTable tbody"),
    paymentsTbody:       $("#paymentsTable tbody"),
  };

  function money(n) {
    return App.money ? App.money(n) : Number(n || 0).toLocaleString();
  }

  function escapeHtml(v) {
    return App.escapeHtml ? App.escapeHtml(v) : String(v ?? "");
  }

  function currentFilters() {
    const grade = els.filterGrade?.value ?? "";
    const term  = els.filterTerm?.value  ?? "";
    const year  = els.filterYear?.value  ?? "";
    return {
      grade: grade === "" ? null : Number(grade),
      term:  term  === "" ? null : Number(term),
      year:  year  === "" ? null : Number(year),
    };
  }

  // ── Viewing badge ────────────────────────────────────────
  function updateTermBadge() {
    if (!els.currentTermBadge) return;
    const { grade, term, year } = currentFilters();
    const parts = [];
    if (term  !== null) parts.push(`Term ${term}`);
    if (year  !== null) parts.push(String(year));
    if (grade !== null) parts.push(`Grade ${grade}`);
    els.currentTermBadge.textContent = parts.length ? parts.join(" • ") : "ALL TERMS";
  }

  // ── Filters ──────────────────────────────────────────────
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

  function filteredStudents() {
    const { grade, term, year } = currentFilters();
    let rows = [...(App.computeLiveFinanceRows?.() || App.state.students || [])];
    if (grade !== null) rows = rows.filter((r) => Number(r.grade) === grade);
    if (term  !== null) rows = rows.filter((r) => Number(r.term)  === term);
    if (year  !== null) rows = rows.filter((r) => Number(r.year)  === year);
    return rows;
  }

  // ── KPIs ─────────────────────────────────────────────────
  function renderKpis(balanceRows) {
    const valid      = balanceRows.filter((r) => r.hasIdentity !== false);
    const totalDue   = valid.reduce((a, r) => a + Number(r.totalDue || 0), 0);
    const totalPaid  = valid.reduce((a, r) => a + Number(r.liveTotalPaid ?? r.totalPaid ?? 0), 0);
    const outstanding= valid.reduce((a, r) => a + Math.max(Number(r.computedBalance ?? r.balance ?? 0), 0), 0);
    const rate       = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

    if (els.kpiExpected)    els.kpiExpected.textContent    = `KES ${money(totalDue)}`;
    if (els.kpiCollected)   els.kpiCollected.textContent   = `KES ${money(totalPaid)}`;
    if (els.kpiOutstanding) els.kpiOutstanding.textContent = `KES ${money(outstanding)}`;

    if (els.kpiRate) {
      els.kpiRate.textContent = `${rate.toFixed(1)}%`;
      els.kpiRate.className   = "kpi-value " + (rate >= 75 ? "rate-high" : rate >= 40 ? "rate-mid" : "rate-low");
    }

    window.Animations?.pulseKpis?.();
  }

  function renderCounts(balanceRows) {
    const valid = balanceRows.filter((r) => r.hasIdentity !== false);
    const under = valid.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) > 0).length;
    const full  = valid.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) === 0).length;
    const over  = valid.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) < 0).length;

    if (els.countUnder) els.countUnder.textContent = String(under);
    if (els.countFull)  els.countFull.textContent  = String(full);
    if (els.countOver)  els.countOver.textContent  = String(over);

    const todayCount = (App.state.payments || []).filter((p) => App.isToday?.(p.date)).length;
    if (els.countToday) els.countToday.textContent = String(todayCount);
  }

  function renderSummaryCounts() {
    // Count unique enrolled students from the register — deduplicate by ADM number
    const uniqueAdmNos = new Set(
      (App.state.register || [])
        .map((r) => String(r.admNo || "").trim())
        .filter((a) => a !== "")
    );
    const registerCount = uniqueAdmNos.size ||
      (App.state.register || []).filter((r) => String(r.student || "").trim()).length;
    if (els.studentsCount) els.studentsCount.textContent = String(registerCount);
    if (els.paymentsCount) els.paymentsCount.textContent = String((App.state.payments || []).length);
  }

  // ── Latest receipts ──────────────────────────────────────
  function renderLatestReceipts() {
    if (!els.latestReceiptsTbody) return;

    const rows = (App.state.payments || [])
      .slice()
      .sort((a, b) => (App.parseLooseDate?.(b.date)?.getTime?.() || 0) - (App.parseLooseDate?.(a.date)?.getTime?.() || 0))
      .slice(0, 15);

    els.latestReceiptsTbody.innerHTML = "";
    if (!rows.length) {
      els.latestReceiptsTbody.innerHTML = `<tr><td colspan="8" class="muted">No receipts found.</td></tr>`;
      return;
    }

    rows.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(p.receiptNo)}</td>
        <td>${escapeHtml(p.student)}</td>
        <td>${escapeHtml(p.grade)}</td>
        <td>Term ${escapeHtml(p.term)}</td>
        <td><strong>KES ${money(p.amount)}</strong></td>
        <td>${escapeHtml(p.method)}</td>
        <td><button class="btn btn-primary" type="button">Receipt PDF</button></td>
      `;
      tr.querySelector("button")?.addEventListener("click", () => App.generateReceiptPDF?.(p));
      els.latestReceiptsTbody.appendChild(tr);
    });

    window.Animations?.tableRefresh?.("#latestReceiptsTable tbody tr");
  }

  // ── Defaulters ───────────────────────────────────────────
  function renderDefaulters(balanceRows) {
    if (!els.defaultersTbody) return;

    const rows = [...balanceRows]
      .filter((r) => r.hasIdentity !== false && Number(r.computedBalance ?? r.balance ?? 0) > 0)
      .sort((a, b) => Number(b.computedBalance ?? b.balance ?? 0) - Number(a.computedBalance ?? a.balance ?? 0))
      .slice(0, 20);

    els.defaultersTbody.innerHTML = "";
    if (!rows.length) {
      els.defaultersTbody.innerHTML = `<tr><td colspan="7" class="muted">No underpaid students for selected filters.</td></tr>`;
      return;
    }

    rows.forEach((r) => {
      const balVal = Number(r.computedBalance ?? r.balance ?? 0);
      const tr = document.createElement("tr");
      tr.classList.add("status-underpaid");
      tr.innerHTML = `
        <td>${escapeHtml(r.student)}</td>
        <td>${escapeHtml(r.grade)}</td>
        <td>Term ${escapeHtml(r.term)}</td>
        <td>KES ${money(r.totalDue)}</td>
        <td>${r.displayTotalPaid || `KES ${money(r.liveTotalPaid ?? r.totalPaid ?? 0)}`}</td>
        <td class="bal-under">${r.displayComputedBalance || `KES ${money(balVal)}`}</td>
        <td>${Number(r.rate || 0).toFixed(1)}%</td>
      `;
      els.defaultersTbody.appendChild(tr);
    });

    window.Animations?.tableRefresh?.("#defaultersTable tbody tr");
  }

  // ── Payments table ───────────────────────────────────────
  function renderPaymentsTable() {
    if (!els.paymentsTbody) return;

    const q = String(els.receiptSearch?.value || "").trim().toLowerCase();
    const rows = (App.state.payments || [])
      .slice()
      .sort((a, b) => (App.parseLooseDate?.(b.date)?.getTime?.() || 0) - (App.parseLooseDate?.(a.date)?.getTime?.() || 0))
      .filter((p) => {
        if (!q) return true;
        return (
          String(p.student  || "").toLowerCase().includes(q) ||
          String(p.receiptNo|| "").toLowerCase().includes(q) ||
          String(p.admNo    || "").toLowerCase().includes(q) ||
          String(p.ref      || "").toLowerCase().includes(q)
        );
      });

    els.paymentsTbody.innerHTML = "";
    if (!rows.length) {
      els.paymentsTbody.innerHTML = `<tr><td colspan="10" class="muted">No payments found.</td></tr>`;
      return;
    }

    rows.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(p.receiptNo)}</td>
        <td>${escapeHtml(p.student)}</td>
        <td>${escapeHtml(p.grade)}</td>
        <td>Term ${escapeHtml(p.term)}</td>
        <td><strong>KES ${money(p.amount)}</strong></td>
        <td>${escapeHtml(p.method)}</td>
        <td>${escapeHtml(p.ref)}</td>
        <td>${escapeHtml(p.receivedBy)}</td>
        <td><button class="btn btn-primary" type="button">Receipt PDF</button></td>
      `;
      tr.querySelector("button")?.addEventListener("click", () => App.generateReceiptPDF?.(p));
      els.paymentsTbody.appendChild(tr);
    });

    window.Animations?.tableRefresh?.("#paymentsTable tbody tr");
  }

  // ── Refresh ──────────────────────────────────────────────
  function refreshAll() {
    populateFilters();
    updateTermBadge();

    const students    = filteredStudents();
    const balanceRows = App.computeBalances(students);

    renderSummaryCounts();
    renderCounts(balanceRows);
    renderKpis(balanceRows);
    renderLatestReceipts();
    renderDefaulters(balanceRows);
    renderPaymentsTable();

    window.Charts?.renderAll?.(balanceRows);
  }

  window.refreshDashboard = refreshAll;

  // ── Listeners ────────────────────────────────────────────
  els.btnSyncNow?.addEventListener("click", async () => {
    const ok = await App.syncAll({ notifyNewReceipts: true });
    if (ok) {
      window.App?.truthDetectChanges?.();
      if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
      refreshAll();
    }
  });

  els.btnExportPayments?.addEventListener("click", () => App.exportPaymentsPdf?.());

  els.btnClearSeen?.addEventListener("click", () => {
    localStorage.removeItem(App.CONFIG.SEEN_RECEIPTS_KEY);
    App.toast?.("Done", "Seen receipts reset.");
  });

  els.btnApplyFilters?.addEventListener("click", refreshAll);

  els.btnResetFilters?.addEventListener("click", () => {
    if (els.filterGrade) els.filterGrade.value = "";
    if (els.filterTerm)  els.filterTerm.value  = "";
    if (els.filterYear)  els.filterYear.value  = "";
    refreshAll();
  });

  els.receiptSearch?.addEventListener("input", renderPaymentsTable);

  window.Animations?.animateIntro?.();

  // ── Boot ──────────────────────────────────────────────────
  (async () => {
    const ok = await App.syncAll({ notifyNewReceipts: false });
    if (ok) {
      window.App?.truthDetectChanges?.();
      if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
    }
    refreshAll();

    setInterval(async () => {
      const ok2 = await App.syncAll({ notifyNewReceipts: true });
      if (ok2) {
        window.App?.truthDetectChanges?.();
        if (els.lastSync) els.lastSync.textContent = App.nowStr?.() || new Date().toLocaleString();
        refreshAll();
      }
    }, App.CONFIG.POLL_MS || 15000);
  })();
});