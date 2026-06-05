/*
 * DLA / S455 Dividend Planning — calculation engine
 * Pure functions, no DOM. Usable in the browser (global functions) and in Node (module.exports).
 *
 * All monetary values are in GBP. All rates are decimals (e.g. 0.3935 = 39.35%).
 *
 * IMPORTANT: This is a planning aid, not tax advice. The accountant retains
 * professional responsibility for the figures. Every rate is editable in the UI
 * because UK tax rates change (the official rate of interest is now reviewed quarterly).
 */

/* ---------------------------------------------------------------------------
 * Default assumptions — UK tax year 2026/27.
 * Verified June 2026. Update via the Assumptions panel when rates change.
 * ------------------------------------------------------------------------- */
function defaultRates() {
  return {
    taxYearLabel: "2026/27",

    // Income tax — personal allowance and bands
    personalAllowance: 12570,   // standard PA
    paTaperThreshold: 100000,   // PA reduced £1 for every £2 of adjusted net income above this
    basicBandWidth: 37700,      // size of the basic rate band (taxable income above PA)
    additionalThreshold: 125140, // total income at which the additional rate begins

    // Income tax rates (apply to salary, BIK and other non-dividend income)
    incomeBasic: 0.20,
    incomeHigher: 0.40,
    incomeAdditional: 0.45,

    // Dividend tax
    dividendAllowance: 500,
    divOrdinary: 0.1075,   // 2026/27: 8.75% -> 10.75%
    divUpper: 0.3575,      // 2026/27: 33.75% -> 35.75%
    divAdditional: 0.3935, // unchanged

    // Loans to participators (s455 CTA 2010)
    s455Rate: 0.3575,      // loans made on/after 6 April 2026 (was 33.75%)

    // Beneficial loan benefit in kind (s175 ITEPA 2003)
    officialRate: 0.0375,  // HMRC official rate of interest from 6 April 2025 (reviewed quarterly)
    bikThreshold: 10000,   // no BIK if loan never exceeds this in the year
    class1ARate: 0.15,     // employer Class 1A NIC on the cash equivalent (2025/26 onwards)
  };
}

/* ---------------------------------------------------------------------------
 * Band slicing helper.
 * Taxes `amount` of income that sits on top of `base` (both expressed as
 * taxable income, i.e. after personal allowance), across the supplied bands.
 * The first `allowance` of `amount` is taxed at 0% but still consumes band space
 * (this is how the dividend allowance / nil-rate band works).
 *   bands: [{ upper, rate }, ...] where `upper` is a cumulative taxable-income limit.
 * ------------------------------------------------------------------------- */
function sliceTax(base, amount, allowance, bands) {
  let tax = 0;
  let pos = base;
  let remaining = amount;
  let allowLeft = allowance;

  for (const b of bands) {
    if (remaining <= 0) break;
    const room = b.upper - pos;
    if (room <= 0) continue;
    const inBand = Math.min(remaining, room);
    const allowanceUsed = Math.min(allowLeft, inBand);
    tax += (inBand - allowanceUsed) * b.rate;
    allowLeft -= allowanceUsed;
    remaining -= inBand;
    pos += inBand;
  }
  return tax;
}

/* ---------------------------------------------------------------------------
 * Compute total income tax for a person with:
 *   nonDivIncome — salary, BIK and other non-savings/non-dividend income
 *   dividends    — dividend income (stacks on top of nonDivIncome)
 *
 * Handles the personal allowance taper (using adjusted net income), allocates
 * the PA to non-dividend income first, applies the dividend allowance, and taxes
 * each slice at the correct band rate.
 *
 * Returns { pa, incomeTax, dividendTax, total }.
 * ------------------------------------------------------------------------- */
function computeTax(nonDivIncome, dividends, r) {
  nonDivIncome = Math.max(0, nonDivIncome || 0);
  dividends = Math.max(0, dividends || 0);

  const ani = nonDivIncome + dividends; // simplified adjusted net income
  const paReduction = ani > r.paTaperThreshold
    ? Math.floor((ani - r.paTaperThreshold) / 2)
    : 0;
  const pa = Math.max(0, r.personalAllowance - paReduction);

  // Personal allowance to non-dividend income first, remainder to dividends
  const paToNonDiv = Math.min(pa, nonDivIncome);
  const paLeft = pa - paToNonDiv;
  const nonDivTaxable = nonDivIncome - paToNonDiv;
  const divTaxable = Math.max(0, dividends - paLeft);

  // Band boundaries (in taxable-income terms)
  const basicLimit = r.basicBandWidth;
  const additionalLimit = Math.max(basicLimit, r.additionalThreshold - pa);

  const incomeBands = [
    { upper: basicLimit, rate: r.incomeBasic },
    { upper: additionalLimit, rate: r.incomeHigher },
    { upper: Infinity, rate: r.incomeAdditional },
  ];
  const dividendBands = [
    { upper: basicLimit, rate: r.divOrdinary },
    { upper: additionalLimit, rate: r.divUpper },
    { upper: Infinity, rate: r.divAdditional },
  ];

  const incomeTax = sliceTax(0, nonDivTaxable, 0, incomeBands);
  // Dividends sit on top of the non-dividend taxable income.
  const dividendTax = sliceTax(nonDivTaxable, divTaxable, r.dividendAllowance, dividendBands);

  return { pa, incomeTax, dividendTax, total: incomeTax + dividendTax };
}

