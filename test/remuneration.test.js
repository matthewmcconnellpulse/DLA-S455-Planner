/*
 * Sanity tests for the remuneration optimiser engine.
 * Run with:  node test/remuneration.test.js
 * No framework — just assertions that throw on failure.
 */
const { defaultRates } = require("../engine.js");
const {
  employeeNIC, employerNIC, corporationTax, marginalCtRate, ctReliefFraction,
  personExtraction, splitDividends, runRemuneration, optimiseRemuneration,
} = require("../remuneration.js");

let passed = 0;
function approx(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > (tol || 0.5)) {
    throw new Error(`FAIL: ${msg}\n  expected ~${expected}, got ${actual}`);
  }
  passed++;
}
function ok(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
}

const r = defaultRates();

/* ---- NIC ---------------------------------------------------------------- */
// Salary at the secondary threshold: no employer NIC.
approx(employerNIC(r.niSecondaryThreshold, r), 0, 0.01, "employer NIC nil at secondary threshold");
// Salary at the PA (£12,570): employer NIC on (12570-5000) @ 15% = 1135.50
approx(employerNIC(12570, r), (12570 - 5000) * 0.15, 0.01, "employer NIC at PA");
// Employee NIC nil at the primary threshold.
approx(employeeNIC(r.niPrimaryThreshold, r), 0, 0.01, "employee NIC nil at primary threshold");
// Employee NIC on £30,000: (30000-12570) @ 8% = 1394.40
approx(employeeNIC(30000, r), (30000 - 12570) * 0.08, 0.01, "employee NIC at 30k");
// Employee NIC above UEL: (50270-12570)*8% + (60000-50270)*2%
approx(employeeNIC(60000, r), (50270 - 12570) * 0.08 + (60000 - 50270) * 0.02, 0.01, "employee NIC above UEL");

/* ---- Corporation tax ---------------------------------------------------- */
approx(ctReliefFraction(r), 3 / 200, 1e-6, "marginal relief fraction is 3/200 with default rates");
approx(corporationTax(40000, 1, r), 40000 * 0.19, 0.01, "CT at small-profits rate below lower limit");
approx(corporationTax(300000, 1, r), 300000 * 0.25, 0.01, "CT at main rate above upper limit");
// £100k profit: 100000*25% - (250000-100000)*0.015 = 25000 - 2250 = 22750 (effective 22.75%)
approx(corporationTax(100000, 1, r), 22750, 0.01, "CT with marginal relief at 100k");
approx(marginalCtRate(100000, 1, r), 0.265, 1e-6, "marginal CT rate is 26.5% in the MR band");
// Associated companies halve the limits: £40k profit with 2 associates -> upper limit 125k, lower 25k -> MR band
approx(marginalCtRate(40000, 2, r), 0.265, 1e-6, "associated companies pull profit into the MR band");

/* ---- Person extraction -------------------------------------------------- */
// A basic-rate-ish person taking £12,570 salary (no IT, no NIC) + £20,000 dividend.
const p = { name: "T", otherIncome: 0, isShareholder: true };
const ex = personExtraction(p, 12570, 20000, r);
approx(ex.incomeTaxOnSalary, 0, 0.5, "no income tax on a PA-level salary");
approx(ex.employeeNIC, 0, 0.5, "no employee NIC on a PA-level salary");
// Dividend tax: £500 allowance free, remaining 19500 at ordinary rate (10.75% default)
approx(ex.dividendTax, (20000 - r.dividendAllowance) * r.divOrdinary, 1, "ordinary-rate dividend tax");

/* ---- Dividend split optimiser ------------------------------------------- */
// Two equal shareholders, no other income, no salary: optimal split should be ~50/50
// and cost less tax than dumping it all on one person.
const two = [
  { name: "A", otherIncome: 0, isEmployee: false, isShareholder: true, sharePct: 50 },
  { name: "B", otherIncome: 0, isEmployee: false, isShareholder: true, sharePct: 50 },
];
const split = splitDividends(100000, two, [0, 0], r, "optimise");
ok(Math.abs(split[0] - split[1]) < 6000, "even split for two identical shareholders");
approx(split[0] + split[1], 100000, 1, "split sums to the pool");

// Tax comparison: optimised split beats putting it all on one person.
const taxAllOnOne = personExtraction(two[0], 0, 100000, r).dividendTax;
const taxSplit = personExtraction(two[0], 0, split[0], r).dividendTax
               + personExtraction(two[1], 0, split[1], r).dividendTax;
ok(taxSplit < taxAllOnOne - 100, "splitting dividends across two people saves tax");

// If one shareholder already has high other income, the optimiser favours the other.
const skew = [
  { name: "Hi", otherIncome: 120000, isEmployee: false, isShareholder: true, sharePct: 50 },
  { name: "Lo", otherIncome: 0, isEmployee: false, isShareholder: true, sharePct: 50 },
];
const skewSplit = splitDividends(40000, skew, [0, 0], r, "optimise");
ok(skewSplit[1] > skewSplit[0], "optimiser steers dividends to the lower-income shareholder");

/* ---- Full optimiser ----------------------------------------------------- */
const plan = {
  availableProfit: 100000,
  associated: 1,
  employmentAllowance: false,
  dividendSplit: "optimise",
  people: [
    { name: "Director", otherIncome: 0, isEmployee: true, isShareholder: true, sharePct: 50, pension: 0 },
    { name: "Spouse", otherIncome: 0, isEmployee: false, isShareholder: true, sharePct: 50, pension: 0 },
  ],
};
const opt = optimiseRemuneration(plan, r);
ok(opt.salary >= 0 && opt.salary <= r.niUpperEarnings, "optimal salary within swept range");
// The optimiser's pick should deliver at least as much as taking no salary.
const noSalary = runRemuneration(plan, 0, r);
ok(opt.best.totals.valueDelivered >= noSalary.totals.valueDelivered - 0.5, "optimum is no worse than no salary");
// Distributing everything: profit consumed equals available profit; tax is positive and sane.
approx(opt.best.totals.profitConsumed, 100000, 0.5, "profit consumed equals available profit");
ok(opt.best.totals.effectiveRate > 0 && opt.best.totals.effectiveRate < 0.6, "effective extraction rate is plausible");
// A two-shareholder optimised plan should beat a single shareholder taking the lot.
const solo = {
  ...plan,
  people: [
    { name: "Director", otherIncome: 0, isEmployee: true, isShareholder: true, sharePct: 100, pension: 0 },
    { name: "Spouse", otherIncome: 0, isEmployee: false, isShareholder: false, sharePct: 0, pension: 0 },
  ],
};
const optSolo = optimiseRemuneration(solo, r);
ok(opt.best.totals.valueDelivered > optSolo.best.totals.valueDelivered + 100,
   "two active shareholders deliver more net than one");

console.log(`\n✓ All ${passed} remuneration assertions passed.`);
