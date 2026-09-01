BancaTracker Enterprise v8.2 — R2B Synthetic Acceptance Test Pack
================================================================

PURPOSE
-------
Synthetic data only. Do not treat as business/production data.

VALID MASTER UPLOAD ORDER
-------------------------
1. 01_geography_master_valid.csv
2. 02_branch_master_valid.csv
3. 03_employee_master_valid.csv
4. 04_hierarchy_master_valid.csv
5. 05_branch_assignment_master_valid.csv
6. 06_branch_budget_potential_valid.csv
7. 07_pr_transactions_valid.csv

IMPORTANT
---------
Leading-zero branch codes (0001, 0002, 0101) are intentional.
BANK ID is TESTBANK.
Hierarchy: NH001 -> ZSM001 -> ASM001 -> CSM001 -> RM001/RM002.
July and August 2026 are included for comparison testing.
The valid PR file intentionally includes one negative-premium row and one zero-premium row.

INVALID / EDGE FIXTURES
-----------------------
08_branch_master_invalid_state.csv
  Expected: validation should prevent activation because STATE ID does not resolve.

09_branch_assignment_invalid_rm.csv
  Expected: validation should prevent activation because RM does not resolve.

10_branch_budget_potential_invalid.csv
  Expected: validation should fail for invalid month / negative budget.

11_pr_transactions_edge_cases.csv
  Contains an unknown bank/unmapped branch row and an invalid policy-date row.
  Use only during edge-case validation, not initial B3 persistence testing.

R2B B3 QUICK TEST
-----------------
A. Upload and activate 01_geography_master_valid.csv.
B. Record that Geography shows Active.
C. Refresh the page.
D. Confirm Geography remains Active.
E. Close the tab/browser and reopen the same origin.
F. Confirm Geography remains Active and the active pointer still exists.
