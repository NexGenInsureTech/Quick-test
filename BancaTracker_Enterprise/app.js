let factData = [];
const TOTAL = {
  "INDIAN BANK": 6022, "INDIAN OVERSEAS BANK": 3561, "KARNATAKA BANK": 977, "ODISHA GRAMEEN BANK": 1000, "TAMIL NADU GRAMA BANK": 674, "OTHER": 75
}
  ;
const MONTHS = ["Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26", "Sep-26", "Oct-26", "Nov-26", "Dec-26", "Jan-27", "Feb-27", "Mar-27"];
function parseCSV(text) {

  const rows = [];

  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {

    const char = text[i];

    if (char === '"') {

      if (
        inQuotes &&
        text[i + 1] === '"'
      ) {

        cell += '"';
        i++;

      } else {

        inQuotes = !inQuotes;
      }

      continue;
    }

    if (
      char === "," &&
      !inQuotes
    ) {

      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (
        char === "\n" ||
        char === "\r"
      ) &&
      !inQuotes
    ) {

      if (
        cell.length ||
        row.length
      ) {

        row.push(cell);

        rows.push(row);

        row = [];
        cell = "";
      }

      if (
        char === "\r" &&
        text[i + 1] === "\n"
      ) {

        i++;
      }

      continue;
    }

    cell += char;
  }

  if (
    cell.length ||
    row.length
  ) {

    row.push(cell);

    rows.push(row);
  }

  return rows;
}
const num = v => Number(String(v || 0).replace(/,/g, '')) || 0;
const inr = v => Number(v || 0).toLocaleString('en-IN');
const idx = (h, n) => h.findIndex(x => String(x).trim().toUpperCase() === n.toUpperCase());
const agg = (d, k) => {
  let o = {
  }
    ;
  d.forEach(r => o[r[k] || 'Blank'] = (o[r[k] || 'Blank'] || 0) + r.premium);
  return o
}
  ;
