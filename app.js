/* global defaultRates, runScenario */
/*
 * UI layer for the Dividend / S455 planner.
 * State is kept in a single `state` object, persisted to localStorage, and the
 * whole view re-renders on change. No frameworks — just the DOM.
 */

const STORAGE_KEY = "dla-s455-planner-v1";

// Live home of this tool — included in the client email so they can open it.
const TOOL_URL = "https://matthewmcconnellpulse.github.io/DLA-S455-Planner/";

/* ---- Planning menu (jump links) ------------------------------------------ */
const MENU = [
  { id: "remun-panel", label: "Remuneration optimiser" },
  { id: "homerent-panel", label: "Use of home" },
  { id: "childemp-panel", label: "Employ children" },
  { id: "rlp-panel", label: "Relevant Life Plan" },
  { id: "dla-panel", label: "Director's loan (S455)" },
  { id: "compare-panel", label: "Comparison" },
  { id: "assumptions", label: "Assumptions & rates" },
  { id: "guidance-panel", label: "HMRC guidance" },
];

/* ---- Planning checklist (tickable options) ------------------------------- */
const CHECKLIST = [
  { key: "salary", label: "Optimal salary / dividend mix", target: "remun-panel" },
  { key: "pension", label: "Employer pension contributions", target: "remun-panel" },
  { key: "split", label: "Split dividends with spouse / family", target: "remun-panel" },
  { key: "useofhome", label: "Use of home (rent to company)", target: "homerent-panel" },
  { key: "children", label: "Employ children (13+)", target: "childemp-panel" },
  { key: "rlp", label: "Relevant Life Plan (life cover)", target: "rlp-panel" },
  { key: "dla", label: "Director's loan & S455 timing", target: "dla-panel" },
  { key: "assetcgt", label: "Time asset sale for CGT (PRR / BADR)", target: "dla-panel" },
  { key: "iht", label: "Inheritance / death uplift & IHT", target: "dla-panel" },
];
function defaultChecklist() {
  const o = {};
  CHECKLIST.forEach((it) => { o[it.key] = { done: false, status: "Relevant", note: "" }; });
  return o;
}

/* ---- Rate metadata: drives the editable Assumptions panel ---------------- */
const RATE_FIELDS = [
  { key: "taxYearLabel", label: "Tax year", type: "text", group: "General" },
  { key: "personalAllowance", label: "Personal allowance", type: "money", group: "Income tax" },
  { key: "paTaperThreshold", label: "PA taper threshold", type: "money", group: "Income tax", hint: "lose £1 per £2 above" },
  { key: "basicBandWidth", label: "Basic rate band width", type: "money", group: "Income tax" },
  { key: "additionalThreshold", label: "Additional rate threshold", type: "money", group: "Income tax" },
  { key: "incomeBasic", label: "Income tax — basic", type: "pct", group: "Income tax" },
  { key: "incomeHigher", label: "Income tax — higher", type: "pct", group: "Income tax" },
  { key: "incomeAdditional", label: "Income tax — additional", type: "pct", group: "Income tax" },
  { key: "dividendAllowance", label: "Dividend allowance", type: "money", group: "Dividends" },
  { key: "divOrdinary", label: "Dividend — ordinary", type: "pct", group: "Dividends" },
  { key: "divUpper", label: "Dividend — upper", type: "pct", group: "Dividends" },
  { key: "divAdditional", label: "Dividend — additional", type: "pct", group: "Dividends" },
  { key: "s455Rate", label: "S455 rate", type: "pct", group: "Loan / S455 / BIK" },
  { key: "officialRate", label: "Official rate of interest", type: "pct", group: "Loan / S455 / BIK", hint: "BIK — reviewed quarterly" },
  { key: "bikThreshold", label: "BIK exemption threshold", type: "money", group: "Loan / S455 / BIK" },
  { key: "class1ARate", label: "Class 1A NIC rate", type: "pct", group: "Loan / S455 / BIK" },
  { key: "cgtAnnualExempt", label: "CGT annual exempt amount", type: "money", group: "CGT / SDLT" },
  { key: "cgtResidentialBasic", label: "CGT residential — basic", type: "pct", group: "CGT / SDLT" },
  { key: "cgtResidentialHigher", label: "CGT residential — higher", type: "pct", group: "CGT / SDLT" },
  { key: "sdltSurcharge", label: "SDLT additional-dwelling surcharge", type: "pct", group: "CGT / SDLT" },
  { key: "sdltNonResident", label: "SDLT non-resident surcharge", type: "pct", group: "CGT / SDLT" },
  { key: "cgtNonResBasic", label: "CGT non-residential — basic", type: "pct", group: "CGT / SDLT" },
  { key: "cgtNonResHigher", label: "CGT non-residential — higher", type: "pct", group: "CGT / SDLT" },
  { key: "badrRate", label: "BADR rate", type: "pct", group: "CGT / SDLT", hint: "business asset disposal relief" },
  { key: "badrLifetimeLimit", label: "BADR lifetime limit", type: "money", group: "CGT / SDLT" },
  { key: "ihtRate", label: "Inheritance tax rate", type: "pct", group: "CGT / SDLT" },
  { key: "ihtNilRateBand", label: "IHT nil-rate band", type: "money", group: "CGT / SDLT" },
  { key: "niPrimaryThreshold", label: "NIC primary threshold", type: "money", group: "NIC", hint: "employee" },
  { key: "niUpperEarnings", label: "Upper earnings limit", type: "money", group: "NIC" },
  { key: "niEmployeeMain", label: "Employee NIC — main", type: "pct", group: "NIC" },
  { key: "niEmployeeUpper", label: "Employee NIC — above UEL", type: "pct", group: "NIC" },
  { key: "niSecondaryThreshold", label: "NIC secondary threshold", type: "money", group: "NIC", hint: "employer" },
  { key: "niEmployerRate", label: "Employer NIC rate", type: "pct", group: "NIC" },
  { key: "employmentAllowance", label: "Employment Allowance", type: "money", group: "NIC" },
  { key: "ctSmallRate", label: "CT small-profits rate", type: "pct", group: "Corporation tax" },
  { key: "ctMainRate", label: "CT main rate", type: "pct", group: "Corporation tax" },
  { key: "ctMarginalLower", label: "CT lower limit", type: "money", group: "Corporation tax" },
  { key: "ctMarginalUpper", label: "CT upper limit", type: "money", group: "Corporation tax" },
];

/* ---- Worked example: the Spanish-property client ------------------------- */
function exampleScenarios() {
  const blankYear = () => ({ drawdown: 0, dividends: 0, externalRepayment: 0 });
  // Spanish property purchase: outside SDLT (not England/NI). UK home sale: main
  // residence, so fully covered by Private Residence Relief (taxable fraction 0).
  const spanishPurchase = () => ({ year: 1, price: 1000000, applies: false, additionalProperty: true, nonResident: false });
  const homeDisposal = () => ({ year: 4, proceeds: 1000000, cost: 1000000, expenses: 0, mainResidence: true, taxableFraction: 0 });
  return [
    {
      name: "A · Loan, repay from UK home sale (no extra dividends)",
      note: "Borrow £1m, pay S455 + BIK, repay in full from the house sale in year 4. S455 is refunded.",
      otherIncome: 150000,
      openingLoan: 0,
      purchase: spanishPurchase(),
      disposal: homeDisposal(),
      years: [
        { drawdown: 1000000, dividends: 0, externalRepayment: 0 },
        blankYear(),
        blankYear(),
        { drawdown: 0, dividends: 0, externalRepayment: 1000000 },
      ],
    },
    {
      name: "B · Loan, clear with £250k dividends/yr",
      note: "Borrow £1m, declare £250k dividends each year to bring down the S455 balance.",
      otherIncome: 150000,
      openingLoan: 0,
      purchase: spanishPurchase(),
      disposal: homeDisposal(),
      years: [
        { drawdown: 1000000, dividends: 250000, externalRepayment: 0 },
        { drawdown: 0, dividends: 250000, externalRepayment: 0 },
        { drawdown: 0, dividends: 250000, externalRepayment: 0 },
        { drawdown: 0, dividends: 250000, externalRepayment: 0 },
      ],
    },
    {
      name: "C · Take £1m as dividends up front",
      note: "No loan. Declare the full £1m as a dividend in year 1 and fund the purchase directly.",
      otherIncome: 150000,
      openingLoan: 0,
      purchase: spanishPurchase(),
      disposal: homeDisposal(),
      years: [
        { drawdown: 0, dividends: 1000000, externalRepayment: 0 },
        blankYear(),
        blankYear(),
        blankYear(),
      ],
    },
  ];
}

