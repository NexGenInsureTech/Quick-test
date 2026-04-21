let chart;

function getVal(id){ return parseFloat(document.getElementById(id).value); }

function calculate(){

  let gwp = getVal("gwp");
  let growth = getVal("growth")/100;
  let lr = getVal("lr");

  let ps = (Math.random()*50)+80; // simulate performance

  let oldProfit = gwp*(1-(lr/100)-0.12);
  let newProfit = (gwp*(1+growth))*(1-((lr-3)/100)-0.15);

  let roi = (newProfit-oldProfit)/(gwp*0.07);

  document.getElementById("ps").innerHTML = "Score: "+ps.toFixed(2);
  document.getElementById("profit").innerHTML = "Profit: ₹"+newProfit.toFixed(2);
  document.getElementById("roi").innerHTML = "ROI: "+roi.toFixed(2);

  document.getElementById("insights").innerHTML =
    roi<1 ? "⚠️ Improve LR or reduce incentives" : "✅ Profitable model";

  updateChart(oldProfit,newProfit);
  updateLeaderboard(ps);
  updateSliders();
}

function updateChart(oldP,newP){
  if(chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"),{
    type:"bar",
    data:{labels:["Old","New"],datasets:[{data:[oldP,newP]}]}
  });
}

function updateSliders(){
  gwp_val.innerText=getVal("gwp");
  growth_val.innerText=getVal("growth")+"%";
  lr_val.innerText=getVal("lr")+"%";
}

document.querySelectorAll("input").forEach(i=>{
  i.addEventListener("input", calculate);
});

setInterval(calculate,2000);
calculate();
renderLeaderboard();
