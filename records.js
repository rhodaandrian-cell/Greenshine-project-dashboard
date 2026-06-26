// records.js
document.addEventListener("DOMContentLoaded", () => {
  const App = window.App;
  if (!App) {
    console.error("[records.js] window.App not found. Load data.js first.");
    return;
  }

  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  const paymentModal = byId("paymentModal");
  const btnRecordPayment = byId("btnRecordPayment");
  const btnClosePaymentModal = byId("btnClosePaymentModal");

  const payStudent = byId("payStudent");
  const studentsDatalist = byId("studentsDatalist");
  const studentHint = byId("studentHint");

  const payDate = byId("payDate");
  const payReceiptNo = byId("payReceiptNo");
  const payAmount = byId("payAmount");
  const payGrade = byId("payGrade");
  const payTerm = byId("payTerm");
  const payMethod = byId("payMethod");
  const payRef = byId("payRef");
  const payReceivedBy = byId("payReceivedBy");
  const btnSavePayment = byId("btnSavePayment");
  const payStatus = byId("payStatus");

  const receiptModal = byId("receiptModal");
  const btnCloseReceiptModal = byId("btnCloseReceiptModal");
  const receiptModalTitle = byId("receiptModalTitle");
  const receiptModalMeta = byId("receiptModalMeta");
  const receiptModalTbody = $("#receiptModalTable tbody");

  // Receipt-choice modal (added in index.html). Optional — guarded everywhere.
  const choiceModal      = byId("receiptChoiceModal");
  const choiceMeta       = byId("receiptChoiceMeta");
  const btnChoiceTermNow = byId("btnChoiceTermNow");
  const btnChoiceFull    = byId("btnChoiceFull");
  const btnChoicePayOnly = byId("btnChoicePayOnly");
  const btnChoiceSkip    = byId("btnChoiceSkip");
  const btnCloseChoice   = byId("btnCloseChoiceModal");

  function money(n) {
    return App.money ? App.money(n) : Number(n || 0).toLocaleString();
  }

  function escapeHtml(v) {
    return App.escapeHtml ? App.escapeHtml(v) : String(v ?? "");
  }

  function todayStr() {
    const d = new Date();
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }

  function openAnimatedModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    window.Animations?.modalIn?.(modal);
  }

  function closeAnimatedModal(modal) {
    if (!modal) return;
    window.Animations?.modalOut?.(modal, () => modal.classList.add("hidden"));
  }

  function getRegisteredStudentsSorted() {
    const source = App.state.register || [];
    const uniq = new Map();

    for (const r of source) {
      const key = `${String(r.student || "").trim().toLowerCase()}__${r.grade}__${r.term}__${r.year}`;
      if (!uniq.has(key)) uniq.set(key, r);
    }

    return [...uniq.values()].sort((a, b) =>
      String(a.student || "").localeCompare(String(b.student || ""))
    );
  }

  function fillStudentDatalist() {
    if (!studentsDatalist) return;

    studentsDatalist.innerHTML = "";
    const used = new Set();

    getRegisteredStudentsSorted().forEach((r) => {
      const name = String(r.student || "").trim();
      if (!name) return;

      const key = name.toLowerCase();
      if (used.has(key)) return;
      used.add(key);

      const opt = document.createElement("option");
      opt.value = name;
      studentsDatalist.appendChild(opt);
    });
  }

  function lookupRegisteredStudentByName(name) {
    const target = String(name || "").trim().toLowerCase();
    if (!target) return null;

    const matches = (App.state.register || []).filter(
      (r) => String(r.student || "").trim().toLowerCase() === target
    );

    if (!matches.length) return null;

    return (
      matches.find((m) => Number(m.term) === Number(App.CONFIG.DEFAULT_TERM || 1)) ||
      matches[0]
    );
  }

  function autofillFromStudentName() {
    const typed = String(payStudent?.value || "").trim();

    if (!typed) {
      if (studentHint) {
        studentHint.textContent = "";
        studentHint.style.color = "";
      }
      if (payGrade) payGrade.value = "";
      if (payTerm) payTerm.value = String(App.CONFIG.DEFAULT_TERM || 1);
      return;
    }

    const student = lookupRegisteredStudentByName(typed);

    if (!student) {
      if (studentHint) {
        studentHint.textContent = "Student not registered.";
        studentHint.style.color = "#ff8d8d";
      }
      return;
    }

    if (payGrade) payGrade.value = String(student.grade || "");
    if (payTerm) payTerm.value = String(student.term || App.CONFIG.DEFAULT_TERM || 1);

    if (studentHint) {
      studentHint.textContent =
        `Registered ✅ ADM ${student.admNo || "—"} • Grade ${student.grade} • Term ${student.term} • Year ${student.year}`;
      studentHint.style.color = "rgba(81,240,167,.95)";
    }
  }

  function fillStaffDropdown() {
    if (!payReceivedBy || payReceivedBy.tagName !== "SELECT") return;
    const cur = payReceivedBy.value;
    payReceivedBy.innerHTML = `<option value="">Select staff…</option>`;
    (App.CONFIG.STAFF || []).forEach((name) => {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      payReceivedBy.appendChild(o);
    });
    payReceivedBy.value = cur || "";
  }

  function openPaymentModal() {
    if (!paymentModal) return;

    fillStudentDatalist();
    fillStaffDropdown();

    if (payStatus) payStatus.textContent = "";
    if (payStudent) payStudent.value = "";
    if (studentHint) {
      studentHint.textContent = "";
      studentHint.style.color = "";
    }

    if (payDate) payDate.value = todayStr();
    if (payReceiptNo) payReceiptNo.value = "";
    if (payAmount) payAmount.value = "";
    if (payGrade) payGrade.value = "";
    if (payTerm) payTerm.value = String(App.CONFIG.DEFAULT_TERM || 1);
    if (payMethod) payMethod.value = "M-Pesa";
    if (payRef) payRef.value = "";
    if (payReceivedBy) payReceivedBy.value = "";

    openAnimatedModal(paymentModal);
    setTimeout(() => payStudent?.focus?.(), 50);
  }

  function closePaymentModal() {
    closeAnimatedModal(paymentModal);
  }

  async function saveReceiptToSheet(payload) {
    const url = App.CONFIG.API_URL;
    if (!url) throw new Error("API_URL missing in data.js");

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    if (String(text).toLowerCase().includes("error")) throw new Error(text);
    if (String(text).toLowerCase().includes("unauthorized")) throw new Error("Unauthorized");

    return text;
  }

  // ── Receipt choice (after a successful save) ──────────────
  // The payment is ALREADY saved by the time this runs. The choice only
  // determines which PDF to generate; dismissing it changes nothing about
  // the recorded payment.
  let pendingChoicePayment = null;

  function offerReceiptChoice(payment) {
    pendingChoicePayment = payment;

    // If the choice modal isn't present on this page, fall back to the
    // existing default (the term receipt) so behaviour never regresses.
    if (!choiceModal) {
      App.generateReceiptPDF?.(payment);
      return;
    }

    if (choiceMeta) {
      choiceMeta.textContent =
        `${payment.student} • ADM ${payment.admNo || "—"} • Term ${payment.term} • KES ${money(payment.amount)}`;
    }
    openAnimatedModal(choiceModal);
  }

  function closeChoice() {
    closeAnimatedModal(choiceModal);
    pendingChoicePayment = null;
  }

  btnChoicePayOnly?.addEventListener("click", () => {
    if (pendingChoicePayment) App.generatePaymentOnlyPDF?.(pendingChoicePayment);
    closeChoice();
  });

  btnChoiceTermNow?.addEventListener("click", () => {
    if (pendingChoicePayment) App.generateReceiptPDF?.(pendingChoicePayment);
    closeChoice();
  });

  btnChoiceFull?.addEventListener("click", () => {
    if (pendingChoicePayment) {
      App.generateStudentStatementPDF?.({
        admNo:   pendingChoicePayment.admNo,
        student: pendingChoicePayment.student,
        grade:   pendingChoicePayment.grade,
        year:    pendingChoicePayment.year,
        term:    pendingChoicePayment.term,
      });
    }
    closeChoice();
  });

  btnChoiceSkip?.addEventListener("click", closeChoice);
  btnCloseChoice?.addEventListener("click", closeChoice);
  choiceModal?.addEventListener("click", (e) => {
    if (e.target === choiceModal) closeChoice();
  });

  // ── Receipts history modal (unchanged) ────────────────────
  function openReceiptsModal(row) {
    if (!receiptModal || !receiptModalTbody || !row) return;

    const list = App.getReceiptsForStudentTerm(
      row.student,
      row.grade,
      row.year,
      row.term,
      row.admNo
    );

    if (receiptModalTitle) receiptModalTitle.textContent = "Receipts";

    if (receiptModalMeta) {
      receiptModalMeta.textContent =
        `${row.student} • ADM ${row.admNo || "—"} • Grade ${row.grade} • Term ${row.term} • Year ${row.year} • ${list.length} receipt(s)`;
    }

    receiptModalTbody.innerHTML = "";

    if (!list.length) {
      receiptModalTbody.innerHTML =
        `<tr><td colspan="5" class="muted">No receipts found for this student in the selected term/year.</td></tr>`;
    } else {
      list.forEach((p) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(p.date)}</td>
          <td>${escapeHtml(p.receiptNo)}</td>
          <td>KES ${money(p.amount)}</td>
          <td>${escapeHtml(p.method)}</td>
          <td><button class="btn btn-primary" type="button">Download</button></td>
        `;
        tr.querySelector("button")?.addEventListener("click", () => {
          App.generateReceiptPDF?.(p);
        });
        receiptModalTbody.appendChild(tr);
      });
    }

    openAnimatedModal(receiptModal);
  }

  function closeReceiptsModal() {
    closeAnimatedModal(receiptModal);
  }

  btnRecordPayment?.addEventListener("click", openPaymentModal);
  btnClosePaymentModal?.addEventListener("click", closePaymentModal);
  paymentModal?.addEventListener("click", (e) => {
    if (e.target === paymentModal) closePaymentModal();
  });

  btnCloseReceiptModal?.addEventListener("click", closeReceiptsModal);
  receiptModal?.addEventListener("click", (e) => {
    if (e.target === receiptModal) closeReceiptsModal();
  });

  payStudent?.addEventListener("input", autofillFromStudentName);
  payStudent?.addEventListener("change", autofillFromStudentName);

  btnSavePayment?.addEventListener("click", async () => {
    try {
      const typedName = String(payStudent?.value || "").trim();
      const registered = lookupRegisteredStudentByName(typedName);

      if (!typedName) return alert("Student Name is required.");
      if (!registered) return alert("Student not registered.");

      const admNo = String(registered.admNo || "").trim();
      const student = String(registered.student || "").trim();
      const grade = Number(payGrade?.value || registered.grade || 0);
      const year = Number(registered.year || new Date().getFullYear());
      const term = Number(payTerm?.value || registered.term || App.CONFIG.DEFAULT_TERM || 1);
      const amount = Number(payAmount?.value || 0);

      const date = String(payDate?.value || "").trim();
      const receiptNo = String(payReceiptNo?.value || "").trim();
      const method = String(payMethod?.value || "").trim();
      const ref = String(payRef?.value || "").trim();
      const receivedBy = String(payReceivedBy?.value || "").trim();

      if (!Number.isFinite(amount) || amount <= 0) return alert("Amount must be greater than 0.");
      if (!Number.isFinite(grade)) return alert("Grade is required.");
      if (!Number.isFinite(term) || term <= 0) return alert("Term is required.");
      if (!method) return alert("Payment Method is required.");
      if (!receivedBy) return alert("Received By is required.");

      if (payStatus) payStatus.textContent = "Saving…";

      const payment = {
        admNo,
        student,
        grade,
        year,
        term,
        amount,
        date,
        receiptNo,
        method,
        ref,
        receivedBy,
      };

      await saveReceiptToSheet(payment);

      if (payStatus) payStatus.textContent = "Saved ✅ Refreshing…";

      const ok = await App.syncAll({ notifyNewReceipts: false });

      if (ok) {
        window.App?.truthDetectChanges?.();
        window.refreshDashboard?.();
      }

      if (payStatus) payStatus.textContent = "Done ✅";

      // Close the entry modal, then ask what document to print. The payment
      // is already saved at this point — the choice is purely about the PDF.
      closePaymentModal();
      setTimeout(() => offerReceiptChoice(payment), 350);
    } catch (err) {
      console.error(err);
      if (payStatus) payStatus.textContent = "Failed ❌";
      alert(`Save failed: ${err.message || err}`);
    }
  });

  window.Records = {
    openPaymentModal,
    closePaymentModal,
    openReceiptsModal,
    closeReceiptsModal,
    offerReceiptChoice,
    fillStudentDatalist,
    lookupRegisteredStudentByName,
  };
});