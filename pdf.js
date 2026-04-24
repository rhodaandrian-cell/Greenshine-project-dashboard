// pdf.js
(() => {
  const App = (window.App = window.App || {});

  // ── Helpers ──────────────────────────────────────────────

  function ensurePdfReady_() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library not loaded. Refresh the page and try again.");
      return null;
    }
    return window.jspdf.jsPDF;
  }

  function money_(n) {
    return App.money ? App.money(n) : Number(n || 0).toFixed(2);
  }

  function nowStr_() {
    return App.nowStr ? App.nowStr() : new Date().toLocaleString();
  }

  function parseTime_(dateStr) {
    if (App.parseLooseDate) {
      const d = App.parseLooseDate(dateStr);
      return d ? d.getTime() : 0;
    }
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function formatBalanceLabel_(balance) {
    if (App.formatMoneyWithSign) return App.formatMoneyWithSign(balance);
    return balance < 0
      ? `+KES ${money_(Math.abs(balance))}`
      : `KES ${money_(balance)}`;
  }

  // ── PDF header ───────────────────────────────────────────

  function pdfHeader_(doc, title, subtitle = "") {
    doc.setFillColor(22, 27, 38);
    doc.rect(0, 0, 210, 34, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("GREENSHINE ACADEMY", 14, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(title, 14, 24);

    if (subtitle) {
      doc.setTextColor(200, 220, 240);
      doc.setFontSize(8.5);
      doc.text(subtitle, 14, 30);
    }

    doc.setTextColor(20, 20, 20);
  }

  // ── Info block (key-value box) ───────────────────────────

  function infoBlock_(doc, title, rows, x, y, w = 84) {
    const lineH = 6.5;
    const h = 10 + rows.length * lineH + 4;

    doc.setDrawColor(60);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, 3, 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, x + 4, y + 7);

    let cy = y + 14;
    rows.forEach(([k, v, highlight]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${k}:`, x + 4, cy);
      doc.setFont("helvetica", highlight ? "bold" : "normal");
      if (highlight) {
        doc.setTextColor(highlight[0], highlight[1], highlight[2]);
      }
      doc.text(String(v), x + 34, cy);
      doc.setTextColor(20, 20, 20);
      cy += lineH;
    });

    return y + h;
  }

  // ── Approval / signature block ───────────────────────────

  function drawApproval_(doc, label, startY) {
    const y = startY || 248;
    doc.setDrawColor(120);
    doc.setLineWidth(0.4);
    doc.line(18, y, 92, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Authorised Signature", 18, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("GREENSHINE ACADEMY", 18, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label || "", 118, y + 12);
  }

  // ── Find finance row for a specific term ─────────────────

  function findFinanceRow_(admNo, studentName, grade, year, term) {
    const targetAdm  = String(admNo       || "").trim();
    const targetName = String(studentName || "").trim().toUpperCase();
    const targetGrade = Number(grade  || 0);
    const targetYear  = Number(year   || 0);
    const targetTerm  = Number(term   || 0);

    return (App.state.students || []).find((s) => {
      const sAdm  = String(s.admNo   || "").trim();
      const sName = String(s.student || "").trim().toUpperCase();

      if (targetAdm && sAdm && sAdm === targetAdm) {
        return Number(s.term) === targetTerm &&
               (targetYear === 0 || Number(s.year) === targetYear);
      }
      return sName === targetName &&
             Number(s.grade) === targetGrade &&
             Number(s.term)  === targetTerm  &&
             (targetYear === 0 || Number(s.year) === targetYear);
    }) || null;
  }

  // ── Get receipts for a specific term ─────────────────────

  function getReceiptsForTerm_(admNo, studentName, grade, year, term) {
    const targetAdm  = String(admNo       || "").trim();
    const targetName = String(studentName || "").trim().toUpperCase();
    const targetYear  = Number(year  || 0);
    const targetTerm  = Number(term  || 0);

    return (App.state.payments || [])
      .filter((p) => {
        const pAdm  = String(p.admNo   || "").trim();
        const pName = String(p.student || "").trim().toUpperCase();

        if (targetAdm && pAdm && pAdm === targetAdm) {
          const sameYear = targetYear > 0 && Number(p.year) > 0
            ? Number(p.year) === targetYear : true;
          return Number(p.term) === targetTerm && sameYear;
        }
        const sameYear = targetYear > 0 && Number(p.year) > 0
          ? Number(p.year) === targetYear : true;
        return pName === targetName &&
               Number(p.grade) === Number(grade || 0) &&
               Number(p.term)  === targetTerm && sameYear;
      })
      .slice()
      .sort((a, b) => parseTime_(a.date) - parseTime_(b.date));
  }

  // ── Get all terms that exist for a student ───────────────

  function getStudentTerms_(admNo, studentName, grade, year) {
    const targetAdm  = String(admNo       || "").trim();
    const targetName = String(studentName || "").trim().toUpperCase();
    const targetYear  = Number(year  || 0);

    const terms = new Set();

    (App.state.students || []).forEach((s) => {
      const sAdm  = String(s.admNo   || "").trim();
      const sName = String(s.student || "").trim().toUpperCase();
      const sYear = Number(s.year || 0);

      const yearMatch = targetYear === 0 || sYear === 0 || sYear === targetYear;

      if ((targetAdm && sAdm && sAdm === targetAdm && yearMatch) ||
          (sName === targetName && Number(s.grade) === Number(grade || 0) && yearMatch)) {
        if (s.term) terms.add(Number(s.term));
      }
    });

    // Also check payments — a student may have a payment for a term
    // even if the finance row isn't created yet
    (App.state.payments || []).forEach((p) => {
      const pAdm  = String(p.admNo   || "").trim();
      const pName = String(p.student || "").trim().toUpperCase();
      const pYear = Number(p.year || 0);
      const yearMatch = targetYear === 0 || pYear === 0 || pYear === targetYear;

      if ((targetAdm && pAdm && pAdm === targetAdm && yearMatch) ||
          (pName === targetName && Number(p.grade) === Number(grade || 0) && yearMatch)) {
        if (p.term) terms.add(Number(p.term));
      }
    });

    return [...terms].sort((a, b) => a - b);
  }

  // ── Draw a single term section on the statement ──────────

  function drawTermSection_(doc, y, termNum, finRow, receipts) {
    const schoolFees = Number(finRow?.schoolFees  || 0);
    const balanceBF  = Number(finRow?.balanceBF   || 0);
    const totalPaid  = Number(finRow?.totalPaid   || 0);
    const totalDue   = schoolFees + balanceBF;
    const balance    = Number(finRow?.balance     ?? (totalDue - totalPaid));

    const balColor = balance > 0 ? [200, 50, 50] : balance < 0 ? [20, 130, 70] : [20, 20, 20];
    const balLabel = balance < 0
      ? `+KES ${money_(Math.abs(balance))} (OVERPAID)`
      : balance === 0
        ? "KES 0.00 (CLEARED)"
        : `KES ${money_(balance)} (OWING)`;

    // Section heading
    doc.setFillColor(35, 42, 58);
    doc.rect(14, y, 182, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`TERM ${termNum} SUMMARY`, 18, y + 5.5);
    doc.setTextColor(20, 20, 20);
    y += 12;

    // Term finance summary table
    doc.autoTable({
      startY: y,
      head: [["BAL B/F", "SCHOOL FEES", "TOTAL DUE", "TOTAL PAID", "BALANCE"]],
      body: [[
        `KES ${money_(balanceBF)}`,
        `KES ${money_(schoolFees)}`,
        `KES ${money_(totalDue)}`,
        `KES ${money_(totalPaid)}`,
        balLabel,
      ]],
      styles:         { font: "helvetica", fontSize: 9, cellPadding: 3 },
      headStyles:     { fillColor: [50, 60, 80], textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles:     { textColor: [20, 20, 20] },
      columnStyles:   { 4: { textColor: balColor, fontStyle: "bold" } },
      margin:         { left: 14, right: 14 },
      tableWidth:     182,
    });

    y = (doc.lastAutoTable?.finalY || y + 14) + 4;

    // Receipts for this term
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 100, 130);
    doc.text(`Term ${termNum} Receipts (${receipts.length})`, 14, y + 3);
    doc.setTextColor(20, 20, 20);
    y += 6;

    const receiptBody = receipts.length
      ? receipts.map((r) => [
          r.date       || "—",
          r.receiptNo  || "—",
          `KES ${money_(r.amount || 0)}`,
          r.method     || "—",
          r.ref        || "—",
          r.receivedBy || "—",
        ])
      : [["—", "—", "KES 0.00", "—", "—", "No receipts recorded"]];

    doc.autoTable({
      startY: y,
      head: [["Date", "Receipt No.", "Amount", "Method", "Reference", "Received By"]],
      body:  receiptBody,
      styles:      { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles:  { fillColor: [22, 27, 38], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      margin:      { left: 14, right: 14 },
      tableWidth:  182,
    });

    return (doc.lastAutoTable?.finalY || y + 20) + 6;
  }

  // ── Invalid rows helper ──────────────────────────────────

  function invalidStudentRows_(rows = []) {
    return (rows || []).filter((r) => {
      const missingIdentity = App.hasIdentity ? !App.hasIdentity(r) : (!r.admNo || !r.student);
      const missingFinance  =
        (App.isBlank && App.isBlank(r.balanceBFRaw))  ||
        (App.isBlank && App.isBlank(r.totalPaidRaw))  ||
        (App.isBlank && App.isBlank(r.balanceRaw))    ||
        (App.isBlank && App.isBlank(r.schoolFeesRaw));
      return missingIdentity || missingFinance;
    });
  }

  // ════════════════════════════════════════════════════════
  // RECEIPT PDF  (single payment receipt — unchanged logic,
  //               but now shows term balance clearly)
  // ════════════════════════════════════════════════════════

  App.generateReceiptPDF = (p) => {
    if (!p) return;
    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF();

    const finRow   = findFinanceRow_(p.admNo, p.student, p.grade, p.year, p.term);
    const receipts = getReceiptsForTerm_(p.admNo, p.student, p.grade, p.year, p.term);

    const balanceBF  = Number(finRow?.balanceBF  || 0);
    const schoolFees = Number(finRow?.schoolFees || 0);
    const totalPaid  = Number(finRow?.totalPaid  || 0);
    const totalDue   = schoolFees + balanceBF;
    const balance    = Number(finRow?.balance    ?? (totalDue - totalPaid));
    const balLabel   = formatBalanceLabel_(balance);

    pdfHeader_(doc, "School Fee Payment Receipt", `Generated: ${nowStr_()}`);

    // Amount received — prominent
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("AMOUNT RECEIVED", 14, 46);
    doc.setTextColor(0, 120, 50);
    doc.setFontSize(28);
    doc.text(`KES ${money_(p.amount)}`, 14, 59);
    doc.setTextColor(20, 20, 20);

    // Payment details block
    infoBlock_(doc, "PAYMENT DETAILS", [
      ["Receipt No",  p.receiptNo  || "—"],
      ["Date",        p.date       || "—"],
      ["ADM NO.",     p.admNo      || "—"],
      ["Student",     p.student    || "—"],
      ["Grade",       String(p.grade || "—")],
      ["Year",        String(p.year  || "—")],
      ["Term",        `Term ${p.term || "—"}`],
      ["Method",      p.method     || "N/A"],
      ["Reference",   p.ref        || "N/A"],
      ["Received By", p.receivedBy || "N/A"],
    ], 14, 68, 92);

    // Account summary block — term-specific
    const balColor = balance > 0 ? [200, 50, 50] : balance < 0 ? [20, 140, 70] : [20, 20, 20];
    infoBlock_(doc, `TERM ${p.term || "?"} ACCOUNT`, [
      ["Bal B/F",     `KES ${money_(balanceBF)}`],
      ["School Fees", `KES ${money_(schoolFees)}`],
      ["Total Due",   `KES ${money_(totalDue)}`],
      ["Total Paid",  `KES ${money_(totalPaid)}`],
      ["Balance",     balLabel, balColor],
    ], 114, 40, 82);

    // Payment history for this term
    let y = 148;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`TERM ${p.term || "?"} PAYMENT HISTORY`, 14, y);
    y += 5;

    const body = receipts.length
      ? receipts.map((r) => [
          r.date      || "",
          r.receiptNo || "",
          `KES ${money_(r.amount || 0)}`,
          r.method    || "",
          r.ref       || "",
        ])
      : [[p.date || "—", p.receiptNo || "—", `KES ${money_(p.amount || 0)}`, p.method || "—", p.ref || "—"]];

    doc.autoTable({
      startY: y,
      head:   [["Date", "Receipt No.", "Amount", "Method", "Reference"]],
      body,
      styles:      { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles:  { fillColor: [22, 27, 38] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin:      { left: 14, right: 14 },
    });

    const finalY = doc.lastAutoTable?.finalY || (y + 30);
    drawApproval_(doc, `Recorded: ${p.recordedAt || p.date || "—"}`, Math.min(finalY + 16, 262));

    doc.save(`${p.receiptNo || "Receipt"}_${p.student || "Student"}.pdf`);
  };

  // ════════════════════════════════════════════════════════
  // STUDENT STATEMENT PDF
  // Shows Term 1, Term 2, Term 3 sections each with their
  // own finance summary + receipts, then a grand total.
  // ════════════════════════════════════════════════════════

  function buildStatement_(doc, studentRow) {
    const admNo      = studentRow.admNo    || "";
    const student    = studentRow.student  || "";
    const grade      = studentRow.grade    || 0;
    const year       = studentRow.year     || 0;

    // Discover all terms this student has data for
    const terms = getStudentTerms_(admNo, student, grade, year);

    pdfHeader_(doc, "Student Fee Statement", `Generated: ${nowStr_()}`);

    // Student details block
    infoBlock_(doc, "STUDENT DETAILS", [
      ["Student",  student        || "—"],
      ["ADM NO.",  admNo          || "—"],
      ["Grade",    String(grade   || "—")],
      ["Year",     String(year    || "—")],
      ["Terms",    terms.length ? terms.map((t) => `Term ${t}`).join(", ") : "—"],
    ], 14, 38, 90);

    // Grand totals (computed across all terms)
    let grandDue  = 0;
    let grandPaid = 0;
    let grandBal  = 0;

    const termData = terms.map((t) => {
      const finRow  = findFinanceRow_(admNo, student, grade, year, t);
      const fees    = Number(finRow?.schoolFees || 0);
      const bfwd    = Number(finRow?.balanceBF  || 0);
      const paid    = Number(finRow?.totalPaid  || 0);
      const due     = fees + bfwd;
      const bal     = Number(finRow?.balance    ?? (due - paid));
      grandDue  += due;
      grandPaid += paid;
      grandBal  += bal;
      return { t, finRow, fees, bfwd, paid, due, bal };
    });

    // Grand summary block
    const grandBalColor = grandBal > 0 ? [200, 50, 50] : grandBal < 0 ? [20, 140, 70] : [20, 20, 20];
    const grandBalLabel = grandBal < 0
      ? `+KES ${money_(Math.abs(grandBal))} (OVERPAID)`
      : grandBal === 0
        ? "KES 0.00 (CLEARED)"
        : `KES ${money_(grandBal)} (OWING)`;

    infoBlock_(doc, "OVERALL BALANCE", [
      ["Total Due",   `KES ${money_(grandDue)}`],
      ["Total Paid",  `KES ${money_(grandPaid)}`],
      ["Net Balance", grandBalLabel, grandBalColor],
    ], 114, 38, 82);

    let y = 98;

    // Draw each term section
    termData.forEach(({ t, finRow, fees, bfwd, paid, due, bal }) => {
      // Check if we need a new page
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      const receipts = getReceiptsForTerm_(admNo, student, grade, year, t);
      y = drawTermSection_(doc, y, t, finRow, receipts);
    });

    // If no terms found, show a note
    if (!terms.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text("No finance records found for this student.", 14, y + 10);
      y += 20;
    }

    // Grand total footer bar
    if (y > 250) { doc.addPage(); y = 20; }

    doc.setFillColor(22, 27, 38);
    doc.rect(14, y, 182, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      `TOTAL DUE: KES ${money_(grandDue)}    TOTAL PAID: KES ${money_(grandPaid)}    NET BALANCE: ${grandBalLabel}`,
      18, y + 6.5
    );
    doc.setTextColor(20, 20, 20);
    y += 16;

    drawApproval_(doc, `${terms.length} term(s) • ${nowStr_()}`, Math.min(y + 4, 272));
  }

  App.generateStudentStatementPDF = (studentRow) => {
    if (!studentRow) return;
    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF();
    buildStatement_(doc, studentRow);
    doc.save(`Statement_${studentRow.student || "Student"}_ADM${studentRow.admNo || ""}.pdf`);
  };

  // ════════════════════════════════════════════════════════
  // ALL STATEMENTS  (one page per student)
  // ════════════════════════════════════════════════════════

  App.generateAllStatementsPDF = (rows = []) => {
    if (!rows.length) return;
    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF();

    rows.forEach((studentRow, index) => {
      if (index > 0) doc.addPage();
      buildStatement_(doc, studentRow);
    });

    doc.save("Greenshine_All_Statements.pdf");
  };

  // ════════════════════════════════════════════════════════
  // PAYMENTS EXPORT PDF  (landscape, all receipts)
  // ════════════════════════════════════════════════════════

  App.exportPaymentsPdf = () => {
    const payments = App.state.payments || [];
    if (!payments.length) { alert("No payments to export yet."); return; }

    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF({ orientation: "landscape" });

    pdfHeader_(doc, "Payments Installments Report", `Generated: ${nowStr_()}`);

    const rows = payments
      .slice()
      .sort((a, b) => parseTime_(b.date) - parseTime_(a.date))
      .map((p) => [
        p.date       || "",
        p.receiptNo  || "",
        p.admNo      || "",
        p.student    || "",
        String(p.grade || ""),
        String(p.year  || ""),
        `Term ${p.term || ""}`,
        `KES ${money_(p.amount)}`,
        p.method     || "",
        p.ref        || "",
        p.receivedBy || "",
      ]);

    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

    doc.autoTable({
      startY: 40,
      head: [["DATE", "RECEIPT NO.", "ADM NO.", "STUDENT NAME", "GRADE", "YEAR",
              "TERM", "AMOUNT", "METHOD", "REFERENCE", "RECEIVED BY"]],
      body: rows,
      styles:      { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles:  { fillColor: [22, 27, 38] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin:      { left: 10, right: 10 },
    });

    const y = (doc.lastAutoTable?.finalY || 40) + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`TOTAL COLLECTED: KES ${money_(total)}`, 14, y);

    doc.save("Greenshine_Payments_Report.pdf");
  };

  // ════════════════════════════════════════════════════════
  // INVALID STUDENTS PDF
  // ════════════════════════════════════════════════════════

  App.generateInvalidStudentsPDF = (rows = []) => {
    const invalid = invalidStudentRows_(rows);
    if (!invalid.length) { alert("No students with data errors were found."); return; }

    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF({ orientation: "landscape" });

    pdfHeader_(doc, "Invalid Students / Data Errors Report", `Generated: ${nowStr_()}`);

    const body = invalid.map((r) => {
      const errors = [];
      if (App.isBlank && App.isBlank(r.admNo))         errors.push("Missing ADM NO.");
      if (App.isBlank && App.isBlank(r.student))        errors.push("Missing Student Name");
      if (App.isBlank && App.isBlank(r.balanceBFRaw))   errors.push("Missing BAL B/F");
      if (App.isBlank && App.isBlank(r.totalPaidRaw))   errors.push("Missing TOTAL PAID");
      if (App.isBlank && App.isBlank(r.schoolFeesRaw))  errors.push("Missing SCHOOL FEES");
      if (App.isBlank && App.isBlank(r.balanceRaw))     errors.push("Missing BALANCE");
      return [
        r.student || "UNDEFINED",
        r.admNo   || "UNDEFINED",
        String(r.grade || "—"),
        String(r.year  || "—"),
        String(r.term  || "—"),
        errors.join(", "),
      ];
    });

    doc.autoTable({
      startY: 40,
      head:   [["STUDENT NAME", "ADM NO.", "GRADE", "YEAR", "TERM", "ERRORS"]],
      body,
      styles:      { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles:  { fillColor: [22, 27, 38] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin:      { left: 10, right: 10 },
    });

    doc.save("Greenshine_Invalid_Students_Report.pdf");
  };

})();