// =====================================================
// ACTIVATION PLUS
// =====================================================

// Requires:
// factData
// TOTAL
// activationPage containers

// =====================================================
// CONFIGURATION
// =====================================================

const ACTIVE_BRANCH_THRESHOLD = 25000;

const NEAR_ACTIVE_MIN = 15000;
const NEAR_ACTIVE_MAX = 24999;

// =====================================================
// HELPERS
// =====================================================

function getBranchBand(premium) {

    if (premium <= 0)
        return "Zero";

    if (premium < 15000)
        return "1 - 14.9K";

    if (premium < 25000)
        return "15K - 24.9K";

    if (premium < 50000)
        return "25K - 49.9K";

    if (premium < 100000)
        return "50K - 99.9K";

    if (premium < 200000)
        return "1L - 1.99L";

    return "2L+";
}

function isActiveBranch(premium) {
    return premium >= ACTIVE_BRANCH_THRESHOLD;
}

function isNearActiveBranch(premium) {

    return (
        premium >= NEAR_ACTIVE_MIN &&
        premium <= NEAR_ACTIVE_MAX
    );
}

// =====================================================
// BRANCH AGGREGATION
// =====================================================

function buildBranchMetrics(data) {

    const branches = {};

    data.forEach(row => {

        const branch =
            row.branch || "Unknown";

        if (!branches[branch]) {

            branches[branch] = {

                premium: 0,

                bank:
                    normalizeBank(
                        row.bank || "",
                    ),

                zone:
                    row.zone || "",

                state:
                    row.state || ""
            };
        }

        branches[branch].premium +=
            row.premium;
    });

    return branches;
}

// =====================================================
// OPPORTUNITY BRANCHES
// =====================================================

function renderOpportunityBranches(data) {

    const container =
        document.getElementById(
            "opportunityBranches"
        );

    if (!container) {
        return;
    }

    const branches =
        buildBranchMetrics(
            data
        );

    const opportunities = [];

    Object.entries(branches)
        .forEach(
            ([branch, info]) => {

                if (
                    info.premium >= 15000 &&
                    info.premium < 25000
                ) {

                    opportunities.push({

                        branch,

                        bank:
                            info.bank,

                        premium:
                            info.premium,

                        gap:
                            25000 -
                            info.premium
                    });
                }
            }
        );

    opportunities.sort(
        (a, b) =>
            a.gap - b.gap
    );

    console.log(
        "Opportunity Count",
        opportunities.length
    );

    container.innerHTML =
        opportunities
            .slice(0, 50)
            .map(row => `

                <div class="metric">

                    <strong>
                        ${row.branch}
                    </strong>

                    <br>

                    Bank:
                    ${row.bank}

                    <br>

                    Premium:
                    ${inr(
                row.premium
            )}

                    <br>

                    Gap To 25K:
                    ${inr(
                row.gap
            )}

                </div>

            `)
            .join("");
}

// =====================================================
// EXTENDED BRANCH BAND PYRAMID
// =====================================================

function renderExtendedBranchBands(data) {

    const container =
        document.getElementById(
            "advancedBranchBands"
        );

    if (!container) {
        return;
    }

    const branches =
        buildBranchMetrics(data);

    const bands = {

        "Zero": 0,

        "1 - 14.9K": 0,

        "15K - 24.9K": 0,

        "25K - 49.9K": 0,

        "50K - 99.9K": 0,

        "1L - 1.99L": 0,

        "2L+": 0
    };

    Object.values(branches)
        .forEach(branch => {

            const band =
                getBranchBand(
                    branch.premium
                );

            bands[band]++;
        });

    container.innerHTML =
        Object.entries(bands)
            .map(row => `

                <div class="metric">

                    ${row[0]}

                    :

                    <strong>
                        ${row[1]}
                    </strong>

                </div>

            `)
            .join("");
}

// =====================================================
// ZONE ACTIVATION
// =====================================================

function renderZoneActivation(data) {

    const container =
        document.getElementById(
            "zoneActivation"
        );

    if (!container) {
        return;
    }

    const zones = {};

    const branches =
        buildBranchMetrics(data);

    Object.values(branches)
        .forEach(branch => {

            const zone =
                branch.zone || "Unknown";

            if (!zones[zone]) {

                zones[zone] = {

                    total: 0,

                    active: 0,

                    premium: 0
                };
            }

            zones[zone].total++;

            zones[zone].premium +=
                branch.premium;

            if (
                isActiveBranch(
                    branch.premium
                )
            ) {

                zones[zone].active++;
            }

        });

    container.innerHTML =
        Object.entries(zones)
            .sort(
                (a, b) =>
                    b[1].premium -
                    a[1].premium
            )
            .map(row => {

                const activationPct =
                    row[1].total > 0
                        ? (
                            row[1].active /
                            row[1].total
                        ) * 100
                        : 0;

                return `

                    <div class="metric">

                        <strong>
                            ${row[0]}
                        </strong>

                        <br>

                        Premium:
                        ${inr(
                    row[1].premium
                )}

                        <br>

                        Active:
                        ${row[1].active}

                        /
                        ${row[1].total}

                        <br>

                        Activation:
                        ${activationPct.toFixed(1)}%

                    </div>

                `;
            })
            .join("");
}

// =====================================================
// STATE ACTIVATION
// =====================================================

function renderStateActivation(data) {

    const container =
        document.getElementById(
            "stateActivation"
        );

    if (!container) {
        return;
    }

    const states = {};

    const branches =
        buildBranchMetrics(data);

    Object.values(branches)
        .forEach(branch => {

            const state =
                branch.state || "Unknown";

            if (!states[state]) {

                states[state] = {

                    total: 0,

                    active: 0,

                    premium: 0
                };
            }

            states[state].total++;

            states[state].premium +=
                branch.premium;

            if (
                isActiveBranch(
                    branch.premium
                )
            ) {

                states[state].active++;
            }

        });



    container.innerHTML =
        Object.entries(states)
            .sort(
                (a, b) =>
                    b[1].premium -
                    a[1].premium
            )
            .map(row => {

                const activationPct =
                    row[1].total > 0
                        ? (
                            row[1].active /
                            row[1].total
                        ) * 100
                        : 0;

                return `

                    <div class="metric">

                        <strong>
                            ${row[0]}
                        </strong>

                        <br>

                        Premium:
                        ${inr(
                    row[1].premium
                )}

                        <br>

                        Active:
                        ${row[1].active}

                        /
                        ${row[1].total}

                        <br>

                        Activation:
                        ${activationPct.toFixed(1)}%

                    </div>

                `;
            })
            .join("");
}


// =====================================================
// MASTER REFRESH
// =====================================================

function refreshActivationPlus() {

    if (
        !factData ||
        !factData.length
    ) {
        return;
    }

    renderOpportunityBranches(
        factData
    );

    renderZoneActivation(
        factData
    );

    renderStateActivation(
        factData
    );

    renderExtendedBranchBands(
        factData
    );


}

// =====================================================
// AUTO REFRESH
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setTimeOut(
            refreshActivationPlus,
            1000
        );
    }
);
