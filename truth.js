// truth.js
document.addEventListener("DOMContentLoaded", () => {
  const App = window.App;
  if (!App) {
    console.error("[truth.js] window.App not found. Load data.js first.");
    return;
  }

  const truthBadge = document.getElementById("truthBadge");

  const SNAPSHOT_KEY = "greenshine_truth_snapshot_v1";
  const ALERTS_KEY = "greenshine_truth_alerts_v1";
  const MAX_ALERTS = 200;

  App.truth = App.truth || { alerts: [] };

  function isBlank(v) {
    return String(v ?? "").trim() === "";
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getSnapshotFallback() {
    return {
      registerKeys: [],
      financeMap: {},
      receiptKeys: [],
    };
  }

  function loadSnapshot() {
    const fallback = getSnapshotFallback();

    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return fallback;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return fallback;

      return {
        registerKeys: Array.isArray(parsed.registerKeys) ? parsed.registerKeys : [],
        financeMap:
          parsed.financeMap && typeof parsed.financeMap === "object"
            ? parsed.financeMap
            : {},
        receiptKeys: Array.isArray(parsed.receiptKeys) ? parsed.receiptKeys : [],
      };
    } catch {
      return fallback;
    }
  }

  function saveSnapshot(snapshot) {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  }

  function loadAlerts() {
    try {
      const raw = localStorage.getItem(ALERTS_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveAlerts() {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(App.truth.alerts || []));
  }

  function unreadCount() {
    return (App.truth.alerts || []).filter((a) => !a.read).length;
  }

  function renderBadge() {
    if (!truthBadge) return;

    const count = unreadCount();
    truthBadge.textContent = String(count);
    truthBadge.classList.toggle("hidden", count === 0);
  }

  function makeStudentKey(r) {
    return [
      String(r.admNo || "").trim(),
      String(r.student || "").trim().toUpperCase(),
      Number(r.grade || 0),
      Number(r.term || 0),
      Number(r.year || 0),
    ].join("__");
  }

  function makeFinanceKey(r) {
    return [
      String(r.admNo || "").trim(),
      String(r.student || "").trim().toUpperCase(),
      Number(r.grade || 0),
      Number(r.term || 0),
      Number(r.year || 0),
    ].join("__");
  }

  function makeFinanceSignature(r) {
    return [
      String(r.balanceBFRaw ?? ""),
      String(r.totalPaidRaw ?? ""),
      String(r.balanceRaw ?? ""),
      String(r.schoolFeesRaw ?? ""),
      Number(r.balanceBF || 0),
      Number(r.totalPaid || 0),
      Number(r.balance || 0),
      Number(r.schoolFees || 0),
    ].join("|");
  }

  function makeReceiptKey(p) {
    return [
      String(p.receiptNo || "").trim(),
      String(p.admNo || "").trim(),
      String(p.student || "").trim().toUpperCase(),
      Number(p.grade || 0),
      Number(p.term || 0),
      Number(p.year || 0),
      Number(p.amount || 0),
    ].join("__");
  }

  function addAlert(type, title, body, dedupeKey = "") {
    const exists = (App.truth.alerts || []).some(
      (a) => a.type === type && a.dedupeKey && dedupeKey && a.dedupeKey === dedupeKey
    );
    if (exists) return;

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    App.truth.alerts.unshift({
      id,
      type,
      title,
      body,
      time: nowIso(),
      read: false,
      dedupeKey,
    });

    App.truth.alerts = App.truth.alerts.slice(0, MAX_ALERTS);
    saveAlerts();
    renderBadge();
  }

  function buildCurrentSnapshot() {
    const registerKeys = (App.state.register || []).map(makeStudentKey);

    const financeMap = {};
    (App.state.students || []).forEach((r) => {
      financeMap[makeFinanceKey(r)] = {
        signature: makeFinanceSignature(r),
        student: r.student,
        admNo: r.admNo,
        grade: r.grade,
        term: r.term,
        year: r.year,
        balanceBF: Number(r.balanceBF || 0),
        totalPaid: Number(r.totalPaid || 0),
        schoolFees: Number(r.schoolFees || 0),
        balance: Number(r.balance || 0),
        balanceBFRaw: String(r.balanceBFRaw ?? ""),
        totalPaidRaw: String(r.totalPaidRaw ?? ""),
        balanceRaw: String(r.balanceRaw ?? ""),
        schoolFeesRaw: String(r.schoolFeesRaw ?? ""),
      };
    });

    const receiptKeys = (App.state.payments || []).map(makeReceiptKey);

    return {
      registerKeys,
      financeMap,
      receiptKeys,
    };
  }

  function detectNewStudents(previous) {
    const prevRegister = new Set(previous.registerKeys || []);

    (App.state.register || []).forEach((r) => {
      const key = makeStudentKey(r);
      if (!prevRegister.has(key)) {
        addAlert(
          "new-student",
          "New student added",
          `${r.student || "UNDEFINED"} • ADM ${r.admNo || "UNDEFINED"} • Grade ${r.grade || "UNDEFINED"} • Term ${r.term || "UNDEFINED"} • ${r.year || "UNDEFINED"}`,
          `new-student__${key}`
        );
      }
    });
  }

  function detectNewReceipts(previous) {
    const prevReceipts = new Set(previous.receiptKeys || []);
    const newReceiptFinanceKeys = new Set();

    (App.state.payments || []).forEach((p) => {
      const receiptKey = makeReceiptKey(p);

      if (!prevReceipts.has(receiptKey)) {
        addAlert(
          "new-receipt",
          "New receipt recorded",
          `${p.receiptNo || "UNDEFINED"} • ${p.student || "UNDEFINED"} • KES ${App.money ? App.money(p.amount) : p.amount}`,
          `new-receipt__${receiptKey}`
        );

        newReceiptFinanceKeys.add(
          [
            String(p.admNo || "").trim(),
            String(p.student || "").trim().toUpperCase(),
            Number(p.grade || 0),
            Number(p.term || 0),
            Number(p.year || 0),
          ].join("__")
        );
      }
    });

    return newReceiptFinanceKeys;
  }

  function detectUndefinedAndIdentityIssues() {
    (App.state.students || []).forEach((r) => {
      const financeKey = makeFinanceKey(r);
      const hasAdm = !isBlank(r.admNo);
      const hasStudent = !isBlank(r.student);

      if (!hasAdm || !hasStudent) {
        addAlert(
          "identity-incomplete",
          "Student identity incomplete",
          `ADM ${hasAdm ? r.admNo : "UNDEFINED"} • Name ${hasStudent ? r.student : "UNDEFINED"} • Balance will not be calculated.`,
          `identity-incomplete__${financeKey}`
        );
      }

      if (isBlank(r.balanceBFRaw)) {
        addAlert(
          "finance-undefined",
          "Finance field undefined",
          `${r.student || "UNDEFINED"} • ADM ${r.admNo || "UNDEFINED"} • Missing: BALANCE B/F`,
          `finance-undefined__${financeKey}__BALANCE B/F`
        );
      }

      if (isBlank(r.totalPaidRaw)) {
        addAlert(
          "finance-undefined",
          "Finance field undefined",
          `${r.student || "UNDEFINED"} • ADM ${r.admNo || "UNDEFINED"} • Missing: TOTAL PAID`,
          `finance-undefined__${financeKey}__TOTAL PAID`
        );
      }

      if (isBlank(r.balanceRaw)) {
        addAlert(
          "finance-undefined",
          "Finance field undefined",
          `${r.student || "UNDEFINED"} • ADM ${r.admNo || "UNDEFINED"} • Missing: BALANCE`,
          `finance-undefined__${financeKey}__BALANCE`
        );
      }
    });
  }

  function detectFinanceChangedWithoutReceipt(previous, current, newReceiptFinanceKeys) {
    Object.entries(current.financeMap || {}).forEach(([financeKey, nowRow]) => {
      const prevRow = previous.financeMap?.[financeKey];
      if (!prevRow) return;
      if (prevRow.signature === nowRow.signature) return;
      if (newReceiptFinanceKeys.has(financeKey)) return;

      const changes = [];

      if (String(prevRow.balanceBFRaw ?? "") !== String(nowRow.balanceBFRaw ?? "")) {
        changes.push(
          `BAL B/F ${isBlank(prevRow.balanceBFRaw) ? "UNDEFINED" : prevRow.balanceBFRaw} → ${isBlank(nowRow.balanceBFRaw) ? "UNDEFINED" : nowRow.balanceBFRaw}`
        );
      }

      if (String(prevRow.totalPaidRaw ?? "") !== String(nowRow.totalPaidRaw ?? "")) {
        changes.push(
          `TOTAL PAID ${isBlank(prevRow.totalPaidRaw) ? "UNDEFINED" : prevRow.totalPaidRaw} → ${isBlank(nowRow.totalPaidRaw) ? "UNDEFINED" : nowRow.totalPaidRaw}`
        );
      }

      if (String(prevRow.balanceRaw ?? "") !== String(nowRow.balanceRaw ?? "")) {
        changes.push(
          `BALANCE ${isBlank(prevRow.balanceRaw) ? "UNDEFINED" : prevRow.balanceRaw} → ${isBlank(nowRow.balanceRaw) ? "UNDEFINED" : nowRow.balanceRaw}`
        );
      }

      if (!changes.length) return;

      addAlert(
        "finance-without-receipt",
        "Finance updated without receipt",
        `${nowRow.student || "UNDEFINED"} • ADM ${nowRow.admNo || "UNDEFINED"} • ${changes.join(" • ")}`,
        `finance-without-receipt__${financeKey}__${nowRow.signature}`
      );
    });
  }

  function detectTruthChanges() {
    const previous = loadSnapshot() || getSnapshotFallback();
    const current = buildCurrentSnapshot();

    detectNewStudents(previous);
    const newReceiptFinanceKeys = detectNewReceipts(previous);
    detectUndefinedAndIdentityIssues();
    detectFinanceChangedWithoutReceipt(previous, current, newReceiptFinanceKeys);

    saveSnapshot(current);
    renderBadge();
  }

  function initTruth() {
    App.truth.alerts = loadAlerts();
    renderBadge();
  }

  App.truthDetectChanges = detectTruthChanges;
  App.truthRenderBadge = renderBadge;

  initTruth();
});