/*
 * Remuneration / profit-extraction optimiser — calculation engine.
 * Pure functions, no DOM. Works in the browser (global functions) and Node.
 *
 * Builds on engine.js (computeTax handles income tax, the dividend allowance and
 * the personal-allowance taper). This module adds:
 *   - employee and employer National Insurance (Class 1)
 *   - corporation tax (small-profits / marginal relief / main rate)
 *   - the salary-vs-dividend-vs-employer-pension trade-off
 *   - an optimal split of a dividend pool across several shareholders
 *
 * Everything is expressed in "profit consumed to deliver value to the people":
 * salary + employer NIC and employer pension are deductible (cost the company
 * their face value of pre-tax profit), whereas a £1 dividend needs £1/(1-CT) of
 * pre-tax profit because dividends are paid out of post-corporation-tax profit.
 *
 * PLANNING AID, NOT ADVICE. Every rate is editable. NIC for directors uses the
 * simple annual basis. Pension contributions are assumed to be within the annual
 * allowance and are valued at the amount paid in (drawdown is taxed later, with
 * 25% normally tax-free — noted in the UI, not modelled here).
 * ------------------------------------------------------------------------- */

/* global computeTax */
const _computeTax =
  typeof computeTax !== "undefined"
    ? computeTax
    : (typeof require !== "undefined" ? require("./engine.js").computeTax : null);

/* Employee Class 1 (primary) NIC on a salary. */
function employeeNIC(salary, r) {
  salary = Math.max(0, salary || 0);
  let nic = 0;
  if (salary > r.niPrimaryThreshold) {
    nic += (Math.min(salary, r.niUpperEarnings) - r.niPrimaryThreshold) * r.niEmployeeMain;
  }
  if (salary > r.niUpperEarnings) {
    nic += (salary - r.niUpperEarnings) * r.niEmployeeUpper;
  }
  return nic;
}

/* Employer (secondary) Class 1 NIC on a salary, before any Employment Allowance. */
function employerNIC(salary, r) {
  salary = Math.max(0, salary || 0);
  return Math.max(0, salary - r.niSecondaryThreshold) * r.niEmployerRate;
}

/* The corporation-tax marginal relief fraction implied by the current rates,
 * derived so that the average rate equals the small-profits rate at the lower
 * limit (with default rates this is the standard 3/200 = 0.015). */
function ctReliefFraction(r) {
  const span = r.ctMarginalUpper - r.ctMarginalLower;
  if (span <= 0) return 0;
  return (r.ctMarginalLower * (r.ctMainRate - r.ctSmallRate)) / span;
}

/* Corporation tax on a level of taxable profit, with the marginal-relief band.
 * `associated` divides the limits between associated companies. */
function corporationTax(profit, associated, r) {
  profit = Math.max(0, profit || 0);
  const n = Math.max(1, associated || 1);
  const lower = r.ctMarginalLower / n;
  const upper = r.ctMarginalUpper / n;
  if (profit <= lower) return profit * r.ctSmallRate;
  if (profit >= upper) return profit * r.ctMainRate;
  return profit * r.ctMainRate - (upper - profit) * ctReliefFraction(r);
}

/* The marginal corporation-tax rate at a level of profit (the rate of relief on
 * the next deductible pound — used to cost salary and pension). */
function marginalCtRate(profit, associated, r) {
  const n = Math.max(1, associated || 1);
  const lower = r.ctMarginalLower / n;
  const upper = r.ctMarginalUpper / n;
  if (profit <= lower) return r.ctSmallRate;
  if (profit >= upper) return r.ctMainRate;
  return r.ctMainRate + ctReliefFraction(r); // = 26.5% with default rates
}

/* Income tax + employee NIC arising on one person's salary and dividend share,
 * computed at the margin on top of their other (non-employment) income.
 * Returns the gross extracted, the taxes, and the net received. */
function personExtraction(person, salary, dividends, r) {
  const other = Math.max(0, person.otherIncome || 0);
  salary = Math.max(0, salary || 0);
  dividends = Math.max(0, dividends || 0);

  const base = _computeTax(other, 0, r).total;
  const withSalary = _computeTax(other + salary, 0, r).total;
  const withSalaryDiv = _computeTax(other + salary, dividends, r).total;

  const incomeTaxOnSalary = withSalary - base;
  const dividendTax = withSalaryDiv - withSalary;
  const eNIC = employeeNIC(salary, r);

  return {
    name: person.name,
    salary,
    dividends,
    incomeTaxOnSalary,
    dividendTax,
    employeeNIC: eNIC,
    netSalary: salary - incomeTaxOnSalary - eNIC,
    netDividends: dividends - dividendTax,
    net: salary + dividends - incomeTaxOnSalary - dividendTax - eNIC,
  };
}

