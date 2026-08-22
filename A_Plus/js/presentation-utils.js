const PresentationUtils = (() => {

  const formatCurrency = value =>
    `₹${value.toLocaleString("en-IN")}`;

  const calculateDailyCost = finalPremium =>
    Math.round(finalPremium / 365);

  const formatSumInsured = value => {
    if (!sumInsuredOptions.includes(value)) {
      return "--";
    }

    return value === 10000000
      ? "₹1 Crore"
      : `₹${value / 100000} Lakh`;
  };

  function getMemberLabel(member, members) {
    const memberIndex = members.findIndex(
      item => item.id === member.id
    );
    const memberNumber = members
      .slice(0, memberIndex + 1)
      .filter(item =>
        item.memberType === member.memberType
      ).length;
    const labels = {
      firstAdult: "Primary Adult",
      secondAdult: "Secondary Adult",
      child: `Child ${memberNumber}`,
      parent: `Parent ${memberNumber}`
    };

    return labels[member.memberType] || member.id;
  }

  return Object.freeze({
    formatCurrency,
    calculateDailyCost,
    formatSumInsured,
    getMemberLabel
  });

})();