function blankScenario() {
  return {
    name: "New scenario",
    note: "",
    otherIncome: 150000,
    openingLoan: 0,
    purchase: { year: 1, price: 0, applies: false, additionalProperty: true, nonResident: false },
    disposal: { year: 4, proceeds: 0, cost: 0, expenses: 0, mainResidence: true, taxableFraction: 0 },
    years: [
      { drawdown: 0, dividends: 0, externalRepayment: 0 },
      { drawdown: 0, dividends: 0, externalRepayment: 0 },
      { drawdown: 0, dividends: 0, externalRepayment: 0 },
      { drawdown: 0, dividends: 0, externalRepayment: 0 },
    ],
  };
}

/* ---- Remuneration optimiser defaults ------------------------------------- */
function defaultRemun() {
  return {
    availableProfit: 100000,
    associated: 1,
    employmentAllowance: false,
    dividendSplit: "optimise",   // "optimise" | "percent"
    salaryMode: "optimise",      // "optimise" | "manual"
    manualSalary: 12570,
    people: [
      { name: "Director", otherIncome: 0, isEmployee: true, isShareholder: true, sharePct: 50, pension: 0 },
      { name: "Spouse", otherIncome: 0, isEmployee: false, isShareholder: true, sharePct: 50, pension: 0 },
    ],
  };
}

/* ---- Use-of-home rent defaults ------------------------------------------- */
function defaultHomeRent() {
  return { rent: 6000, allowableCosts: 6000, otherIncome: 50000, companyProfit: 100000, associated: 1 };
}
function defaultChildEmp() {
  return { children: 2, wagePerChild: 12570, childOtherIncome: 0, companyProfit: 100000, associated: 1 };
}
function defaultRLP() {
  return { premium: 1200, directorOtherIncome: 120000, companyProfit: 100000, associated: 1 };
}

/* ---- State --------------------------------------------------------------- */
let state = loadState();

function normaliseScenario(scn) {
  if (!scn.purchase) scn.purchase = { year: 1, price: 0, applies: false, additionalProperty: true, nonResident: false };
  if (!scn.disposal) scn.disposal = { year: scn.years ? scn.years.length : 4, proceeds: 0, cost: 0, expenses: 0, mainResidence: true, taxableFraction: 0 };
  if (!scn.disposal.type) scn.disposal.type = "residential";
  if (scn.disposal.estimateIHT == null) scn.disposal.estimateIHT = false;
  return scn;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.rates && parsed.scenarios) {
        // Merge any new default rate keys (e.g. CGT/SDLT added in a later version)
        parsed.rates = Object.assign(defaultRates(), parsed.rates);
        parsed.scenarios.forEach(normaliseScenario);
        if (!parsed.emailMeta) parsed.emailMeta = { client: "", sender: "" };
        if (!parsed.remun) parsed.remun = defaultRemun();
        if (!parsed.homeRent) parsed.homeRent = defaultHomeRent();
        if (!parsed.childEmp) parsed.childEmp = defaultChildEmp();
        if (!parsed.rlp) parsed.rlp = defaultRLP();
        if (!parsed.karbon) parsed.karbon = { proxyUrl: "", passphrase: "" };
        parsed.checklist = Object.assign(defaultChecklist(), parsed.checklist || {});
        return parsed;
      }
    }
  } catch (e) { /* ignore */ }
  return { rates: defaultRates(), scenarios: exampleScenarios(), emailMeta: { client: "", sender: "" }, remun: defaultRemun(), homeRent: defaultHomeRent(), childEmp: defaultChildEmp(), rlp: defaultRLP(), karbon: { proxyUrl: "", passphrase: "" }, checklist: defaultChecklist() };
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* ---- Formatting ---------------------------------------------------------- */
const gbp = (n) => "£" + Math.round(n || 0).toLocaleString("en-GB");
const gbp0 = (n) => (n === 0 ? "—" : gbp(n));
const pct = (n) => (n * 100).toFixed(2).replace(/\.?0+$/, "") + "%";
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + gbp(Math.abs(n));

/* ---- Render: assumptions ------------------------------------------------- */
function renderRates() {
  document.getElementById("assumptions-year").textContent =
    "· defaults for " + state.rates.taxYearLabel;
  const grid = document.getElementById("rates-grid");
  grid.innerHTML = "";
  RATE_FIELDS.forEach((f) => {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const val = state.rates[f.key];
    const display = f.type === "pct" ? (val * 100) : val;
    const hint = f.hint ? ` <span class="hint">(${f.hint})</span>` : "";
    const suffix = f.type === "pct" ? "%" : f.type === "money" ? "£" : "";
    wrap.innerHTML = `
      <span class="lbl">${f.label}${hint}</span>
      <input type="${f.type === "text" ? "text" : "number"}"
             step="${f.type === "pct" ? "0.01" : "any"}"
             data-rate="${f.key}" data-rtype="${f.type}"
             value="${f.type === "text" ? val : display}" />`;
    grid.appendChild(wrap);
  });
  grid.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const key = e.target.dataset.rate;
      const rtype = e.target.dataset.rtype;
      if (rtype === "text") state.rates[key] = e.target.value;
      else if (rtype === "pct") state.rates[key] = (parseFloat(e.target.value) || 0) / 100;
      else state.rates[key] = parseFloat(e.target.value) || 0;
      saveState();
      renderScenarios();
      renderComparison();
      renderRemunResults();
      renderHomeRentResults();
      renderChildEmpResults();
      renderRLPResults();
      document.getElementById("assumptions-year").textContent =
        "· defaults for " + state.rates.taxYearLabel;
    });
  });
}

/* ---- Render: the "asset sold to repay the loan" block (CGT / IHT) -------- */
const ASSET_TYPES = [
  { key: "residential", label: "🏠 House sale" },
  { key: "business", label: "🏢 Business sale (BADR)" },
  { key: "inheritance", label: "🪦 Inheritance" },
  { key: "other", label: "📦 Other asset" },
];
const ASSET_HELP = {
  residential: "Selling the UK home: if it's been the main residence throughout, Private Residence Relief usually means no CGT — keep \"Main residence\" ticked with taxable fraction 0. For a rental or second home, untick it (or set the taxable fraction).",
  business: "Selling the business or its shares: a UK-resident individual may claim Business Asset Disposal Relief at the BADR rate on gains up to the lifetime limit, with any excess at the main CGT rates. (BADR is 18% for 2026/27 — it was 10% to Apr-25 and 14% to Apr-26; edit it in Assumptions.)",
  inheritance: "Asset kept until death: it is rebased to market value, so there's no CGT in lifetime. Inheritance tax may apply to the estate instead — tick \"Estimate IHT\" for a rough figure (value above the nil-rate band at 40%).",
  other: "Any other chargeable asset, with no relief: the gain is taxed at the main CGT rates after the annual exempt amount.",
};

function disposalBlock(d) {
  const type = d.type || "residential";
  const btns = ASSET_TYPES.map((a) =>
    `<button type="button" class="small ${type === a.key ? "primary" : ""}" data-asset="${a.key}">${a.label}</button>`
  ).join("");
  const proceedsLabel = type === "inheritance" ? "Asset value at death" : "Sale proceeds";

  let costFields = `
    <label class="field"><span class="lbl">Base cost</span><input type="number" data-dbind="cost" value="${d.cost}" /></label>
    <label class="field"><span class="lbl">Costs of sale</span><input type="number" data-dbind="expenses" value="${d.expenses}" /></label>`;
  if (type === "inheritance") costFields = ""; // no CGT computation, so cost/expenses are not used

  let extra = "";
  if (type === "residential") {
    extra = `
      <label class="field" style="align-self:end"><label style="font-weight:600;font-size:12.5px"><input type="checkbox" data-dbind="mainResidence" ${d.mainResidence ? "checked" : ""}/> Main residence (PRR)</label></label>
      <label class="field"><span class="lbl">Taxable fraction <span class="hint">(0–1, if not fully PRR)</span></span><input type="number" step="0.01" data-dbind="taxableFraction" value="${d.taxableFraction}" /></label>`;
  } else if (type === "inheritance") {
    extra = `<label class="field" style="align-self:end"><label style="font-weight:600;font-size:12.5px"><input type="checkbox" data-dbind="estimateIHT" ${d.estimateIHT ? "checked" : ""}/> Estimate IHT (40% above NRB)</label></label>`;
  }

  return `
    <div style="font-weight:600;margin:16px 0 8px">Asset sold to repay the loan</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${btns}</div>
    <p class="muted" style="margin:0 0 10px;font-size:12px">${ASSET_HELP[type]}</p>
    <div class="grid cols-4">
      <label class="field"><span class="lbl">${proceedsLabel}</span><input type="number" data-dbind="proceeds" value="${d.proceeds}" /></label>
      ${costFields}
      <label class="field"><span class="lbl">In which year</span><input type="number" data-dbind="year" value="${d.year}" /></label>
      ${extra}
    </div>`;
}

