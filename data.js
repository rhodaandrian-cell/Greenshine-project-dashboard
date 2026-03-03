// data.js
(() => {
  const App = (window.App = window.App || {});

  App.CONFIG = {
    STUDENTS_CSV_URL:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSedPYB_UrkW4WVhO39C62ENGY96D5sBi9d30axlSlegxgguL_KfgZiyLGUcNqjE7zMDZT-aMeA0f6p/pub?gid=869831895&single=true&output=csv",
    PAYMENTS_CSV_URL:
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vSedPYB_UrkW4WVhO39C62ENGY96D5sBi9d30axlSlegxgguL_KfgZiyLGUcNqjE7zMDZT-aMeA0f6p/pub?gid=841135586&single=true&output=csv",
    POLL_MS: 15000,
    DEFAULT_TERM: 1,
    GRADES: [0, 1, 2, 3, 4, 5, 6],
    TERMS: [1, 2, 3],
    SEEN_RECEIPTS_KEY: "greenshine_seen_receipts_v1",
    CUTOFF_DATE: "2026-02-25",
  };

  App.state = {
    students: [],
    payments: [],
    lastSync: null,
  };

  App.money = (n) =>
    Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  App.escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  App.nowStr = () => new Date().toLocaleString();

  App.setStatus = (msg, type = "") => {
    const el = document.getElementById("statusText");
    if (!el) return;
    el.textContent = msg || "";
    el.style.color =
      type === "error"
        ? "#ff5d6c"
        : type === "ok"
        ? "rgba(81,240,167,.95)"
        : "rgba(155,176,199,.95)";
  };

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
        <button class="btn btn-ghost" type="button">Dismiss</button>
      </div>
    `;
    const [btnDownload, btnDismiss] = el.querySelectorAll("button");
    btnDownload.addEventListener("click", () => { onDownload?.(); el.remove(); });
    btnDismiss.addEventListener("click", () => el.remove());
    container.appendChild(el);
    window.Animations?.toastIn?.(el);
    setTimeout(() => { if (el.isConnected) window.Animations?.toastOut?.(el, () => el.remove()); }, 12000);
  };

  App.fetchCsvAsRows = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    const csvText = await res.text();
    return await new Promise((resolve, reject) => {
      Papa.parse(csvText, { header: true, skipEmptyLines: true, complete: (out) => resolve(out.data || []), error: reject });
    });
  };

  App.normalizeStudents = (rows) => {
    const grades = new Set(App.CONFIG.GRADES);
    const terms = new Set(App.CONFIG.TERMS);
    return rows
      .filter((r) => r["STUDENT NAME"] && String(r["STUDENT NAME"]).trim())
      .map((r) => ({
        student: String(r["STUDENT NAME"]).trim(),
        grade: Number(r["GRADE"]),
        term: Number(r["TERM"]),
        fees: Number(r["SCHOOL FEES"] || 0),
        basePaid: Number(r["TOTAL PAID"] ?? r["TOTAL_PAID"] ?? 0),
      }))
      .filter((s) => s.student && grades.has(s.grade) && terms.has(s.term));
  };

  App.normalizePayments = (rows) => {
    const grades = new Set(App.CONFIG.GRADES);
    const terms = new Set(App.CONFIG.TERMS);
    return rows
      .map((r) => {
        const receiptNo = String(r["RECEIPT NO."] ?? r["RECEIPT NO"] ?? r["ReceiptNo"] ?? "").trim();
        const date = String(r["DATE"] ?? r["Date"] ?? "").trim();
        const student = String(r["STUDENT NAME"] ?? r["StudentName"] ?? "").trim();
        const grade = Number(r["GRADE"] ?? r["Grade"]);
        const term = Number(r["TERM"] ?? r["Term"]);
        const amount = Number(r["AMOUNT PAID"] ?? r["AmountPaid"] ?? r["AMOUNT"] ?? 0);
        const method = String(r["PAYMENT METHOD"] ?? r["PaymentMethod"] ?? "").trim();
        const ref = String(r["REFERENCE"] ?? r["Reference"] ?? "").trim();
        const receivedBy = String(r["RECEIVED BY"] ?? r["ReceivedBy"] ?? "").trim();
        return { receiptNo, date, student, grade, term, amount, method, ref, receivedBy };
      })
      .filter((p) => p.receiptNo && p.student && grades.has(p.grade) && terms.has(p.term) && Number(p.amount) > 0);
  };

  App.parseLooseDate = (s) => {
    const str = String(s || "").trim();
    if (!str) return null;
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
      const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
      d = new Date(yyyy, mm - 1, dd);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  App.isToday = (dateStr) => {
    const d = App.parseLooseDate(dateStr);
    if (!d) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  App.getReceiptsForStudentTerm = (student, grade, term) => {
    return (App.state.payments || [])
      .filter((p) => p.student === student && Number(p.grade) === Number(grade) && Number(p.term) === Number(term))
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  };

  App.exportPaymentsPdf = () => {
    const payments = App.state.payments || [];
    if (!payments.length) return alert("No payments to export yet.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("GREENSHINE ACADEMY", 14, 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text("Payments (Installments / Receipts) Report", 14, 21);
    doc.setFontSize(9); doc.text(`Generated: ${App.nowStr()}`, 14, 27);
    const rows = payments.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((p) => [p.date||"", p.receiptNo||"", p.student||"", String(p.grade||""), String(p.term||""), `KES ${App.money(p.amount)}`, p.method||"", p.ref||"", p.receivedBy||""]);
    const total = payments.reduce((a, p) => a + Number(p.amount||0), 0);
    doc.autoTable({ startY: 32, head:[["DATE","RECEIPT NO.","STUDENT NAME","GRADE","TERM","AMOUNT","METHOD","REFERENCE","RECEIVED BY"]], body: rows, styles:{font:"helvetica", fontSize:8}, headStyles:{fillColor:[20,20,20]}, alternateRowStyles:{fillColor:[245,245,245]}, margin:{left:10,right:10} });
    const y = doc.lastAutoTable.finalY + 10; doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.text(`TOTAL COLLECTED: KES ${App.money(total)}`, 14, y);
    doc.save("Greenshine_Payments_Report.pdf");
  };

  App.findStudentFees = (studentName, grade, term) => {
    const s = App.state.students.find(x => x.student === studentName && Number(x.grade)===Number(grade) && Number(x.term)===Number(term));
    return s ? Number(s.fees||0) : 0;
  };

  App.findStudentBasePaid = (studentName, grade, term) => {
    const s = App.state.students.find(x => x.student === studentName && Number(x.grade)===Number(grade) && Number(x.term)===Number(term));
    return s ? Number(s.basePaid||0) : 0;
  };

  App.sumInstallmentsForTerm = (studentName, grade, term) => {
    const cutoff = new Date(App.CONFIG.CUTOFF_DATE); cutoff.setHours(0,0,0,0);
    return (App.state.payments||[])
      .filter(p => p.student===studentName && Number(p.grade)===Number(grade) && Number(p.term)===Number(term))
      .reduce((a,p)=>{
        const d = App.parseLooseDate(p.date); if(!d) return a; d.setHours(0,0,0,0);
        if(d<cutoff) return a; return a + Number(p.amount||0);
      },0);
  };

  App.generateReceiptPDF = (p) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const expectedFees = App.findStudentFees(p.student,p.grade,p.term);
    const basePaid = App.findStudentBasePaid(p.student,p.grade,p.term);
    const installmentsPaid = App.sumInstallmentsForTerm(p.student,p.grade,p.term);
    const totalPaid = basePaid + installmentsPaid;
    const balance = expectedFees - totalPaid;
    doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.text("GREENSHINE ACADEMY",14,16);
    doc.setFontSize(11); doc.setFont("helvetica","normal"); doc.text("School Fee Payment Receipt",14,23);
    doc.setDrawColor(80); doc.setLineWidth(0.3); doc.line(14,28,196,28);
    doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.text("AMOUNT RECEIVED TODAY",14,38);
    doc.setFontSize(26); doc.setTextColor(0,110,45); doc.text(`KES ${App.money(p.amount)}`,14,50);
    doc.setTextColor(10);
    const boxX=120, boxY=34, boxW=76, boxH=30; doc.setDrawColor(40); doc.setLineWidth(0.6); doc.roundedRect(boxX,boxY,boxW,boxH,3,3);
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.text("ACCOUNT SUMMARY",boxX+4,boxY+7);
    doc.setFont("helvetica","normal"); doc.setFontSize(9.5);
    doc.text(`Expected Fees: KES ${App.money(expectedFees)}`,boxX+4,boxY+14);
    doc.text(`Total Paid (Term): KES ${App.money(totalPaid)}`,boxX+4,boxY+20);
    doc.text(`Balance: KES ${App.money(balance)}`,boxX+4,boxY+26);
    const lines=[["Receipt No",p.receiptNo],["Date",p.date||"—"],["Student Name",p.student],["Grade",String(p.grade)],["Term",String(p.term)],["Payment Method",p.method||"N/A"],["Reference",p.ref||"N/A"],["Received By",p.receivedBy||"N/A"],["Baseline Paid (before cutoff)",`KES ${App.money(basePaid)}`],["Installments Paid (from cutoff)",`KES ${App.money(installmentsPaid)}`]];
    let y=72; doc.setFontSize(10.5); for(const[k,v] of lines){doc.setFont("helvetica","bold"); doc.text(`${k}:`,14,y); doc.setFont("helvetica","normal"); doc.text(String(v),86,y); y+=7.2;}
    const stampX=135, stampY=y+2, stampW=60, stampH=40; doc.setDrawColor(20); doc.setLineWidth(0.6); doc.roundedRect(stampX,stampY,stampW,stampH,3,3);
    doc.setTextColor(0,110,45); doc.setFont("helvetica","bold"); doc.setFontSize(22); doc.text("PAID",stampX+10,stampY+26,{angle:12});
    doc.setTextColor(10); doc.setFont("helvetica","normal"); doc.setFontSize(11); doc.text("Signature: ____________________________",14,stampY+52);
    doc.save(`${p.receiptNo}_${p.student}.pdf`);
  };

  App.syncAll = async ({ notifyNewReceipts=true }={}) => {
    try {
      App.setStatus("Syncing from Google Sheets…");
      const [studentRows,paymentRows]=await Promise.all([App.fetchCsvAsRows(App.CONFIG.STUDENTS_CSV_URL), App.fetchCsvAsRows(App.CONFIG.PAYMENTS_CSV_URL)]);
      App.state.students=App.normalizeStudents(studentRows);
      App.state.payments=App.normalizePayments(paymentRows);
      App.state.lastSync=new Date();
      const lastSyncEl=document.getElementById("lastSync"); if(lastSyncEl) lastSyncEl.textContent=App.nowStr();
      App.setStatus("Sync successful ✅","ok");
      if(notifyNewReceipts){
        const seen=App.loadSeenSet();
        const sorted=App.state.payments.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
        let shown=0;
        for(const p of sorted){if(seen.has(p.receiptNo)) continue; seen.add(p.receiptNo);
          App.toast("Receipt ready for download",`${p.receiptNo} • ${p.student} • KES ${App.money(p.amount)}`,{onDownload:()=>App.generateReceiptPDF(p)});
          shown++; if(shown>=3) break;
        }
        App.saveSeenSet(seen);
      }
      return true;
    } catch(e){ console.warn(e); App.setStatus("Sync failed. Ensure both sheets are Published to web (CSV).","error"); return false; }
  };
})();