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

const SENIOR_AGE_BANDS = ["56-60", "61-65", "66-70", "71-75", "76-80", "81+"];

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

function getVisibleAgeBands(list, packageKey) {
  const baseAgeBands = filterAge(list);
  if (packageKey === "senior") {
    const seniorBands = list.filter((age) => SENIOR_AGE_BANDS.includes(age));
    return seniorBands.length ? seniorBands : baseAgeBands;
  }
  return baseAgeBands;
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
const STORAGE_KEY = "healthPremierSavedQuote";

function init() {
  renderPackages();
  const f = Object.keys(rates)[0];
  const a = Object.keys(rates[f])[0];
  const s = Object.keys(rates[f][a])[0];
  selected = { family: f, age: a, si: s };

  document.getElementById("shareQuoteBtn").onclick = () =>
    openCustomerModal("share");
  document.getElementById("saveQuoteBtn").onclick = () =>
    openCustomerModal("save");
  document.getElementById("resetQuoteBtn").onclick = resetSelection;
  document.getElementById("learnMoreBtn").onclick = () => openInfoModal();
  document.getElementById("modalSubmitBtn").onclick = submitCustomerModal;
  document.getElementById("modalCancelBtn").onclick = closeCustomerModal;
  document.getElementById("infoCloseBtn").onclick = closeInfoModal;
  document.querySelectorAll("[data-close='true']").forEach((el) => {
    el.onclick = (event) => {
      const modal = event.currentTarget.closest(".modal");
      if (modal?.id === "customerModal") {
        closeCustomerModal();
      } else if (modal?.id === "infoModal") {
        closeInfoModal();
      }
    };
  });

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
  ${v.recommended ? '<div class="package-badge">Recommended</div>' : ""}
`;
    d.className =
      "pkg" +
      (v.recommended ? " recommended" : "") +
      (selectedPackage === k ? " active" : "");

    d.onclick = () => selectPackage(k);
    el.appendChild(d);
  });
}

function renderRecommendation() {
  const packageInfo = packageDefs[selectedPackage] || {
    title: "Custom Health Cover",
    subtitle: "Choose your preferred family, age band, and sum insured",
    anchor: "Tailor your protection",
  };

  document.getElementById("anchor").innerText = packageInfo.anchor;
  document.getElementById("recommendationTitle").innerText = packageInfo.title;
  document.getElementById("recommendationText").innerText =
    packageInfo.subtitle;
}

function renderSummary() {
  const packageInfo = packageDefs[selectedPackage] || {
    title: "Custom Health Cover",
    subtitle: "Custom combination selected",
  };
  const familyLabel = familyLabels[selected.family] || selected.family;
  const sumInsuredLabel = `₹${Number(selected.si) / 100000}L`;

  document.getElementById("quoteSummary").innerHTML = `
    <div class="summary-item"><strong>Plan</strong><span>${packageInfo.title}</span></div>
    <div class="summary-item"><strong>Family</strong><span>${familyLabel}</span></div>
    <div class="summary-item"><strong>Age</strong><span>${selected.age}</span></div>
    <div class="summary-item"><strong>Cover</strong><span>${sumInsuredLabel}</span></div>
    <div class="summary-item"><strong>Premium</strong><span>${document.getElementById("premium").innerText}</span></div>
  `;
}

let pendingAction = null;

function getCustomerDetails() {
  return {
    name: document.getElementById("customerName").value.trim(),
    mobile: document.getElementById("customerMobile").value.trim(),
  };
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function openCustomerModal(action) {
  pendingAction = action;
  openModal("customerModal");
  document.getElementById("customerName").focus();
}

function closeCustomerModal() {
  pendingAction = null;
  closeModal("customerModal");
}

function openInfoModal() {
  openModal("infoModal");
}

function closeInfoModal() {
  closeModal("infoModal");
}

function submitCustomerModal() {
  const customer = getCustomerDetails();
  if (!customer.name || !customer.mobile) {
    document.getElementById("saveStatus").innerText =
      "Please enter name and mobile number to continue";
    return;
  }

  if (pendingAction === "save") {
    saveQuote(customer);
  } else if (pendingAction === "share") {
    shareQuote(customer);
  }

  closeCustomerModal();
}

function saveQuote(customer = getCustomerDetails()) {
  if (!customer.name || !customer.mobile) {
    document.getElementById("saveStatus").innerText =
      "Please enter name and mobile number to save the quote";
    return;
  }

  const quote = {
    packageKey: selectedPackage,
    family: selected.family,
    age: selected.age,
    si: selected.si,
    premium: document.getElementById("premium").innerText,
    perDay: document.getElementById("perday").innerText,
    customerName: customer.name,
    customerMobile: customer.mobile,
    savedAt: new Date().toLocaleString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quote));
    document.getElementById("saveStatus").innerText = "Quote saved for later";
  } catch (error) {
    document.getElementById("saveStatus").innerText =
      "Saving is not available right now";
  }
}

function resetSelection() {
  document.getElementById("customerName").value = "";
  document.getElementById("customerMobile").value = "";
  selectPackage("smart");
  document.getElementById("saveStatus").innerText = "";
}

function selectPackage(k) {
  selectedPackage = k;

  const p = packageDefs[k];
  const ageList = getVisibleAgeBands(Object.keys(rates[p.family] || {}), k);
  // selected.si = p.si;
  selected.family = p.family;
  selected.age = ageList.includes(p.age) ? p.age : ageList[0];
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
    if (key === "family") {
      c.innerText = familyLabels[v] || v;
    } else if (key === "si") {
      c.innerText = "₹" + Number(v) / 100000 + "L";
    } else {
      c.innerText = v;
    }

    c.onclick = () => {
      selected[key] = v;
      selectedPackage = null;

      if (key === "family") {
        const ageList = filterAge(Object.keys(rates[v] || {}));
        if (!ageList.includes(selected.age)) {
          selected.age = ageList[0];
        }
        const siList = filterSI(Object.keys(rates[v][selected.age] || {}));
        if (!siList.includes(selected.si)) {
          selected.si = siList[0];
        }
      } else if (key === "age") {
        const siList = filterSI(Object.keys(rates[selected.family][v] || {}));
        if (!siList.includes(selected.si)) {
          selected.si = siList[0];
        }
      }

      renderAll();
    };

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

  const ageList = getVisibleAgeBands(
    Object.keys(rates[selected.family] || {}),
    selectedPackage,
  );
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

  renderRecommendation();
  calc();
  renderSummary();
}
function calc() {
  let p = rates?.[selected.family]?.[selected.age]?.[selected.si];
  if (!p) return;
  let annual = Math.round(p * 1.18);
  document.getElementById("premium").innerText = "₹ " + annual.toLocaleString();
  document.getElementById("perday").innerText = "₹ " + Math.round(annual / 365);
}

function shareQuote(customer = getCustomerDetails()) {
  if (!customer.name || !customer.mobile) {
    document.getElementById("saveStatus").innerText =
      "Please enter name and mobile number before sharing";
    return;
  }

  const premium = document.getElementById("premium").innerText;

  const perDay = document.getElementById("perday").innerText;
  const pkg = packageDefs[selectedPackage] || {
    title: "Custom Health Cover",
    subtitle: "Custom combination selected",
  };

  const txt = `

🏦 Indian Bank Health Care Premier

Customer: ${customer.name}
Mobile: ${customer.mobile}

⭐ ${pkg.title}

${pkg.subtitle}

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