/* Marginal dividend tax rate for a person who already has `nonDiv` of
 * non-dividend taxable income and `current` dividends, for a small probe. */
function marginalDividendRate(nonDiv, current, probe, r) {
  const before = _computeTax(nonDiv, current, r).total;
  const after = _computeTax(nonDiv, current + probe, r).total;
  return (after - before) / probe;
}

/* Split a dividend pool across shareholders.
 *   mode "percent"  — by each shareholder's share %.
 *   mode "optimise" — greedily allocate each slice to whoever faces the lowest
 *                     marginal dividend tax, which minimises the total tax
 *                     (this is the spouse / alphabet-share planning point).
 * `salaries` is the salary already allocated to each person (parallel array).
 * Returns an array of dividend amounts, parallel to `people`.
 */
function splitDividends(total, people, salaries, r, mode) {
  const alloc = people.map(() => 0);
  total = Math.max(0, total || 0);
  if (total === 0) return alloc;

  const holders = people
    .map((p, i) => ({ i, p }))
    .filter((x) => x.p.isShareholder);
  if (holders.length === 0) return alloc;

  if (mode === "percent") {
    const sum = holders.reduce((t, x) => t + (x.p.sharePct || 0), 0);
    holders.forEach((x) => {
      alloc[x.i] = sum > 0 ? total * ((x.p.sharePct || 0) / sum) : total / holders.length;
    });
    return alloc;
  }

  // Optimise: incremental greedy. Coarser step for big pools keeps it fast.
  const step = Math.max(25, Math.round(total / 1500));
  let remaining = total;
  const nonDiv = people.map((p, i) => Math.max(0, p.otherIncome || 0) + (salaries[i] || 0));
  while (remaining > 0.5) {
    const inc = Math.min(step, remaining);
    let bestIdx = holders[0].i;
    let bestRate = Infinity;
    holders.forEach((x) => {
      const rate = marginalDividendRate(nonDiv[x.i], alloc[x.i], inc, r);
      if (rate < bestRate - 1e-9) { bestRate = rate; bestIdx = x.i; }
    });
    alloc[bestIdx] += inc;
    remaining -= inc;
  }
  return alloc;
}

/* Run the full company position for a given salary per employee and a dividend
 * pool derived from the profit left after salaries, employer NIC and pension.
 *
 * plan = {
 *   availableProfit,        // company profit before any salaries / pension
 *   associated,             // number of associated companies (CT limits divided)
 *   employmentAllowance,    // boolean — can the company claim it?
 *   dividendSplit,          // "optimise" | "percent"
 *   people: [ { name, otherIncome, isEmployee, isShareholder, sharePct, pension } ]
 * }
 * salaryPerEmployee — the salary paid to each employee (same figure for all).
 *
 * Returns a detailed result for display / comparison.
 */