/* ---- Render: scenarios --------------------------------------------------- */
function renderScenarios() {
  const host = document.getElementById("scenarios");
  host.innerHTML = "";
  state.scenarios.forEach((scn, idx) => {
    host.appendChild(renderScenario(scn, idx));
  });
}

function renderScenario(scn, idx) {
  const r = state.rates;
  const result = runScenario(scn, r);
  const root = document.createElement("div");
  root.className = "scenario";

  /* header */
  const head = document.createElement("div");
  head.className = "sc-head";
  head.innerHTML = `
    <input class="sc-name" value="${escapeAttr(scn.name)}" data-bind="name" />
    <button class="small ghost" data-act="dup">Duplicate</button>
    <button class="small danger" data-act="del">Delete</button>`;
  root.appendChild(head);

  /* body */
  const body = document.createElement("div");
  body.className = "sc-body";

  body.innerHTML = `
    <div class="grid cols-3" style="margin-bottom:14px">
      <label class="field"><span class="lbl">Other annual income <span class="hint">(salary etc., before dividends)</span></span>
        <input type="number" data-bind="otherIncome" value="${scn.otherIncome}" /></label>
      <label class="field"><span class="lbl">Opening loan balance <span class="hint">(director owes company)</span></span>
        <input type="number" data-bind="openingLoan" value="${scn.openingLoan}" /></label>
      <label class="field"><span class="lbl">Note</span>
        <input type="text" data-bind="note" value="${escapeAttr(scn.note || "")}" /></label>
    </div>`;

  /* year input table */
  const yearTbl = document.createElement("div");
  yearTbl.className = "table-scroll";
  let yrows = scn.years.map((y, yi) => `
    <tr data-yi="${yi}">
      <td>Year ${yi + 1}</td>
      <td><input type="number" data-yfield="drawdown" value="${y.drawdown}" /></td>
      <td><input type="number" data-yfield="dividends" value="${y.dividends}" /></td>
      <td><input type="number" data-yfield="externalRepayment" value="${y.externalRepayment}" /></td>
      <td class="nowrap muted">${gbp(result.years[yi].closing)}</td>
      <td><button class="small ghost" data-act="delyear" data-yi="${yi}">✕</button></td>
    </tr>`).join("");
  yearTbl.innerHTML = `
    <table class="data">
      <thead><tr>
        <th>Period</th><th>Loan drawdown</th><th>Dividends (credited to loan)</th>
        <th>External repayment</th><th>Closing loan</th><th></th>
      </tr></thead>
      <tbody>${yrows}</tbody>
    </table>`;
  body.appendChild(yearTbl);

  const addYearBtn = document.createElement("button");
  addYearBtn.className = "small";
  addYearBtn.textContent = "+ Add year";
  addYearBtn.style.marginTop = "8px";
  addYearBtn.addEventListener("click", () => {
    scn.years.push({ drawdown: 0, dividends: 0, externalRepayment: 0 });
    commit();
  });
  body.appendChild(addYearBtn);

  /* property transaction taxes (SDLT on a purchase, CGT on a disposal) */
  const p = scn.purchase, d = scn.disposal;
  const prop = document.createElement("details");
  prop.style.marginTop = "14px";
  if (scn._propOpen) prop.open = true;
  prop.addEventListener("toggle", () => { scn._propOpen = prop.open; });
  prop.innerHTML = `
    <summary style="cursor:pointer;font-weight:600;font-size:13.5px">Property &amp; asset taxes — SDLT, CGT / IHT (one-off)</summary>
    <div style="border:1px solid var(--line);border-radius:8px;padding:14px;margin-top:8px">
      <div style="font-weight:600;margin-bottom:8px">Purchase (SDLT)</div>
      <p class="muted" style="margin:0 0 10px;font-size:12px">SDLT applies to property in England &amp; Northern Ireland only. A property in Spain is outside SDLT — leave "Located in England/NI" unticked (Spain levies its own transfer tax / VAT, modelled separately).</p>
      <div class="grid cols-4">
        <label class="field"><span class="lbl">Purchase price</span><input type="number" data-pbind="price" value="${p.price}" /></label>
        <label class="field"><span class="lbl">In which year</span><input type="number" data-pbind="year" value="${p.year}" /></label>
        <label class="field" style="align-self:end"><label style="font-weight:600;font-size:12.5px"><input type="checkbox" data-pbind="applies" ${p.applies ? "checked" : ""}/> Located in England/NI</label></label>
        <label class="field" style="align-self:end"><label style="font-weight:600;font-size:12.5px"><input type="checkbox" data-pbind="additionalProperty" ${p.additionalProperty ? "checked" : ""}/> Additional dwelling (+surcharge)</label></label>
        <label class="field" style="align-self:end"><label style="font-weight:600;font-size:12.5px"><input type="checkbox" data-pbind="nonResident" ${p.nonResident ? "checked" : ""}/> Non-UK-resident (+2%)</label></label>
      </div>
      ${disposalBlock(d)}
    </div>`;
  body.appendChild(prop);

  /* summary cards */
  const cards = document.createElement("div");
  cards.className = "summary-cards";
  cards.style.marginTop = "16px";
  cards.innerHTML = `
    <div class="card"><div class="k">Permanent tax cost</div>
      <div class="v perm">${gbp(result.netPermanentCost)}</div>
      <div class="note">dividend tax + BIK income tax + Class 1A</div></div>
    <div class="card"><div class="k">Transaction taxes</div>
      <div class="v perm">${gbp(result.transactionTaxes)}</div>
      <div class="note">SDLT ${gbp(result.totals.sdlt)} · CGT ${gbp(result.totals.cgt)}${result.totals.iht > 0 ? ` · est. IHT ${gbp(result.totals.iht)} (on death)` : ""}</div></div>
    <div class="card"><div class="k">Peak S455 (refundable)</div>
      <div class="v timing">${gbp(result.peakS455)}</div>
      <div class="note">cash locked up with HMRC at peak</div></div>
    <div class="card"><div class="k">Total non-refundable cost</div>
      <div class="v perm">${gbp(result.totalNonRefundable)}</div>
      <div class="note">permanent + SDLT + CGT</div></div>`;
  body.appendChild(cards);

  /* detailed per-year results */
  const detail = document.createElement("details");
  detail.className = "breakdown";
  detail.style.marginTop = "8px";
  detail.innerHTML = `<summary class="muted" style="cursor:pointer;font-size:13px">Year-by-year breakdown</summary>`;
  const detTbl = document.createElement("div");
  detTbl.className = "table-scroll";
  detTbl.style.marginTop = "8px";
  let drows = result.years.map((y) => `
    <tr>
      <td>Year ${y.year}</td>
      <td>${gbp(y.closing)}</td>
      <td>${gbp0(y.bik)}</td>
      <td>${gbp0(y.bikIncomeTax)}</td>
      <td>${gbp0(y.class1A)}</td>
      <td>${gbp0(y.dividendTax)}${y.dividends > 0 ? ` <span class="muted">(${pct(y.effectiveDivRate)})</span>` : ""}</td>
      <td>${gbp0(y.s455Liab)}</td>
      <td class="${y.s455Movement > 0 ? "neg" : y.s455Movement < 0 ? "pos" : "muted"}">${y.s455Movement === 0 ? "—" : signed(y.s455Movement)}</td>
      <td>${gbp0(y.sdlt)}</td>
      <td>${gbp0(y.cgt)}</td>
      <td><strong>${gbp(y.permanentCost + y.sdlt + y.cgt)}</strong></td>
    </tr>`).join("");
  detTbl.innerHTML = `
    <table class="data">
      <thead><tr>
        <th>Period</th><th>Closing loan</th><th>BIK value</th><th>BIK income tax</th>
        <th>Class 1A</th><th>Dividend tax</th><th>S455 liability</th>
        <th>S455 cash (+pay/−refund)</th><th>SDLT</th><th>CGT</th><th>Non-refundable cost</th>
      </tr></thead>
      <tbody>${drows}</tbody>
      <tfoot><tr>
        <td>Total</td><td></td><td>${gbp(result.totals.bik)}</td>
        <td>${gbp(result.totals.bikIncomeTax)}</td><td>${gbp(result.totals.class1A)}</td>
        <td>${gbp(result.totals.dividendTax)}</td><td></td>
        <td class="muted">paid ${gbp(result.totals.s455Paid)} / ref ${gbp(result.totals.s455Refunded)}</td>
        <td>${gbp(result.totals.sdlt)}</td><td>${gbp(result.totals.cgt)}</td>
        <td>${gbp(result.totalNonRefundable)}</td>
      </tr></tfoot>
    </table>`;
  detail.appendChild(detTbl);
  body.appendChild(detail);

  root.appendChild(body);

  /* ---- wiring ---- */
  head.querySelector('[data-act="dup"]').addEventListener("click", () => {
    state.scenarios.splice(idx + 1, 0, JSON.parse(JSON.stringify(scn)));
    state.scenarios[idx + 1].name = scn.name + " (copy)";
    commit();
  });
  head.querySelector('[data-act="del"]').addEventListener("click", () => {
    if (state.scenarios.length <= 1) { alert("Keep at least one scenario."); return; }
    state.scenarios.splice(idx, 1);
    commit();
  });

  root.querySelectorAll("[data-bind]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const field = e.target.dataset.bind;
      if (field === "name" || field === "note") scn[field] = e.target.value;
      else scn[field] = parseFloat(e.target.value) || 0;
      saveState();
      // Light re-render: name/note don't need a full recompute, numbers do.
      if (field !== "name" && field !== "note") refreshScenarioInPlace(root, scn);
      renderComparison();
    });
  });

  root.querySelectorAll("[data-yfield]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const tr = e.target.closest("tr");
      const yi = parseInt(tr.dataset.yi, 10);
      scn.years[yi][e.target.dataset.yfield] = parseFloat(e.target.value) || 0;
      saveState();
      refreshScenarioInPlace(root, scn);
      renderComparison();
    });
  });

  root.querySelectorAll('[data-act="delyear"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const yi = parseInt(e.target.dataset.yi, 10);
      if (scn.years.length <= 1) { alert("Keep at least one year."); return; }
      scn.years.splice(yi, 1);
      commit();
    });
  });

  // Property transaction tax inputs (purchase = pbind, disposal = dbind)
  const bindProp = (selector, target) => {
    root.querySelectorAll(selector).forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const field = e.target.dataset.pbind || e.target.dataset.dbind;
        if (e.target.type === "checkbox") target[field] = e.target.checked;
        else target[field] = parseFloat(e.target.value) || 0;
        saveState();
        refreshScenarioInPlace(root, scn);
        renderComparison();
      });
    });
  };
  bindProp("[data-pbind]", scn.purchase);
  bindProp("[data-dbind]", scn.disposal);

  // Asset-type buttons (house sale / business sale / inheritance / other)
  root.querySelectorAll("[data-asset]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      scn.disposal.type = e.currentTarget.dataset.asset;
      scn._propOpen = true; // keep the panel open after switching type
      commit();
    });
  });

  return root;
}

