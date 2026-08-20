let selected = {

  profile: null,

  family: null,

  age: null,

  zone: "ZONE1",

  plan: "gold",

  sumInsured: null,

  addons: [],

  deductible: null

};


const packageContainer =
  document.getElementById("packageContainer");

const profileContainer =
  document.getElementById("profileContainer");

function renderPackages() {

  packageContainer.innerHTML = "";

  Object.values(packageDefs).forEach(pkg => {

    const div = document.createElement("div");

    div.className = "card";

    div.innerHTML = `
      <h3>${pkg.title}</h3>

      ${pkg.recommended
        ? '<span class="badge">Recommended</span>'
        : ''
      }

      <p>
      ${pkg.plan.toUpperCase()}
      </p>
    `;

    packageContainer.appendChild(div);
  });
}

function renderProfiles() {

  profileContainer.innerHTML = "";

  customerProfiles.forEach(profile => {

    const div = document.createElement("div");

    div.className = "card";

    if (
      selected.profile === profile.id
    ) {
      div.classList.add("active");
    }

    div.innerHTML = `
      <h2>${profile.icon}</h2>

      <h3>
      ${profile.title}
      </h3>

      <p>
      ${profile.description}
      </p>
    `;

    div.onclick = () => {

      selected.profile =
        profile.id;

      renderProfiles();

    };


    profileContainer.appendChild(div);
  });
}

function renderFamilies() {

  const familyContainer =
    document.getElementById(
      "familyContainer"
    );

  familyContainer.innerHTML = "";

  familyOptions.forEach(family => {

    const div =
      document.createElement("div");

    div.className = "card";

    if (
      selected.family === family.code
    ) {
      div.classList.add("active");
    }

    div.innerHTML = `
      <h3>${family.label}</h3>
      <p>${family.code}</p>
    `;

    div.onclick = () => {

      selected.family =
        family.code;

      renderFamilies();

      console.log(
        FamilyEngine.getFamilyDefinition(
          family.code
        )
      );

    };

    familyContainer.appendChild(div);

  });

}

function renderAgeBands() {

  const ageContainer =
    document.getElementById(
      "ageContainer"
    );

  ageContainer.innerHTML = "";

  ageBands.forEach(age => {

    const div =
      document.createElement("div");

    div.className = "card";

    if (
      selected.age === age
    ) {

      div.classList.add(
        "active"
      );

    }

    div.innerHTML = `
            <h3>${age}</h3>
        `;

    div.onclick = () => {

      selected.age = age;

      renderAgeBands();

      console.log(
        "Selected Age:",
        selected.age
      );

      console.log(
        selected
      );

    };

    ageContainer.appendChild(
      div
    );

  });

}

function renderZones() {

  const zoneContainer =
    document.getElementById(
      "zoneContainer"
    );

  zoneContainer.innerHTML = "";

  zones.forEach(zone => {

    const div =
      document.createElement("div");

    div.className = "card";

    if (
      selected.zone === zone.code
    ) {

      div.classList.add(
        "active"
      );

    }

    div.innerHTML = `

            <h3>
                ${zone.title}
            </h3>

            <p>
                ${zone.description}
            </p>

        `;

    div.onclick = () => {

      selected.zone =
        zone.code;

      renderZones();

      console.log(
        "Selected Zone:",
        selected.zone
      );

      console.log(
        selected
      );

    };

    zoneContainer.appendChild(
      div
    );

  });

}

function renderPlans() {

  const planContainer =
    document.getElementById(
      "planContainer"
    );

  planContainer.innerHTML = "";

  plans.forEach(plan => {

    const div =
      document.createElement("div");

    div.className = "card";

    if (
      selected.plan === plan.code
    ) {

      div.classList.add(
        "active"
      );

    }

    div.innerHTML = `

            <h3>
                ${plan.title}
            </h3>

            <p>
                ${plan.badge}
            </p>

        `;

    div.onclick = () => {

      selected.plan =
        plan.code;

      renderPlans();

      console.log(
        "Selected Plan:",
        selected.plan
      );

      console.log(
        selected
      );

    };

    planContainer.appendChild(
      div
    );

  });

}

function renderSI() {

  const siContainer =
    document.getElementById(
      "siContainer"
    );

  siContainer.innerHTML = "";

  sumInsuredOptions.forEach(si => {

    const div =
      document.createElement("div");

    div.className = "card";

    if (
      selected.sumInsured === si
    ) {

      div.classList.add(
        "active"
      );

    }

    const label = si === 10000000
      ? "₹1 Crore"
      : `₹${si / 100000} Lakh`;

    div.innerHTML = `
      <h3>${label}</h3>
    `;

    div.onclick = () => {

      selected.sumInsured = si;

      renderSI();

    };

    siContainer.appendChild(
      div
    );

  });

}


renderPackages();
renderProfiles();
renderFamilies();
renderAgeBands();
renderZones();
renderPlans();
renderSI();
