/*
 * Tests for the asset-disposal CGT engine (computeCGT) and its asset types.
 * Run with:  node test/cgt.test.js
 */
const { defaultRates, computeCGT } = require("../engine.js");

let passed = 0;
function approx(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > (tol || 0.5)) {
    throw new Error(`FAIL: ${msg}\n  expected ~${expected}, got ${actual}`);
  }
  passed++;
}
function ok(cond, msg) { if (!cond) throw new Error(`FAIL: ${msg}`); passed++; }

const r = defaultRates();
const HI = 200000; // income high enough that all gains fall in the higher band

/* House sale — main residence fully covered by PRR: no CGT. */
const home = computeCGT({ type: "residential", proceeds: 1000000, cost: 400000, expenses: 0, mainResidence: true, taxableFraction: 0 }, HI, r);
approx(home.cgt, 0, 0.5, "main-residence house sale: PRR gives nil CGT");

/* House sale — second home (no PRR), higher-rate: 24% on gain less AEA. */
const second = computeCGT({ type: "residential", proceeds: 500000, cost: 300000, expenses: 0, mainResidence: false }, HI, r);
approx(second.cgt, (200000 - r.cgtAnnualExempt) * r.cgtResidentialHigher, 1, "second home taxed at residential higher rate (24%)");

/* Business sale within the BADR lifetime limit: gain at the BADR rate. */
const biz = computeCGT({ type: "business", proceeds: 800000, cost: 0, expenses: 0 }, HI, r);
approx(biz.cgt, (800000 - r.cgtAnnualExempt) * r.badrRate, 1, "business sale within limit taxed at BADR rate");

/* Business sale above the lifetime limit: BADR on the first £1m, excess at the main rate. */
const bizBig = computeCGT({ type: "business", proceeds: 1500000, cost: 0, expenses: 0 }, HI, r);
const tg = 1500000 - r.cgtAnnualExempt;
const expectedBig = r.badrLifetimeLimit * r.badrRate + (tg - r.badrLifetimeLimit) * r.cgtNonResHigher;
approx(bizBig.cgt, expectedBig, 1, "business gain above lifetime limit: BADR + main rate on excess");

/* Inheritance: no CGT (death uplift); IHT estimated only when requested. */
const inh = computeCGT({ type: "inheritance", proceeds: 1000000, cost: 200000 }, HI, r);
approx(inh.cgt, 0, 0.5, "inheritance: no CGT in lifetime (death uplift)");
approx(inh.iht, 0, 0.5, "inheritance: no IHT figure unless estimate requested");
const inhIHT = computeCGT({ type: "inheritance", proceeds: 1000000, estimateIHT: true }, HI, r);
approx(inhIHT.iht, (1000000 - r.ihtNilRateBand) * r.ihtRate, 1, "inheritance: IHT estimated above the nil-rate band");

/* Other chargeable asset: main CGT rates, no relief. */
const other = computeCGT({ type: "other", proceeds: 100000, cost: 20000 }, HI, r);
approx(other.cgt, (80000 - r.cgtAnnualExempt) * r.cgtNonResHigher, 1, "other asset taxed at the main higher rate");

/* Default (no type) still behaves as residential, preserving existing scenarios. */
const legacy = computeCGT({ proceeds: 500000, cost: 300000, mainResidence: true, taxableFraction: 0 }, HI, r);
approx(legacy.cgt, 0, 0.5, "untyped disposal defaults to residential (back-compatible)");

console.log(`\n✓ All ${passed} CGT assertions passed.`);
