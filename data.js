// data.js
(() => {
  const App = (window.App = window.App || {});

  App.CONFIG = {
    FINANCE_CSV_URL:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSedPYB_UrkW4WVhO39C62ENGY96D5sBi9d30axlSlegxgguL_KfgZiyLGUcNqjE7zMDZT-aMeA0f6p/pub?gid=869831895&single=true&output=csv",

    REGISTER_CSV_URL:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSedPYB_UrkW4WVhO39C62ENGY96D5sBi9d30axlSlegxgguL_KfgZiyLGUcNqjE7zMDZT-aMeA0f6p/pub?gid=1612989967&single=true&output=csv",

    PAYMENTS_CSV_URL:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSedPYB_UrkW4WVhO39C62ENGY96D5sBi9d30axlSlegxgguL_KfgZiyLGUcNqjE7zMDZT-aMeA0f6p/pub?gid=841135586&single=true&output=csv",

    POLL_MS: 15000,

    // ── Current school term ──────────────────────────────────
    // This is the term the dashboard opens on by default. The dashboard
    // computes KPIs, charts and the defaulters list for THIS term only, so a
    // student who has cleared an earlier term but has no row yet for a later
    // term is never wrongly shown as owing.
    //
    // IMPORTANT: update this number when the school moves to a new term.
    //   Term 1 → 1   •   Term 2 → 2   •   Term 3 → 3
    CURRENT_TERM: 2,

    DEFAULT_TERM: "",              // "" = All Terms (used by the Students page)
    GRADES: [0, 1, 2, 3, 4, 5, 6],
    TERMS: [1, 2, 3],
    SEEN_RECEIPTS_KEY: "greenshine_seen_receipts_v1",

    // ── Staff who can receive payments ───────────────────────
    // Used to populate the "Received By" dropdown in the Record Payment
    // modal and the Calculator's quick-record. Edit this list to add or
    // remove staff; both places update automatically.
    STAFF: [
      "TR JANE", "TR GITONGA", "TR SAMUEL", "TR BONIFACE", "TR JEDIDAH",
      "TR ANNE", "TR WAMBUI", "TR JOY", "TR FAITH", "TR SUSAN",
      "TR LOYCE", "TR MAGRET", "TR LINET", "TR TRACY", "ADMIN",
    ],

    API_URL:
      "https://script.google.com/macros/s/AKfycbz53N8bmyGiVm89K46fzRiVLWqpYhhvGLPhj2I5c8uYK46RAnHOPctnpMYmvtsHNxIADQ/exec",
  };

  App.state = {
    register: [],
    students: [],
    payments: [],
    lastSync: null,
  };

  // ── Formatting ───────────────────────────────────────────
  App.money = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  App.escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  App.nowStr = () => new Date().toLocaleString();

  App.isBlank = (v) => String(v ?? "").trim() === "";

  App.hasIdentity = (row) =>
    Boolean(String(row?.admNo ?? "").trim() && String(row?.student ?? "").trim());

  App.formatMoneyWithSign = (n) => {
    const num = Number(n || 0);
    if (num < 0) return `+KES ${App.money(Math.abs(num))}`;
    return `KES ${App.money(num)}`;
  };

  App.displayMaybeMoney = (raw, numericValue) => {
    if (App.isBlank(raw)) return "UNDEFINED";
    return App.formatMoneyWithSign(numericValue);
  };

  // ── Status UI ────────────────────────────────────────────
  App.setStatus = (msg, type = "") => {
    const el = document.getElementById("statusText");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color =
      type === "error" ? "#ff5d6c"
      : type === "ok"  ? "rgba(81,240,167,.95)"
      :                  "rgba(155,176,199,.95)";
  };

  // ── Seen receipts ────────────────────────────────────────
  App.loadSeenSet = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(App.CONFIG.SEEN_RECEIPTS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  };

  App.saveSeenSet = (set) => {
    localStorage.setItem(App.CONFIG.SEEN_RECEIPTS_KEY, JSON.stringify([...set]));
  };

  // ── Toast ────────────────────────────────────────────────
  App.toast = (title, body, { onDownload } = {}) => {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `
      <div class="t-title">${App.escapeHtml(title)}</div>
      <p class="t-body">${App.escapeHtml(body)}</p>
      <div class="t-actions">
        <button class="btn btn-primary" type="button">Download</button>
        <button class="btn btn-ghost"   type="button">Dismiss</button>
      </div>
    `;

    const [btnDownload, btnDismiss] = el.querySelectorAll("button");
    btnDownload?.addEventListener("click", () => { onDownload?.(); el.remove(); });
    btnDismiss?.addEventListener("click",  () => el.remove());

    container.appendChild(el);
    window.Animations?.toastIn?.(el);

    setTimeout(() => {
      if (el.isConnected) window.Animations?.toastOut?.(el, () => el.remove());
    }, 12000);
  };

  // ── CSV fetch ────────────────────────────────────────────
  App.fetchCsvAsRows = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    const csvText = await res.text();
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (out) => resolve(out.data || []),
        error: reject,
      });
    });
  };

  // ── Date helpers ─────────────────────────────────────────
  App.parseLooseDate = (s) => {
    const str = String(s || "").trim();
    if (!str) return null;

    let d = new Date(str);
    if (!Number.isNaN(d.getTime())) return d;

    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
      if (!Number.isNaN(d.getTime())) return d;
    }

    return null;
  };

  App.isToday = (dateStr) => {
    const d   = App.parseLooseDate(dateStr);
    if (!d) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth()    === now.getMonth()    &&
      d.getDate()     === now.getDate()
    );
  };

  // ── Normalizers ──────────────────────────────────────────
  App.normalizeRegister = (rows) =>
    rows
      .filter((r) => {
        const admNo   = String(r["ADM NO."] ?? r["ADM NO"] ?? "").trim();
        const student = String(r["STUDENT NAME"] ?? "").trim();
        return admNo || student;
      })
      .map((r) => ({
        admNo:    String(r["ADM NO."] ?? r["ADM NO"] ?? "").trim(),
        student:  String(r["STUDENT NAME"] ?? "").trim(),
        grade:    Number(r["GRADE"] ?? 0),
        year:     Number(r["YEAR"]  ?? new Date().getFullYear()),
        term:     Number(r["TERM"]  ?? 1),
        gender:   String(r["GENDER"] ?? "").trim(),
        guardian: String(r["GUARDIAN/ PARENT"] ?? r["GUARDIAN/PARENT"] ?? "").trim(),
        phone:    String(r["PHONE NUMBER"] ?? "").trim(),
        altPhone: String(r["ALTERNATIVE PHONE"] ?? "").trim(),
        status:   String(r["STATUS"] ?? "").trim(),
      }));

  App.normalizeFinance = (rows) =>
    rows
      .filter((r) => {
        const admNo   = String(r["ADM NO."] ?? r["ADM NO"] ?? "").trim();
        const student = String(r["STUDENT NAME"] ?? "").trim();
        return admNo || student;
      })
      .map((r) => {
        const rawBalanceBF = String(r["BALANCE B/F"] ?? "").trim();
        const rawTotalPaid = String(r["TOTAL PAID"]  ?? "").trim();
        const rawBalance   = String(r["BALANCE"]     ?? "").trim();
        const rawFees      = String(r["SCHOOL FEES"] ?? "").trim();

        return {
          admNo:    String(r["ADM NO."] ?? r["ADM NO"] ?? "").trim(),
          student:  String(r["STUDENT NAME"] ?? "").trim(),
          grade:    Number(r["GRADE"] ?? 0),
          year:     Number(r["YEAR"]  ?? new Date().getFullYear()),
          term:     Number(r["TERM"]  ?? 1),

          balanceBFRaw:  rawBalanceBF,
          totalPaidRaw:  rawTotalPaid,
          balanceRaw:    rawBalance,
          schoolFeesRaw: rawFees,

          balanceBF:  App.isBlank(rawBalanceBF) ? 0 : Number(rawBalanceBF) || 0,
          totalPaid:  App.isBlank(rawTotalPaid)  ? 0 : Number(rawTotalPaid)  || 0,
          balance:    App.isBlank(rawBalance)    ? 0 : Number(rawBalance)    || 0,
          schoolFees: App.isBlank(rawFees)       ? 0 : Number(rawFees)       || 0,
        };
      });

  App.normalizePayments = (rows) =>
    rows
      .map((r) => ({
        date:       String(r["DATE"]         ?? "").trim(),
        receiptNo:  String(r["RECEIPT NO."]  ?? r["RECEIPT NO"] ?? "").trim(),
        admNo:      String(r["ADM NO."]      ?? r["ADM NO"] ?? "").trim(),
        student:    String(r["STUDENT NAME"] ?? "").trim(),
        grade:      Number(r["GRADE"]        ?? 0),
        year:       Number(r["YEAR"]         ?? 0),
        term:       Number(r["TERM"]         ?? 0),
        amount:     Number(r["AMOUNT PAID"]  ?? 0) || 0,
        method:     String(r["PAYMENT METHOD"] ?? "").trim(),
        ref:        String(r["REFERENCE"]    ?? "").trim(),
        receivedBy: String(r["RECEIVED BY"]  ?? "").trim(),
        recordedAt: String(r["RECORDED AT"]  ?? "").trim(),
      }))
      .filter((p) => p.student && p.receiptNo && p.amount > 0);

  // ── Student lookup helpers ───────────────────────────────
  App.findFinanceStudent = (studentName, grade, year, term, admNo = "") => {
    const targetAdm  = String(admNo        || "").trim();
    const targetName = String(studentName  || "").trim().toUpperCase();
    const targetGrade = Number(grade  || 0);
    const targetYear  = Number(year   || 0);
    const targetTerm  = Number(term   || 0);

    return (App.state.students || []).find((r) => {
      const rAdm  = String(r.admNo   || "").trim();
      const rName = String(r.student || "").trim().toUpperCase();

      if (targetAdm && rAdm && targetAdm === rAdm) {
        return Number(r.year) === targetYear && Number(r.term) === targetTerm;
      }

      return (
        rName === targetName &&
        Number(r.grade) === targetGrade &&
        Number(r.year)  === targetYear  &&
        Number(r.term)  === targetTerm
      );
    }) || null;
  };

  App.findStudentFees = (studentName, grade, year, term, admNo = "") => {
    const s = App.findFinanceStudent(studentName, grade, year, term, admNo);
    return s ? Number(s.schoolFees || 0) : 0;
  };

  App.findStudentBalanceBF = (studentName, grade, year, term, admNo = "") => {
    const s = App.findFinanceStudent(studentName, grade, year, term, admNo);
    return s ? Number(s.balanceBF || 0) : 0;
  };

  App.findStudentTotalDue = (studentName, grade, year, term, admNo = "") => {
    return App.findStudentFees(studentName, grade, year, term, admNo)
         + App.findStudentBalanceBF(studentName, grade, year, term, admNo);
  };

  // Receipts for a specific student/term (used by Records modal)
  App.getReceiptsForStudentTerm = (studentName, grade, year, term, admNo = "") => {
    const targetAdm  = String(admNo       || "").trim();
    const targetName = String(studentName || "").trim().toUpperCase();
    const targetYear  = Number(year  || 0);
    const targetTerm  = Number(term  || 0);

    return (App.state.payments || []).filter((p) => {
      const pAdm  = String(p.admNo   || "").trim();
      const pName = String(p.student || "").trim().toUpperCase();

      if (targetAdm && pAdm && targetAdm === pAdm) {
        const sameYear = targetYear > 0 && Number(p.year) > 0 ? Number(p.year) === targetYear : true;
        return Number(p.term) === targetTerm && sameYear;
      }

      const sameName  = pName === targetName;
      const sameGrade = Number(p.grade) === Number(grade || 0);
      const sameYear  = targetYear > 0 && Number(p.year) > 0 ? Number(p.year) === targetYear : true;
      return sameName && sameGrade && Number(p.term) === targetTerm && sameYear;
    });
  };

  // ── Sync ─────────────────────────────────────────────────
  App.syncAll = async ({ notifyNewReceipts = true } = {}) => {
    try {
      App.setStatus("Refreshing from Google Sheets…");

      const [registerRows, financeRows, paymentRows] = await Promise.all([
        App.fetchCsvAsRows(App.CONFIG.REGISTER_CSV_URL),
        App.fetchCsvAsRows(App.CONFIG.FINANCE_CSV_URL),
        App.fetchCsvAsRows(App.CONFIG.PAYMENTS_CSV_URL),
      ]);

      App.state.register = App.normalizeRegister(registerRows);
      App.state.students = App.normalizeFinance(financeRows);
      App.state.payments = App.normalizePayments(paymentRows);
      App.state.lastSync = new Date();

      const lastSyncEl = document.getElementById("lastSync");
      if (lastSyncEl) lastSyncEl.textContent = App.nowStr();

      App.setStatus("Refresh successful ✅", "ok");

      // NOTE: the old per-receipt toast storm has been removed. New receipts are
      // still recorded in the Finance Alerts (Messages) page via truthDetectChanges,
      // and will be surfaced via a quiet badge / the Receipts page in later steps.
      // The notifyNewReceipts flag is kept for backward compatibility but no longer
      // pops toasts.

      return true;
    } catch (e) {
      console.warn(e);
      App.setStatus("Refresh failed. Ensure the sheets are published to web as CSV.", "error");
      return false;
    }
  };
})();