function runRemuneration(plan, salaryPerEmployee, r) {
  const people = plan.people || [];
  const associated = plan.associated || 1;

  const salaries = people.map((p) => (p.isEmployee ? Math.max(0, salaryPerEmployee || 0) : 0));
  const pensions = people.map((p) => Math.max(0, p.pension || 0));

  const totalSalary = salaries.reduce((t, s) => t + s, 0);
  const totalPension = pensions.reduce((t, s) => t + s, 0);

  let employerNICgross = salaries.reduce((t, s) => t + employerNIC(s, r), 0);
  const eaClaim = plan.employmentAllowance ? Math.min(employerNICgross, r.employmentAllowance) : 0;
  const employerNICnet = employerNICgross - eaClaim;

  // Profit chargeable to corporation tax, after deductible salary/NIC/pension.
  const profitBeforeCT = Math.max(0, plan.availableProfit - totalSalary - employerNICnet - totalPension);
  const ct = corporationTax(profitBeforeCT, associated, r);
  const distributable = Math.max(0, profitBeforeCT - ct);

  const dividendAlloc = splitDividends(distributable, people, salaries, r, plan.dividendSplit || "optimise");

  const perPerson = people.map((p, i) => {
    const ex = personExtraction(p, salaries[i], dividendAlloc[i], r);
    ex.pension = pensions[i];
    ex.totalValue = ex.net + pensions[i]; // cash in pocket + into pension
    return ex;
  });

  const totals = {
    salary: totalSalary,
    employerNICgross,
    employmentAllowanceClaimed: eaClaim,
    employerNIC: employerNICnet,
    pension: totalPension,
    profitBeforeCT,
    corporationTax: ct,
    distributable,
    dividends: dividendAlloc.reduce((t, d) => t + d, 0),
    incomeTax: perPerson.reduce((t, x) => t + x.incomeTaxOnSalary, 0),
    dividendTax: perPerson.reduce((t, x) => t + x.dividendTax, 0),
    employeeNIC: perPerson.reduce((t, x) => t + x.employeeNIC, 0),
    netToPockets: perPerson.reduce((t, x) => t + x.net, 0),
  };
  // Value delivered (pockets + pension) vs profit consumed (the whole available profit).
  totals.valueDelivered = totals.netToPockets + totalPension;
  totals.profitConsumed = plan.availableProfit;
  totals.totalTax = ct + totals.incomeTax + totals.dividendTax + totals.employeeNIC + employerNICnet;
  totals.effectiveRate = plan.availableProfit > 0 ? totals.totalTax / plan.availableProfit : 0;

  return { salaryPerEmployee: Math.max(0, salaryPerEmployee || 0), marginalCtRate: marginalCtRate(profitBeforeCT, associated, r), perPerson, totals };
}

/* Find the salary per employee that maximises total value delivered (pockets +
 * pension) for the given available profit, by sweeping a sensible range.
 * Returns { best, salary, candidates } where candidates are a few named points
 * for transparency. A coarse sweep is used; the winner is recomputed exactly.
 */
function optimiseRemuneration(plan, r) {
  const employees = (plan.people || []).filter((p) => p.isEmployee).length;
  const cap = employees > 0
    ? Math.min(r.niUpperEarnings, Math.floor(plan.availableProfit / employees))
    : 0;

  let best = runRemuneration(plan, 0, r);
  if (employees > 0 && cap > 0) {
    const stepN = 120;
    const step = Math.max(100, Math.round(cap / stepN));
    for (let s = step; s <= cap; s += step) {
      const res = runRemuneration(plan, s, r);
      if (res.totals.valueDelivered > best.totals.valueDelivered + 0.5) best = res;
    }
    // refine around the winner at £50 resolution
    const lo = Math.max(0, best.salaryPerEmployee - step);
    const hi = Math.min(cap, best.salaryPerEmployee + step);
    for (let s = lo; s <= hi; s += 50) {
      const res = runRemuneration(plan, s, r);
      if (res.totals.valueDelivered > best.totals.valueDelivered + 0.5) best = res;
    }
  }

  // Named comparison points (only those within range)
  const named = [
    { label: "No salary", salary: 0 },
    { label: "Employer NIC threshold", salary: r.niSecondaryThreshold },
    { label: "Personal allowance", salary: r.personalAllowance },
  ].filter((c) => employees === 0 ? c.salary === 0 : c.salary <= (cap || 0) + 0.5);

  const candidates = named.map((c) => ({ label: c.label, salary: c.salary, result: runRemuneration(plan, c.salary, r) }));

  return { best, salary: best.salaryPerEmployee, candidates };
}

/* ---------------------------------------------------------------------------
 * Use of home — the director charges the company rent under a licence.
 *
 * The rent is deductible for the company (corporation-tax relief) and is taxed
 * on the director as PROPERTY income — but only on the profit, after an
 * apportioned share of household running costs. Setting the rent close to those
 * allowable costs extracts cash at little or no personal tax while the company
 * still saves corporation tax. (A market rent under a licence; keep the use
 * non-exclusive to preserve Private Residence Relief — see the UI notes.)
 *
 * input = { rent, allowableCosts, otherIncome, companyProfit, associated }
 *   allowableCosts — business-use share of household running costs (offsets rent)
 *   otherIncome    — director's other taxable (non-dividend) income, to find the
 *                    marginal income-tax rate on the rental profit
 *   companyProfit  — company taxable profit, to find the marginal CT rate
 * ------------------------------------------------------------------------- */
