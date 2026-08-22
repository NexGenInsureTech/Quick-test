const CustomerForm = (() => {

  function normalizeMobileNumber(value) {
    const digits = String(value || "").replace(/\D/g, "");

    if (
      digits.length === 12 &&
      digits.startsWith("91")
    ) {
      return digits.slice(2);
    }

    return digits;
  }

  function validate(details) {
    const normalizedDetails = {
      customerName: String(
        details.customerName || ""
      ).trim(),
      mobileNumber: normalizeMobileNumber(
        details.mobileNumber
      ),
      rmName: String(details.rmName || "").trim(),
      branchName: String(
        details.branchName || ""
      ).trim()
    };
    const errors = {};

    if (!normalizedDetails.customerName) {
      errors.customerName =
        "Enter the customer name.";
    }

    if (!/^[6-9]\d{9}$/.test(
      normalizedDetails.mobileNumber
    )) {
      errors.mobileNumber =
        "Enter a valid 10-digit Indian mobile number.";
    }

    if (Object.keys(errors).length > 0) {
      return {
        ok: false,
        errors,
        details: normalizedDetails
      };
    }

    return {
      ok: true,
      details: normalizedDetails
    };
  }

  function renderValidation(result) {
    document.getElementById(
      "customerNameError"
    ).textContent = result.errors
      ? result.errors.customerName || ""
      : "";
    document.getElementById(
      "mobileNumberError"
    ).textContent = result.errors
      ? result.errors.mobileNumber || ""
      : "";
  }

  function bindFields({ details, onChange } = {}) {
    const customerNameInput =
      document.getElementById("customerName");
    const mobileNumberInput =
      document.getElementById("mobileNumber");
    const rmNameInput =
      document.getElementById("rmName");
    const branchNameInput =
      document.getElementById("branchName");

    customerNameInput.oninput = () => {
      details.customerName =
        customerNameInput.value.trim();
      onChange();
    };

    customerNameInput.onblur = () => {
      const result = validate(details);
      document.getElementById(
        "customerNameError"
      ).textContent = result.errors
        ? result.errors.customerName || ""
        : "";
    };

    mobileNumberInput.oninput = () => {
      details.mobileNumber =
        normalizeMobileNumber(mobileNumberInput.value);
      onChange();
    };

    mobileNumberInput.onblur = () => {
      const result = validate(details);
      mobileNumberInput.value =
        details.mobileNumber;
      document.getElementById(
        "mobileNumberError"
      ).textContent = result.errors
        ? result.errors.mobileNumber || ""
        : "";
    };

    rmNameInput.oninput = () => {
      details.rmName = rmNameInput.value.trim();
      onChange();
    };

    branchNameInput.oninput = () => {
      details.branchName =
        branchNameInput.value.trim();
      onChange();
    };
  }

  return Object.freeze({
    validate,
    bindFields,
    renderValidation
  });

})();
