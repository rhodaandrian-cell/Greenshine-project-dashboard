// calculator.jsx
// ─────────────────────────────────────────────────────────────
// React (Babel-standalone, no build step). Two tools on one page:
//   1) A real working desk calculator (digits, operators, =, C).
//   2) A student lookup: search → pick → see all their payments →
//      pick a term → see that term's balance (from the sheet).
// Balances and payment amounts have a "→ calc" button that pushes
// the number into the calculator (touch of B). Recording a payment
// is also available, using the same API path as the modal.
// ─────────────────────────────────────────────────────────────
const { useState, useEffect, useMemo, useRef } = React;

const App = window.App;
const SESSION_KEY = "greenshine_session_v1";
const RECENT_KEY = "greenshine_calc_recent_v1";
const CURRENT_TERM = Number(App?.CONFIG?.CURRENT_TERM) || 1;

// ── Helpers ────────────────────────────────────────────────
function money(n) {
  return App?.money ? App.money(n) : Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
}
function gradeLabel(g) { return Number(g) === 0 ? "ECD" : "Grade " + g; }
function todayStr() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
function loadRecent() {
  try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function saveRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5))); } catch {}
}
function balanceLabel(bal) {
  if (bal > 0) return { text: `KES ${money(bal)} owing`, cls: "calc-bal-owe" };
  if (bal < 0) return { text: `+KES ${money(Math.abs(bal))} overpaid`, cls: "calc-bal-over" };
  return { text: "Cleared", cls: "calc-bal-clear" };
}

