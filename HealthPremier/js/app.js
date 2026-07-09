console.log(packageDefs);

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
    c.innerText = key === "si" ? Number(v) / 100000 + "L" : v;
    c.onclick = () => {
      selected[key] = v;
      if (key === "family") selected.age = Object.keys(rates[v])[0];
      if (key === "age")
        selected.si = Object.keys(rates[selected.family][v])[0];
      renderAll();
    };
    el.appendChild(c);
  });
}
function renderAll() {
  renderChips("family", Object.keys(rates), "family");
  renderChips("age", Object.keys(rates[selected.family]), "age");
  renderChips(
    "si",
    Object.keys(rates[selected.family][selected.age]).slice(0, 7),
    "si",
  );
  calc();
}
function calc() {
  let p = rates?.[selected.family]?.[selected.age]?.[selected.si];
  if (!p) return;
  let annual = Math.round(p * 1.18);
  document.getElementById("premium").innerText = "₹ " + annual.toLocaleString();
  document.getElementById("perday").innerText = "₹ " + Math.round(annual / 365);
}
function shareQuote() {
  const txt = `Indian Bank Health Care Premier%0AFamily:${selected.family}%0AAge:${selected.age}%0ACover:${selected.si}`;
  window.open("https://wa.me/?text=" + txt);
}
window.onload = () => {
  if (window.rates) init();
};
