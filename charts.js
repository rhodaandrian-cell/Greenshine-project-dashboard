// charts.js
document.addEventListener("DOMContentLoaded", () => {
  const App = window.App;
  if (!App) {
    console.error("[charts.js] window.App not found. Load data.js first.");
    return;
  }

  if (typeof window.Chart !== "function") {
    console.warn("[charts.js] Chart.js not found.");
    return;
  }

  const byId = (id) => document.getElementById(id);

  const els = {
    chartGrade:      byId("chartGrade"),
    chartTerm:       byId("chartTerm"),
    chartPieStatus:  byId("chartPieStatus"),
    chartPieMethods: byId("chartPieMethods"),
  };

  let gradeChart      = null;
  let termChart       = null;
  let pieStatusChart  = null;
  let pieMethodsChart = null;

  // ── Brand palette ────────────────────────────────────────
  const C = {
    due:         "rgba(139,90,43,.80)",
    paid:        "rgba(29,185,84,.85)",
    outstanding: "rgba(255,107,122,.75)",
    dueBorder:   "rgba(200,140,70,.90)",
    paidBorder:  "rgba(45,224,112,.90)",
    outBorder:   "rgba(255,120,130,.90)",
    slices: [
      "rgba(255,107,122,.80)",   // danger / underpaid
      "rgba(29,185,84,.82)",     // green  / cleared
      "rgba(143,208,255,.80)",   // info   / overpaid
      "rgba(255,204,102,.80)",   // warning
      "rgba(160,110,255,.80)",   // purple
      "rgba(255,163,72,.80)",    // orange
    ],
  };

  function money(n) {
    return App.money ? App.money(n) : Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  }

  function validRows(rows) {
    return (rows || []).filter((r) => r && r.hasIdentity !== false);
  }

  function destroyChart(chart) {
    chart?.destroy?.();
    return null;
  }

  // ── Shared options ───────────────────────────────────────
  function baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 480, easing: "easeOutQuart" },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#c5d6e8",
            boxWidth: 12,
            boxHeight: 12,
            padding: 16,
            font: { size: 11, weight: "600" },
          },
        },
        tooltip: {
          backgroundColor: "rgba(8,12,20,.97)",
          titleColor: "#ffffff",
          bodyColor: "#c5d6e8",
          borderColor: "rgba(255,255,255,.12)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => {
              // For bar charts show KES amount
              if (typeof ctx.parsed.y === "number") {
                return ` ${ctx.dataset.label}: KES ${money(ctx.parsed.y)}`;
              }
              // For pie/doughnut show count + percent
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0.0";
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            },
          },
        },
      },
    };
  }

  function axisOptions() {
    return {
      x: {
        ticks: { color: "#7a9ab8", font: { size: 11 } },
        grid:  { display: false },
      },
      y: {
        ticks: {
          color: "#7a9ab8",
          font: { size: 11 },
          callback: (v) => "KES " + (v >= 1000 ? (v / 1000).toFixed(0) + "k" : v),
        },
        grid: { color: "rgba(255,255,255,.05)" },
      },
    };
  }

  // ── Data builders ────────────────────────────────────────
  function buildGradeMap(rows) {
    const map = new Map();
    validRows(rows).forEach((r) => {
      const key = `Grade ${r.grade}`;
      const cur = map.get(key) || { due: 0, paid: 0, bal: 0 };
      cur.due  += Number(r.totalDue || 0);
      cur.paid += Number(r.liveTotalPaid ?? r.totalPaid ?? 0);
      cur.bal  += Math.max(Number(r.computedBalance ?? r.balance ?? 0), 0);
      map.set(key, cur);
    });
    // Sort by grade number
    return new Map([...map.entries()].sort((a, b) => {
      const na = Number(a[0].replace("Grade ", ""));
      const nb = Number(b[0].replace("Grade ", ""));
      return na - nb;
    }));
  }

  function buildTermMap(rows) {
    const map = new Map();
    validRows(rows).forEach((r) => {
      const key = `Term ${r.term}`;
      const cur = map.get(key) || { due: 0, paid: 0, bal: 0 };
      cur.due  += Number(r.totalDue || 0);
      cur.paid += Number(r.liveTotalPaid ?? r.totalPaid ?? 0);
      cur.bal  += Math.max(Number(r.computedBalance ?? r.balance ?? 0), 0);
      map.set(key, cur);
    });
    return new Map([...map.entries()].sort((a, b) => {
      const na = Number(a[0].replace("Term ", ""));
      const nb = Number(b[0].replace("Term ", ""));
      return na - nb;
    }));
  }

  // ── Render functions ─────────────────────────────────────
  function renderGradeChart(rows) {
    if (!els.chartGrade) return;

    const map    = buildGradeMap(rows);
    const labels = [...map.keys()];
    const due    = labels.map((k) => map.get(k).due);
    const paid   = labels.map((k) => map.get(k).paid);
    const bal    = labels.map((k) => map.get(k).bal);

    gradeChart = destroyChart(gradeChart);
    gradeChart = new Chart(els.chartGrade, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Due",
            data: due,
            backgroundColor: C.due,
            borderColor: C.dueBorder,
            borderWidth: 1,
            borderRadius: 7,
            maxBarThickness: 24,
          },
          {
            label: "Paid",
            data: paid,
            backgroundColor: C.paid,
            borderColor: C.paidBorder,
            borderWidth: 1,
            borderRadius: 7,
            maxBarThickness: 24,
          },
          {
            label: "Outstanding",
            data: bal,
            backgroundColor: C.outstanding,
            borderColor: C.outBorder,
            borderWidth: 1,
            borderRadius: 7,
            maxBarThickness: 24,
          },
        ],
      },
      options: { ...baseOptions(), scales: axisOptions() },
    });
  }

  function renderTermChart(rows) {
    if (!els.chartTerm) return;

    const map    = buildTermMap(rows);
    const labels = [...map.keys()];
    const due    = labels.map((k) => map.get(k).due);
    const paid   = labels.map((k) => map.get(k).paid);
    const bal    = labels.map((k) => map.get(k).bal);

    termChart = destroyChart(termChart);
    termChart = new Chart(els.chartTerm, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Due",
            data: due,
            backgroundColor: C.due,
            borderColor: C.dueBorder,
            borderWidth: 1,
            borderRadius: 7,
            maxBarThickness: 38,
          },
          {
            label: "Paid",
            data: paid,
            backgroundColor: C.paid,
            borderColor: C.paidBorder,
            borderWidth: 1,
            borderRadius: 7,
            maxBarThickness: 38,
          },
          {
            label: "Outstanding",
            data: bal,
            backgroundColor: C.outstanding,
            borderColor: C.outBorder,
            borderWidth: 1,
            borderRadius: 7,
            maxBarThickness: 38,
          },
        ],
      },
      options: { ...baseOptions(), scales: axisOptions() },
    });
  }

  function renderStatusChart(rows) {
    if (!els.chartPieStatus) return;

    const vRows  = validRows(rows);
    const under  = vRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) > 0).length;
    const full   = vRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) === 0).length;
    const over   = vRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) < 0).length;
    const values = [under, full, over];
    const hasData = values.some((v) => v > 0);

    pieStatusChart = destroyChart(pieStatusChart);
    pieStatusChart = new Chart(els.chartPieStatus, {
      type: "doughnut",
      data: {
        labels:   hasData ? ["Underpaid", "Cleared", "Overpaid"] : ["No Data"],
        datasets: [{
          data:        hasData ? values : [1],
          backgroundColor: hasData ? [C.slices[0], C.slices[1], C.slices[2]] : ["rgba(255,255,255,.08)"],
          borderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: { ...baseOptions(), cutout: "66%" },
    });
  }

  function renderMethodsChart() {
    if (!els.chartPieMethods || typeof App.countPaymentMethods !== "function") return;

    const map    = App.countPaymentMethods();
    const labels = [...map.keys()];
    const values = labels.map((k) => map.get(k));
    const hasData = values.some((v) => Number(v) > 0);

    pieMethodsChart = destroyChart(pieMethodsChart);
    pieMethodsChart = new Chart(els.chartPieMethods, {
      type: "doughnut",
      data: {
        labels:   hasData ? labels : ["No Data"],
        datasets: [{
          data:        hasData ? values : [1],
          backgroundColor: hasData ? C.slices.slice(0, labels.length) : ["rgba(255,255,255,.08)"],
          borderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: { ...baseOptions(), cutout: "66%" },
    });
  }

  function renderAll(rows) {
    renderGradeChart(rows);
    renderTermChart(rows);
    renderStatusChart(rows);
    renderMethodsChart();
  }

  function destroyAll() {
    gradeChart      = destroyChart(gradeChart);
    termChart       = destroyChart(termChart);
    pieStatusChart  = destroyChart(pieStatusChart);
    pieMethodsChart = destroyChart(pieMethodsChart);
  }

  window.Charts = { renderAll, destroyAll };
});