function table(id, o) {
  document.getElementById(id).innerHTML = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 25).map(x => `<tr><td>${x[0]}</td><td>${inr(x[1])}</td></tr>`).join('')
}
function refresh(d) {
  document.getElementById('kpis').innerHTML = `<div class='card'><div>YTD Premium</div><div class='value'>${inr(d.reduce((s, r) => s + r.premium, 0))}</div></div><div class='card'><div>Policies</div><div class='value'>${inr(d.length)}</div></div><div class='card'><div>Active RMs</div><div class='value'>${new Set(d.map(x => x.baCode)).size}</div></div>`;
  let m = agg(d, 'month');
  document.getElementById('monthlyCards').innerHTML = MONTHS.filter(x => m[x]).map(x => `<div class='month-card'><div>${x}</div><div class='value'>${(m[x] / 10000000).toFixed(2)} Cr</div></div>`).join('');
  table('bankTable', agg(d, 'bank'));
  table('rmTable', agg(d, 'rm'));
  table('lobTable', agg(d, 'lob'));
  activation(d)
}
function activation(d) {
  let b = {
  }
    ;
  d.forEach(r => {
    let k = r.branch || 'Unknown';
    b[k] = (b[k] || {
      p: 0, bank: r.bank
    }
    );
    b[k].p += r.premium
  }
  );
  let bands = {
    Zero: 0, '1-24K': 0, '25-49K': 0, '50-99K': 0, '1L-2L': 0, '2L+': 0
  }
    , near = {
    }
    , act = {
    }
    ;
  Object.values(b).forEach(x => {
    let p = x.p;
    if (p <= 0) bands.Zero++;
    else if (p < 25000) {
      bands['1-24K']++;
      if (p >= 15000) near[x.bank] = (near[x.bank] || 0) + 1
    } else if (p < 50000) {
      bands['25-49K']++;
      act[x.bank] = (act[x.bank] || 0) + 1
    } else if (p < 100000) {
      bands['50-99K']++;
      act[x.bank] = (act[x.bank] || 0) + 1
    } else if (p < 200000) {
      bands['1L-2L']++;
      act[x.bank] = (act[x.bank] || 0) + 1
    } else {
      bands['2L+']++;
      act[x.bank] = (act[x.bank] || 0) + 1
    }
  }
  );
  document.getElementById('branchPyramid').innerHTML = Object.entries(bands).map(x => `<div class='metric'>${x[0]} : ${x[1]}</div>`).join('');
  document.getElementById('nearActivation').innerHTML = Object.entries(near).map(x => `<div class='metric'>${x[0]} : ${x[1]}</div>`).join('');
  document.getElementById('bankActivation').innerHTML = Object.entries(act).map(x => `<div class='metric'>${x[0]} : ${((x[1] / (TOTAL[x[0]] || 1)) * 100).toFixed(1)}%</div>`).join('')
}
document.getElementById('csvFile').onchange = e => {
  let f = e.target.files[0];
  if (!f) return;
  let r = new FileReader();
  r.onload = x => {
    let rows = parseCSV(x.target.result), h = rows[0];
    // factData = rows.slice(1).map(v => ({
    //   premium: num(v[idx(h, 'USGI NET PREMIUM')]), month: v[idx(h, 'Month')] || '', bank: v[idx(h, 'INTERMEDIARY')] || '', rm: v[idx(h, 'BA NAME')] || '', baCode: v[idx(h, 'Ba Code')] || '', lob: v[idx(h, 'LINE OF BUSINESS')] || '', branch: v[idx(h, 'BRANCH NAME')] || ''
    // }
    // ));
    factData = rows.slice(1).map(v => ({

      premium:
        num(
          v[idx(
            h,
            'USGI NET PREMIUM'
          )]
        ),

      month:
        v[idx(
          h,
          'Month'
        )] || '',

      bank:
        v[idx(
          h,
          'INTERMEDIARY'
        )] || '',

      rm:
        v[idx(
          h,
          'BA NAME'
        )] || '',

      baCode:
        v[idx(
          h,
          'Ba Code'
        )] || '',

      lob:
        v[idx(
          h,
          'LINE OF BUSINESS'
        )] || '',

      branch:
        v[idx(
          h,
          'BRANCH NAME'
        )] || '',

      zone:
        v[idx(
          h,
          'Zone'
        )] || '',

      state:
        v[idx(
          h,
          'STATE'
        )] || '',

      imd:
        v[idx(
          h,
          'SUM IMD CODE'
        )] || ''

    }));

    const monthFilter =
      document.getElementById(
        "monthFilter"
      );

    monthFilter.innerHTML =
      '<option value="ALL">All Months</option>';

    const availableMonths =
      [...new Set(
        factData
          .map(x => x.month)
          .filter(Boolean)
      )];

    MONTHS.forEach(month => {

      if (
        availableMonths.includes(month)
      ) {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          month;

        option.textContent =
          month;

        monthFilter.appendChild(
          option
        );
      }

    });
    refresh(factData);
    // status.textContent = 'Loaded ' + inr(factData.length) + ' records'

    document
      .getElementById("status")
      .textContent =
      'Loaded ' +
      inr(factData.length) +
      ' records';
  }
    ;
  r.readAsText(f)
}
  ;
document
  .getElementById("misTab")
  .addEventListener(
    "click",
    () => {

      document
        .getElementById("misPage")
        .style.display = "block";

      document
        .getElementById("activationPage")
        .style.display = "none";
    }
  );

document
  .getElementById("actTab")
  .addEventListener(
    "click",
    () => {

      document
        .getElementById("misPage")
        .style.display = "none";

      document
        .getElementById("activationPage")
        .style.display = "block";
    }
  );

document
  .getElementById("monthFilter")
  .addEventListener(
    "change",
    function () {

      const month =
        this.value;

      if (month === "ALL") {

        refresh(
          factData
        );

        return;
      }

      refresh(
        factData.filter(
          x =>
            x.month === month
        )
      );

    }
  );