/* Re-run + repaint a scenario's computed cells without rebuilding inputs
 * (so the user's cursor/focus is preserved while typing). */
function refreshScenarioInPlace(root, scn) {
  const fresh = renderScenario(scn, state.scenarios.indexOf(scn));
  root.querySelector(".summary-cards").replaceWith(fresh.querySelector(".summary-cards"));
  root.querySelector("details.breakdown").replaceWith(fresh.querySelector("details.breakdown"));
  // update closing-loan column
  const result = runScenario(scn, state.rates);
  root.querySelectorAll("tbody tr[data-yi]").forEach((tr) => {
    const yi = parseInt(tr.dataset.yi, 10);
    const cell = tr.children[4];
    if (cell && result.years[yi]) cell.textContent = gbp(result.years[yi].closing);
  });
}

/* ---- Render: comparison table + chart ------------------------------------ */
function renderComparison() {
  const r = state.rates;
  const results = state.scenarios.map((s) => runScenario(s, r));
  const tbl = document.getElementById("compare");

  const minPerm = Math.min(...results.map((x) => x.netPermanentCost));
  const minNonRef = Math.min(...results.map((x) => x.totalNonRefundable));
  const minTotal = Math.min(...results.map((x) => x.totalNonRefundable + x.s455Outstanding));

  let header = "<thead><tr><th>Scenario</th>";
  results.forEach((x) => { header += `<th>${escapeHtml(x.name)}</th>`; });
  header += "</tr></thead>";

  const rows = [
    ["Total dividends declared", (x) => gbp(x.totals.dividends)],
    ["Dividend tax", (x) => gbp(x.totals.dividendTax)],
    ["BIK income tax", (x) => gbp(x.totals.bikIncomeTax)],
    ["Employer Class 1A NIC", (x) => gbp(x.totals.class1A)],
    ["Permanent tax cost", (x) => gbp(x.netPermanentCost), (x) => x.netPermanentCost === minPerm],
    ["SDLT (purchase)", (x) => gbp(x.totals.sdlt)],
    ["CGT (disposal)", (x) => gbp(x.totals.cgt)],
    ["Total non-refundable cost", (x) => gbp(x.totalNonRefundable), (x) => x.totalNonRefundable === minNonRef],
    ["Peak S455 (cash locked up)", (x) => gbp(x.peakS455)],
    ["S455 outstanding at end", (x) => gbp(x.s455Outstanding)],
    ["Non-refundable + S455 still locked", (x) => gbp(x.totalNonRefundable + x.s455Outstanding), (x) => (x.totalNonRefundable + x.s455Outstanding) === minTotal],
  ];

  let bodyHtml = "<tbody>";
  rows.forEach(([label, fn, best]) => {
    bodyHtml += `<tr><td>${label}</td>`;
    results.forEach((x) => {
      const isBest = best && best(x);
      bodyHtml += `<td class="${isBest ? "best" : ""}">${fn(x)}</td>`;
    });
    bodyHtml += "</tr>";
  });
  bodyHtml += "</tbody>";

  tbl.innerHTML = header + bodyHtml;
  drawChart(results);
}

/* ---- Canvas chart: grouped bars (permanent cost vs S455 locked up) ------- */
function drawChart(results) {
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 70, padR = 20, padT = 30, padB = 64;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const series = results.map((x) => ({
    name: x.name,
    perm: x.netPermanentCost,
    txn: x.transactionTaxes,
    s455: x.s455Outstanding,
    peak: x.peakS455,
  }));
  const maxVal = Math.max(1, ...series.map((s) => Math.max(s.perm + s.txn + s.s455, s.peak)));
  // round axis up to a nice number
  const niceMax = niceCeil(maxVal);

  // axes
  ctx.strokeStyle = "#dde3ea";
  ctx.fillStyle = "#5d6b7a";
  ctx.font = "11px -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.lineWidth = 1;
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = (niceMax / ticks) * i;
    const y = padT + plotH - (v / niceMax) * plotH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("£" + shortNum(v), padL - 8, y);
  }

  const n = series.length;
  const groupW = plotW / n;
  const barW = Math.min(70, groupW * 0.5);

  series.forEach((s, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const x = cx - barW / 2;
    // stacked: permanent (red) + transaction taxes (orange) + S455 outstanding (blue)
    const permH = (s.perm / niceMax) * plotH;
    const txnH = (s.txn / niceMax) * plotH;
    const s455H = (s.s455 / niceMax) * plotH;
    const baseY = padT + plotH;

    ctx.fillStyle = "#b3261e";
    ctx.fillRect(x, baseY - permH, barW, permH);
    ctx.fillStyle = "#b4690e";
    ctx.fillRect(x, baseY - permH - txnH, barW, txnH);
    ctx.fillStyle = "#0b5a8a";
    ctx.fillRect(x, baseY - permH - txnH - s455H, barW, s455H);

    // peak S455 marker (dashed line) to show cash locked up at peak
    const peakH = (s.peak / niceMax) * plotH;
    ctx.strokeStyle = "#1f9d7a";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x - 4, baseY - peakH);
    ctx.lineTo(x + barW + 4, baseY - peakH);
    ctx.stroke();
    ctx.setLineDash([]);

    // total label
    const topH = permH + txnH + s455H;
    ctx.fillStyle = "#1c2733";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.font = "bold 11px -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText("£" + shortNum(s.perm + s.txn + s.s455), cx, baseY - topH - 4);

    // x label (wrapped)
    ctx.fillStyle = "#5d6b7a";
    ctx.font = "11px -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textBaseline = "top";
    wrapLabel(ctx, s.name, cx, baseY + 8, groupW - 6, 13);
  });

  // legend
  const legend = [
    ["#b3261e", "Permanent tax cost"],
    ["#b4690e", "Transaction taxes (SDLT/CGT)"],
    ["#0b5a8a", "S455 outstanding at end"],
    ["#1f9d7a", "Peak S455 (cash locked up)"],
  ];
  let lx = padL;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  legend.forEach(([c, t]) => {
    ctx.fillStyle = c; ctx.fillRect(lx, 12, 12, 12);
    ctx.fillStyle = "#1c2733"; ctx.fillText(t, lx + 17, 18);
    lx += ctx.measureText(t).width + 46;
  });
}

