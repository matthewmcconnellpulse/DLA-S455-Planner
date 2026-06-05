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

    // Capital Gains Tax (on a disposal used to repay the loan)
    cgtAnnualExempt: 3000,        // annual exempt amount 2026/27
    cgtResidentialBasic: 0.18,    // residential gains within the basic rate band
    cgtResidentialHigher: 0.24,   // residential gains in the higher/additional band
    cgtNonResBasic: 0.18,         // non-residential / other gains, basic rate band
    cgtNonResHigher: 0.24,        // non-residential / other gains, higher/additional band
    badrRate: 0.18,               // Business Asset Disposal Relief (2026/27; was 10% to Apr-25, 14% to Apr-26)
    badrLifetimeLimit: 1000000,   // BADR lifetime limit on qualifying gains
    ihtRate: 0.40,                // inheritance tax rate above the nil-rate band
    ihtNilRateBand: 325000,       // IHT nil-rate band

    // National Insurance (Class 1) — used by the remuneration optimiser
    niPrimaryThreshold: 12570,    // employee NIC starts (annual, aligned with PA)
    niUpperEarnings: 50270,       // employee main rate applies up to here, 2% above
    niEmployeeMain: 0.08,         // employee Class 1 primary main rate
    niEmployeeUpper: 0.02,        // employee Class 1 above the upper earnings limit
    niSecondaryThreshold: 5000,   // employer NIC starts (from 6 April 2025)
    niEmployerRate: 0.15,         // employer (secondary) Class 1 rate
    employmentAllowance: 10500,   // per-employer relief against employer NIC (not sole-director cos.)

    // Corporation tax — used to cost extraction (salary/pension are deductible; dividends are not)
    ctSmallRate: 0.19,            // small profits rate (profits up to the lower limit)
    ctMainRate: 0.25,             // main rate (profits at/above the upper limit)
    ctMarginalLower: 50000,       // lower limit (divided by number of associated companies)
    ctMarginalUpper: 250000,      // upper limit (marginal relief applies between the two)

    // Stamp Duty Land Tax (England & NI only — overseas purchases are outside SDLT)
    sdltBands: [
      { upper: 125000, rate: 0 },
      { upper: 250000, rate: 0.02 },
      { upper: 925000, rate: 0.05 },
      { upper: 1500000, rate: 0.10 },
      { upper: Infinity, rate: 0.12 },
    ],
    sdltSurcharge: 0.05,      // higher rates for additional dwellings (on the whole price, from £40k)
    sdltSurchargeFloor: 40000, // surcharge only applies if price is at least this
    sdltNonResident: 0.02,    // non-UK-resident surcharge on English/NI residential property
  };
}

/* Progressive band tax for a single amount (used for SDLT). */
function progressiveTax(amount, bands) {
  let tax = 0, prev = 0;
  for (const b of bands) {
    if (amount <= prev) break;
    const slice = Math.min(amount, b.upper) - prev;
    tax += slice * b.rate;
    prev = b.upper;
  }
  return tax;
}

/* ---------------------------------------------------------------------------
 * Stamp Duty Land Tax on a purchase.
 *   purchase = { price, applies, additionalProperty, nonResident }
 * `applies` is false for property outside England/NI (e.g. Spain) — SDLT then £0.
 * Returns { sdlt, standard, surcharge, nonResidentSurcharge, applies }.
 * ------------------------------------------------------------------------- */
function computeSDLT(purchase, r) {
  const price = (purchase && purchase.price) || 0;
  if (!purchase || !purchase.applies || price <= 0) {
    return { sdlt: 0, standard: 0, surcharge: 0, nonResidentSurcharge: 0, applies: false, price };
  }
  const standard = progressiveTax(price, r.sdltBands);
  const surcharge = purchase.additionalProperty && price >= r.sdltSurchargeFloor
    ? price * r.sdltSurcharge : 0;
  const nonResidentSurcharge = purchase.nonResident ? price * r.sdltNonResident : 0;
  return {
    sdlt: standard + surcharge + nonResidentSurcharge,
    standard, surcharge, nonResidentSurcharge, applies: true, price,
  };
}

/* ---------------------------------------------------------------------------
 * Capital Gains Tax (or, for the inheritance route, IHT) on the asset sold to
 * repay the loan. The asset `type` selects the treatment:
 *
 *   "residential" — the UK home etc. Private Residence Relief applies when
 *                   `mainResidence` is true (gain × `taxableFraction`, 0 = fully
 *                   relieved); taxed at the residential CGT rates.
 *   "business"    — sale of the business/shares. Business Asset Disposal Relief
 *                   at the BADR rate on gains up to the lifetime limit, with any
 *                   excess at the main (non-residential) CGT rates.
 *   "inheritance" — asset kept until death: rebased to market value, so no CGT in
 *                   life. Optional IHT estimate (value above the nil-rate band).
 *   "other"       — any other chargeable asset: main CGT rates, no relief.
 *
 *   disposal = { type, proceeds, cost, expenses, mainResidence, taxableFraction, estimateIHT }
 * `incomeUsingBand` is the person's taxable income (after PA) used to see how
 * much basic-rate band is left. Returns { gain, taxableGain, cgt, basicPart, higherPart, iht, type }.
 * ------------------------------------------------------------------------- */
