let chart;

function getVal(id) {
  return parseFloat(document.getElementById(id).value);
}

// ROLE WEIGHTS
function getWeights(role) {
  if (role === "bank")
    return { agwp: 0.35, adi: 0.25, qs: 0.1, npi: 0.2, es: 0.1 };
  if (role === "branch")
    return { agwp: 0.25, adi: 0.35, qs: 0.15, npi: 0.15, es: 0.1 };
  if (role === "zonal")
    return { agwp: 0.3, adi: 0.2, qs: 0.3, npi: 0.1, es: 0.1 };
  return { agwp: 0.3, adi: 0.2, qs: 0.2, npi: 0.15, es: 0.15 };
}

// KPI SCORE
function calculatePS() {
  let role = localStorage.getItem("role");
  let w = getWeights(role);

  return (
    Math.min(150, getVal("agwp")) * w.agwp +
    Math.min(150, getVal("adi")) * w.adi +
    Math.min(150, getVal("qs")) * w.qs +
    Math.min(150, getVal("npi")) * w.npi +
    Math.min(150, getVal("es")) * w.es
  );
}

// INCENTIVE
function calculateIncentive(ps, ti = 600000) {
  let qm = ps < 80 ? 0.7 : ps < 100 ? 1 : ps < 120 ? 1.15 : 1.25;
  let acc = ps > 110 ? 1 + (ps - 110) / 100 : 1;
  return ti * (ps / 100) * qm * 1.1 * 1.1 * acc;
}

// INSIGHTS
function insights(ps, roi, lr) {
  let i = [];
  if (roi < 1)
    i.push("⚠️ ROI below 1. Improve LR by 2–3% or reduce incentives.");
  if (lr > 78) i.push("⚠️ High Loss Ratio impacting profitability.");
  if (ps > 120) i.push("🚀 Strong performance. Eligible for accelerator.");
  if (ps < 90) i.push("📉 Improve activation & engagement.");
  return i.join("<br>");
}

// MAIN
function calculate() {
  let gwp = getVal("gwp");
  let growth = getVal("growth") / 100;
  let lr = getVal("lr");
  let inc = getVal("inc") / 100;

  let ps = calculatePS();
  let incentive = calculateIncentive(ps);

  let oldProfit = gwp * (1 - lr / 100 - 0.12);
  let newGwp = gwp * (1 + growth);
  let newProfit = newGwp * (1 - (lr - 3) / 100 - (0.12 + inc));

  let roi = (newProfit - oldProfit) / (gwp * inc);

  let incentiveCost = gwp * inc;
  let incrementalProfit = newProfit - oldProfit;

  document.getElementById("ps").innerHTML = "Score: " + ps.toFixed(2);
  document.getElementById("incentive").innerHTML =
    "Incentive: ₹" + incentive.toFixed(0);
  document.getElementById("profit").innerHTML =
    "Profit: ₹" + newProfit.toFixed(2) + " Cr";
  document.getElementById("roi").innerHTML = "ROI: " + roi.toFixed(2);

  document.getElementById("extra").innerHTML =
    "Incentive Cost: ₹" +
    incentiveCost.toFixed(2) +
    " | Incremental Profit: ₹" +
    incrementalProfit.toFixed(2);

  document.getElementById("insights").innerHTML = insights(ps, roi, lr);

  updateChart(oldProfit, newProfit);
  updateLeaderboard(ps);
  updateSliders();
}

// CHART
function updateChart(oldP, newP) {
  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"), {
    type: "bar",
    data: {
      labels: ["Old", "New"],
      datasets: [
        {
          label: "Profit Comparison",
          data: [oldP, newP],
        },
      ],
    },
  });
}

// SLIDER VALUES
function updateSliders() {
  gwp_val.innerText = getVal("gwp");
  growth_val.innerText = getVal("growth") + "%";
  lr_val.innerText = getVal("lr") + "%";
  inc_val.innerText = getVal("inc") + "%";
}

// EXPORT
function exportCSV() {
  let data = "Metric,Value\n";
  data += "Score," + ps.innerText + "\n";
  let blob = new Blob([data], { type: "text/csv" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "report.csv";
  a.click();
}

function buildSummary(newProfit, oldProfit, roi){
  let diff = newProfit - oldProfit;
  let status = "";

  if(roi > 1){
    status = "<span class='good'>Profitable Model ✅</span>";
  } else if(roi > 0.7){
    status = "<span class='warn'>Borderline ⚠️</span>";
  } else {
    status = "<span class='bad'>Not Profitable ❌</span>";
  }

  return `
    Profit: ₹${newProfit.toFixed(2)} Cr <br>
    Change: ₹${diff.toFixed(2)} Cr <br>
    ROI: ${roi.toFixed(2)} <br>
    Status: ${status}
  `;
}

// EVENTS
document.querySelectorAll("input").forEach((i) => {
  i.addEventListener("input", calculate);
});

calculate();
renderLeaderboard();
