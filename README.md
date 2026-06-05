# Dividend & Director's Loan (S455) Planner

A self-contained, zero-dependency web tool for modelling and comparing the tax
cost of funding a client withdrawal through a **director's loan** (with **S455**
and **benefit-in-kind** exposure) versus **declaring dividends** — including the
higher / additional rate bands, the personal allowance taper, and the knock-on
tax when dividends are themselves taken to fund a tax bill.

Built to sit in front of a client and run scenarios live.

> **Planning aid, not tax advice.** Every figure is an estimate to support a
> conversation. All rates are editable and default to **2026/27** — verify
> against current HMRC guidance before relying on them.

## Running it

It's a **local HTML app** — no server, no database, no dependencies. Either:

- **Open `index.html`** directly in any browser, or
- Run `node build.js` to produce **`dist/index.html`**, a single self-contained file
  (CSS + JS inlined) you can email, drop on a shared drive, or open from a USB stick.

Your assumptions and scenarios are saved automatically in your own browser
(localStorage) — nothing leaves the machine. Use **Print / Save PDF** to produce a
hand-out for the client.

## What it models

| Item | Basis | Default (2026/27) |
|---|---|---|
| **S455** (loans to participators) | % of loan outstanding 9 months + 1 day after the company year end; refunded under s458 once repaid | **35.75%** |
| **Benefit in kind** on a beneficial loan | Average balance × official rate of interest, taxed as employment income; applies if the loan exceeds £10,000 at any point | official rate **3.75%** |
| **Employer Class 1A NIC** on the BIK | % of the cash equivalent | **15%** |
| **Dividend tax** | Ordinary / upper / additional rates on top of other income, after the £500 allowance | **10.75% / 35.75% / 39.35%** |
| **Personal allowance taper** | £1 lost for every £2 of adjusted net income over £100,000 | PA **£12,570**, gone by £125,140 |
| **CGT** (on a property disposal) | Residential gain after the annual exempt amount; basic-band part at the lower rate, rest at the higher rate; Private Residence Relief toggle for the main home | AEA **£3,000**, rates **18% / 24%** |
| **SDLT** (on a purchase) | Progressive bands, optional additional-dwelling and non-resident surcharges; only applies to property in England/NI | surcharge **5%**, non-resident **2%** |

Each scenario has an optional **Property transaction taxes** section: enter a purchase
(SDLT) and/or a disposal (CGT). These one-off taxes are shown separately from the
income-tax planning and rolled into a **total non-refundable cost** line.

### Permanent cost vs timing cost

The tool deliberately separates two very different things:

- **Permanent tax cost** — dividend tax + income tax on the loan BIK + employer
  Class 1A NIC. This money never comes back.
- **S455** — a refundable charge. It is real cash locked up with HMRC, but it
  comes back (under s458) once the loan is repaid. Shown separately as a
  cash-flow / timing cost, with both the *peak* locked up and any amount *still
  outstanding* at the end of the plan.

## Worked example — £1m Spanish property (additional-rate client)

Client already earns £150,000 (so all dividends are taxed at **39.35%** and the
personal allowance is already fully lost). He borrows ~£1m from his company to
buy a property in Spain and will repay within 4 years by selling his UK home.
Click **"Load worked example"** to populate these three scenarios:

| | A · Loan, repay from home sale | B · Loan, clear with £250k dividends/yr | C · Take £1m as dividends up front |
|---|--:|--:|--:|
| Dividend tax | £0 | ~£393k | ~£393k |
| BIK income tax + Class 1A (4 yrs) | ~£67.5k | ~£33k | £0 |
| **Permanent tax cost** | **~£67.5k** | **~£426k** | **~£393k** |
| Peak S455 (cash locked up) | £357.5k | £268k | £0 |

In all three the property-tax section is pre-set to show **£0 SDLT** (the Spanish
purchase is outside SDLT) and **£0 CGT** (the UK home is the main residence, covered
by Private Residence Relief) — a useful reassurance point for the client. Untick
those toggles, or change the figures, to model a UK buy-to-let or a non-PRR disposal.

**The planning point this surfaces:** for an additional-rate taxpayer there is
*no rate saving* from spreading dividends — they are all at 39.35% whether taken
in one year or four. So declaring dividends purely to "bring down the S455"
(scenario B) is the **most expensive** route: it crystallises the same ~£393k of
dividend tax as taking it up front, **plus** the BIK cost of carrying the loan.
If the loan can instead be cleared from the house sale (scenario A), the S455 is
fully refunded and the only permanent cost is the BIK on the loan while it is
outstanding. The trade-off is the ~£357.5k of S455 cash tied up with HMRC until
the loan is repaid.

