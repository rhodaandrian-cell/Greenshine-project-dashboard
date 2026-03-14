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
    chartGrade: byId("chartGrade"),
    chartTerm: byId("chartTerm"),
    chartPieStatus: byId("chartPieStatus"),
    chartPieMethods: byId("chartPieMethods"),
  };

  let gradeChart = null;
  let termChart = null;
  let pieStatusChart = null;
  let pieMethodsChart = null;

  function validRows(rows) {
    return (rows || []).filter((r) => r && r.hasIdentity !== false);
  }

  function destroyChart(chart) {
    chart?.destroy?.();
    return null;
  }

  function baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 500,
        easing: "easeOutQuart",
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#eaf1ff",
            boxWidth: 12,
            boxHeight: 12,
            padding: 14,
            font: { size: 11, weight: "600" },
          },
        },
        tooltip: {
          backgroundColor: "rgba(12,16,24,.96)",
          titleColor: "#ffffff",
          bodyColor: "#eaf1ff",
          borderColor: "rgba(255,255,255,.10)",
          borderWidth: 1,
          padding: 10,
        },
      },
    };
  }

  function buildGradeMap(rows) {
    const map = new Map();

    validRows(rows).forEach((r) => {
      const key = `Grade ${r.grade}`;
      const current = map.get(key) || { due: 0, paid: 0, bal: 0 };

      current.due += Number(r.totalDue || 0);
      current.paid += Number(r.liveTotalPaid ?? r.totalPaid ?? 0);
      current.bal += Math.max(Number(r.computedBalance ?? r.balance ?? 0), 0);

      map.set(key, current);
    });

    return map;
  }

  function buildTermMap(rows) {
    const map = new Map();

    validRows(rows).forEach((r) => {
      const key = `Term ${r.term}`;
      const current = map.get(key) || { due: 0, paid: 0, bal: 0 };

      current.due += Number(r.totalDue || 0);
      current.paid += Number(r.liveTotalPaid ?? r.totalPaid ?? 0);
      current.bal += Math.max(Number(r.computedBalance ?? r.balance ?? 0), 0);

      map.set(key, current);
    });

    return map;
  }

  function renderGradeChart(rows) {
    if (!els.chartGrade) return;

    const map = buildGradeMap(rows);
    const labels = [...map.keys()];
    const due = labels.map((k) => map.get(k).due);
    const paid = labels.map((k) => map.get(k).paid);
    const bal = labels.map((k) => map.get(k).bal);

    gradeChart = destroyChart(gradeChart);
    gradeChart = new Chart(els.chartGrade, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Due", data: due, borderRadius: 8, maxBarThickness: 26 },
          { label: "Paid", data: paid, borderRadius: 8, maxBarThickness: 26 },
          { label: "Outstanding", data: bal, borderRadius: 8, maxBarThickness: 26 },
        ],
      },
      options: {
        ...baseOptions(),
        scales: {
          x: {
            ticks: { color: "#9bb0c7", font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            ticks: { color: "#9bb0c7", font: { size: 11 } },
            grid: { color: "rgba(255,255,255,.05)" },
          },
        },
      },
    });
  }

  function renderTermChart(rows) {
    if (!els.chartTerm) return;

    const map = buildTermMap(rows);
    const labels = [...map.keys()];
    const due = labels.map((k) => map.get(k).due);
    const paid = labels.map((k) => map.get(k).paid);
    const bal = labels.map((k) => map.get(k).bal);

    termChart = destroyChart(termChart);
    termChart = new Chart(els.chartTerm, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Due", data: due, borderRadius: 8, maxBarThickness: 34 },
          { label: "Paid", data: paid, borderRadius: 8, maxBarThickness: 34 },
          { label: "Outstanding", data: bal, borderRadius: 8, maxBarThickness: 34 },
        ],
      },
      options: {
        ...baseOptions(),
        scales: {
          x: {
            ticks: { color: "#9bb0c7", font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            ticks: { color: "#9bb0c7", font: { size: 11 } },
            grid: { color: "rgba(255,255,255,.05)" },
          },
        },
      },
    });
  }

  function renderStatusChart(rows) {
    if (!els.chartPieStatus) return;

    const vRows = validRows(rows);

    const counts = {
      under: vRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) > 0).length,
      full: vRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) === 0).length,
      over: vRows.filter((r) => Number(r.computedBalance ?? r.balance ?? 0) < 0).length,
    };

    const values = [counts.under, counts.full, counts.over];
    const hasData = values.some((v) => v > 0);

    pieStatusChart = destroyChart(pieStatusChart);
    pieStatusChart = new Chart(els.chartPieStatus, {
      type: "doughnut",
      data: {
        labels: hasData ? ["Underpaid", "Cleared", "Overpaid"] : ["No Data"],
        datasets: [
          {
            data: hasData ? values : [1],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        ...baseOptions(),
        cutout: "64%",
      },
    });
  }

  function renderMethodsChart() {
    if (!els.chartPieMethods || typeof App.countPaymentMethods !== "function") return;

    const map = App.countPaymentMethods();
    const labels = [...map.keys()];
    const values = labels.map((k) => map.get(k));
    const hasData = values.some((v) => Number(v) > 0);

    pieMethodsChart = destroyChart(pieMethodsChart);
    pieMethodsChart = new Chart(els.chartPieMethods, {
      type: "doughnut",
      data: {
        labels: hasData ? labels : ["No Data"],
        datasets: [
          {
            data: hasData ? values : [1],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        ...baseOptions(),
        cutout: "64%",
      },
    });
  }

  function renderAll(rows) {
    renderGradeChart(rows);
    renderTermChart(rows);
    renderStatusChart(rows);
    renderMethodsChart();
  }

  function destroyAll() {
    gradeChart = destroyChart(gradeChart);
    termChart = destroyChart(termChart);
    pieStatusChart = destroyChart(pieStatusChart);
    pieMethodsChart = destroyChart(pieMethodsChart);
  }

  window.Charts = {
    renderAll,
    destroyAll,
  };
});