function niceCeil(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}
function shortNum(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 2) + "m";
  if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 0) + "k";
  return String(Math.round(v));
}
function wrapLabel(ctx, text, cx, y, maxW, lh) {
  const words = text.split(" ");
  let line = "", lines = [];
  words.forEach((w) => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  });
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}

/* ---- Helpers ------------------------------------------------------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function commit() {
  saveState();
  renderScenarios();
  renderComparison();
}

function renderAll() {
  renderToolkit();
  renderRates();
  renderRemun();
  renderHomeRent();
  renderChildEmp();
  renderRLP();
  renderScenarios();
  renderComparison();
}

/* ---- Remuneration optimiser ---------------------------------------------- */
function renderRemun() {
  renderRemunInputs();
  renderRemunResults();
}

function renderRemunInputs() {
  const plan = state.remun;
  const sel = (b) => (b ? " selected" : "");
  const company = document.getElementById("remun-company");
  company.innerHTML = `
    <label class="field"><span class="lbl">Profit available <span class="hint">(before salaries)</span></span>
      <input type="number" data-rm="availableProfit" value="${plan.availableProfit}" /></label>
    <label class="field"><span class="lbl">Associated companies <span class="hint">(divides CT limits)</span></span>
      <input type="number" data-rm="associated" value="${plan.associated}" /></label>
    <label class="field"><span class="lbl">Salary strategy</span>
      <select data-rm="salaryMode">
        <option value="optimise"${sel(plan.salaryMode === "optimise")}>Optimise automatically</option>
        <option value="manual"${sel(plan.salaryMode === "manual")}>Set manually</option>
      </select></label>
    ${plan.salaryMode === "manual"
      ? `<label class="field"><span class="lbl">Salary per employee</span><input type="number" data-rm="manualSalary" value="${plan.manualSalary}" /></label>`
      : ""}
    <label class="field"><span class="lbl">Dividend split</span>
      <select data-rm="dividendSplit">
        <option value="optimise"${sel(plan.dividendSplit === "optimise")}>Optimise (minimise tax)</option>
        <option value="percent"${sel(plan.dividendSplit === "percent")}>By share %</option>
      </select></label>
    <label class="field" style="align-self:end">
      <label style="font-weight:600;font-size:12.5px"><input type="checkbox" data-rm="employmentAllowance" ${plan.employmentAllowance ? "checked" : ""}/> Can claim Employment Allowance</label>
    </label>`;

  company.querySelectorAll("[data-rm]").forEach((inp) => {
    const evt = inp.tagName === "SELECT" || inp.type === "checkbox" ? "change" : "input";
    inp.addEventListener(evt, (e) => {
      const key = e.target.dataset.rm;
      if (e.target.type === "checkbox") plan[key] = e.target.checked;
      else if (e.target.tagName === "SELECT") plan[key] = e.target.value;
      else plan[key] = parseFloat(e.target.value) || 0;
      saveState();
      if (key === "salaryMode") renderRemunInputs(); // show/hide the manual salary field
      renderRemunResults();
    });
  });

  const tbl = document.getElementById("remun-people");
  const rows = plan.people.map((p, i) => `
    <tr data-pi="${i}">
      <td><input type="text" data-pf="name" value="${escapeAttr(p.name)}" style="text-align:left" /></td>
      <td><input type="number" data-pf="otherIncome" value="${p.otherIncome}" /></td>
      <td style="text-align:center"><input type="checkbox" data-pf="isEmployee" ${p.isEmployee ? "checked" : ""} /></td>
      <td style="text-align:center"><input type="checkbox" data-pf="isShareholder" ${p.isShareholder ? "checked" : ""} /></td>
      <td><input type="number" data-pf="sharePct" value="${p.sharePct}" /></td>
      <td><input type="number" data-pf="pension" value="${p.pension}" /></td>
      <td><button class="small ghost" data-rmdel="${i}" title="Remove">✕</button></td>
    </tr>`).join("");
  tbl.innerHTML = `
    <thead><tr>
      <th>Person</th><th>Other income</th><th>Employee</th><th>Shareholder</th>
      <th>Share %</th><th>Employer pension</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody>`;

  tbl.querySelectorAll("[data-pf]").forEach((inp) => {
    const evt = inp.type === "checkbox" ? "change" : "input";
    inp.addEventListener(evt, (e) => {
      const pi = parseInt(e.target.closest("tr").dataset.pi, 10);
      const f = e.target.dataset.pf;
      if (e.target.type === "checkbox") state.remun.people[pi][f] = e.target.checked;
      else if (f === "name") state.remun.people[pi][f] = e.target.value;
      else state.remun.people[pi][f] = parseFloat(e.target.value) || 0;
      saveState();
      renderRemunResults();
    });
  });
  tbl.querySelectorAll("[data-rmdel]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (state.remun.people.length <= 1) { alert("Keep at least one person."); return; }
      state.remun.people.splice(parseInt(e.target.dataset.rmdel, 10), 1);
      saveState();
      renderRemun();
    });
  });
}

function remunCard(k, v, note, cls) {
  return `<div class="card"><div class="k">${k}</div><div class="v ${cls || ""}">${v}</div><div class="note">${note || ""}</div></div>`;
}

