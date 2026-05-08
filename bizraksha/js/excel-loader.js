function loadPricingFromExcel(file) {
  const reader = new FileReader();

  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let pricing = {};

    rows.forEach(row => {
      if (!pricing[row.Product]) {
        pricing[row.Product] = {};
      }
      pricing[row.Product][row.Slab] = row.Annual_Premium;
    });

    localStorage.setItem("bizraksha_pricing", JSON.stringify(pricing));
    alert("Pricing uploaded successfully");
  };

  reader.readAsArrayBuffer(file);
}


function validateWorkbook(workbook) {
  const requiredSheets = [
    "META",
    "CORE_PRICING",
    "PAYSAFE_PRICING",
    "TRUST_PRICING",
    "CYBERLITE_PRICING",
    "BUNDLE_RULES"
  ];

  requiredSheets.forEach(sheet => {
    if (!workbook.Sheets[sheet]) {
      throw new Error(`Missing sheet: ${sheet}`);
    }
  });
}