(The dividend-spreading lever *does* matter for clients who are **not** already
additional-rate, where extra dividends would tip them into a higher band or erode
the personal allowance — the model handles those cases too.)

## HMRC guidance & legislation

All of the following are linked inside the app (Guidance panel):

**S455 — loans to participators**
- [GOV.UK — Director's loans](https://www.gov.uk/directors-loans) ·
  [you owe your company money](https://www.gov.uk/directors-loans/you-owe-your-company-money)
- [HMRC CTM61505](https://www.gov.uk/hmrc-internal-manuals/company-taxation-manual/ctm61505) ·
  [CTM61600 (relief on repayment)](https://www.gov.uk/hmrc-internal-manuals/company-taxation-manual/ctm61600)
- Legislation: [s455 CTA 2010](https://www.legislation.gov.uk/ukpga/2010/4/section/455) ·
  [s458 CTA 2010](https://www.legislation.gov.uk/ukpga/2010/4/section/458)

**Benefit in kind — beneficial loans**
- [GOV.UK — Loans to employees](https://www.gov.uk/expenses-and-benefits-loans-provided-to-employees) ·
  [£10,000 exemption](https://www.gov.uk/expenses-and-benefits-loans-provided-to-employees/whats-exempt)
- [GOV.UK — Official rate of interest](https://www.gov.uk/government/publications/rates-and-allowances-beneficial-loan-arrangements-hmrc-official-rates/beneficial-loan-arrangements-hmrc-official-rates)
- [HMRC EIM26101](https://www.gov.uk/hmrc-internal-manuals/employment-income-manual/eim26101) ·
  [Booklet 480](https://www.gov.uk/guidance/480-expenses-and-benefits-a-tax-guide)
- Legislation: [s175 ITEPA 2003](https://www.legislation.gov.uk/ukpga/2003/1/section/175)

**Dividends, personal allowance & Class 1A NIC**
- [GOV.UK — Tax on dividends](https://www.gov.uk/tax-on-dividends) ·
  [HMRC SAIM5040](https://www.gov.uk/hmrc-internal-manuals/savings-and-investment-manual/saim5040)
- [GOV.UK — Personal allowance over £100k](https://www.gov.uk/income-tax-rates/income-over-100000)
- [GOV.UK — CWG5: Class 1A NIC](https://www.gov.uk/government/publications/cwg5-class-1a-national-insurance-contributions-on-benefits-in-kind)

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure and the guidance/legislation links |
| `engine.js` | Pure tax-calculation engine (dividends, S455, BIK, CGT, SDLT) — also runnable in Node |
| `app.js` | UI: state, rendering, scenario editing, comparison table and chart |
| `styles.css` | Styling, including a print stylesheet for client hand-outs |
| `build.js` | Inlines the above into a single shareable `dist/index.html` |

The engine is dependency-free and unit-testable in Node:

```js
const E = require('./engine.js');
const r = E.defaultRates();
console.log(E.runScenario({ name:'demo', otherIncome:150000, openingLoan:0,
  years:[{drawdown:1000000,dividends:0,externalRepayment:0},{},{},{externalRepayment:1000000}] }, r));
```

## Assumptions & caveats

- The official rate of interest is now **reviewed quarterly**; the BIK figure
  uses a single annual rate, so enter the rate (or an average) applicable to the
  period. The 3.75% default is the rate from 6 April 2025 — check GOV.UK for the
  current quarter.
- BIK uses the **average balance** method, not the (optional) precise daily
  method. For loans with large mid-year movements the precise method may differ.
- S455 is modelled on the closing balance each year, assuming the planning year
  aligns with the company's accounting period; the 9-month-and-a-day payment and
  the timing of s458 refunds are not cash-flow dated to the day.
- Adjusted net income for the PA taper is simplified to salary + dividends
  (no pension/Gift Aid relief netted off — add those to "other income" manually
  if relevant).
- SDLT/CGT are modelled at a headline level (standard residential SDLT bands; CGT
  at the residential rates after the annual exempt amount). They do **not** cover
  multiple-dwellings relief, mixed-use rates, non-resident CGT nuances, or partial
  PRR/lettings-relief computations beyond the single "taxable fraction" input.
- The model does not cover Spanish purchase taxes (ITP/IVA), nor the Transactions in
  Securities / settlements anti-avoidance rules — flag these separately with the client.