function renderRemunResults() {
  const r = state.rates, plan = state.remun;
  const host = document.getElementById("remun-results");
  const result = plan.salaryMode === "manual"
    ? runRemuneration(plan, plan.manualSalary, r)
    : optimiseRemuneration(plan, r).best;
  const t = result.totals;

  const cards = `<div class="summary-cards">
    ${remunCard(plan.salaryMode === "manual" ? "Salary / employee" : "Optimal salary / employee", gbp(result.salaryPerEmployee), plan.salaryMode === "manual" ? "as entered" : "auto-optimised")}
    ${remunCard("Marginal CT rate", pct(result.marginalCtRate), "relief on salary & pension", "timing")}
    ${remunCard("Net to pockets + pension", gbp(t.valueDelivered), "value delivered to the people")}
    ${remunCard("Effective extraction rate", pct(t.effectiveRate), "all tax ÷ profit extracted", "perm")}
  </div>`;

  const prows = result.perPerson.map((p) => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${gbp0(p.salary)}</td>
      <td>${gbp0(p.dividends)}</td>
      <td>${gbp0(p.incomeTaxOnSalary)}</td>
      <td>${gbp0(p.employeeNIC)}</td>
      <td>${gbp0(p.dividendTax)}</td>
      <td>${gbp0(p.pension)}</td>
      <td><strong>${gbp(p.totalValue)}</strong></td>
    </tr>`).join("");
  const peopleTbl = `<div class="table-scroll" style="margin-top:6px"><table class="data">
    <thead><tr><th>Person</th><th>Salary</th><th>Dividends</th><th>Income tax</th><th>Employee NIC</th><th>Dividend tax</th><th>Pension</th><th>Net + pension</th></tr></thead>
    <tbody>${prows}</tbody>
    <tfoot><tr><td>Total</td><td>${gbp(t.salary)}</td><td>${gbp(t.dividends)}</td><td>${gbp(t.incomeTax)}</td><td>${gbp(t.employeeNIC)}</td><td>${gbp(t.dividendTax)}</td><td>${gbp(t.pension)}</td><td>${gbp(t.valueDelivered)}</td></tr></tfoot>
  </table></div>`;

  const eaNote = t.employmentAllowanceClaimed > 0
    ? ` (after ${gbp(t.employmentAllowanceClaimed)} Employment Allowance)` : "";
  const companyTbl = `<div class="table-scroll" style="margin-top:14px"><table class="data">
    <tbody>
      <tr><td>Profit available to extract</td><td>${gbp(plan.availableProfit)}</td></tr>
      <tr><td>Less salaries</td><td>−${gbp(t.salary)}</td></tr>
      <tr><td>Less employer NIC${eaNote}</td><td>−${gbp(t.employerNIC)}</td></tr>
      <tr><td>Less employer pension</td><td>−${gbp(t.pension)}</td></tr>
      <tr><td>Profit chargeable to corporation tax</td><td>${gbp(t.profitBeforeCT)}</td></tr>
      <tr><td>Corporation tax</td><td>−${gbp(t.corporationTax)}</td></tr>
      <tr><td>Distributable as dividends</td><td>${gbp(t.distributable)}</td></tr>
      <tr><td>Total tax (CT + income tax + NIC + dividend tax)</td><td><strong>${gbp(t.totalTax)}</strong></td></tr>
    </tbody>
  </table></div>`;

  host.innerHTML = cards + peopleTbl + companyTbl + remunRecommendation(result, plan, r);
}

function remunRecommendation(result, plan, r) {
  if (plan.salaryMode === "manual") return "";
  const s = result.salaryPerEmployee;
  const mct = result.marginalCtRate;

  // Quantify the benefit: optimal vs taking nothing as salary (all dividends).
  const noSalary = runRemuneration(plan, 0, r);
  const gain = result.totals.valueDelivered - noSalary.totals.valueDelivered;

  // The core reason this salary level wins.
  let headline;
  if (s <= r.niSecondaryThreshold + 1) {
    headline = `A salary at the <strong>employer-NIC threshold (${gbp(r.niSecondaryThreshold)})</strong> draws a wage and starts the state-pension qualifying record without triggering any employer NIC.`;
  } else if (Math.abs(s - r.personalAllowance) < 250) {
    headline = `A salary at the <strong>personal allowance (${gbp(r.personalAllowance)})</strong> is the sweet spot: it pays <strong>no income tax</strong>, and the corporation-tax relief on it (at ${pct(mct)}) comfortably outweighs the small employee/employer NIC it triggers.`;
  } else if (plan.employmentAllowance && s > r.personalAllowance) {
    headline = `Because the <strong>Employment Allowance</strong> wipes out the employer NIC, a larger salary (here ${gbp(s)}) is efficient — every extra pound of salary saves corporation tax at ${pct(mct)} and only bears 20% income tax + 8% employee NIC, which beats paying it as a dividend out of post-tax profit.`;
  } else {
    headline = `A salary of ${gbp(s)} gave the best overall position once income tax, NIC and corporation-tax relief are balanced against the dividend route.`;
  }

  return `
    <div class="explainer">
      <div style="font-weight:700;margin-bottom:6px">Why this is the best structure</div>
      <p style="margin:0 0 8px">${headline}</p>
      <ul style="margin:0 0 8px;padding-left:18px">
        <li><strong>Salary &amp; pension are deductible</strong> — they cut the company's corporation tax (relief at the marginal ${pct(mct)} here), so the company funds them out of <em>pre-tax</em> profit.</li>
        <li><strong>Dividends are not</strong> — they're paid from profit <em>after</em> ${pct(mct)} corporation tax, and are then taxed again on the shareholder. That double layer is why salary up to the allowances/thresholds usually wins, and dividends mop up the rest.</li>
        <li><strong>Why not more salary?</strong> Above this point each extra pound starts attracting income tax (and employee NIC) faster than the corporation-tax relief it saves, so dividends become the cheaper way to extract the remaining profit.</li>
        <li><strong>Dividends are split</strong> across the shareholders to use each person's allowance and basic-rate band, minimising the total dividend tax.</li>
      </ul>
      <p style="margin:0"><strong>Result:</strong> ${gbp(result.totals.valueDelivered)} delivered for ${gbp(plan.availableProfit)} of profit — an effective extraction rate of <strong>${pct(result.totals.effectiveRate)}</strong>${gain > 1 ? `, about <strong>${gbp(gain)}</strong> better than taking it all as dividends with no salary` : ""}.</p>
    </div>`;
}

/* ---- Use of home — rent to company --------------------------------------- */
function renderHomeRent() {
  renderHomeRentInputs();
  renderHomeRentResults();
}

function renderHomeRentInputs() {
  const h = state.homeRent;
  const host = document.getElementById("homerent-inputs");
  host.innerHTML = `
    <label class="field"><span class="lbl">Annual rent charged</span>
      <input type="number" data-hr="rent" value="${h.rent}" /></label>
    <label class="field"><span class="lbl">Allowable costs <span class="hint">(business-use share)</span></span>
      <input type="number" data-hr="allowableCosts" value="${h.allowableCosts}" /></label>
    <label class="field"><span class="lbl">Director's other income <span class="hint">(sets marginal rate)</span></span>
      <input type="number" data-hr="otherIncome" value="${h.otherIncome}" /></label>
    <label class="field"><span class="lbl">Company taxable profit <span class="hint">(sets CT rate)</span></span>
      <input type="number" data-hr="companyProfit" value="${h.companyProfit}" /></label>
    <label class="field"><span class="lbl">Associated companies</span>
      <input type="number" data-hr="associated" value="${h.associated}" /></label>`;
  host.querySelectorAll("[data-hr]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      state.homeRent[e.target.dataset.hr] = parseFloat(e.target.value) || 0;
      saveState();
      renderHomeRentResults();
    });
  });
}

function renderHomeRentResults() {
  const res = useOfHomeRent(state.homeRent, state.rates);
  const host = document.getElementById("homerent-results");
  const cards = `<div class="summary-cards">
    ${remunCard("Rental profit (taxable)", gbp(res.rentalProfit), "rent less allowable costs")}
    ${remunCard("Director's income tax", gbp(res.incomeTax), res.rentalProfit > 0 ? `at ${pct(res.marginalIncomeRate)} marginal` : "no taxable profit")}
    ${remunCard("Net cash to director", gbp(res.netToDirector), "rent received less the tax", "timing")}
    ${remunCard("Company CT relief", gbp(res.ctRelief), `rent deductible at ${pct(res.ctRate)}`, "")}
  </div>`;
  const tbl = `<div class="table-scroll" style="margin-top:12px"><table class="data"><tbody>
      <tr><td>Rent charged to the company</td><td>${gbp(res.rent)}</td></tr>
      <tr><td>Less allowable household costs (business share)</td><td>−${gbp(res.allowableCosts)}</td></tr>
      <tr><td>Taxable rental profit</td><td>${gbp(res.rentalProfit)}</td></tr>
      <tr><td>Director's income tax on the profit</td><td>−${gbp(res.incomeTax)}</td></tr>
      <tr><td>Company corporation-tax relief on the rent</td><td>${gbp(res.ctRelief)}</td></tr>
      <tr><td><strong>Net cost to the company</strong> (rent less CT relief)</td><td><strong>${gbp(res.netCostToCompany)}</strong></td></tr>
      <tr><td><strong>Personal tax as a % of the rent extracted</strong></td><td><strong>${pct(res.effectiveRate)}</strong></td></tr>
  </tbody></table></div>`;
  const insight = res.rentalProfit === 0
    ? `<p class="muted" style="font-size:12.5px;margin-top:12px"><strong>£${Math.round(res.rent).toLocaleString("en-GB")} extracted at 0% personal tax</strong> — the rent is matched to allowable costs, so there's no taxable profit, while the company still saves ${gbp(res.ctRelief)} in corporation tax.</p>`
    : `<p class="muted" style="font-size:12.5px;margin-top:12px">The rent exceeds the allowable costs, so the ${gbp(res.rentalProfit)} profit is taxed on the director at ${pct(res.marginalIncomeRate)}. Bringing the rent down towards the allowable costs reduces the personal tax while keeping the company's CT relief.</p>`;
  host.innerHTML = cards + tbl + insight;
}

/* ---- Employing children -------------------------------------------------- */
function renderChildEmp() { renderChildEmpInputs(); renderChildEmpResults(); }
function renderChildEmpInputs() {
  const c = state.childEmp;
  document.getElementById("childemp-inputs").innerHTML = `
    <label class="field"><span class="lbl">Number of children</span><input type="number" data-ce="children" value="${c.children}" /></label>
    <label class="field"><span class="lbl">Wage per child</span><input type="number" data-ce="wagePerChild" value="${c.wagePerChild}" /></label>
    <label class="field"><span class="lbl">Child's other income</span><input type="number" data-ce="childOtherIncome" value="${c.childOtherIncome}" /></label>
    <label class="field"><span class="lbl">Company taxable profit <span class="hint">(sets CT rate)</span></span><input type="number" data-ce="companyProfit" value="${c.companyProfit}" /></label>
    <label class="field"><span class="lbl">Associated companies</span><input type="number" data-ce="associated" value="${c.associated}" /></label>`;
  document.querySelectorAll("#childemp-inputs [data-ce]").forEach((inp) =>
    inp.addEventListener("input", (e) => {
      state.childEmp[e.target.dataset.ce] = parseFloat(e.target.value) || 0;
      saveState(); renderChildEmpResults();
    }));
}
function renderChildEmpResults() {
  const res = childEmployment(state.childEmp, state.rates);
  const cards = `<div class="summary-cards">
    ${remunCard("Total wages", gbp(res.totalWages), res.count + " child" + (res.count === 1 ? "" : "ren"))}
    ${remunCard("Income tax on children", gbp(res.totalIncomeTax), res.totalIncomeTax === 0 ? "within their allowance" : "above the allowance", "perm")}
    ${remunCard("Company CT relief", gbp(res.ctRelief), "wages deductible at " + pct(res.ctRate))}
    ${remunCard("Net cost to company", gbp(res.netCostToCompany), "wages less CT relief", "timing")}
  </div>`;
  const insight = res.totalWages > 0 && res.totalIncomeTax === 0
    ? `<p class="muted" style="font-size:12.5px;margin-top:12px"><strong>${gbp(res.totalWages)} moved into the children's tax-free allowances</strong> at 0% income tax, while the company saves ${gbp(res.ctRelief)} in corporation tax — provided the wage is justified for real work (see below).</p>`
    : (res.totalWages > 0 ? `<p class="muted" style="font-size:12.5px;margin-top:12px">Part of the wage exceeds a child's allowance and is taxed at ${pct(state.rates.incomeBasic)} on them; the company still saves ${gbp(res.ctRelief)} in CT.</p>` : "");
  document.getElementById("childemp-results").innerHTML = cards + insight;
}

/* ---- Relevant life plan -------------------------------------------------- */
function renderRLP() { renderRLPInputs(); renderRLPResults(); }
function renderRLPInputs() {
  const x = state.rlp;
  document.getElementById("rlp-inputs").innerHTML = `
    <label class="field"><span class="lbl">Annual premium</span><input type="number" data-rl="premium" value="${x.premium}" /></label>
    <label class="field"><span class="lbl">Director's other income <span class="hint">(sets marginal rate)</span></span><input type="number" data-rl="directorOtherIncome" value="${x.directorOtherIncome}" /></label>
    <label class="field"><span class="lbl">Company taxable profit <span class="hint">(sets CT rate)</span></span><input type="number" data-rl="companyProfit" value="${x.companyProfit}" /></label>
    <label class="field"><span class="lbl">Associated companies</span><input type="number" data-rl="associated" value="${x.associated}" /></label>`;
  document.querySelectorAll("#rlp-inputs [data-rl]").forEach((inp) =>
    inp.addEventListener("input", (e) => {
      state.rlp[e.target.dataset.rl] = parseFloat(e.target.value) || 0;
      saveState(); renderRLPResults();
    }));
}
function renderRLPResults() {
  const res = relevantLifePlan(state.rlp, state.rates);
  const cards = `<div class="summary-cards">
    ${remunCard("Net cost via company", gbp(res.companyNetCost), "premium less CT relief at " + pct(res.ctRate), "timing")}
    ${remunCard("Profit needed — RLP", gbp(res.profitRLP), "premium is deductible")}
    ${remunCard("Profit needed — personally", gbp(res.profitPersonal), "grossed up for dividend + CT", "perm")}
    ${remunCard("Profit saved with an RLP", gbp(res.saving), pct(res.savingPct) + " cheaper")}
  </div>`;
  const insight = res.premium > 0
    ? `<p class="muted" style="font-size:12.5px;margin-top:12px">To fund <strong>${gbp(res.premium)}</strong> of cover, paying for it personally would need about <strong>${gbp(res.profitPersonal)}</strong> of company profit (draw ${gbp(res.grossDividendNeeded)} as dividend, then buy the cover from what's left after tax). Through a Relevant Life Plan it needs just <strong>${gbp(res.profitRLP)}</strong> — a saving of <strong>${gbp(res.saving)}</strong> (${pct(res.savingPct)}).</p>`
    : "";
  document.getElementById("rlp-results").innerHTML = cards + insight;
}

/* ---- Planning menu & checklist ------------------------------------------- */
function jumpTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "DETAILS") el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderToolkit() { renderMenu(); renderChecklist(); }

