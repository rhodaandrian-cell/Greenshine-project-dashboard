// pdf.js
(() => {
  const App = (window.App = window.App || {});

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

  function pdfHeader_(doc, title, subtitle = "") {
    doc.setFillColor(22, 27, 38);
    doc.rect(0, 0, 210, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("GREENSHINE ACADEMY", 14, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(title, 14, 23);

    if (subtitle) {
      doc.setTextColor(220, 230, 240);
      doc.setFontSize(9);
      doc.text(subtitle, 14, 28);
    }

    doc.setTextColor(20, 20, 20);
  }

  function infoBlock_(doc, title, rows, x, y, w = 84) {
    const lineHeight = 6.5;
    const h = 10 + rows.length * lineHeight + 4;

    doc.setDrawColor(60);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, 3, 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, x + 4, y + 7);

    let cy = y + 14;
    rows.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${k}:`, x + 4, cy);
      doc.setFont("helvetica", "normal");
      doc.text(String(v), x + 32, cy);
      cy += lineHeight;
    });

    return y + h;
  }

  function formatBalanceLabel_(balance) {
    if (App.formatMoneyWithSign) return App.formatMoneyWithSign(balance);
    return balance < 0
      ? `+KES ${money_(Math.abs(balance))}`
      : `KES ${money_(balance)}`;
  }

  function getReceiptsForPayment_(p) {
    return (App.state.payments || [])
      .filter((r) => {
        const rAdm = String(r.admNo || "").trim();
        const pAdm = String(p.admNo || "").trim();

        if (pAdm && rAdm && pAdm === rAdm) {
          const sameTerm = Number(r.term || 0) === Number(p.term || 0);
          const sameYear =
            Number(r.year || 0) > 0 && Number(p.year || 0) > 0
              ? Number(r.year) === Number(p.year)
              : true;

          return sameTerm && sameYear;
        }

        const sameName =
          String(r.student || "").trim().toUpperCase() ===
          String(p.student || "").trim().toUpperCase();

        const sameGrade = Number(r.grade || 0) === Number(p.grade || 0);
        const sameTerm = Number(r.term || 0) === Number(p.term || 0);
        const sameYear =
          Number(r.year || 0) > 0 && Number(p.year || 0) > 0
            ? Number(r.year) === Number(p.year)
            : true;

        return sameName && sameGrade && sameTerm && sameYear;
      })
      .slice()
      .sort((a, b) => parseTime_(b.date) - parseTime_(a.date));
  }

  function findFinanceStudentStrict_(studentName, grade, year, term, admNo = "") {
    if (typeof App.findFinanceStudent === "function") {
      const found = App.findFinanceStudent(studentName, grade, year, term, admNo);
      if (found) return found;
    }

    return (
      (App.state.students || []).find((s) => {
        const sAdm = String(s.admNo || "").trim();
        const targetAdm = String(admNo || "").trim();

        if (targetAdm && sAdm && sAdm === targetAdm) {
          const sameTerm = Number(s.term || 0) === Number(term || 0);
          const sameYear =
            Number(s.year || 0) > 0 && Number(year || 0) > 0
              ? Number(s.year) === Number(year)
              : true;

          return sameTerm && sameYear;
        }

        const sameName =
          String(s.student || "").trim().toUpperCase() ===
          String(studentName || "").trim().toUpperCase();

        const sameGrade = Number(s.grade || 0) === Number(grade || 0);
        const sameTerm = Number(s.term || 0) === Number(term || 0);
        const sameYear =
          Number(s.year || 0) > 0 && Number(year || 0) > 0
            ? Number(s.year) === Number(year)
            : true;

        return sameName && sameGrade && sameTerm && sameYear;
      }) || null
    );
  }

  function invalidStudentRows_(rows = []) {
    return (rows || []).filter((r) => {
      const missingIdentity = App.hasIdentity ? !App.hasIdentity(r) : (!r.admNo || !r.student);
      const missingFinanceField =
        (App.isBlank && App.isBlank(r.balanceBFRaw)) ||
        (App.isBlank && App.isBlank(r.totalPaidRaw)) ||
        (App.isBlank && App.isBlank(r.balanceRaw)) ||
        (App.isBlank && App.isBlank(r.schoolFeesRaw));

      return missingIdentity || missingFinanceField;
    });
  }

  function drawReceiptApproval_(doc, p, startY) {
    const y = startY || 248;

    doc.setDrawColor(120);
    doc.setLineWidth(0.4);
    doc.line(18, y, 92, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text("Signature", 18, y + 5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("GREENSHINE ACADEMY DIRECTOR", 18, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Recorded: ${p.recordedAt || p.date || "—"}`, 118, y + 12);
  }

  App.exportPaymentsPdf = () => {
    const payments = App.state.payments || [];
    if (!payments.length) {
      alert("No payments to export yet.");
      return;
    }

    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF({ orientation: "landscape" });

    pdfHeader_(doc, "Payments Installments Report", `Generated: ${nowStr_()}`);

    const rows = payments
      .slice()
      .sort((a, b) => parseTime_(b.date) - parseTime_(a.date))
      .map((p) => [
        p.date || "",
        p.receiptNo || "",
        p.admNo || "",
        p.student || "",
        String(p.grade || ""),
        String(p.year || ""),
        String(p.term || ""),
        `KES ${money_(p.amount)}`,
        p.method || "",
        p.ref || "",
        p.receivedBy || "",
      ]);

    const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    doc.autoTable({
      startY: 38,
      head: [[
        "DATE",
        "RECEIPT NO.",
        "ADM NO.",
        "STUDENT NAME",
        "GRADE",
        "YEAR",
        "TERM",
        "AMOUNT",
        "METHOD",
        "REFERENCE",
        "RECEIVED BY",
      ]],
      body: rows,
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [20, 20, 20] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 10, right: 10 },
    });

    const y = (doc.lastAutoTable?.finalY || 40) + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`TOTAL COLLECTED: KES ${money_(total)}`, 14, y);

    doc.save("Greenshine_Payments_Report.pdf");
  };

  App.generateReceiptPDF = (p) => {
    if (!p) return;

    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF();

    const receipts = getReceiptsForPayment_(p);
    const financeStudent = findFinanceStudentStrict_(
      p.student,
      p.grade,
      p.year,
      p.term,
      p.admNo
    );

    const balanceBF = Number(financeStudent?.balanceBF || 0);
    const schoolFees = Number(financeStudent?.schoolFees || 0);
    const totalPaid = Number(financeStudent?.totalPaid || 0);
    const balance = Number(
      typeof financeStudent?.balance !== "undefined" ? financeStudent.balance : 0
    );

    const balanceLabel = formatBalanceLabel_(balance);

    pdfHeader_(doc, "School Fee Payment Receipt", `Generated: ${nowStr_()}`);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("AMOUNT RECEIVED", 14, 45);

    doc.setTextColor(0, 110, 45);
    doc.setFontSize(26);
    doc.text(`KES ${money_(p.amount)}`, 14, 58);
    doc.setTextColor(20, 20, 20);

    infoBlock_(
      doc,
      "PAYMENT DETAILS",
      [
        ["Receipt No", p.receiptNo || "—"],
        ["Date", p.date || "—"],
        ["ADM NO.", p.admNo || "—"],
        ["Student", p.student || "—"],
        ["Grade", String(p.grade || "—")],
        ["Year", String(p.year || "—")],
        ["Term", String(p.term || "—")],
        ["Method", p.method || "N/A"],
        ["Reference", p.ref || "N/A"],
        ["Received By", p.receivedBy || "N/A"],
      ],
      14,
      68,
      90
    );

    infoBlock_(
      doc,
      "ACCOUNT SUMMARY",
      [
        ["Bal B/F", `KES ${money_(balanceBF)}`],
        ["School Fees", `KES ${money_(schoolFees)}`],
        ["Total Paid", `KES ${money_(totalPaid)}`],
        ["Balance", balanceLabel],
      ],
      112,
      40,
      84
    );

    let y = 142;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PAYMENT HISTORY", 14, y);
    y += 5;

    const body = receipts.length
      ? receipts.map((r) => [
          r.date || "",
          r.receiptNo || "",
          `KES ${money_(r.amount || 0)}`,
          r.method || "",
          r.ref || "",
        ])
      : [[
          p.date || "—",
          p.receiptNo || "—",
          `KES ${money_(p.amount || 0)}`,
          p.method || "—",
          p.ref || "No installments history found",
        ]];

    doc.autoTable({
      startY: y,
      head: [["Date", "Receipt No.", "Amount", "Method", "Reference"]],
      body,
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [20, 20, 20] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc.lastAutoTable?.finalY || (y + 30));
    drawReceiptApproval_(doc, p, Math.min(finalY + 18, 262));

    doc.save(`${p.receiptNo || "Receipt"}_${p.student || "Student"}.pdf`);
  };

  App.generateStudentStatementPDF = (studentRow) => {
    if (!studentRow) return;

    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF();

    const receipts = App.getReceiptsForStudentTerm
      ? App.getReceiptsForStudentTerm(
          studentRow.student,
          studentRow.grade,
          studentRow.year,
          studentRow.term,
          studentRow.admNo
        )
      : [];

    const financeStudent = findFinanceStudentStrict_(
      studentRow.student,
      studentRow.grade,
      studentRow.year,
      studentRow.term,
      studentRow.admNo
    );

    const balanceBF = Number(financeStudent?.balanceBF || studentRow.balanceBF || 0);
    const schoolFees = Number(financeStudent?.schoolFees || studentRow.schoolFees || 0);
    const totalPaid = Number(financeStudent?.totalPaid || studentRow.liveTotalPaid || 0);
    const totalDue = schoolFees + balanceBF;
    const balance = Number(
      typeof financeStudent?.balance !== "undefined"
        ? financeStudent.balance
        : totalDue - totalPaid
    );

    const balanceLabel = formatBalanceLabel_(balance);
    const status =
      studentRow.status ||
      (balance > 0 ? "UNDERPAID" : balance < 0 ? "OVERPAID" : "FULLY PAID");

    pdfHeader_(doc, "Student Fee Statement", `Generated: ${nowStr_()}`);

    infoBlock_(
      doc,
      "STUDENT DETAILS",
      [
        ["Student", studentRow.student || "—"],
        ["ADM NO.", studentRow.admNo || "—"],
        ["Grade", String(studentRow.grade || "—")],
        ["Year", String(studentRow.year || "—")],
        ["Term", String(studentRow.term || "—")],
        ["Status", status],
      ],
      14,
      40,
      90
    );

    infoBlock_(
      doc,
      "FINANCE SUMMARY",
      [
        ["Bal B/F", `KES ${money_(balanceBF)}`],
        ["School Fees", `KES ${money_(schoolFees)}`],
        ["Total Due", `KES ${money_(totalDue)}`],
        ["Total Paid", `KES ${money_(totalPaid)}`],
        ["Balance", balanceLabel],
      ],
      112,
      40,
      84
    );

    let y = 102;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PAYMENT HISTORY", 14, y);
    y += 5;

    const body = receipts.length
      ? receipts.map((r) => [
          r.date || "",
          r.receiptNo || "",
          `KES ${money_(r.amount || 0)}`,
          r.method || "",
          r.ref || "",
        ])
      : [["—", "—", "KES 0.00", "—", "No receipts found"]];

    doc.autoTable({
      startY: y,
      head: [["Date", "Receipt No.", "Amount", "Method", "Reference"]],
      body,
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [20, 20, 20] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Statement_${studentRow.student || "Student"}.pdf`);
  };

  App.generateAllStatementsPDF = (rows = []) => {
    if (!rows.length) return;

    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF();

    rows.forEach((studentRow, index) => {
      if (index > 0) doc.addPage();

      const receipts = App.getReceiptsForStudentTerm
        ? App.getReceiptsForStudentTerm(
            studentRow.student,
            studentRow.grade,
            studentRow.year,
            studentRow.term,
            studentRow.admNo
          )
        : [];

      const financeStudent = findFinanceStudentStrict_(
        studentRow.student,
        studentRow.grade,
        studentRow.year,
        studentRow.term,
        studentRow.admNo
      );

      const balanceBF = Number(financeStudent?.balanceBF || studentRow.balanceBF || 0);
      const schoolFees = Number(financeStudent?.schoolFees || studentRow.schoolFees || 0);
      const totalPaid = Number(financeStudent?.totalPaid || studentRow.liveTotalPaid || 0);
      const totalDue = schoolFees + balanceBF;
      const balance = Number(
        typeof financeStudent?.balance !== "undefined"
          ? financeStudent.balance
          : totalDue - totalPaid
      );

      const balanceLabel = formatBalanceLabel_(balance);

      pdfHeader_(doc, "Student Fee Statement", `Generated: ${nowStr_()}`);

      infoBlock_(
        doc,
        "STUDENT DETAILS",
        [
          ["Student", studentRow.student || "—"],
          ["ADM NO.", studentRow.admNo || "—"],
          ["Grade", String(studentRow.grade || "—")],
          ["Year", String(studentRow.year || "—")],
          ["Term", String(studentRow.term || "—")],
          ["Status", studentRow.status || "—"],
        ],
        14,
        40,
        90
      );

      infoBlock_(
        doc,
        "FINANCE SUMMARY",
        [
          ["Bal B/F", `KES ${money_(balanceBF)}`],
          ["School Fees", `KES ${money_(schoolFees)}`],
          ["Total Due", `KES ${money_(totalDue)}`],
          ["Total Paid", `KES ${money_(totalPaid)}`],
          ["Balance", balanceLabel],
        ],
        112,
        40,
        84
      );

      let y = 102;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("PAYMENT HISTORY", 14, y);
      y += 5;

      const body = receipts.length
        ? receipts.map((r) => [
            r.date || "",
            r.receiptNo || "",
            `KES ${money_(r.amount || 0)}`,
            r.method || "",
            r.ref || "",
          ])
        : [["—", "—", "KES 0.00", "—", "No receipts found"]];

      doc.autoTable({
        startY: y,
        head: [["Date", "Receipt No.", "Amount", "Method", "Reference"]],
        body,
        styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [20, 20, 20] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
      });
    });

    doc.save("Greenshine_All_Statements.pdf");
  };

  App.generateInvalidStudentsPDF = (rows = []) => {
    const invalidRows = invalidStudentRows_(rows);

    if (!invalidRows.length) {
      alert("No students with data errors were found.");
      return;
    }

    const JsPDF = ensurePdfReady_();
    if (!JsPDF) return;

    const doc = new JsPDF({ orientation: "landscape" });

    pdfHeader_(doc, "Invalid Students / Data Errors Report", `Generated: ${nowStr_()}`);

    const body = invalidRows.map((r) => {
      const errors = [];

      if (App.isBlank && App.isBlank(r.admNo)) errors.push("Missing ADM NO.");
      if (App.isBlank && App.isBlank(r.student)) errors.push("Missing Student Name");
      if (App.isBlank && App.isBlank(r.balanceBFRaw)) errors.push("Missing BAL B/F");
      if (App.isBlank && App.isBlank(r.totalPaidRaw)) errors.push("Missing TOTAL PAID");
      if (App.isBlank && App.isBlank(r.schoolFeesRaw)) errors.push("Missing SCHOOL FEES");
      if (App.isBlank && App.isBlank(r.balanceRaw)) errors.push("Missing BALANCE");

      return [
        r.student || "UNDEFINED",
        r.admNo || "UNDEFINED",
        String(r.grade || "—"),
        String(r.year || "—"),
        String(r.term || "—"),
        errors.join(", "),
      ];
    });

    doc.autoTable({
      startY: 38,
      head: [[
        "STUDENT NAME",
        "ADM NO.",
        "GRADE",
        "YEAR",
        "TERM",
        "ERRORS",
      ]],
      body,
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [20, 20, 20] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 10, right: 10 },
    });

    doc.save("Greenshine_Invalid_Students_Report.pdf");
  };
})();