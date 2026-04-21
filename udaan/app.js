let chart;

function getVal(id) {
  return parseFloat(document.getElementById(id).value);
}

// KPI Score Calculation
function calculatePS() {
  let agwp = Math.min(150, getVal("agwp"));
  let adi = Math.min(150, getVal("adi"));
  let qs = Math.min(150, getVal("qs"));
  let npi = Math.min(150, getVal("npi"));
  let es = Math.min(150, getVal("es"));

  return (agwp * 0.3 + adi * 0.2 + qs * 0.2 + npi * 0.15 + es * 0.15);
}

// Incentive Calculation
function calculateIncentive(ps, ti = 600000) {
  let qm = ps < 80 ? 0.7 : ps < 100 ? 1 : ps < 120 ? 1.15 : 1.25;
  let cm = 1.1;
  let im = 1.1;
  let acc = ps > 110 ? 1 + (ps - 110) / 100 : 1;

  return ti * (ps / 100) * qm * cm * im * acc;
}

// Main Calculation
function calculate() {

  let gwp = getVal("gwp");
  let growth = getVal("growth") / 100;
  let lr = getVal("lr") / 100;
  let inc = getVal("inc") / 100;

  let ps = calculatePS();
  let incentive = calculateIncentive(ps);

  let oldProfit = gwp * (1 - lr - 0.12);
  let newGwp = gwp * (1 + growth);
  let newProfit = newGwp * (1 - (lr - 0.03) - (0.12 + inc));

  let roi = (newProfit - oldProfit) / (gwp * inc);

  document.getElementById("ps").innerHTML = "Performance Score: " + ps.toFixed(2);
  document.getElementById("incentive").innerHTML = "Incentive: ₹" + incentive.toFixed(0);
  document.getElementById("profit").innerHTML = "New Profit: ₹" + newProfit.toFixed(2) + " Cr";
  document.getElementById("roi").innerHTML = "ROI: " + roi.toFixed(2);

  updateChart(oldProfit, newProfit);
}

// Chart
function updateChart(oldP, newP) {
  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("chart"), {
    type: "bar",
    data: {
      labels: ["Old", "New"],
      datasets: [{
        label: "Profit",
        data: [oldP, newP]
      }]
    }
  });
}

// RM Calculator
function calculateRM() {
  let ps = getVal("rm_ps");
  let ti = getVal("rm_ti");

  let earnings = calculateIncentive(ps, ti);

  document.getElementById("rm_output").innerHTML =
    "Estimated Earnings: ₹" + earnings.toFixed(0);
}

// Event Listeners
document.querySelectorAll("input").forEach(i => {
  i.addEventListener("input", () => {
    calculate();
    calculateRM();
  });
});

// Initial Run
calculate();
calculateRM();