function renderMenu() {
  document.getElementById("menu-chips").innerHTML =
    MENU.map((m) => `<a class="menu-chip" data-jump="${m.id}">${m.label}</a>`).join("");
  document.querySelectorAll("#menu-chips [data-jump]").forEach((a) =>
    a.addEventListener("click", () => jumpTo(a.dataset.jump)));
}

function updateChecklistProgress() {
  const done = CHECKLIST.filter((it) => (state.checklist[it.key] || {}).done).length;
  document.getElementById("checklist-progress").textContent = `Considered ${done} of ${CHECKLIST.length}`;
}

function renderChecklist() {
  const cl = state.checklist;
  const rows = CHECKLIST.map((it) => {
    const s = cl[it.key] || { done: false, status: "Relevant", note: "" };
    const opt = (v) => `<option ${s.status === v ? "selected" : ""}>${v}</option>`;
    return `<tr data-k="${it.key}" class="${s.done ? "done" : ""}">
      <td style="text-align:center"><input type="checkbox" data-cl="done" ${s.done ? "checked" : ""} /></td>
      <td style="text-align:left"><a class="tool-link" data-jump="${it.target}">${it.label}</a></td>
      <td><select data-cl="status">${opt("Relevant")}${opt("Applied")}${opt("Not relevant")}</select></td>
      <td><input type="text" data-cl="note" value="${escapeAttr(s.note || "")}" placeholder="notes…" style="width:100%;text-align:left" /></td>
    </tr>`;
  }).join("");
  document.getElementById("checklist-table").innerHTML =
    `<thead><tr><th style="width:36px">✓</th><th style="text-align:left">Strategy</th><th style="width:130px">Status</th><th style="text-align:left">Notes</th></tr></thead><tbody>${rows}</tbody>`;
  updateChecklistProgress();

  const tbl = document.getElementById("checklist-table");
  tbl.querySelectorAll("[data-jump]").forEach((a) => a.addEventListener("click", () => jumpTo(a.dataset.jump)));
  tbl.querySelectorAll("[data-cl]").forEach((inp) => {
    const evt = (inp.type === "checkbox" || inp.tagName === "SELECT") ? "change" : "input";
    inp.addEventListener(evt, (e) => {
      const k = e.target.closest("tr").dataset.k;
      const f = e.target.dataset.cl;
      if (e.target.type === "checkbox") {
        state.checklist[k].done = e.target.checked;
        saveState();
        e.target.closest("tr").classList.toggle("done", e.target.checked);
        updateChecklistProgress();
      } else {
        state.checklist[k][f] = e.target.value; // status / note — no re-render, keep focus
        saveState();
      }
    });
  });
}

/* ---- Client email -------------------------------------------------------- */
/* Builds a plain-English email summarising the modelled scenarios, spelling out
 * the key caveat — that clearing a director's loan with a future dividend is
 * itself taxable — and linking to this tool so the client can explore / clear
 * the loan down. Returns { subject, body }. */
function buildClientEmail() {
  const r = state.rates;
  const results = state.scenarios.map((s) => runScenario(s, r));
  const meta = state.emailMeta || { client: "", sender: "" };
  const client = (meta.client || "").trim() || "[client name]";
  const sender = (meta.sender || "").trim() || "[your name]";

  // Headline figure = the largest total new borrowing across the scenarios.
  const totalDrawdown = (scn) => (scn.years || []).reduce((t, y) => t + (y.drawdown || 0), 0);
  const headline = Math.max(0, ...state.scenarios.map(totalDrawdown));
  const amountPhrase = headline > 0 ? `the ${gbp(headline)} withdrawal` : "the withdrawal";

  // "Lowest cost once the loan is eventually cleared" = non-refundable + S455 still locked up.
  const trueCost = (x) => x.totalNonRefundable + x.s455Outstanding;
  let best = results[0];
  results.forEach((x) => { if (trueCost(x) < trueCost(best)) best = x; });

  const L = [];
  L.push(`Dear ${client},`, "");
  L.push(`Thank you for your time. Following our discussion, here is a summary of the options we modelled for funding ${amountPhrase} — comparing taking the money out of the company as a director's loan against declaring it as dividends.`, "");

  L.push("SUMMARY OF THE OPTIONS");
  results.forEach((x) => {
    L.push(`• ${x.name}`);
    L.push(`    - Permanent tax cost: ${gbp(x.netPermanentCost)} (dividend tax + benefit-in-kind income tax + employer Class 1A NIC)`);
    if (x.transactionTaxes > 0) {
      L.push(`    - One-off SDLT/CGT on the property transaction: ${gbp(x.transactionTaxes)}`);
    }
    if (x.peakS455 > 0) {
      L.push(`    - S455 charge at its peak (refundable once the loan is repaid): ${gbp(x.peakS455)}`);
    }
    let total = `    - Total non-refundable cost: ${gbp(x.totalNonRefundable)}`;
    if (x.s455Outstanding > 0) {
      total += `, with a further ${gbp(x.s455Outstanding)} of S455 still locked up with HMRC at the end`;
    }
    L.push(total);
  });
  L.push("");
  if (results.length > 1) {
    L.push(`On these figures, the lowest overall cost is "${best.name}".`, "");
  }

  L.push("THE IMPORTANT CAVEAT WITH THE DIRECTOR'S LOAN ROUTE");
  L.push(`Taking the money as a director's loan looks cheaper up front: the only immediate tax is the S455 charge — currently ${pct(r.s455Rate)} of the balance still outstanding nine months and a day after the company year end — and that charge is refundable once the loan is repaid, plus a small benefit-in-kind cost on the cheap loan.`, "");
  L.push("However, the loan still has to be repaid. If you later clear it by declaring a dividend (rather than repaying it from another source, such as the sale of a property), that dividend is itself taxable in the year it is declared, at the dividend rates then in force. In other words, a director's loan defers the dividend tax — it does not remove it: the tax falls due when the loan is eventually cleared with a dividend. For an additional-rate taxpayer there is no rate saving from spreading the dividends over several years, so clearing a loan this way can end up being the most expensive route overall.", "");

  L.push("REVIEW THE FIGURES / MODEL CLEARING THE LOAN DOWN");
  L.push("You can review all of the figures, change any of the assumptions, and model how to clear the director's loan down here:");
  L.push(TOOL_URL, "");

  L.push("These figures are estimates to support our planning conversation and are not formal tax advice; we will confirm the final numbers before anything is actioned.", "");
  L.push("Kind regards,", sender);

  return { subject: "Funding options: director's loan vs dividends", body: L.join("\n") };
}

