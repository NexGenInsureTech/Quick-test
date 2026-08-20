const FamilyEngine = {

  getFamilyDefinition(code) {

    return familyOptions.find(
      item => item.code === code
    );

  }

};
