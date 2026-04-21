let chart;

function getVal(id) {
  return parseFloat(document.getElementById(id).value);
}

// ROLE WEIGHTS
function getWeights(role) {
  if (role === "bank") return {agwp:0.35, adi:0.25, qs:0.1, npi:0.2, es:0.1};
  if (role === "branch") return {agwp:0.25, adi:0.35, qs:0.15, npi:0.15, es:0.1};
  if (role === "zonal") return {agwp:0.3, adi:0.2, qs:0.3, npi:0.1, es:0.1};
  return {agwp:0.3, adi:0.2, qs:0.2, npi:0.15, es:0.15};
}

// KPI SCORE
function calculatePS() {
  let role = document.getElementById("role").value;
  let w = getWeights(role);

  return (
    Math.min(150,getVal("agwp")) * w.agwp +
    Math.min(150,getVal("adi")) * w.adi +
    Math.min(150,getVal("qs")) * w.qs +
    Math.min(150,getVal("npi")) * w.npi +
    Math.min(150,getVal("es")) * w.es
  );
}

// INCENTIVE
function calculateIncentive(ps, ti=600000) {
  let qm = ps < 80 ? 0.7 : ps < 100 ? 1 : ps < 120 ? 1.15 : 1.25;
  let acc = ps > 110 ? 1 + (ps-110)/100 : 1;
  return ti * (ps/100) * qm * 1.1 * 1.1 * acc;
}

// INSIGHTS
function insights(ps, roi, lr) {
  let i=[];
  if(roi<1) i.push("⚠️ ROI below 1. Improve LR or reduce incentives.");
  if(lr>78) i.push("⚠️ High Loss Ratio hurting profitability.");
  if(ps>120) i.push("🚀 Excellent performance. Consider accelerator rewards.");
  if(ps<90) i.push("📉 Low performance. Improve engagement and activation.");
  return i.join("<br>");
}

// MAIN
function calculate(){

  let gwp=getVal("gwp");
  let growth=getVal("growth")/100;
  let lr=getVal("lr");
  let inc=getVal("inc")/100;

  let ps=calculatePS();
  let incentive=calculateIncentive(ps);

  let oldProfit=gwp*(1-(lr/100)-0.12);
  let newGwp=gwp*(1+growth);
  let newProfit=newGwp*(1-((lr-3)/100)-(0.12+inc));

  let roi=(newProfit-oldProfit)/(gwp*inc);

  // DISPLAY
  document.getElementById("ps").innerHTML="Performance Score: "+ps.toFixed(2);
  document.getElementById("incentive").innerHTML="Incentive: ₹"+incentive.toFixed(0);
  document.getElementById("profit").innerHTML="New Profit: ₹"+newProfit.toFixed(2)+" Cr";
  document.getElementById("roi").innerHTML="ROI: "+roi.toFixed(2);
  document.getElementById("insights").innerHTML=insights(ps,roi,lr);

  updateChart(oldProfit,newProfit);
  updateSliderValues();
}

// CHART
function updateChart(oldP,newP){
  if(chart) chart.destroy();
  chart=new Chart(document.getElementById("chart"),{
    type:"bar",
    data:{labels:["Old","New"],datasets:[{data:[oldP,newP]}]}
  });
}

// SLIDER DISPLAY
function updateSliderValues(){
  gwp_val.innerText=getVal("gwp");
  growth_val.innerText=getVal("growth")+"%";
  lr_val.innerText=getVal("lr")+"%";
  inc_val.innerText=getVal("inc")+"%";
}

// RM CALC
function calculateRM(){
  let ps=getVal("rm_ps");
  let ti=getVal("rm_ti");
  let earn=calculateIncentive(ps,ti);
  rm_output.innerHTML="Estimated Earnings: ₹"+earn.toFixed(0);
}

// EXPORT
function exportCSV(){
  let data="Metric,Value\n";
  data+="Performance Score,"+ps.innerText+"\n";
  let blob=new Blob([data],{type:"text/csv"});
  let a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="report.csv";
  a.click();
}

// EVENTS
document.querySelectorAll("input,select").forEach(i=>{
  i.addEventListener("input",()=>{calculate();calculateRM();});
});

calculate();
calculateRM();