const emailModal = () => document.getElementById("email-modal");
function regenEmail() {
  const { subject, body } = buildClientEmail();
  document.getElementById("email-subject").value = subject;
  document.getElementById("email-body").value = body;
}
function openEmailModal() {
  const meta = state.emailMeta || { client: "", sender: "" };
  document.getElementById("email-client").value = meta.client || "";
  document.getElementById("email-sender").value = meta.sender || "";
  regenEmail();
  emailModal().hidden = false;
}
function closeEmailModal() { emailModal().hidden = true; }

document.getElementById("btn-email").addEventListener("click", openEmailModal);
document.getElementById("email-close").addEventListener("click", closeEmailModal);
document.getElementById("email-close2").addEventListener("click", closeEmailModal);
emailModal().addEventListener("click", (e) => { if (e.target === emailModal()) closeEmailModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !emailModal().hidden) closeEmailModal();
});
["email-client", "email-sender"].forEach((id) => {
  document.getElementById(id).addEventListener("input", (e) => {
    if (!state.emailMeta) state.emailMeta = { client: "", sender: "" };
    state.emailMeta[id === "email-client" ? "client" : "sender"] = e.target.value;
    saveState();
    regenEmail();
  });
});
document.getElementById("email-copy").addEventListener("click", async () => {
  const btn = document.getElementById("email-copy");
  const body = document.getElementById("email-body").value;
  try {
    await navigator.clipboard.writeText(body);
    const old = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(() => { btn.textContent = old; }, 1500);
  } catch (e) {
    const ta = document.getElementById("email-body");
    ta.focus(); ta.select();
    alert("Press Ctrl/Cmd + C to copy the selected text.");
  }
});
document.getElementById("email-mailto").addEventListener("click", () => {
  const subject = document.getElementById("email-subject").value;
  const body = document.getElementById("email-body").value;
  const to = (state.emailMeta && state.emailMeta.clientEmail) ? encodeURIComponent(state.emailMeta.clientEmail) : "";
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

/* ---- Karbon client lookup ------------------------------------------------ */
const karbonModal = () => document.getElementById("karbon-modal");
function openKarbonModal() {
  document.getElementById("karbon-url").value = state.karbon.proxyUrl || "";
  document.getElementById("karbon-pass").value = state.karbon.passphrase || "";
  document.getElementById("karbon-results").innerHTML = "";
  document.getElementById("karbon-status").textContent = "";
  if (!state.karbon.proxyUrl) document.getElementById("karbon-settings").open = true;
  karbonModal().hidden = false;
  document.getElementById("karbon-q").focus();
}
function closeKarbonModal() { karbonModal().hidden = true; }

function saveKarbonConfig() {
  state.karbon.proxyUrl = document.getElementById("karbon-url").value.trim();
  state.karbon.passphrase = document.getElementById("karbon-pass").value;
  saveState();
}

async function karbonSearch() {
  saveKarbonConfig();
  const status = document.getElementById("karbon-status");
  const results = document.getElementById("karbon-results");
  results.innerHTML = "";
  const q = document.getElementById("karbon-q").value.trim();
  if (!state.karbon.proxyUrl) { status.textContent = "Set the proxy URL in connection settings first."; return; }
  if (q.length < 2) { status.textContent = "Type at least two letters of the client name."; return; }
  status.textContent = "Searching…";
  try {
    const url = state.karbon.proxyUrl.replace(/\/+$/, "") + "/search?q=" + encodeURIComponent(q);
    const res = await fetch(url, { headers: { "X-Passphrase": state.karbon.passphrase || "" } });
    if (res.status === 401) { status.textContent = "Unauthorised — check the passphrase."; return; }
    if (!res.ok) { status.textContent = "Proxy error (" + res.status + ")."; return; }
    const data = await res.json();
    const list = (data && data.results) || [];
    if (list.length === 0) { status.textContent = "No matches."; return; }
    status.textContent = list.length + " result" + (list.length === 1 ? "" : "s") + " — click to use:";
    results.innerHTML = list.map((p, i) => `
      <div class="karbon-row" data-ki="${i}">
        <div><strong>${escapeHtml(p.name)}</strong> <span class="muted" style="font-size:11.5px">${escapeHtml(p.type || "")}</span></div>
        <div class="muted" style="font-size:12px">${escapeHtml([p.email, p.address].filter(Boolean).join(" · "))}</div>
      </div>`).join("");
    results.querySelectorAll(".karbon-row").forEach((row) => {
      row.addEventListener("click", () => {
        const p = list[parseInt(row.dataset.ki, 10)];
        state.emailMeta.client = p.name;
        state.emailMeta.clientEmail = p.email || "";
        state.emailMeta.clientAddress = p.address || "";
        saveState();
        status.textContent = `Loaded "${p.name}" — it'll pre-fill the client email.`;
        results.querySelectorAll(".karbon-row").forEach((r) => r.classList.remove("sel"));
        row.classList.add("sel");
      });
    });
  } catch (e) {
    status.textContent = "Could not reach the proxy. Check the URL and that the Worker is deployed.";
  }
}

document.getElementById("btn-karbon").addEventListener("click", openKarbonModal);
document.getElementById("karbon-close").addEventListener("click", closeKarbonModal);
document.getElementById("karbon-close2").addEventListener("click", closeKarbonModal);
karbonModal().addEventListener("click", (e) => { if (e.target === karbonModal()) closeKarbonModal(); });
document.getElementById("karbon-search").addEventListener("click", karbonSearch);
document.getElementById("karbon-q").addEventListener("keydown", (e) => { if (e.key === "Enter") karbonSearch(); });
["karbon-url", "karbon-pass"].forEach((id) => document.getElementById(id).addEventListener("change", saveKarbonConfig));

/* ---- Toolbar ------------------------------------------------------------- */
document.getElementById("btn-add").addEventListener("click", () => {
  state.scenarios.push(blankScenario());
  commit();
});
document.getElementById("btn-example").addEventListener("click", () => {
  state.scenarios = exampleScenarios();
  commit();
});
document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("Reset all assumptions and scenarios to defaults?")) return;
  state = { rates: defaultRates(), scenarios: exampleScenarios(), emailMeta: { client: "", sender: "" }, remun: defaultRemun(), homeRent: defaultHomeRent(), childEmp: defaultChildEmp(), rlp: defaultRLP(), karbon: state.karbon || { proxyUrl: "", passphrase: "" }, checklist: defaultChecklist() };
  saveState();
  renderAll();
});
document.getElementById("checklist-reset").addEventListener("click", () => {
  if (!confirm("Clear all checklist ticks, statuses and notes?")) return;
  state.checklist = defaultChecklist();
  saveState();
  renderChecklist();
});
document.getElementById("btn-print").addEventListener("click", () => window.print());
document.getElementById("remun-add").addEventListener("click", () => {
  state.remun.people.push({ name: "Shareholder", otherIncome: 0, isEmployee: false, isShareholder: true, sharePct: 0, pension: 0 });
  saveState();
  renderRemun();
});

renderAll();