function useOfHomeRent(input, r) {
  const rent = Math.max(0, input.rent || 0);
  const costs = Math.max(0, input.allowableCosts || 0);
  const other = Math.max(0, input.otherIncome || 0);
  const rentalProfit = Math.max(0, rent - costs);

  const base = _computeTax(other, 0, r).total;
  const withProfit = _computeTax(other + rentalProfit, 0, r).total;
  const incomeTax = withProfit - base;

  const ctRate = marginalCtRate(input.companyProfit || 0, input.associated || 1, r);
  const ctRelief = rent * ctRate;

  return {
    rent,
    allowableCosts: costs,
    rentalProfit,
    incomeTax,
    marginalIncomeRate: rentalProfit > 0 ? incomeTax / rentalProfit : 0,
    ctRate,
    ctRelief,
    netToDirector: rent - incomeTax,        // cash received, less personal tax on the profit
    netCostToCompany: rent - ctRelief,      // rent net of corporation-tax relief
    effectiveRate: rent > 0 ? incomeTax / rent : 0, // personal tax as a % of the rent
  };
}

/* ---------------------------------------------------------------------------
 * Employing your children (13+). A commercial wage for genuine work is
 * deductible for the company, and the child has their own personal allowance,
 * so wages up to the PA are income-tax-free. Under-21s also have a nil employer
 * NIC band up to the Upper Secondary Threshold, so employer NIC is typically nil
 * on a modest wage. The wage must be commercially justifiable for actual work
 * done (wholly & exclusively — see the UI notes / case law).
 *
 * input = { children, wagePerChild, childOtherIncome, companyProfit, associated }
 * ------------------------------------------------------------------------- */
function childEmployment(input, r) {
  const wage = Math.max(0, input.wagePerChild || 0);
  const count = Math.max(0, Math.floor(input.children || 0));
  const childOther = Math.max(0, input.childOtherIncome || 0);
  const ctRate = marginalCtRate(input.companyProfit || 0, input.associated || 1, r);

  const itPerChild = _computeTax(childOther + wage, 0, r).total - _computeTax(childOther, 0, r).total;
  const employerNic = 0; // under-21: nil employer NIC up to the upper secondary threshold

  const totalWages = wage * count;
  const totalIncomeTax = itPerChild * count;
  const ctRelief = (totalWages + employerNic) * ctRate;

  return {
    wage, count, totalWages,
    itPerChild, totalIncomeTax, employerNic,
    ctRate, ctRelief,
    netToChildren: totalWages - totalIncomeTax,
    netCostToCompany: totalWages + employerNic - ctRelief,
    effectiveRate: totalWages > 0 ? totalIncomeTax / totalWages : 0,
  };
}

/* ---------------------------------------------------------------------------
 * Relevant Life Plan (tax-deductible life cover). The company pays the premium
 * on a single-life death-in-service policy written into trust: premiums are
 * generally corporation-tax deductible, with no benefit-in-kind, no NIC and the
 * payout normally free of income tax and outside the estate for IHT. Compared
 * with funding the same cover from the director's own (post-tax) income.
 *
 * input = { premium, directorOtherIncome, companyProfit, associated }
 * ------------------------------------------------------------------------- */
function relevantLifePlan(input, r) {
  const premium = Math.max(0, input.premium || 0);
  const other = Math.max(0, input.directorOtherIncome || 0);
  const ctRate = marginalCtRate(input.companyProfit || 0, input.associated || 1, r);

  // Marginal personal rate on extra income drawn as a dividend to fund cover.
  const probe = 2000;
  const divRate = (_computeTax(other, probe, r).total - _computeTax(other, 0, r).total) / probe;

  // Company (RLP) route: premium is deductible, so it consumes its face value of
  // pre-tax profit; net cost after CT relief is premium × (1 − CT).
  const profitRLP = premium;
  const companyNetCost = premium * (1 - ctRate);

  // Personal route: to net £premium the director draws a dividend grossed up for
  // dividend tax, which itself needs pre-tax profit grossed up for corporation tax.
  const grossDividendNeeded = divRate < 1 ? premium / (1 - divRate) : premium;
  const profitPersonal = ctRate < 1 ? grossDividendNeeded / (1 - ctRate) : grossDividendNeeded;

  return {
    premium, ctRate, divRate,
    profitRLP, companyNetCost,
    grossDividendNeeded, profitPersonal,
    saving: profitPersonal - profitRLP,
    savingPct: profitPersonal > 0 ? (profitPersonal - profitRLP) / profitPersonal : 0,
  };
}

