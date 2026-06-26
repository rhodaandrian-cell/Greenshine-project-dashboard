// faq.js
(() => {
  // ── Session gate ─────────────────────────────────────────
  if (sessionStorage.getItem("greenshine_session_v1") !== "true") return;

  // ── FAQ content ──────────────────────────────────────────
  // Edit this list to add, remove or reword questions. Each item has a
  // category, a question (q) and an answer (a). Categories drive the tabs.
  const FAQ = [
    // ── Payments ──
    {
      cat: "Payments",
      q: "How do I record a payment?",
      a: "Click \"+ Record Payment\" on the dashboard. Start typing the student's name and pick them from the list — their grade and term fill in automatically. Enter the amount, choose the payment method and the staff member under \"Received By\", then click Save Payment. After it saves, you'll be asked what to print: a payment receipt only, this term's statement, or the full statement.",
    },
    {
      cat: "Payments",
      q: "What is the difference between the three receipt options after saving?",
      a: "\"Payment receipt only\" shows just the single payment that was made. \"This term's statement\" shows that term's account summary plus its payment history. \"Full statement\" shows every term the student has, with a combined total. The payment is already saved before you choose — picking one only decides which PDF to print.",
    },
    {
      cat: "Payments",
      q: "Which payment methods can I record?",
      a: "M-Pesa, Cash, Bank and Cheque. Choose the right one when recording so the Payment Methods chart on the dashboard stays accurate.",
    },
    {
      cat: "Payments",
      q: "Can I record a payment from the Calculator page?",
      a: "Yes. On the Calculator, search a student, pick the term, then click \"Record payment\". It saves the same way as the main button and offers the same receipt choices. It also shows a live preview of what the balance will be after the payment.",
    },

    // ── Students & Balances ──
    {
      cat: "Students",
      q: "Why does the dashboard open on Term 2?",
      a: "The dashboard opens on the current school term so the numbers reflect what's happening now. Each term is treated separately — a student who has cleared an earlier term but has no row yet for a later term is never wrongly shown as owing. You can change the term with the Term filter at any time.",
    },
    {
      cat: "Students",
      q: "How are balances calculated for each term?",
      a: "For each term: Total Due = School Fees + Balance Brought Forward, and Balance = Total Due − Total Paid. A positive balance means the student is owing, zero means cleared, and a negative balance means overpaid. Each term is calculated on its own, not added across all terms.",
    },
    {
      cat: "Students",
      q: "A student paid but still shows as owing — why?",
      a: "Two common reasons: the payment hasn't synced yet (click Refresh), or the finance sheet hasn't been updated for that term. Because balances come from the finance sheet, if a term's row is blank or not yet created, the dashboard can't reflect the payment. Check the Students page for that student's term row.",
    },
    {
      cat: "Students",
      q: "What does \"Identity Incomplete\" mean?",
      a: "It means the student's row is missing an ADM number or a name, so a balance can't be calculated for them. Fix the missing field in the register or finance sheet, then Refresh.",
    },

    // ── Calculator ──
    {
      cat: "Calculator",
      q: "What is the Calculator page for?",
      a: "It's two tools in one: a real working calculator on the left for any quick math, and a student lookup on the right. Search a student, pick a term, and you'll see that term's balance straight from the sheet along with all their payments.",
    },
    {
      cat: "Calculator",
      q: "What does the \"→ calc\" button do?",
      a: "It sends that number — a balance or a payment amount — straight into the calculator's display, so you can do math against it without typing it in. The calculator also works fully on its own for any other sums.",
    },
    {
      cat: "Calculator",
      q: "What is the \"Last 5\" button?",
      a: "It remembers the last five students you looked up, so you can reload one with a single tap instead of searching again.",
    },

    // ── Receipts & Dashboard ──
    {
      cat: "Receipts",
      q: "Where do I find all the receipts?",
      a: "The Receipts page (in the sidebar) lists every payment, newest first. You can search by student, receipt number, ADM number or reference, and filter by term or method. Receipts recorded since your last visit are tagged \"NEW\".",
    },
    {
      cat: "Receipts",
      q: "How do I download a single receipt or a full statement?",
      a: "On the Receipts page, each row has a Download button for that receipt. For a full per-term statement, use the Students page — each student has a \"Statement PDF\" button. To export every payment at once, use \"Export All PDF\" on the Receipts page.",
    },
    {
      cat: "Dashboard",
      q: "What does the Refresh button do?",
      a: "It pulls the latest data from the Google Sheets — the register, the finance sheet and the payments. The dashboard also refreshes on its own every few seconds, but you can press Refresh any time you want the newest figures immediately.",
    },
    {
      cat: "Dashboard",
      q: "Who are the Top Defaulters?",
      a: "The students with the highest outstanding balances for the term you're viewing. Because it's per-term, it shows who genuinely owes for that term, not a running total across the whole year.",
    },

    // ── Google Sheets & Troubleshooting ──
    {
      cat: "Troubleshooting",
      q: "The dashboard won't load or shows old numbers — what do I do?",
      a: "First press Refresh. If it still looks wrong, check your internet connection — the dashboard reads from Google Sheets, so a dropped connection can stop a refresh. The status pill at the top shows whether the last refresh succeeded.",
    },
    {
      cat: "Troubleshooting",
      q: "I recorded a payment but don't see it yet.",
      a: "Saving sends it to the sheet, then the dashboard refreshes. If it doesn't appear within a few seconds, press Refresh. If it still doesn't show, confirm the save said \"Saved\" and check the Receipts page.",
    },
    {
      cat: "Google Sheets",
      q: "Which sheets does the dashboard use?",
      a: "Three: the students register, the finance sheet (term balances), and the payments sheet (receipts). The dashboard reads these; payments you record are written back to the payments sheet automatically.",
    },
  ];

  // ── Build ────────────────────────────────────────────────
  const byId = (id) => document.getElementById(id);
  const list = byId("faqList");
  const empty = byId("faqEmpty");
  const tabsEl = byId("faqTabs");
  const searchEl = byId("faqSearch");
  const countEl = byId("faqResultCount");

  if (!list) return;

  const categories = ["All", ...[...new Set(FAQ.map((f) => f.cat))]];
  let activeCat = "All";
  let query = "";

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  // Highlight matched query text within a string.
  function highlight(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    try {
      const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
      return safe.replace(re, '<mark class="faq-mark">$1</mark>');
    } catch {
      return safe;
    }
  }

  function buildTabs() {
    if (!tabsEl) return;
    tabsEl.innerHTML = "";
    categories.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "faq-tab " + (c === activeCat ? "is-active" : "");
      b.textContent = c;
      b.addEventListener("click", () => { activeCat = c; render(); });
      tabsEl.appendChild(b);
    });
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return FAQ.filter((f) => {
      if (activeCat !== "All" && f.cat !== activeCat) return false;
      if (!q) return true;
      return (f.q + " " + f.a + " " + f.cat).toLowerCase().includes(q);
    });
  }

  function render() {
    // Update active tab styling without full rebuild.
    [...tabsEl.querySelectorAll(".faq-tab")].forEach((t) => {
      t.classList.toggle("is-active", t.textContent === activeCat);
    });

    const items = filtered();
    list.innerHTML = "";

    if (countEl) {
      countEl.textContent = query.trim()
        ? `${items.length} result${items.length === 1 ? "" : "s"}`
        : (activeCat === "All" ? "All questions" : activeCat);
    }

    if (!items.length) {
      empty?.classList.remove("hidden");
      return;
    }
    empty?.classList.add("hidden");

    items.forEach((f) => {
      const item = document.createElement("div");
      item.className = "faq-item";
      item.innerHTML = `
        <button class="faq-q" type="button" aria-expanded="false">
          <span class="faq-q-text">${highlight(f.q, query.trim())}</span>
          <span class="faq-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="faq-a"><p>${highlight(f.a, query.trim())}</p></div>
      `;
      const btn = item.querySelector(".faq-q");
      const ans = item.querySelector(".faq-a");
      btn.addEventListener("click", () => {
        const open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        ans.style.maxHeight = open ? ans.scrollHeight + "px" : null;
      });
      list.appendChild(item);
    });

    // If searching, auto-open the matches so answers are visible.
    if (query.trim()) {
      list.querySelectorAll(".faq-item").forEach((item) => {
        item.classList.add("is-open");
        const ans = item.querySelector(".faq-a");
        const btn = item.querySelector(".faq-q");
        ans.style.maxHeight = ans.scrollHeight + "px";
        btn.setAttribute("aria-expanded", "true");
      });
    }
  }

  searchEl?.addEventListener("input", () => { query = searchEl.value; render(); });

  buildTabs();
  render();
})();