// ═══════════════════════════════════════════════════════════
//  DESK CALCULATOR
// ═══════════════════════════════════════════════════════════
function DeskCalculator({ injectRef }) {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState(null);     // previous operand
  const [op, setOp] = useState(null);         // pending operator
  const [fresh, setFresh] = useState(true);   // next digit starts a new number

  // Allow the parent to push a value into the display (touch of B).
  useEffect(() => {
    if (injectRef) {
      injectRef.current = (value) => {
        const v = Number(value);
        if (Number.isFinite(v)) {
          setDisplay(String(v));
          setFresh(true);
        }
      };
    }
  }, [injectRef]);

  function inputDigit(d) {
    setDisplay((cur) => {
      if (fresh) { setFresh(false); return d === "." ? "0." : d; }
      if (d === "." && cur.includes(".")) return cur;
      if (cur === "0" && d !== ".") return d;
      return cur + d;
    });
  }

  function compute(a, b, operator) {
    const x = Number(a), y = Number(b);
    switch (operator) {
      case "+": return x + y;
      case "-": return x - y;
      case "×": return x * y;
      case "÷": return y === 0 ? NaN : x / y;
      default:  return y;
    }
  }

  function chooseOp(nextOp) {
    const current = Number(display);
    if (prev === null) {
      setPrev(current);
    } else if (!fresh) {
      const result = compute(prev, current, op);
      setPrev(result);
      setDisplay(formatResult(result));
    }
    setOp(nextOp);
    setFresh(true);
  }

  function equals() {
    if (op === null || prev === null) return;
    const result = compute(prev, Number(display), op);
    setDisplay(formatResult(result));
    setPrev(null);
    setOp(null);
    setFresh(true);
  }

  function formatResult(r) {
    if (!Number.isFinite(r)) return "Error";
    // Trim long floats but keep cents.
    return String(Math.round(r * 100) / 100);
  }

  function clearAll() { setDisplay("0"); setPrev(null); setOp(null); setFresh(true); }
  function backspace() {
    setDisplay((cur) => {
      if (fresh || cur.length <= 1 || cur === "Error") { setFresh(true); return "0"; }
      return cur.slice(0, -1);
    });
  }
  function percent() {
    setDisplay((cur) => formatResult(Number(cur) / 100));
    setFresh(true);
  }
  function negate() {
    setDisplay((cur) => (cur === "0" || cur === "Error" ? cur : formatResult(Number(cur) * -1)));
  }

  const keys = [
    ["C", clearAll, "calc-key-fn"], ["±", negate, "calc-key-fn"], ["%", percent, "calc-key-fn"], ["÷", () => chooseOp("÷"), "calc-key-op"],
    ["7", () => inputDigit("7")], ["8", () => inputDigit("8")], ["9", () => inputDigit("9")], ["×", () => chooseOp("×"), "calc-key-op"],
    ["4", () => inputDigit("4")], ["5", () => inputDigit("5")], ["6", () => inputDigit("6")], ["-", () => chooseOp("-"), "calc-key-op"],
    ["1", () => inputDigit("1")], ["2", () => inputDigit("2")], ["3", () => inputDigit("3")], ["+", () => chooseOp("+"), "calc-key-op"],
    ["0", () => inputDigit("0"), "calc-key-wide"], [".", () => inputDigit(".")], ["⌫", backspace, "calc-key-fn"], ["=", equals, "calc-key-eq"],
  ];

  return (
    <div className="card calc-desk">
      <div className="calc-desk-display">
        <div className="calc-desk-sub">{op ? `${money(prev)} ${op}` : "\u00A0"}</div>
        <div className="calc-desk-main">{display}</div>
      </div>
      <div className="calc-desk-keys">
        {keys.map(([label, fn, cls], i) => (
          <button key={i} type="button" className={"calc-key " + (cls || "")} onClick={fn}>{label}</button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  STUDENT LOOKUP
// ═══════════════════════════════════════════════════════════
function useRegisteredStudents() {
  return useMemo(() => {
    const seen = new Map();
    (App?.state?.register || []).forEach((r) => {
      const name = String(r.student || "").trim();
      if (!name) return;
      const key = `${name.toLowerCase()}__${r.admNo || ""}`;
      if (!seen.has(key)) seen.set(key, { student: name, admNo: r.admNo || "", grade: r.grade, year: r.year });
    });
    return [...seen.values()].sort((a, b) => a.student.localeCompare(b.student));
  }, [App?.state?.register?.length]);
}

// All payments for a student (across terms), newest first.
function studentPayments(student) {
  if (!student) return [];
  const adm = String(student.admNo || "").trim();
  const name = String(student.student || "").trim().toUpperCase();
  return (App?.state?.payments || [])
    .filter((p) => {
      const pAdm = String(p.admNo || "").trim();
      const pName = String(p.student || "").trim().toUpperCase();
      if (adm && pAdm) return pAdm === adm;
      return pName === name;
    })
    .slice()
    .sort((a, b) =>
      (App?.parseLooseDate?.(b.date)?.getTime?.() || 0) -
      (App?.parseLooseDate?.(a.date)?.getTime?.() || 0)
    );
}

// Terms that exist for the student (from finance rows + payments).
function studentTerms(student) {
  if (!student) return [];
  const adm = String(student.admNo || "").trim();
  const name = String(student.student || "").trim().toUpperCase();
  const set = new Set();
  const matches = (r) => {
    const rAdm = String(r.admNo || "").trim();
    const rName = String(r.student || "").trim().toUpperCase();
    if (adm && rAdm) return rAdm === adm;
    return rName === name;
  };
  (App?.state?.students || []).forEach((r) => { if (matches(r) && r.term) set.add(Number(r.term)); });
  (App?.state?.payments || []).forEach((p) => { if (matches(p) && p.term) set.add(Number(p.term)); });
  return [...set].sort((a, b) => a - b);
}

// Finance row → balance for a specific term.
function termFinance(student, term) {
  if (!student) return null;
  const adm = String(student.admNo || "").trim();
  const name = String(student.student || "").trim().toUpperCase();
  const row = (App?.state?.students || []).find((r) => {
    const rAdm = String(r.admNo || "").trim();
    const rName = String(r.student || "").trim().toUpperCase();
    const matchId = adm && rAdm ? rAdm === adm : rName === name;
    return matchId && Number(r.term) === Number(term);
  });
  if (!row) return null;
  const schoolFees = Number(row.schoolFees || 0);
  const balanceBF = Number(row.balanceBF || 0);
  const totalPaid = Number(row.totalPaid || 0);
  const totalDue = schoolFees + balanceBF;
  const balance = Number(row.balance ?? (totalDue - totalPaid));
  return { row, schoolFees, balanceBF, totalPaid, totalDue, balance,
           grade: Number(row.grade || 0), year: Number(row.year || 0) };
}

function StudentLookup({ onSendToCalc }) {
  const registered = useRegisteredStudents();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [term, setTerm] = useState(null);
  const [recent, setRecent] = useState(loadRecent());
  const [showRecent, setShowRecent] = useState(false);
  const [recording, setRecording] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowRecent(false); }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return registered
      .filter((s) => s.student.toLowerCase().includes(q) || String(s.admNo).toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, registered]);

  const terms = useMemo(() => studentTerms(selected), [selected, App?.state?.students?.length]);
  const payments = useMemo(() => studentPayments(selected), [selected, App?.state?.payments?.length]);
  const fin = useMemo(() => (term != null ? termFinance(selected, term) : null), [selected, term, App?.state?.students?.length]);

  function pick(s) {
    setSelected(s);
    setQuery(s.student);
    setShowRecent(false);
    // Default the term to the current term if the student has it, else first.
    const t = studentTerms(s);
    setTerm(t.includes(CURRENT_TERM) ? CURRENT_TERM : (t[0] ?? null));

    const key = `${s.student.toLowerCase()}__${s.admNo}`;
    const next = [s, ...recent.filter((r) => `${r.student.toLowerCase()}__${r.admNo}` !== key)].slice(0, 5);
    setRecent(next); saveRecent(next);
  }

  function clear() { setSelected(null); setQuery(""); setTerm(null); setRecording(false); }

  return (
    <div className="card calc-lookup">
      {/* Search bar */}
      <div className="calc-lookup-search" ref={wrapRef}>
        <div className="calc-search-input-wrap">
          <input
            className="calc-search-input"
            type="text"
            value={query}
            placeholder="Search a student by name or ADM no…"
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {matches.length > 0 && (
            <div className="calc-suggest">
              {matches.map((s, i) => (
                <button key={i} className="calc-suggest-item" type="button" onClick={() => pick(s)}>
                  <strong>{s.student}</strong>
                  <span>ADM {s.admNo || "—"} • {gradeLabel(s.grade)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setShowRecent((v) => !v)} disabled={!recent.length}>Last 5</button>
        {showRecent && recent.length > 0 && (
          <div className="calc-recent">
            <div className="calc-recent-title">Recently looked up</div>
            {recent.map((s, i) => (
              <button key={i} className="calc-recent-item" type="button" onClick={() => pick(s)}>
                <strong>{s.student}</strong>
                <span>ADM {s.admNo || "—"} • {gradeLabel(s.grade)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!selected && (
        <div className="calc-empty" style={{ margin: "0 16px 16px" }}>
          Pick a student to see their payments and term balances.
        </div>
      )}

      {selected && (
        <div className="calc-lookup-body">
          <div className="calc-lookup-head">
            <div>
              <h3 className="calc-name">{selected.student}</h3>
              <p className="calc-meta">ADM {selected.admNo || "—"} • {gradeLabel(selected.grade)}{selected.year ? ` • Year ${selected.year}` : ""}</p>
            </div>
            <button className="btn btn-ghost" type="button" onClick={clear}>✕ Clear</button>
          </div>

          {/* Term selector */}
          <div className="calc-term-pills">
            <span className="calc-term-pills-label">Term:</span>
            {terms.length === 0 && <span className="muted">No term data yet.</span>}
            {terms.map((t) => (
              <button
                key={t}
                type="button"
                className={"calc-term-pill " + (Number(term) === t ? "is-active" : "")}
                onClick={() => setTerm(t)}
              >
                Term {t}
              </button>
            ))}
          </div>

          {/* Selected term's balance */}
          {fin && (
            <div className="calc-term-balance">
              <div className="calc-tb-grid">
                <div><span>Bal B/F</span><strong>KES {money(fin.balanceBF)}</strong></div>
                <div><span>School Fees</span><strong>KES {money(fin.schoolFees)}</strong></div>
                <div><span>Total Due</span><strong>KES {money(fin.totalDue)}</strong></div>
                <div><span>Total Paid</span><strong>KES {money(fin.totalPaid)}</strong></div>
              </div>
              <div className="calc-tb-balance">
                <div>
                  <span>Term {term} Balance</span>
                  <strong className={balanceLabel(fin.balance).cls}>{balanceLabel(fin.balance).text}</strong>
                </div>
                <div className="calc-tb-actions">
                  <button className="btn" type="button" onClick={() => onSendToCalc(Math.abs(fin.balance))}>→ calc</button>
                  <button className="btn btn-primary" type="button" onClick={() => setRecording((v) => !v)}>
                    {recording ? "Hide record" : "Record payment"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {term != null && !fin && (
            <div className="calc-empty" style={{ margin: "0 16px 14px" }}>
              No finance row for Term {term} yet (the student may have paid but the row isn't created).
            </div>
          )}

          {/* Quick record */}
          {recording && fin && (
            <QuickRecord
              student={selected}
              term={term}
              fin={fin}
              onSendToCalc={onSendToCalc}
              onDone={() => setRecording(false)}
            />
          )}

          {/* All payments */}
          <div className="calc-payments">
            <div className="calc-payments-title">All payments ({payments.length})</div>
            {payments.length === 0 ? (
              <div className="muted" style={{ padding: "8px 4px" }}>No payments recorded for this student.</div>
            ) : (
              <div className="calc-table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Receipt</th><th>Term</th><th>Amount</th><th>Method</th><th></th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={i}>
                        <td>{p.date}</td>
                        <td>{p.receiptNo}</td>
                        <td>Term {p.term}</td>
                        <td><strong>KES {money(p.amount)}</strong></td>
                        <td>{p.method}</td>
                        <td>
                          <button className="btn btn-ghost" type="button" onClick={() => onSendToCalc(p.amount)}>→ calc</button>
                          <button className="btn btn-primary" type="button" onClick={() => App?.generateReceiptPDF?.(p)}>PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick record (same API path as the modal) ─────────────
function QuickRecord({ student, term, fin, onSendToCalc, onDone }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("M-Pesa");
  const [receiptNo, setReceiptNo] = useState("");
  const [ref, setRef] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [date, setDate] = useState(todayStr());
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedPayment, setSavedPayment] = useState(null); // set after a successful save

  const amt = Number(amount || 0);
  const projected = fin.balance - amt;
  const projLabel = balanceLabel(projected);

  async function save() {
    setStatus("");
    if (!Number.isFinite(amt) || amt <= 0) { setStatus("Amount must be greater than 0."); return; }
    if (!receivedBy.trim()) { setStatus("Enter who received the payment."); return; }

    const payload = {
      admNo: student.admNo || "",
      student: student.student,
      grade: Number(fin.grade ?? student.grade ?? 0),
      year: Number(fin.year || student.year || new Date().getFullYear()),
      term: Number(term),
      amount: amt,
      date: String(date || "").trim(),
      receiptNo: String(receiptNo || "").trim(),
      method,
      ref: String(ref || "").trim(),
      receivedBy: String(receivedBy || "").trim(),
    };

    try {
      setSaving(true);
      setStatus("Saving…");
      const url = App?.CONFIG?.API_URL;
      if (!url) throw new Error("API URL missing.");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      if (String(text).toLowerCase().includes("error")) throw new Error(text);
      setStatus("Saved ✅ Refreshing…");
      await App?.syncAll?.({ notifyNewReceipts: false });
      App?.truthDetectChanges?.();
      setStatus("Saved ✅");
      // Payment is now recorded. Offer the three-way receipt choice
      // (same PDFs as the modal). Closing without choosing changes nothing.
      setSavedPayment(payload);
    } catch (err) {
      console.error(err);
      setStatus("Failed ❌ " + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  // After a successful save, show the three-way print choice.
  if (savedPayment) {
    const choose = (fn) => { fn?.(savedPayment); onDone(); };
    return (
      <div className="calc-record">
        <div className="calc-choice-head">
          <strong>Payment saved ✅</strong>
          <span className="calc-meta">{savedPayment.student} • Term {savedPayment.term} • KES {money(savedPayment.amount)}</span>
        </div>
        <p className="muted" style={{ margin: "0 0 10px" }}>What would you like to print?</p>
        <div className="calc-choice-btns">
          <button className="btn" type="button" onClick={() => choose(App?.generatePaymentOnlyPDF)}>Payment receipt only</button>
          <button className="btn btn-primary" type="button" onClick={() => choose(App?.generateReceiptPDF)}>This term's statement</button>
          <button className="btn" type="button" onClick={() => choose((p) => App?.generateStudentStatementPDF?.({
            admNo: p.admNo, student: p.student, grade: p.grade, year: p.year, term: p.term,
          }))}>Full statement (all terms)</button>
          <button className="btn btn-ghost" type="button" onClick={onDone}>Don't print anything</button>
        </div>
      </div>
    );
  }

  return (
    <div className="calc-record">
      <div className="calc-record-grid">
        <label>Amount (KES)
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </label>
        <label>Method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>M-Pesa</option><option>Cash</option><option>Bank</option><option>Cheque</option>
          </select>
        </label>
        <label>Date
          <input type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder="M/D/YYYY" />
        </label>
        <label>Receipt No.
          <input type="text" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="e.g. RCPT-001" />
        </label>
        <label>Reference
          <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction code" />
        </label>
        <label>Received By
          <select value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}>
            <option value="">Select staff…</option>
            {(App?.CONFIG?.STAFF || []).map((name, i) => (
              <option key={i} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      {amt > 0 && (
        <div className="calc-projection">
          After this payment, Term {term} → <strong className={projLabel.cls}>{projLabel.text}</strong>
          <button className="btn btn-ghost" type="button" style={{ marginLeft: 10 }} onClick={() => onSendToCalc(Math.abs(projected))}>→ calc</button>
        </div>
      )}
      <div className="calc-record-foot">
        <button className="btn btn-primary" type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save payment"}</button>
        <span className="status">{status}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════════════════
function CalculatorPage() {
  const [dataReady, setDataReady] = useState(Boolean(App?.state?.register?.length));
  const injectRef = useRef(null);

  useEffect(() => {
    if (dataReady) return;
    const id = setInterval(() => {
      if (App?.state?.register?.length) { setDataReady(true); clearInterval(id); }
    }, 400);
    return () => clearInterval(id);
  }, [dataReady]);

  function sendToCalc(value) {
    injectRef.current?.(value);
  }

  return (
    <div className="calc-page">
      <DeskCalculator injectRef={injectRef} />
      {!dataReady
        ? <div className="calc-empty">Loading student data…</div>
        : <StudentLookup onSendToCalc={sendToCalc} />}
    </div>
  );
}

// ── Mount ──────────────────────────────────────────────────
(function mount() {
  if (sessionStorage.getItem(SESSION_KEY) !== "true") return;
  const rootEl = document.getElementById("calcRoot");
  if (!rootEl || !App) return;

  ReactDOM.createRoot(rootEl).render(<CalculatorPage />);

  App.syncAll?.({ notifyNewReceipts: false }).then((ok) => { if (ok) App.truthDetectChanges?.(); });

  document.getElementById("btnSyncNow")?.addEventListener("click", async () => {
    const ok = await App.syncAll?.({ notifyNewReceipts: false });
    if (ok) App.truthDetectChanges?.();
  });
})();