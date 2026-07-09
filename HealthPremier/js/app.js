console.log(packageDefs);

// ==========================================
// BUSINESS CONFIGURATION
// Change these after pilot feedback
// ==========================================

const UI_FILTERS = {
  family: ["1A", "2A", "2A1C", "2A2C"],

  age: ["18-25", "26-35", "36-40", "41-45", "46-50", "51-55"],

  si: [
    "100000",
    "300000",
    "500000",
    "1000000",
    "2000000",
    "3000000",
    "5000000",
  ],
};

// Reusable filter functions
function filterFamily(list) {
  return UI_FILTERS.family.filter((v) => list.includes(v));
}

function filterAge(list) {
  return UI_FILTERS.age.filter((v) => list.includes(v));
}

function filterSI(list) {
  return UI_FILTERS.si.filter((v) => list.includes(v));
}

const familyLabels = {
  "1A": "Self",
  "1A1C": "Parent + 1 Child",
  "1A2C": "Parent + 2 Children",
  "1A3C": "Parent + 3 Children",
  "1A4C": "Parent + 4 Children",
  "2A": "Couple",
  "2A1C": "Couple + 1 Child",
  "2A2C": "Family of 4",
  "2A3C": "Family of 5",
  "2A4C": "Large Family",
};
``;

let selected = {};

let selectedPackage = "smart";

const rates = window.rates;
function init() {
  renderPackages();
  const f = Object.keys(rates)[0];
  const a = Object.keys(rates[f])[0];
  const s = Object.keys(rates[f][a])[0];
  selected = { family: f, age: a, si: s };
  renderAll();
}
function renderPackages() {
  const el = document.getElementById("packages");
  el.innerHTML = "";
  Object.entries(packageDefs).forEach(([k, v]) => {
    const d = document.createElement("div");
    d.className = "pkg";
    d.innerHTML = `
  <div class="package-title">${v.title}</div>
  <div class="package-subtitle">${v.subtitle}</div>
`;
    d.className =
      "pkg" +
      (v.recommended ? " recommended" : "") +
      (selectedPackage === k ? " active" : "");

    d.onclick = () => selectPackage(k);
    el.appendChild(d);
  });
}
function selectPackage(k) {
  selectedPackage = k;

  const p = packageDefs[k];
  document.getElementById("anchor").innerText = p.anchor;
  document.getElementById("recommendationTitle").innerText = p.title;
  document.getElementById("recommendationText").innerText = p.subtitle;
  selected.si = p.si;
  renderPackages();
  renderAll();
}
function renderChips(id, items, key) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  items.forEach((v) => {
    const c = document.createElement("div");
    c.className = "chip" + (selected[key] == v ? " active" : "");
    // c.innerText = key === "si" ? Number(v) / 100000 + "L" : v;
    // c.onclick = () => {
    //   selected[key] = v;
    //   if (key === "family") selected.age = Object.keys(rates[v])[0];
    //   if (key === "age")
    //     selected.si = Object.keys(rates[selected.family][v])[0];
    //   renderAll();
    // };
    if (key === "family") {
      c.innerText = familyLabels[v] || v;
    } else if (key === "si") {
      c.innerText = "₹" + Number(v) / 100000 + "L";
    } else {
      c.innerText = v;
    }

    el.appendChild(c);
  });
}
function renderAll() {
  // renderChips("family", Object.keys(rates), "family");
  // renderChips("age", Object.keys(rates[selected.family]), "age");
  // const siList = Object.keys(rates[selected.family][selected.age]);
  const familyList = filterFamily(Object.keys(rates));
  if (!familyList.includes(selected.family)) selected.family = familyList[0];
  renderChips("family", familyList, "family");

  const ageList = filterAge(Object.keys(rates[selected.family]));
  if (!ageList.includes(selected.age)) selected.age = ageList[0];
  renderChips("age", ageList, "age");

  const siList = filterSI(Object.keys(rates[selected.family][selected.age]));

  if (!siList.includes(selected.si)) {
    selected.si = siList[0];
  }

  // renderChips("si", siList.slice(0, 7), "si");
  renderChips("family", familyList, "family");
  renderChips("age", ageList, "age");
  renderChips("si", siList, "si");

  calc();
}
function calc() {
  let p = rates?.[selected.family]?.[selected.age]?.[selected.si];
  if (!p) return;
  let annual = Math.round(p * 1.18);
  document.getElementById("premium").innerText = "₹ " + annual.toLocaleString();
  document.getElementById("perday").innerText = "₹ " + Math.round(annual / 365);
}
// function shareQuote() {
//   const txt = `Indian Bank Health Care Premier % 0AFamily:${ selected.family }% 0AAge:${ selected.age }% 0ACover:${ selected.si } `;
//   window.open("https://wa.me/?text=" + txt);
// }

function shareQuote() {
  const premium = document.getElementById("premium").innerText;

  const perDay = document.getElementById("perday").innerText;

  const txt = `

🏦 Indian Bank Health Care Premier

⭐ ${packageDefs[selectedPackage].title}

${packageDefs[selectedPackage].subtitle}

  Family:
${familyLabels[selected.family] || selected.family}

Age Band:
${selected.age}

Sum Insured:
₹ ${(Number(selected.si) / 100000).toFixed(0)} Lakh

  Premium:
${premium}

Protection Starts From:
${perDay} per day

✅ No Co - Pay
✅ Restore Benefit
✅ OPD Cover
✅ Cashless Hospitalisation

Indicative Quote
    `;

  window.open("https://wa.me/?text=" + encodeURIComponent(txt));
}

window.onload = () => {
  if (window.rates) init();
};