/* ---------------------------------------------------------------------------
 * Electric company car. A pure EV has a very low taxable benefit (list price ×
 * a small appropriate percentage), so providing it through the company is far
 * cheaper than funding an equivalent car from taxed income. A new EV also
 * usually attracts a 100% first-year capital allowance.
 *
 * input = { listPrice, bikPercent, directorOtherIncome, companyProfit,
 *           associated, carCost, purchased, petrolBikPercent }
 * ------------------------------------------------------------------------- */
function evCompanyCar(input, r) {
  const listPrice = Math.max(0, input.listPrice || 0);
  const bikPct = Math.max(0, input.bikPercent || 0);
  const other = Math.max(0, input.directorOtherIncome || 0);
  const ctRate = marginalCtRate(input.companyProfit || 0, input.associated || 1, r);
  const carCost = input.carCost != null ? Math.max(0, input.carCost) : listPrice;
  const purchased = input.purchased !== false;
  const petrolPct = Math.max(0, input.petrolBikPercent || 0);

  const probe = 2000;
  const marginalRate = (_computeTax(other + probe, 0, r).total - _computeTax(other, 0, r).total) / probe;

  const benefit = listPrice * bikPct;
  const employeeTax = benefit * marginalRate;
  const class1A = benefit * r.class1ARate;
  const class1ANet = class1A * (1 - ctRate);
  const annualTaxCost = employeeTax + class1ANet;
  const fyaRelief = purchased ? carCost * ctRate : 0;

  const petrolBenefit = listPrice * petrolPct;
  const petrolEmployeeTax = petrolBenefit * marginalRate;
  const petrolClass1ANet = petrolBenefit * r.class1ARate * (1 - ctRate);
  const petrolAnnualTaxCost = petrolEmployeeTax + petrolClass1ANet;

  return {
    listPrice, bikPct, benefit, marginalRate, ctRate,
    employeeTax, class1A, class1ANet, annualTaxCost,
    fyaRelief, purchased, carCost,
    petrolPct, petrolBenefit, petrolAnnualTaxCost,
    savingVsPetrol: petrolAnnualTaxCost - annualTaxCost,
  };
}

/* ---------------------------------------------------------------------------
 * Pension annual allowance: the standard allowance, the tapered allowance for
 * high earners, and carry-forward of unused allowance from the previous 3 years.
 *
 * input = { adjustedIncome, thresholdIncome, contribution, carryForward,
 *           companyProfit, associated, employerContribution }
 * ------------------------------------------------------------------------- */
function pensionAllowance(input, r) {
  const adjusted = Math.max(0, input.adjustedIncome || 0);
  const threshold = Math.max(0, input.thresholdIncome || 0);
  const contribution = Math.max(0, input.contribution || 0);
  const carry = Math.max(0, input.carryForward || 0);

  let tapered = r.pensionAnnualAllowance;
  if (threshold > r.pensionThresholdIncome && adjusted > r.pensionTaperThreshold) {
    const reduction = Math.floor((adjusted - r.pensionTaperThreshold) / 2);
    tapered = Math.max(r.pensionMinAllowance, r.pensionAnnualAllowance - reduction);
  }

  const available = tapered + carry;
  const within = Math.min(contribution, available);
  const excess = Math.max(0, contribution - available);

  const ctRate = marginalCtRate(input.companyProfit || 0, input.associated || 1, r);
  const ctRelief = input.employerContribution !== false ? contribution * ctRate : 0;

  // Annual allowance charge on any excess, at the marginal income-tax rate.
  const probe = 2000;
  const marginalRate = (_computeTax(adjusted + probe, 0, r).total - _computeTax(adjusted, 0, r).total) / probe;
  const aaCharge = excess * marginalRate;

  return {
    standardAA: r.pensionAnnualAllowance, tapered, carryForward: carry,
    available, contribution, within, excess,
    ctRate, ctRelief, marginalRate, aaCharge,
    headroom: available - contribution,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    employeeNIC, employerNIC, corporationTax, marginalCtRate, ctReliefFraction,
    personExtraction, splitDividends, runRemuneration, optimiseRemuneration,
    useOfHomeRent, childEmployment, relevantLifePlan, evCompanyCar, pensionAllowance,
  };
}
