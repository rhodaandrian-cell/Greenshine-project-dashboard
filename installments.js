// installments.js
(() => {
  const App = (window.App = window.App || {});

  App.computeBalances = (filteredStudents) => {
    const payments = App.state.payments || [];
    const key = (student, grade, term) => `${student}__${grade}__${term}`;
    const cutoff = new Date(App.CONFIG.CUTOFF_DATE);
    cutoff.setHours(0, 0, 0, 0);

    const instMap = new Map();
    for (const p of payments) {
      const d = App.parseLooseDate(p.date);
      if (!d) continue;
      d.setHours(0, 0, 0, 0);
      if (d < cutoff) continue;
      const k = key(p.student, Number(p.grade), Number(p.term));
      instMap.set(k, (instMap.get(k) || 0) + Number(p.amount || 0));
    }

    return filteredStudents.map((s) => {
      const k = key(s.student, Number(s.grade), Number(s.term));
      const installmentsPaid = instMap.get(k) || 0;
      const basePaid = Number(s.basePaid || 0);
      const collected = basePaid + installmentsPaid;
      const balance = Number(s.fees || 0) - collected;
      const rate = Number(s.fees || 0) > 0 ? (collected / s.fees) * 100 : 0;

      return {
        ...s,
        installmentsPaid,
        collected,
        balance,
        rate,
      };
    });
  };

  App.countStatus = (balanceRows) => {
    let under = 0, full = 0, over = 0;
    for (const r of balanceRows) {
      if (r.balance > 0) under++;
      else if (r.balance === 0) full++;
      else over++;
    }
    return { under, full, over };
  };

  App.countPaymentMethods = () => {
    const payments = App.state.payments || [];
    const map = new Map();
    for (const p of payments) {
      const m = (p.method || "Unknown").trim() || "Unknown";
      map.set(m, (map.get(m) || 0) + 1);
    }
    return map;
  };
})();