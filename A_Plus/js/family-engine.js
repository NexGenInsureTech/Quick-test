const FamilyEngine = {

  getFamilyDefinition(code) {

    return familyOptions.find(
      item => item.code === code
    );

  },

  createRatingMembers(code) {

    const family = this.getFamilyDefinition(code);

    if (!family) {
      return [];
    }

    const members = [];

    if (family.adults >= 1) {
      members.push({
        id: "adult-1",
        memberType: "firstAdult",
        ageBand: null
      });
    }

    if (family.adults >= 2) {
      members.push({
        id: "adult-2",
        memberType: "secondAdult",
        ageBand: null
      });
    }

    for (
      let index = 1;
      index <= family.children;
      index++
    ) {
      members.push({
        id: `child-${index}`,
        memberType: "child",
        ageBand: null
      });
    }

    for (
      let index = 1;
      index <= family.parents;
      index++
    ) {
      members.push({
        id: `parent-${index}`,
        memberType: "parent",
        ageBand: null
      });
    }

    return members;

  }

};
