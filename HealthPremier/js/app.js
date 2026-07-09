const packageDefs = [
  { id: "young", title: "NEW YOUNG", si: "1000000" },
  { id: "lite", title: "HEALTH PROTECT LITE", si: "500000" },
  { id: "smart", title: "SMART HEALTH PLUS", si: "1000000" },
  { id: "senior", title: "SENIOR CARE SECURE", si: "500000" },
];
let selected = {};
function init() {
  renderPackages();
  const f = Object.keys(rates)[0];
  const a = Object.keys(rates[f])[0];
  const s = Object.keys(rates[f][a])[0];
  selected = { family: f, age: a, si: s };
  renderAll();
}
function renderPackages() {
  document.getElementById("packages").innerHTML = packageDefs
    .map(
      (p) =>
        `<div class=pkg onclick="selectPackage('${p.id}')">${p.title}</div>`,
    )
    .join("");
}
function selectPackage(id) {
  const p = packageDefs.find((x) => x.id === id);
  selected.si = p.si;
  renderAll();
}
function chips(id, items, key) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  items.forEach((v) => {
    const d = document.createElement("div");
    d.className = "chip" + (selected[key] == v ? " active" : "");
    d.textContent = v;
    d.onclick = () => {
      selected[key] = v;
      if (key === "family") selected.age = Object.keys(rates[v])[0];
      renderAll();
    };
    el.appendChild(d);
  });
}
function renderAll() {
  chips("family", Object.keys(rates), "family");
  chips("age", Object.keys(rates[selected.family]), "age");
  chips(
    "si",
    Object.keys(rates[selected.family][selected.age]).slice(0, 7),
    "si",
  );
  calc();
}
function calc() {
  let p = rates[selected.family][selected.age][selected.si];
  if (!p) return;
  document.getElementById("premium").textContent = "₹ " + p;
  document.getElementById("perday").textContent =
    "₹ " + Math.round((p * 1.18) / 365) + " per day";
}
function shareQuote() {
  window.open(
    "https://wa.me/?text=" +
      encodeURIComponent(document.getElementById("premium").textContent),
  );
}
window.onload = init;