/* ---------------------------------------------------------------------------
 * Run a multi-year scenario.
 *
 * scenario = {
 *   name, note,
 *   otherIncome,   // annual non-dividend income (e.g. salary), assumed constant
 *   openingLoan,   // director's loan balance brought forward (positive = director owes company)
 *   years: [ { drawdown, dividends, externalRepayment }, ... ]
 * }
 *
 * Convention:
 *   - `dividends` declared in a year are credited against the loan (they reduce the
 *     director's loan account, which is the usual way to "bring down the s455").
 *   - `externalRepayment` is cash repaid from another source (e.g. selling the UK home).
 *   - `drawdown` increases the loan.
 *
 * For each year we compute:
 *   - loan opening/closing balance
 *   - benefit in kind (average-balance method at the official rate) + its income tax + Class 1A
 *   - dividend tax (marginal, on top of salary + BIK)
 *   - s455 liability on the closing balance, and the cash movement vs the prior year
 *     (positive = pay HMRC, negative = s458 refund as the loan is reduced)
 *
 * We distinguish PERMANENT tax cost (dividend tax + BIK income tax + Class 1A — never
 * comes back) from the S455 TIMING cost (refundable once the loan is cleared).
 * ------------------------------------------------------------------------- */
function runScenario(scenario, r) {
  const otherIncome = scenario.otherIncome || 0;
  const baseline = computeTax(otherIncome, 0, r); // "do nothing" — salary only

  let opening = scenario.openingLoan || 0;
  let prevS455 = r.s455Rate * Math.max(0, opening);
  // Note: we treat the brought-forward balance as already having borne its s455,
  // so the opening liability is the baseline against which movements are measured.

  const years = [];
  const totals = {
    dividends: 0,
    dividendTax: 0,
    bik: 0,
    bikIncomeTax: 0,
    class1A: 0,
    permanentCost: 0,
    s455Paid: 0,
    s455Refunded: 0,
  };
  let peakS455 = prevS455;

  (scenario.years || []).forEach((y, i) => {
    const drawdown = y.drawdown || 0;
    const dividends = y.dividends || 0;
    const externalRepayment = y.externalRepayment || 0;

    const closing = opening + drawdown - dividends - externalRepayment;

    // Benefit in kind — average balance method, only if loan exceeds the threshold
    const maxBalance = Math.max(Math.max(0, opening), Math.max(0, closing));
    const avgBalance = (Math.max(0, opening) + Math.max(0, closing)) / 2;
    const bikApplies = maxBalance > r.bikThreshold;
    const bik = bikApplies ? avgBalance * r.officialRate : 0;

    // Split the marginal tax between BIK (income tax) and dividends
    const taxBaseline = baseline.total;
    const taxWithBik = computeTax(otherIncome + bik, 0, r).total;
    const taxWithBikAndDiv = computeTax(otherIncome + bik, dividends, r).total;

    const bikIncomeTax = taxWithBik - taxBaseline;
    const dividendTax = taxWithBikAndDiv - taxWithBik;
    const class1A = bik * r.class1ARate;

    // s455 on the closing balance, and the cash movement this year
    const s455Liab = r.s455Rate * Math.max(0, closing);
    const s455Movement = s455Liab - prevS455; // + = pay, - = refund
    peakS455 = Math.max(peakS455, s455Liab);

    const permanentCost = dividendTax + bikIncomeTax + class1A;

    years.push({
      year: i + 1,
      opening,
      drawdown,
      dividends,
      externalRepayment,
      closing,
      avgBalance,
      bik,
      bikIncomeTax,
      dividendTax,
      class1A,
      s455Liab,
      s455Movement,
      permanentCost,
      effectiveDivRate: dividends > 0 ? dividendTax / dividends : 0,
    });

    totals.dividends += dividends;
    totals.dividendTax += dividendTax;
    totals.bik += bik;
    totals.bikIncomeTax += bikIncomeTax;
    totals.class1A += class1A;
    totals.permanentCost += permanentCost;
    if (s455Movement > 0) totals.s455Paid += s455Movement;
    else totals.s455Refunded += -s455Movement;

    opening = closing;
    prevS455 = s455Liab;
  });

  const closingLoan = opening;
  const s455Outstanding = r.s455Rate * Math.max(0, closingLoan); // still locked up with HMRC at the end

  return {
    name: scenario.name,
    note: scenario.note || "",
    baselineTax: baseline.total,
    years,
    totals,
    peakS455,
    closingLoan,
    s455Outstanding,
    // Headline: what it really costs once the dust settles and the loan is cleared.
    // Permanent cost is money gone for good; s455 still outstanding is cash locked up.
    netPermanentCost: totals.permanentCost,
    cashLockedUp: s455Outstanding,
  };
}

/* Convenience: run several scenarios with shared assumptions. */
function runAll(scenarios, r) {
  return scenarios.map((s) => runScenario(s, r));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { defaultRates, sliceTax, computeTax, runScenario, runAll };
}