function computeCGT(disposal, incomeUsingBand, r) {
  const type = disposal ? (disposal.type || "residential") : "residential";
  if (!disposal || !disposal.proceeds) {
    return { gain: 0, taxableGain: 0, cgt: 0, basicPart: 0, higherPart: 0, iht: 0, type };
  }
  let gain = Math.max(0, (disposal.proceeds || 0) - (disposal.cost || 0) - (disposal.expenses || 0));

  // Inheritance: assets are rebased to market value on death, so no CGT in life.
  if (type === "inheritance") {
    const iht = disposal.estimateIHT
      ? Math.max(0, (disposal.proceeds || 0) - (r.ihtNilRateBand || 0)) * (r.ihtRate || 0)
      : 0;
    return { gain, taxableGain: 0, cgt: 0, basicPart: 0, higherPart: 0, iht, type };
  }

  // Private residence relief only applies to a residential main home.
  if (type === "residential" && disposal.mainResidence) {
    const frac = disposal.taxableFraction != null ? disposal.taxableFraction : 0;
    gain = gain * frac;
  }

  const taxableGain = Math.max(0, gain - r.cgtAnnualExempt);
  const remainingBasic = Math.max(0, r.basicBandWidth - Math.max(0, incomeUsingBand));
  const basicPart = Math.min(taxableGain, remainingBasic);
  const higherPart = taxableGain - basicPart;

  let cgt;
  if (type === "business") {
    // BADR on gains up to the lifetime limit; excess at the main CGT rates.
    const badrAmount = Math.min(taxableGain, r.badrLifetimeLimit != null ? r.badrLifetimeLimit : Infinity);
    const excess = taxableGain - badrAmount;
    // BADR gains use up the basic-rate band first, so the excess sits above it.
    const basicLeftAfterBadr = Math.max(0, remainingBasic - badrAmount);
    const excessBasic = Math.min(excess, basicLeftAfterBadr);
    const excessHigher = excess - excessBasic;
    cgt = badrAmount * r.badrRate + excessBasic * r.cgtNonResBasic + excessHigher * r.cgtNonResHigher;
  } else if (type === "residential") {
    cgt = basicPart * r.cgtResidentialBasic + higherPart * r.cgtResidentialHigher;
  } else { // "other" — non-residential asset, no relief
    cgt = basicPart * r.cgtNonResBasic + higherPart * r.cgtNonResHigher;
  }

  return { gain, taxableGain, cgt, basicPart, higherPart, iht: 0, type };
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

  // One-off property transaction taxes (optional)
  const purchase = scenario.purchase || null;   // { year, price, applies, additionalProperty, nonResident }
  const disposal = scenario.disposal || null;    // { year, proceeds, cost, expenses, mainResidence, taxableFraction }
  const sdltResult = computeSDLT(purchase, r);
  const sdltYear = purchase && purchase.year ? purchase.year : 1;
  const disposalYear = disposal && disposal.year ? disposal.year : (scenario.years || []).length;

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
    sdlt: 0,
    cgt: 0,
    iht: 0,
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

    // Attach any one-off property taxes that fall in this year
    const yearNum = i + 1;
    const sdlt = purchase && purchase.applies && yearNum === sdltYear ? sdltResult.sdlt : 0;
    let cgt = 0, iht = 0, cgtDetail = null;
    if (disposal && disposal.proceeds && yearNum === disposalYear) {
      // Income occupying the basic-rate band this year (salary + BIK + dividends, after PA)
      const incomeAfterPA = Math.max(0, (otherIncome + bik + dividends) - computeTax(otherIncome + bik, dividends, r).pa);
      cgtDetail = computeCGT(disposal, incomeAfterPA, r);
      cgt = cgtDetail.cgt;
      iht = cgtDetail.iht || 0;
    }

    years.push({
      year: yearNum,
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
      sdlt,
      cgt,
      iht,
      cgtDetail,
      effectiveDivRate: dividends > 0 ? dividendTax / dividends : 0,
    });

    totals.sdlt += sdlt;
    totals.cgt += cgt;
    totals.iht += iht;

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
  const transactionTaxes = totals.sdlt + totals.cgt;

  return {
    name: scenario.name,
    note: scenario.note || "",
    baselineTax: baseline.total,
    years,
    totals,
    peakS455,
    closingLoan,
    s455Outstanding,
    sdltResult,
    transactionTaxes,
    // Headline: what it really costs once the dust settles and the loan is cleared.
    // Permanent cost is money gone for good; s455 still outstanding is cash locked up.
    netPermanentCost: totals.permanentCost,
    // Permanent income-tax cost + one-off transaction taxes (SDLT/CGT) — all non-refundable.
    totalNonRefundable: totals.permanentCost + transactionTaxes,
    cashLockedUp: s455Outstanding,
  };
}

/* Convenience: run several scenarios with shared assumptions. */
function runAll(scenarios, r) {
  return scenarios.map((s) => runScenario(s, r));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    defaultRates, sliceTax, computeTax, runScenario, runAll,
    progressiveTax, computeSDLT, computeCGT,
  };
}
