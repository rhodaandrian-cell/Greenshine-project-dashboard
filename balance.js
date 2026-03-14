// balance.js
(() => {
  const App = (window.App = window.App || {});

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function hasIdentity(row) {
    if (typeof App.hasIdentity === "function") return App.hasIdentity(row);
    return Boolean(
      String(row?.admNo ?? "").trim() &&
      String(row?.student ?? "").trim()
    );
  }

  function formatMoneyWithSign(n) {
    if (typeof App.formatMoneyWithSign === "function") {
      return App.formatMoneyWithSign(n);
    }

    const value = num(n);
    if (value < 0) {
      return `+KES ${Math.abs(value).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return `KES ${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  App.computeBalances = (rows = []) => {
    return (rows || []).map((row) => {
      const identityOk = hasIdentity(row);

      const balanceBF = num(row.balanceBF);
      const schoolFees = num(row.schoolFees);
      const totalPaid = num(row.liveTotalPaid ?? row.totalPaid);
      const totalDue =
        row.totalDue !== undefined ? num(row.totalDue) : schoolFees + balanceBF;

      const computedBalance =
        row.computedBalance !== undefined && row.computedBalance !== null
          ? Number(row.computedBalance)
          : identityOk
          ? totalDue - totalPaid
          : null;

      const balanceForMath = computedBalance === null ? 0 : num(computedBalance);

      const status = !identityOk
        ? "IDENTITY INCOMPLETE"
        : balanceForMath > 0
        ? "UNDERPAID"
        : balanceForMath < 0
        ? "OVERPAID"
        : "FULLY PAID";

      const rate = identityOk && totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

      return {
        ...row,
        hasIdentity: identityOk,
        balanceBF,
        schoolFees,
        totalPaid,
        liveTotalPaid: totalPaid,
        totalDue,
        computedBalance,
        balance: identityOk ? balanceForMath : 0,
        status,
        rate,

        displayBalanceBF:
          row.displayBalanceBF ??
          (String(row.balanceBFRaw ?? "").trim() === ""
            ? "UNDEFINED"
            : formatMoneyWithSign(balanceBF)),

        displayTotalPaid:
          row.displayTotalPaid ??
          (String(row.totalPaidRaw ?? "").trim() === ""
            ? "UNDEFINED"
            : formatMoneyWithSign(totalPaid)),

        displayStoredBalance:
          row.displayStoredBalance ??
          (String(row.balanceRaw ?? "").trim() === ""
            ? "UNDEFINED"
            : formatMoneyWithSign(num(row.balance))),

        displayComputedBalance:
          row.displayComputedBalance ??
          (!identityOk ? "UNDEFINED" : formatMoneyWithSign(balanceForMath)),
      };
    });
  };

  App.countStatus = (rows = []) => {
    return (rows || []).reduce(
      (acc, row) => {
        if (!row || row.hasIdentity === false) return acc;

        const bal =
          row.computedBalance !== undefined && row.computedBalance !== null
            ? num(row.computedBalance)
            : num(row.balance);

        if (bal > 0) acc.under += 1;
        else if (bal < 0) acc.over += 1;
        else acc.full += 1;

        return acc;
      },
      { under: 0, full: 0, over: 0 }
    );
  };

  App.filterByPaymentStatus = (rows = [], status = "ALL") => {
    if (!status || status === "ALL") return rows || [];
    return (rows || []).filter((row) => String(row?.status || "") === String(status));
  };

  App.countPaymentMethods = () => {
    const map = new Map();

    (App.state?.payments || []).forEach((p) => {
      const key = String(p?.method || "UNDEFINED").trim() || "UNDEFINED";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
  };

  App.getStudentBalanceRow = (student, grade, year, term, admNo = "") => {
    const liveRows =
      typeof App.computeLiveFinanceRows === "function"
        ? App.computeLiveFinanceRows()
        : App.state?.students || [];

    const targetAdm = String(admNo || "").trim();
    const targetName = String(student || "").trim().toUpperCase();
    const targetGrade = num(grade);
    const targetYear = num(year);
    const targetTerm = num(term);

    const match =
      liveRows.find((r) => {
        const rAdm = String(r.admNo || "").trim();
        const rName = String(r.student || "").trim().toUpperCase();

        if (targetAdm && rAdm && targetAdm === rAdm) {
          return num(r.year) === targetYear && num(r.term) === targetTerm;
        }

        return (
          rName === targetName &&
          num(r.grade) === targetGrade &&
          num(r.year) === targetYear &&
          num(r.term) === targetTerm
        );
      }) || null;

    if (!match) return null;

    return App.computeBalances([match])[0] || null;
  };
})();