/* Бірқалып: private local budget + optional live shared workspace. */
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
const uid = () => crypto.randomUUID();
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Qyzylorda" }).format(
    new Date(),
  );
const future = (n) =>
  new Date(Date.parse(today() + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const daysTo = (d) =>
  Math.max(
    0,
    Math.round(
      (Date.parse(d + "T12:00:00Z") - Date.parse(today() + "T12:00:00Z")) /
        86400000,
    ),
  );
const months = [
  "қаңтар",
  "ақпан",
  "наурыз",
  "сәуір",
  "мамыр",
  "маусым",
  "шілде",
  "тамыз",
  "қыркүйек",
  "қазан",
  "қараша",
  "желтоқсан",
];
const dateLabel = (d) =>
  Number(d?.slice(8, 10)) + " " + months[Number(d?.slice(5, 7)) - 1];
const cats = ["Тамақ", "Көлік", "Үй", "Демалыс", "Сатып алу", "Басқа"];
const icons = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  plan: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 5h6"/>',
  transactions: '<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>',
  ai: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  goals:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8-8"/>',
  wishes:
    '<path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wallet:
    '<path d="M3 7V5a2 2 0 0 1 2-2h13v4M3 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm13 6h5m-4 0v2"/>',
  report: '<path d="M4 20h16M7 16v-5m5 5V4m5 12v-8"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.8M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
};
const icon = (n) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] || icons.wallet}</svg>`;
const btn = (text, action, cls = "primary", id = "") =>
  `<button class="btn ${cls}" data-action="${action}" ${id ? `data-id="${esc(id)}"` : ""}>${text}</button>`;
const KEY = "birqalyp-v5";
function seed() {
  return {
    name: "Мадияр",
    plan: "free",
    opening: 350000,
    next: future(20),
    reserve: 20000,
    savings: 30000,
    start: future(-5),
    bills: [
      {
        id: uid(),
        name: "Пәтерақы",
        amount: 90000,
        date: future(5),
        paid: false,
      },
      {
        id: uid(),
        name: "Интернет",
        amount: 6000,
        date: future(3),
        paid: false,
      },
      {
        id: uid(),
        name: "Коммуналдық төлем",
        amount: 14000,
        date: future(9),
        paid: false,
      },
    ],
    entries: [
      {
        id: uid(),
        type: "expense",
        amount: 18500,
        category: "Тамақ",
        note: "Азық-түлік",
        date: future(-1),
      },
      {
        id: uid(),
        type: "expense",
        amount: 2200,
        category: "Көлік",
        note: "Такси",
        date: today(),
      },
    ],
  };
}
function loadPersonal() {
  try {
    const x = JSON.parse(localStorage.getItem(KEY));
    if (
      x &&
      Array.isArray(x.entries) &&
      Array.isArray(x.bills) &&
      Number.isFinite(x.opening)
    )
      return x;
    const old = JSON.parse(localStorage.getItem("birqalyp-v1"));
    if (old)
      return {
        ...seed(),
        opening: old.base,
        next: old.payday,
        reserve: old.reserve,
        savings: old.savings,
        bills: old.bills,
        entries: old.transactions,
      };
  } catch {}
  return seed();
}
let personal = loadPersonal();
function demoGroup() {
  return {
    id: "demo",
    name: "Біздің отбасы",
    ownerId: "m",
    viewerId: "m",
    plan: "free",
    subscriptionStatus: "demo",
    members: [
      { id: "m", name: "Мадияр" },
      { id: "u", name: "Умида" },
    ],
    opening: 400000,
    reserve: 30000,
    next: future(20),
    revision: 1,
    entries: [
      {
        id: "se1",
        type: "expense",
        amount: 28500,
        category: "Тамақ",
        note: "Үйге азық-түлік",
        date: today(),
        by: "m",
      },
      {
        id: "se2",
        type: "expense",
        amount: 8000,
        category: "Үй",
        note: "Интернет",
        date: today(),
        by: "u",
      },
    ],
    goals: [
      {
        id: "g1",
        name: "Отбасымен демалыс",
        target: 500000,
        saved: 120000,
        date: future(120),
      },
      {
        id: "g2",
        name: "Үйге жаңа жиһаз",
        target: 250000,
        saved: 45000,
        date: future(90),
      },
    ],
    wishes: [
      {
        id: "w1",
        name: "Балама ойыншық алу",
        price: 15000,
        forWhom: "Баламызға",
        note: "Туған күніне құрастырмалы ойыншық",
        by: "m",
        votes: ["u"],
        bought: false,
      },
      {
        id: "w2",
        name: "Үйге шаңсорғыш",
        price: 65000,
        forWhom: "Отбасымызға",
        note: "Бірге жақсы модель таңдайық",
        by: "u",
        votes: ["m"],
        bought: false,
      },
      {
        id: "w3",
        name: "Бірге киноға бару",
        price: 10000,
        forWhom: "Екеумізге",
        note: "Демалыс күнін бірге өткізу",
        by: "u",
        votes: [],
        bought: false,
      },
    ],
  };
}
let group;
try {
  group = JSON.parse(localStorage.getItem("birqalyp-demo")) || demoGroup();
} catch {
  group = demoGroup();
}
const SPACE_KEY = "birqalyp-last-space";
function lastSpace() {
  try {
    return localStorage.getItem(SPACE_KEY) === "shared" ? "shared" : "personal";
  } catch {
    return "personal";
  }
}
function rememberSpace() {
  try {
    localStorage.setItem(SPACE_KEY, mode);
  } catch {}
}
let token = localStorage.getItem("birqalyp-session") || "",
  serverAvailable = false,
  live = false,
  mode = lastSpace(),
  page = "overview",
  filter = "all",
  chat = [],
  busy = false,
  syncError = false,
  currentInvite = localStorage.getItem("birqalyp-invite") || "";
const menu = {
  personal: [
    ["overview", "Шолу"],
    ["plan", "Айлық жоспары"],
    ["transactions", "Операциялар"],
    ["ai", "ЖИ кеңес"],
  ],
  shared: [
    ["overview", "Ортақ шолу"],
    ["goals", "Мақсаттар"],
    ["wishes", "Хотелкалар"],
    ["ai", "ЖИ кеңес"],
  ],
};
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(personal));
    if (!live) localStorage.setItem("birqalyp-demo", JSON.stringify(group));
  } catch {
    toast("Браузер деректерді сақтай алмады.");
  }
}
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4000);
}
function totals(b) {
  const income = b.entries
      .filter((x) => x.type === "income")
      .reduce((a, x) => a + x.amount, 0),
    expense = b.entries
      .filter((x) => x.type === "expense")
      .reduce((a, x) => a + x.amount, 0);
  return {
    income,
    expense,
    balance:
      b.opening +
      income -
      expense -
      (b.bills || []).filter((x) => x.paid).reduce((a, x) => a + x.amount, 0),
  };
}
function stats() {
  const b = mode === "personal" ? personal : group,
    t = totals(b),
    days = daysTo(b.next),
    reserved =
      mode === "personal"
        ? personal.bills
            .filter((x) => !x.paid && x.date <= b.next)
            .reduce((a, x) => a + x.amount, 0) + personal.savings
        : group.goals.reduce((a, x) => a + x.saved, 0),
    available = t.balance - reserved - b.reserve,
    todaySpent = b.entries
      .filter((x) => x.type === "expense" && x.date === today())
      .reduce((a, x) => a + x.amount, 0),
    daily = days ? Math.max(0, (available + todaySpent) / days) : 0;
  return {
    ...t,
    days,
    reserved,
    available,
    todaySpent,
    daily,
    left: Math.max(0, daily - todaySpent),
    average: days ? Math.max(0, available / days) : 0,
  };
}
const currentPlan = () => (mode === "shared" ? group.plan : personal.plan);
const memberName = (id) =>
  group.members.find((m) => m.id === id)?.name || "Қатысушы";
const isOwner = () => group.viewerId === group.ownerId;
function heading(title, desc, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${mode === "personal" ? "ӨЗІҢ ҮШІН. ЕРТЕҢІҢ ҮШІН." : "БІРГЕ ЖОСПАРЛАЙМЫЗ. БІРГЕ ЖЕТЕМІЗ."}</div><h1>${title}</h1><p class="subtitle">${desc}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function empty(text, action, label) {
  return `<div class="empty-state"><div class="empty-icon">${icon(mode === "personal" ? "wallet" : "users")}</div><h3>${text}</h3><p>Алғашқы қадамнан бастайық.</p>${action ? btn(label, action, "secondary") : ""}</div>`;
}
function txRows(entries) {
  return entries.length
    ? (mode === "shared" ? [...entries] : [...entries].reverse())
        .map(
          (x) =>
            `<div class="tx-row"><span class="category-icon ${x.type === "income" ? "mint" : ""}">${icon(x.type === "income" ? "wallet" : x.category === "Үй" ? "overview" : "transactions")}</span><div class="tx-info"><strong>${esc(x.note || x.category)}</strong><span class="tx-note">${esc(x.category)} · ${dateLabel(x.date)}${mode === "shared" ? " · " + esc(memberName(x.by)) : ""}</span></div><span class="tx-amount ${x.type === "income" ? "positive" : ""}">${x.type === "income" ? "+" : x.type === "transfer" ? "↔ " : "−"}${money(x.amount)}</span>${mode === "personal" ? `<button class="icon-btn" data-action="entry-edit" data-id="${x.id}" aria-label="Операцияны түзету">✎</button>` : ""}${mode === "personal" || ((x.by === group.viewerId || isOwner()) && !group.wishes.some((w) => w.purchaseEntryId === x.id)) ? `<button class="icon-btn" data-action="entry-delete" data-id="${x.id}" aria-label="Операцияны жою">×</button>` : ""}</div>`,
        )
        .join("")
    : empty("Әзірге операция жоқ", "entry", "Операция қосу");
}
function familyBanner() {
  return `<div class="family-banner"><div class="member-stack">${group.members
    .slice(0, 3)
    .map(
      (m, i) =>
        `<span class="mini-avatar ${i % 2 ? "peach" : ""}" title="${esc(m.name)}">${esc(m.name[0])}</span>`,
    )
    .join(
      "",
    )}</div><div class="banner-copy"><strong>${esc(group.name)}</strong><span>${live ? (syncError ? "Байланыс үзілді · қайта қосылуда" : "Ортақ жазбалар синхрондалады") : "Демо кеңістік · осы браузерде ғана"} · ${group.members.length} адам</span></div><div class="banner-actions">${live ? btn("Адам шақыру →", "invite", "secondary small") : btn("Нақты ортақ бюджет ашу →", "create-group", "secondary small")}</div></div>`;
}
function warning(s) {
  return s.available < 0
    ? `<div class="alert warning">Міндеттемелер мен бөлінген қорларға ${money(-s.available)} жетіспейді. Жоспарды қайта қарап шығыңыз.</div>`
    : s.days === 0
      ? '<div class="alert warning">Жалақы күні келді. Ақша автоматты қосылмайды: нақты кірісті енгізіп, келесі күнді жаңартыңыз.</div>'
      : "";
}
function overview() {
  const s = stats(),
    shared = mode === "shared",
    obligations = personal.bills
      .filter((x) => !x.paid && x.date <= personal.next)
      .reduce((a, x) => a + x.amount, 0);
  return (
    heading(
      shared ? "Бір отбасы. Бір жоспар." : `Сәлем, ${esc(personal.name)} 👋`,
      shared
        ? "Армандар ортақ болғанда, оларға жету де жеңіл."
        : "Бүгінгі ақшаңды біл. Ертеңіңді еркін жоспарла.",
      `<span class="badge ${live && shared ? "mint" : "ghost"}">${shared ? (live ? "● Онлайн кеңістік" : "Демо кеңістік") : "◈ Жеке бюджет"}</span>`,
    ) +
    (shared ? familyBanner() : "") +
    `<div class="grid-dashboard"><section class="card hero"><div class="hero-decoration"></div><div class="hero-label">${shared ? "Отбасының ортақ балансы" : "Бүгінге қалған лимит"}<span class="badge">${shared ? "Бірге" : "Тек өзіңе"}</span></div><div class="hero-money">${money(shared ? s.balance : s.left)}</div><div class="hero-subtitle">${shared ? "Ортақ салымдар мен шығындар. Жеке қаржыңыз бөлек." : "Айлыққа дейінгі жоспарың — бір қарағанда."}</div><div class="hero-progress"><span style="width:${shared ? Math.min(100, (s.reserved / Math.max(1, s.balance)) * 100) : Math.min(100, (s.todaySpent / Math.max(1, s.daily)) * 100)}%"></span></div><div class="hero-stats"><div><span>${shared ? "Күнделікті қолжетімді" : "Бүгін жұмсалды"}</span><strong>${money(shared ? Math.max(0, s.available) : s.todaySpent)}</strong></div><div><span>${shared ? "Мақсаттарға бөлінген" : "Бүгінгі бастапқы лимит"}</span><strong>${money(shared ? s.reserved : s.daily)}</strong></div></div><div class="hero-foot">${icon("plan")} Келесі айлыққа <b>${s.days} күн</b><span>· ${dateLabel(shared ? group.next : personal.next)}</span>${btn("Есеп қалай шығады?", "calculation", "hero-link small")}</div></section><section class="card"><div class="card-header"><h2>${shared ? "Отбасылық жоспар" : "Айлық жоспары"}</h2>${btn("Өзгерту →", shared ? "shared-plan" : "plan", "text-link")}</div><div class="budget-breakdown"><div><span>Қолдағы қалдық</span><b>${money(s.balance)}</b></div><div><span>${shared ? "Ортақ мақсаттарға" : "Міндетті төлемдерге"}</span><b>− ${money(shared ? s.reserved : obligations)}</b></div>${shared ? "" : `<div><span>Жинаққа бөлінді</span><b>− ${money(personal.savings)}</b></div>`}<div><span>Күтпеген жағдайға резерв</span><b>− ${money(shared ? group.reserve : personal.reserve)}</b></div><div class="breakdown-total"><span>Күнделікті шығынға</span><b>${money(Math.max(0, s.available))}</b></div></div><div class="card-note">${icon("lock")} ${shared ? "Мақсаттағы жинақ күнделікті ақшадан бөлек есептеледі." : "Жинақ пен резерв — жоспар. Банкке автоматты аударылмайды."}</div></section></div>${warning(s)}<div class="stat-grid"><article class="stat-card"><span class="stat-icon mint">${icon("wallet")}</span><div><span class="stat-label">${shared ? "Орташа күндік жоспар" : "Қолдағы ақша"}</span><strong class="stat-value">${money(shared ? s.average : s.balance)}</strong><span class="stat-note">${shared ? "Бөлінген қорлар ескерілді" : "Енгізілген операциялар бойынша"}</span></div></article><article class="stat-card"><span class="stat-icon peach">${icon(shared ? "wishes" : "report")}</span><div><span class="stat-label">${shared ? "Алынбаған хотелкалар" : "Кезеңдегі шығын"}</span><strong class="stat-value">${shared ? group.wishes.filter((w) => !w.bought).length + " қалау" : money(s.expense)}</strong><span class="stat-note">${shared ? money(group.wishes.filter((w) => !w.bought).reduce((a, w) => a + w.price, 0)) : "Өзіңіздің жеке шығындарыңыз"}</span></div></article><article class="stat-card"><span class="stat-icon lilac">${icon(shared ? "goals" : "plan")}</span><div><span class="stat-label">${shared ? "Ортақ мақсаттар" : "Айлыққа дейін"}</span><strong class="stat-value">${shared ? group.goals.length + " мақсат" : s.days + " күн"}</strong><span class="stat-note">${shared ? "Кішкентай қадам — үлкен арман" : dateLabel(personal.next) + " күні"}</span></div></article></div><div class="quick-actions">${btn(icon("plus") + " Шығын қосу", "entry", "quick-action primary")}${btn(icon(shared ? "wishes" : "wallet") + (shared ? " Хотелка қосу" : " Сатып алсам ше?"), shared ? "wish" : "whatif", "quick-action secondary")}${btn(icon("report") + " Есепті көру", "report", "quick-action secondary")}</div><div class="bottom-grid"><section class="card"><div class="card-header"><h2>${shared ? "Соңғы ортақ операциялар" : "Соңғы операциялар"}</h2>${btn("Барлығы →", "transactions", "text-link")}</div>${txRows(shared ? group.entries.slice(0, 4) : personal.entries.slice(-4))}</section><section class="card">${
      shared
        ? `<div class="card-header"><h2>Бірге жететін мақсат</h2>${btn("Барлығы →", "goals", "text-link")}</div>${group.goals.length ? goalCard(group.goals[0], 0, true) : empty("Бірінші арман қандай?", "goal", "Мақсат қосу")}`
        : `<div class="card-header"><h2>Жақын төлемдер</h2><span class="badge ghost">Жоспарда</span></div>${
            personal.bills
              .filter((x) => !x.paid && x.date <= personal.next)
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 3)
              .map(
                (x) =>
                  `<div class="bill-row"><span class="category-icon">${icon("plan")}</span><div class="tx-info"><strong>${esc(x.name)}</strong><span class="tx-note">${dateLabel(x.date)}</span></div><b>${money(x.amount)}</b>${btn("✓", "bill-pay", "icon-btn", x.id)}</div>`,
              )
              .join("") || empty("Алдағы төлем жоқ")
          }`
    }</section></div>`
  );
}
function field(label, name, type = "text", value = "", attrs = "") {
  return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs} required></label>`;
}
function planView() {
  const s = stats();
  return (
    heading(
      "Айлық жоспары",
      "Тұрақты төлемдеріңді ескер. Қалған ақшаны өзіңе бөл.",
    ) +
    `<form id="plan-form" class="card"><div class="card-header"><h2>Менің айлық кезеңім</h2><span class="badge mint">${esc(personal.name)}</span></div><div class="form-grid">${field("Қолдағы нақты қалдық, ₸", "balance", "number", s.balance, 'min="0" max="1000000000" step="1"')}${field("Келесі жалақы күні", "next", "date", personal.next, `min="${today()}"`)}${field("Жинаққа қалдыратын сома, ₸", "savings", "number", personal.savings, 'min="0" max="1000000000" step="1"')}${field("Күтпеген жағдайға резерв, ₸", "reserve", "number", personal.reserve, 'min="0" max="1000000000" step="1"')}</div><div class="form-section"><div class="card-header"><h2>Міндетті төлемдер</h2>${btn("＋ Төлем қосу", "bill-add", "secondary small")}</div><div id="bill-fields">${personal.bills.map(billField).join("")}</div><p class="field-help">Тамақ пен көлік сияқты күнделікті шығындарды мұнда қоспаңыз. Төленген міндеттеме екінші рет шегерілмейді.</p></div><div class="form-actions"><button class="btn primary" type="submit">Жоспарды сақтау</button><span class="field-help">Күндік лимит бірден жаңарады.</span></div></form>`
  );
}
function billField(b) {
  return `<div class="bill-edit" data-id="${b.id}" data-paid="${b.paid}">${field(b.paid ? "✓ Төленді" : "Атауы", "bill-name", "text", b.name, b.paid ? "disabled" : 'maxlength="60"')}${field("Сома, ₸", "bill-amount", "number", b.amount, 'min="1" max="1000000000" step="1" ' + (b.paid ? "disabled" : ""))}${field("Күні", "bill-date", "date", b.date, b.paid ? "disabled" : "")}${b.paid ? '<span class="badge mint">Төленді</span>' : btn("×", "bill-remove", "icon-btn")}</div>`;
}
function transactions() {
  const b = mode === "personal" ? personal : group;
  return (
    heading(
      mode === "personal" ? "Менің операцияларым" : "Ортақ операциялар",
      "Кіріс пен шығынның әрқайсысы өз орнында.",
      btn("＋ Операция қосу", "entry"),
    ) +
    `<section class="card"><div class="card-header"><div class="filter-tabs">${["all", "expense", "income"].map((v, i) => `<button class="btn ${filter === v ? "primary" : "light"} small" data-action="filter" data-id="${v}">${["Барлығы", "Шығын", "Кіріс"][i]}</button>`).join("")}</div><div class="heading-actions">${btn("Есепті көру", "report", "secondary small")}${btn("CSV жүктеу →", "export", "secondary small")}</div></div>${txRows(b.entries.filter((x) => filter === "all" || x.type === filter))}</section>`
  );
}
function goalCard(g, i = 0, small = false) {
  const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
  return `<article class="goal-card ${small ? "compact" : ""}"><div class="goal-cover ${["sea", "sand", "lilac"][i % 3]}"><span class="goal-illustration">${["☀", "⌂", "✧"][i % 3]}</span><span class="badge">${pct}% жиналды</span></div><div class="goal-body"><h3 class="goal-title">${esc(g.name)}</h3><div class="goal-meta"><b>${money(g.saved)}</b><span>/ ${money(g.target)}</span></div><div class="goal-progress"><span style="width:${pct}%"></span></div><div class="goal-footer"><span>${dateLabel(g.date)} · ${daysTo(g.date)} күн</span>${pct >= 100 ? '<span class="badge mint">✓ Жиналды</span>' : btn("＋ Жинақ қосу", "contribute", "secondary small", g.id)}</div>${isOwner() && !small ? '<div class="goal-management">' + (g.saved > 0 ? btn("Жинақты босату", "goal-withdraw", "text-link", g.id) : "") + btn("Мақсатты жою", "goal-delete", "text-link", g.id) + "</div>" : ""}</div></article>`;
}
function goals() {
  return (
    heading(
      "Арманды бірге жақындатайық.",
      "Ортақ ақшаңның бір бөлігін маңызды мақсаттарға қалдыр.",
      btn("＋ Мақсат қосу", "goal"),
    ) +
    familyBanner() +
    `<div class="goals-grid">${group.goals.map((g, i) => goalCard(g, i)).join("") || empty("Алғашқы ортақ мақсатты қосыңыз", "goal", "Мақсат қосу")}</div><div class="alert info">${icon("lock")} Мақсатқа қосылған сома күнделікті қолжетімді ақшадан бөлінеді. Бұл банк аударымы емес.</div>`
  );
}
function wishes() {
  return (
    heading(
      "Кішкентай қалаулар. Үлкен қуаныш.",
      "Отбасыңа керек затты қос. Бағасын жаз. Бірге шешіңдер.",
      btn("＋ Хотелка қосу", "wish"),
    ) +
    familyBanner() +
    `<div class="filter-tabs wishes-filter">${["all", "planned", "bought"].map((v, i) => btn(["Барлығы", "Жоспарда", "Сатып алынды"][i], "filter", filter === v ? "primary small" : "light small", v)).join("")}</div><div class="wishes-grid">${
      group.wishes
        .filter(
          (w) =>
            filter === "all" || (filter === "bought" ? w.bought : !w.bought),
        )
        .map(
          (w, i) =>
            `<article class="wish-card ${w.bought ? "bought" : ""}"><div class="wish-top"><span class="wish-icon ${["peach", "mint", "lilac"][i % 3]}">${icon("wishes")}</span><span class="badge ${w.bought ? "mint" : "ghost"}">${w.bought ? "✓ Сатып алынды" : "Жоспарда"}</span></div><h3>${esc(w.name)}</h3><div class="wish-price">${money(w.price)}</div><p class="wish-description">${esc(w.note) || "Бірге таңдайтын тағы бір қуаныш."}</p><div class="wish-tags"><span class="badge ghost">${esc(w.forWhom)}</span><span class="tx-author">${esc(memberName(w.by))} қосты</span></div><div class="wish-footer">${w.bought ? '<span class="field-help">♥ ' + w.votes.length + "</span>" : btn((w.votes.includes(group.viewerId) ? "♥" : "♡") + " " + w.votes.length, "vote", "vote-btn " + (w.votes.includes(group.viewerId) ? "selected" : ""), w.id)}${w.bought ? '<span class="field-help">Шығынға жазылды</span>' : btn("Сатып алдық", "wish-buy", "secondary small", w.id)}${w.by === group.viewerId || isOwner() ? btn("×", "wish-delete", "icon-btn", w.id) : ""}</div></article>`,
        )
        .join("") || empty("Бұл тізім әзірге бос", "wish", "Хотелка қосу")
    }</div>`
  );
}
const tiers = [
  {
    id: "free",
    name: "Free",
    price: "0",
    caption: "Өз қаржыңа алғашқы қадам.",
    features: [
      "Күндік лимит және айлық жоспар",
      "Шығын мен кірісті енгізу",
      "2 адамға ортақ бюджет",
      "3 мақсат · 5 хотелка",
      "Деректерге негізделген кеңес",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    price: "990",
    caption: "Көбірек мүмкіндік, анық көрініс.",
    features: [
      "Free тарифіндегі барлық мүмкіндік",
      "CSV форматында есепті жүктеу",
      "Айлыққа дейінгі қалдық болжамы",
      "20 мақсат · 50 хотелка",
      "ЖИ қызметі қосылса, еркін сұрақтар",
    ],
  },
  {
    id: "family",
    name: "Family",
    price: "1 990",
    caption: "Бүкіл отбасың бір кеңістікте.",
    features: [
      "Plus тарифіндегі барлық мүмкіндік",
      "Ортақ бюджетке 6 адамға дейін",
      "50 мақсат · 200 хотелка",
      "Қатысушыларды басқару",
      "Ортақ CSV есеп және болжам",
    ],
  },
];
function pricing() {
  return (
    heading(
      "Өзіңе сай бірқалыпты таңда.",
      "Жеке жоспарыңнан отбасыңның үлкен арманына дейін.",
      '<span class="badge peach">Жазылым демосы</span>',
    ) +
    `<div class="pricing-grid">${tiers.map((t) => `<article class="price-card ${t.id === "plus" ? "featured" : ""}">${t.id === "plus" ? '<span class="price-badge">ЕҢ ТАНЫМАЛ</span>' : ""}<span class="price-name">${t.name}</span><p>${t.caption}</p><div class="price">${t.price} <span>₸</span></div><span class="price-period">${t.id === "free" ? "әрқашан тегін" : "/ ай · үлгі баға"}</span>${btn(currentPlan() === t.id ? "✓ Қазіргі тариф" : "Тегін байқап көру", "subscribe", currentPlan() === t.id ? "secondary wide" : "primary wide", t.id)}<ul class="features">${t.features.map((f) => `<li><span>✓</span>${f}</li>`).join("")}</ul></article>`).join("")}</div><div class="pricing-note"><strong>Әзірге бұл — жазылым форматының демосы.</strong><p>Тариф мүмкіндіктерін тегін сынауға болады. Карта сұралмайды, ақша алынбайды, автоматты төлем жоқ. Нақты төлем жүйесі бөлек қосылады.</p></div>`
  );
}
function localAdvice(q) {
  const s = stats(),
    b = mode === "personal" ? personal : group;
  if (/шығын|қайда|санат|көп/.test(q.toLowerCase())) {
    const c = {};
    b.entries
      .filter((e) => e.type === "expense")
      .forEach((e) => (c[e.category] = (c[e.category] || 0) + e.amount));
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top
      ? `Ең көп шығын — ${top[0]}: ${money(top[1])}. Барлық енгізілген шығын ${money(s.expense)}. Осы санатқа апталық шек белгілеп, келесі аптадағы нәтижені салыстырыңыз.`
      : "Талдау үшін алғашқы шығынды енгізіңіз.";
  }
  if (mode === "shared" && /мақсат|жина/.test(q.toLowerCase())) {
    const g = group.goals.find((g) => g.saved < g.target);
    if (!g)
      return "Алдымен ортақ мақсат қосыңыз. Жиналған соманы күнделікті ақшадан бөлек жоспарлаймыз.";
    const months = Math.max(1, Math.ceil(daysTo(g.date) / 30));
    return `«${g.name}» мақсатына ${money(g.target - g.saved)} қалды. Шамамен ${months} айға бөлсек, ай сайын ${money((g.target - g.saved) / months)} бөлу керек. Қазір ортақ бюджетте ${money(Math.max(0, s.available))} қолжетімді.`;
  }
  if (mode === "shared" && /хотел|қалау|алсам|зат/.test(q.toLowerCase())) {
    const price = group.wishes
      .filter((w) => !w.bought)
      .reduce((a, w) => a + w.price, 0);
    return `Жоспардағы хотелкалар: ${money(price)}. Мақсаттар мен резервтен кейін ${money(Math.max(0, s.available))} қолжетімді. ${price > s.available ? "Барлық қалауды бірден алу бюджетке сыймайды. Ең қажеттісін бірге таңдаңыз." : "Барлығын алғаннан кейін " + money(s.available - price) + " қалады. Алдымен жақын міндеттемелерді де ескеріңіз."}`;
  }
  if (s.available < 0)
    return `Жоспардағы қорлар мен төлемдерге ${money(-s.available)} жетіспейді. Алдымен міндеттемелерді тексеріп, міндетті емес сатып алуды кейінге қалдырыңыз.`;
  if (!s.days)
    return "Жалақы күні келді. Нақты түскен табысты кіріс ретінде қосып, келесі жалақы күнін жаңартыңыз.";
  return `Қолдағы ақша: ${money(s.balance)}. Бөлінген қорлардан кейін ${money(s.available)} қалады. Келесі айлыққа ${s.days} күн: орташа күндік жоспар ${money(s.average)}. Бүгінге ${money(s.left)} қалды. ${mode === "shared" ? "Ортақ сатып алуды осы бос ақшамен салыстырыңыз." : "Жинақ пен резервті күнделікті шығынға қоспаңыз."}`;
}
function aiView() {
  return (
    heading(
      "Ақшаң туралы сөйлесейік.",
      "Енгізген деректеріңе сүйенген сабырлы, түсінікті кеңес.",
    ) +
    `<div class="advice-layout"><section class="card advice-card"><div class="card-header"><div class="advice-icon">${icon("ai")}</div><span class="badge mint">${mode === "personal" ? "Тек жеке бюджет" : "Тек ортақ бюджет"}</span></div><h2>Бірқалып көмекшісі</h2><p class="subtitle">Сұрағыңызды таңдаңыз немесе жазыңыз.</p><div class="advice-prompts">${(mode === "shared" ? ["Хотелкаларға ақша жете ме?", "Мақсатқа қанша жинау керек?", "Көп шығын қайда кетті?"] : ["Айлыққа дейін ақша жете ме?", "Көп шығын қайда кетті?", "Күндік лимитімді түсіндір"]).map((q) => btn(q, "advice", "prompt", q)).join("")}</div><div class="chat-messages" aria-live="polite">${chat.map((m) => `<div class="chat-message ${m.role}"><span>${m.role === "user" ? "Сіз" : m.source === "ai" ? "ЖИ көмекші" : "Есептік кеңес"}</span><p>${esc(m.text)}</p></div>`).join("") || '<div class="chat-message assistant"><span>Есептік кеңес</span><p>Сәлем! Ақшаңыздың қайда кететінін, айлыққа дейінгі жоспар мен ортақ мақсаттарды бірге қарап шығайық.</p></div>'}</div><form id="chat-form" class="chat-form"><input name="question" maxlength="500" required placeholder="Мысалы, бүгін қанша жұмсай аламын?" aria-label="Кеңесшіге сұрақ"><button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Күтуде…" : "Жіберу →"}</button></form><p class="field-help">Әдепкіде нақты сандарға сүйенген есептік кеңес. Plus/Family және сервердегі ЖИ кілті болғанда генеративті ЖИ қосылады. Бұл қаржылық кепілдік емес.</p></section><section><article class="card insight-card"><span class="badge mint">БҮГІНГІ БАҒЫТ</span><h3>Өзіңе шағын кеңістік қалдыр.</h3><p>${esc(localAdvice("баланс"))}</p></article><article class="card privacy-card">${icon("lock")}<h3>Жеке мен ортақ — бөлек.</h3><p>Ортақ көмекшіге жеке бюджет жіберілмейді. Әр кеңістік өз дерегімен жұмыс істейді.</p></article></section></div>`
  );
}
function render() {
  rememberSpace();
  const title =
    menu[mode].find((x) => x[0] === page)?.[1] ||
    (page === "pricing"
      ? "Жазылым"
      : page === "transactions"
        ? "Ортақ операциялар"
        : "Шолу");
  $("#nav").innerHTML = menu[mode]
    .map(
      ([id, label]) =>
        `<button class="nav-item ${page === id ? "active" : ""}" ${page === id ? 'aria-current="page"' : ""} data-action="page" data-id="${id}"><span class="icon">${icon(id)}</span><span class="label">${label}</span>${id === "ai" ? '<span class="nav-new">✧</span>' : ""}</button>`,
    )
    .join("");
  $("#nav-label").textContent =
    mode === "personal" ? "МЕНІҢ КЕҢІСТІГІМ" : "ОТБАСЫ КЕҢІСТІГІ";
  document.querySelectorAll(".mode").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
    b.setAttribute("aria-pressed", b.dataset.mode === mode);
  });
  $("#current-label").textContent = title;
  const name = mode === "shared" ? memberName(group.viewerId) : personal.name;
  $("#profile-name").textContent = name;
  $(".profile .avatar").textContent = name[0];
  $(".user-avatar").textContent = name[0];
  $("#profile-meta").textContent =
    currentPlan().toUpperCase() +
    " · " +
    (mode === "personal"
      ? "жеке кеңістік"
      : live
        ? "онлайн отбасы"
        : "демо отбасы");
  $("#storage-label").textContent =
    mode === "personal"
      ? "Жеке деректер осы браузерде сақталады."
      : live
        ? "Ортақ деректер серверде сақталады."
        : "Ортақ демо осы браузерде сақталады.";
  $("#app").innerHTML = (
    {
      overview,
      plan: planView,
      transactions,
      goals,
      wishes,
      ai: aiView,
      pricing,
    }[page] || overview
  )();
  $("#today-label").textContent = dateLabel(today());
}
function go(p) {
  page = p;
  filter = "all";
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function switchMode(m) {
  mode = m;
  page = "overview";
  chat = [];
  filter = "all";
  render();
}
function modal(title, html) {
  $("#modal").innerHTML =
    `<div class="modal-heading"><h2 id="modal-title">${title}</h2>${btn("×", "close", "modal-close")}</div>${html}`;
  $("#modal").showModal();
}
function modalForm(title, kind, html, id = "") {
  modal(
    title,
    `<form id="modal-form" data-kind="${kind}" data-id="${id}">${html}<div class="modal-actions">${btn("Болдырмау", "close", "secondary")}<button type="submit" class="btn primary">Сақтау</button></div></form>`,
  );
}
function entryForm(id) {
  const b = mode === "personal" ? personal : group,
    e = b.entries.find((e) => e.id === id);
  modalForm(
    e
      ? "Операцияны түзету"
      : mode === "personal"
        ? "Жеке операция"
        : "Ортақ операция",
    "entry",
    `<div class="form-grid"><label>Операция түрі<select name="type"><option value="expense" ${e?.type === "expense" ? "selected" : ""}>Шығын</option><option value="income" ${e?.type === "income" ? "selected" : ""}>Кіріс / салым</option>${mode === "personal" ? `<option value="transfer" ${e?.type === "transfer" ? "selected" : ""}>Өз шоттарым арасындағы аударым</option>` : ""}</select></label>${field("Сомасы, ₸", "amount", "number", e?.amount || "", 'min="1" max="1000000000" step="1"')}<label>Санат<select name="category">${[...cats, "Айлық", "Салым"].map((c) => `<option ${e?.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>${field("Күні", "date", "date", e?.date || today(), `max="${today()}"`)}</div><label>Түсініктеме <span class="field-help">(міндетті емес)</span><input name="note" value="${esc(e?.note || "")}" maxlength="100" placeholder="Мысалы, азық-түлік"></label>${mode === "personal" ? '<label>Кіріс болса, қайда бөлінеді?<select name="allocation"><option value="daily">Күнделікті шығынға</option><option value="savings">Жинаққа</option><option value="reserve">Резервке</option></select></label>' : ""}<p class="field-help">${mode === "personal" ? "Жеке операция ортақ бюджетке берілмейді. Аударым қалдықты өзгертпейді." : "Ортақ операция барлық қатысушыға көрінеді."}</p>`,
    id || "",
  );
  if (mode === "personal") {
    const form = $("#modal-form");
    form.elements.allocation.value = e?.allocation || "daily";
    const syncAllocation = () => {
      form.elements.allocation.disabled = form.elements.type.value !== "income";
    };
    form.elements.type.onchange = syncAllocation;
    syncAllocation();
  }
}
function wishForm() {
  modalForm(
    "Отбасыға не керек?",
    "wish",
    field(
      "Хотелка атауы",
      "name",
      "text",
      "",
      'placeholder="Балама ойыншық алу" maxlength="70"',
    ) +
      `<div class="form-grid">${field("Бағасы, ₸", "price", "number", "", 'min="1" max="1000000000" step="1"')}${field("Кімге арналған?", "forWhom", "text", "", 'placeholder="Баламызға" maxlength="50"')}</div><label>Қосымша түсініктеме<textarea name="note" maxlength="300" placeholder="Мысалы, туған күніне"></textarea></label><p class="field-help">Қалауды қосу ақшаны шегермейді. Оны отбасыңыз бірге көріп, қолдай алады.</p>`,
  );
}
function goalForm() {
  modalForm(
    "Бірге жететін жаңа мақсат",
    "goal",
    field(
      "Мақсат атауы",
      "name",
      "text",
      "",
      'placeholder="Отбасымен демалыс" maxlength="70"',
    ) +
      field(
        "Қажетті сома, ₸",
        "target",
        "number",
        "",
        'min="1" max="1000000000" step="1"',
      ) +
      field("Қай күнге дейін?", "date", "date", future(90), `min="${today()}"`),
  );
}
function createForm() {
  if (live) return toast("Сізде ортақ кеңістік бар.");
  modalForm(
    "Өз отбасы кеңістігіңді аш",
    "create",
    `<p class="modal-description">Жеке бюджетіңіз өзіңізде қалады. Жаңа ортақ бюджет нөлден басталады.</p>${field("Отбасы / бюджет атауы", "name", "text", "Біздің отбасы", 'maxlength="60"')}${field("Сіздің атыңыз", "displayName", "text", personal.name, 'maxlength="40"')}<p class="field-help">${serverAvailable ? "Сақтағаннан кейін Умиданы немесе басқа қатысушыны сілтеме/QR арқылы шақыра аласыз." : "Онлайн бөлісу үшін сайтты npm start арқылы серверде іске қосу қажет. Демо кеңістікті қазір сынауға болады."}</p>`,
  );
}
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Сұрауды орындау мүмкін болмады");
  return data;
}
async function groupAction(action, fields = {}) {
  if (live) {
    const data = await api("/api/group/action", {
      method: "POST",
      body: JSON.stringify({ action, ...fields }),
    });
    group = data.group;
    if (data.invite) {
      currentInvite = new URL(data.invite.url, location.href).href;
      localStorage.setItem("birqalyp-invite", currentInvite);
    }
    return data;
  }
  demoAction(action, fields);
  group.revision++;
  persist();
  return { group };
}
function demoAction(action, f) {
  const caps = { free: [2, 3, 5], plus: [2, 20, 50], family: [6, 50, 200] }[
    group.plan
  ];
  if (action === "entry.add")
    group.entries.unshift({ ...f, id: uid(), by: group.viewerId });
  if (action === "entry.delete")
    group.entries = group.entries.filter((e) => e.id !== f.id);
  if (action === "wish.add") {
    if (group.wishes.length >= caps[2])
      throw Error("Хотелка шегіне жеттіңіз. Тарифті кеңейтіңіз.");
    group.wishes.unshift({
      ...f,
      id: uid(),
      by: group.viewerId,
      votes: [],
      bought: false,
    });
  }
  if (action === "wish.vote") {
    const w = group.wishes.find((w) => w.id === f.id);
    w.votes = w.votes.includes(group.viewerId)
      ? w.votes.filter((v) => v !== group.viewerId)
      : [...w.votes, group.viewerId];
  }
  if (action === "wish.buy") {
    const w = group.wishes.find((w) => w.id === f.id);
    if (w.bought) return;
    if (w.price > stats().available)
      throw Error(
        "Қолданыстағы ақша жеткіліксіз. Мақсат пен резерв қорғалған.",
      );
    w.bought = true;
    group.entries.unshift({
      id: uid(),
      type: "expense",
      amount: w.price,
      category: "Сатып алу",
      note: w.name,
      date: today(),
      by: group.viewerId,
    });
  }
  if (action === "wish.delete")
    group.wishes = group.wishes.filter((w) => w.id !== f.id);
  if (action === "goal.add") {
    if (group.goals.length >= caps[1])
      throw Error("Мақсат шегіне жеттіңіз. Тарифті кеңейтіңіз.");
    group.goals.push({ ...f, id: uid(), saved: 0 });
  }
  if (action === "goal.contribute") {
    const g = group.goals.find((g) => g.id === f.id);
    if (f.amount > stats().available || g.saved + f.amount > g.target)
      throw Error("Сома қолжетімді ақшадан немесе мақсат қалдығынан артық.");
    g.saved += f.amount;
  }
  if (action === "plan.update") {
    const delta = f.balance - totals(group).balance;
    if (delta !== 0)
      group.entries.unshift({
        id: uid(),
        type: delta > 0 ? "income" : "expense",
        amount: Math.abs(delta),
        category: "Басқа",
        note: "Қалдықты нақтылау",
        date: today(),
        by: group.viewerId,
      });
    group.reserve = f.reserve;
    group.next = f.next;
  }
  if (action === "goal.withdraw") {
    const g = group.goals.find((g) => g.id === f.id);
    if (f.amount > g.saved) throw Error("Мақсаттағы сома жеткіліксіз.");
    g.saved -= f.amount;
  }
  if (action === "goal.delete")
    group.goals = group.goals.filter((g) => g.id !== f.id);
  if (action === "subscription.demo") {
    if (
      group.members.length > { free: 2, plus: 2, family: 6 }[f.plan] ||
      group.goals.length > { free: 3, plus: 20, family: 50 }[f.plan] ||
      group.wishes.length > { free: 5, plus: 50, family: 200 }[f.plan]
    )
      throw Error("Қазіргі жазбалар бұл тариф шегінен асады.");
    group.plan = f.plan;
  }
  if (action === "member.remove")
    group.members = group.members.filter((m) => m.id !== f.id);
}
async function invite() {
  if (!live) return createForm();
  if (!currentInvite) {
    if (!isOwner()) return toast("Шақыру сілтемесін бюджет иесінен сұраңыз.");
    await groupAction("invite.rotate");
  }
  modal(
    "Жақындарыңды шақыр",
    `<p class="modal-description">QR немесе сілтемені Умидаға жіберіңіз. Қабылдағаннан кейін ортақ жазбалар екеуіңізге де көрінеді.</p><div class="invite-layout"><div class="qr-box" id="qr-box"></div><span class="badge mint">${esc(group.name)}</span></div><label>Шақыру сілтемесі<div class="copy-row"><input id="invite-link" readonly value="${esc(currentInvite)}">${btn("Көшіру", "copy-invite", "secondary")}</div></label><p class="field-help">Бұл сілтеме ортақ бюджетке кіру құқығын береді. Тек шақырғыңыз келген адамға жіберіңіз.</p>${isOwner() ? `<div class="modal-actions">${btn("Қатысушылар", "members", "secondary")}${btn("Жаңа сілтеме жасау", "rotate-invite", "light")}</div>` : ""}`,
  );
  const qr = qrcode(0, "M");
  qr.addData(currentInvite);
  qr.make();
  $("#qr-box").innerHTML = qr.createSvgTag({
    cellSize: 5,
    margin: 4,
    scalable: true,
  });
  $("#qr-box svg").setAttribute("aria-label", "Ортақ бюджетке шақыру QR коды");
}
async function joinView(code) {
  mode = "shared";
  try {
    const data = await api("/api/invites/" + encodeURIComponent(code));
    modalForm(
      `${esc(data.name)} — шақыру`,
      "join",
      `<div class="invite-view">${icon("users")}<p class="modal-description">Сізді ортақ бюджетке шақырды. Жеке ақшаңыз бен операцияларыңыз бұл топқа берілмейді.</p><span class="badge mint">${data.members.map((m) => esc(m.name)).join(" + ")}</span></div>${field("Атыңыз", "displayName", "text", "Умида", 'maxlength="40"')}<input type="hidden" name="code" value="${esc(code)}"><p class="field-help">Қабылдасаңыз, ортақ мақсаттар мен хотелкаларды көріп, өз жазбаңызды қоса аласыз.</p>`,
    );
  } catch (e) {
    toast(e.message);
  }
}
async function askAdvice(q) {
  if (busy) return;
  chat.push({ role: "user", text: q });
  busy = true;
  render();
  try {
    if (currentPlan() !== "free" && serverAvailable) {
      const b = mode === "personal" ? personal : group,
        context = {
          mode,
          stats: stats(),
          entries: b.entries
            .slice(
              mode === "personal" ? -10 : 0,
              mode === "personal" ? undefined : 10,
            )
            .map(({ type, amount, category, date }) => ({
              type,
              amount,
              category,
              date,
            })),
          ...(mode === "shared"
            ? {
                goals: group.goals
                  .slice(0, 5)
                  .map(({ name, target, saved, date }) => ({
                    name,
                    target,
                    saved,
                    date,
                  })),
                wishes: group.wishes
                  .filter((w) => !w.bought)
                  .slice(0, 5)
                  .map(({ name, price }) => ({ name, price })),
              }
            : {}),
        };
      const data = await api("/api/advice", {
        method: "POST",
        body: JSON.stringify({ question: q, context }),
      });
      if (data.configured && data.answer) {
        chat.push({ role: "assistant", source: "ai", text: data.answer });
        return;
      }
    }
    chat.push({
      role: "assistant",
      source: "calculation",
      text: localAdvice(q),
    });
  } catch {
    chat.push({
      role: "assistant",
      source: "calculation",
      text:
        localAdvice(q) + " ЖИ сервисі жауап бермеді, есептік кеңес көрсетілді.",
    });
  } finally {
    busy = false;
    render();
  }
}
function calculation() {
  const s = stats();
  modal(
    "Лимит қалай есептеледі?",
    `<div class="budget-breakdown"><div><span>Қолдағы қалдық</span><b>${money(s.balance)}</b></div><div><span>Мақсат / жинақ / міндеттемелер</span><b>− ${money(s.reserved)}</b></div><div><span>Резерв</span><b>− ${money((mode === "personal" ? personal : group).reserve)}</b></div><div class="breakdown-total"><span>Қолжетімді</span><b>${money(s.available)}</b></div></div><p class="modal-description">Бүгінгі бастапқы лимит: (қолжетімді ақша + бүгінгі шығын) / ${s.days} күн. Бүгінге қалған лимит: бастапқы лимит − бүгінгі шығын. Жалақы күні есепке кірмейді.</p>`,
  );
}
function whatif() {
  modal(
    "Сатып алсам ше?",
    `<p class="modal-description">Сатып алуды алдымен жоспарға салып көріңіз. Бұл есеп қалдықты өзгертпейді.</p>${field("Заттың бағасы, ₸", "purchase", "number", 20000, 'id="purchase" min="1" max="1000000000" step="1"')}<div id="purchase-result"></div><div class="modal-actions">${btn("Әзірге алмаймын", "close", "secondary")}${btn("Сатып алдым", "purchase-confirm")}</div>`,
  );
  purchaseResult();
}
function purchaseResult() {
  const s = stats(),
    amount = Number($("#purchase").value) || 0,
    after = s.available - amount;
  $("#purchase-result").innerHTML =
    `<div class="comparison-grid"><div><span>Орташа күндік жоспар</span><strong>${money(s.average)}</strong></div><div><span>Сатып алғаннан кейін</span><strong>${money(s.days ? Math.max(0, after / s.days) : 0)}</strong></div></div><p class="field-help">Күндік жоспар ${money(s.days ? Math.min(s.average, amount / s.days) : 0)}-ге азаяды.</p>${after < 0 ? `<div class="alert warning">${money(-after)} жетіспейді.</div>` : ""}`;
}
function report() {
  const s = stats(),
    b = mode === "personal" ? personal : group;
  const rows = cats
    .map((c) => ({
      c,
      n: b.entries
        .filter((e) => e.type === "expense" && e.category === c)
        .reduce((a, e) => a + e.amount, 0),
    }))
    .filter((x) => x.n);
  modal(
    "Шығындар есебі",
    `<span class="badge mint">${mode === "personal" ? "Жеке" : "Ортақ"} бюджет</span><h3 class="report-total">${money(s.expense)}</h3><div class="report-bars">${rows.map((x) => `<div class="report-row"><div><span>${x.c}</span><b>${money(x.n)}</b></div><div class="bar"><span style="width:${(x.n / Math.max(1, s.expense)) * 100}%"></span></div></div>`).join("") || empty("Әзірге шығын жоқ")}</div><div class="modal-actions">${btn("CSV жүктеу", "export", "secondary")}${btn("Қалдық болжамы", "forecast", "primary")}</div>`,
  );
}
function forecast() {
  if (currentPlan() === "free") {
    closeModal();
    go("pricing");
    return toast("Қалдық болжамы Plus және Family тарифтерінде.");
  }
  const s = stats(),
    n = Math.max(1, s.days),
    points = [0, Math.ceil(n / 4), Math.ceil(n / 2), Math.ceil((3 * n) / 4), n];
  modal(
    "Айлыққа дейінгі қалдық болжамы",
    `<p class="modal-description">Орташа күндік жоспарды ұстансаңыз: ${money(s.average)}/күн. Болашақ кіріс автоматты қосылмайды.</p><div class="forecast-chart">${points.map((d) => `<div class="forecast-col"><span>${money(s.balance - s.average * d)}</span><i style="height:${Math.max(6, ((s.balance - s.average * d) / Math.max(1, s.balance)) * 150)}px"></i><small>${d} күн</small></div>`).join("")}</div><p class="field-help">Тұрақты орташа шығынға негізделген сценарий. Нақты шығындар өзгеше болуы мүмкін.</p>`,
  );
}
function closeModal() {
  $("#modal").close();
}
function exportCSV() {
  if (currentPlan() === "free") {
    closeModal();
    go("pricing");
    return toast("CSV есебі Plus және Family тарифтерінде.");
  }
  const entries = (mode === "personal" ? personal : group).entries;
  const safe = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const csv =
    "\ufeff" +
    [
      ["Күні", "Түрі", "Санат", "Сома", "Түсініктеме", "Қатысушы"],
      ...entries.map((e) => [
        e.date,
        e.type,
        e.category,
        e.amount,
        e.note,
        mode === "shared" ? memberName(e.by) : personal.name,
      ]),
    ]
      .map((r) => r.map(safe).join(","))
      .join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  a.download = `birqalyp-${mode}-${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("CSV есеп жүктелді");
}
function members() {
  modal(
    "Отбасы қатысушылары",
    `<p class="modal-description">${group.members.length} адам · ${group.plan.toUpperCase()} тарифі</p>${group.members.map((m) => `<div class="tx-row"><span class="avatar">${esc(m.name[0])}</span><div class="tx-info"><strong>${esc(m.name)}</strong><span class="tx-note">${m.id === group.ownerId ? "Бюджет иесі" : "Қатысушы"}</span></div>${isOwner() && m.id !== group.ownerId ? btn("Алып тастау", "member-remove", "danger small", m.id) : ""}</div>`).join("")}<p class="field-help">Шақыру кезіндегі атыңыз басқа адамдарға көрінеді. Жеке бюджетіңіз бөлек қалады.</p>`,
  );
}
async function handleAction(a, id, b) {
  if (a === "page") return go(id);
  if (a === "close") return closeModal();
  if (["plan", "ai", "pricing", "transactions", "goals"].includes(a))
    return go(a);
  if (a === "filter") {
    filter = id;
    return render();
  }
  if (a === "entry") return entryForm();
  if (a === "entry-edit") return entryForm(id);
  if (a === "wish") return wishForm();
  if (a === "goal") return goalForm();
  if (a === "create-group") return createForm();
  if (a === "invite") return invite();
  if (a === "calculation") return calculation();
  if (a === "whatif") return whatif();
  if (a === "report") return report();
  if (a === "forecast") return forecast();
  if (a === "export") return exportCSV();
  if (a === "advice") return askAdvice(id);
  if (a === "profile")
    return modalForm(
      "Сіздің жеке профиліңіз",
      "profile",
      field("Атыңыз", "name", "text", personal.name, 'maxlength="40"') +
        '<p class="field-help">Жеке бюджет тек осы браузерде сақталады. Ортақ кеңістіктегі атыңыз шақыруды қабылдағанда белгіленеді.</p>',
    );
  if (a === "bill-add")
    return $("#bill-fields").insertAdjacentHTML(
      "beforeend",
      billField({ id: uid(), name: "", amount: 0, date: today(), paid: false }),
    );
  if (a === "bill-remove") return b.closest(".bill-edit").remove();
  if (a === "bill-pay") {
    const bill = personal.bills.find((x) => x.id === id);
    if (!bill.paid) {
      bill.paid = true;
      persist();
      render();
      toast("Төлем орындалды. Қосарлап шегерілмейді.");
    }
    return;
  }
  if (a === "entry-delete") {
    if (mode === "personal") {
      const old = personal.entries.find((e) => e.id === id);
      if (
        old.type === "income" &&
        ["savings", "reserve"].includes(old.allocation)
      )
        personal[old.allocation] = Math.max(
          0,
          personal[old.allocation] - old.amount,
        );
      personal.entries = personal.entries.filter((e) => e.id !== id);
      persist();
    } else await groupAction("entry.delete", { id });
    render();
    return toast("Операция жойылды");
  }
  if (a === "vote") {
    await groupAction("wish.vote", { id });
    return render();
  }
  if (a === "wish-delete")
    return modal(
      "Хотелканы жою керек пе?",
      `<p class="modal-description">Бұл қалау ортақ тізімнен алынады. Сатып алу шығыны болса, ол операцияларда қалады.</p><div class="modal-actions">${btn("Қалсын", "close", "secondary")}${btn("Жою", "wish-delete-confirm", "danger", id)}</div>`,
    );
  if (a === "wish-delete-confirm") {
    await groupAction("wish.delete", { id });
    closeModal();
    render();
    return;
  }
  if (a === "wish-buy") {
    const w = group.wishes.find((w) => w.id === id);
    return modal(
      "Сатып алуды растау",
      `<p class="modal-description">«${esc(w.name)}» — ${money(w.price)}. Бұл сома ортақ шығынға бір рет жазылады.</p><div class="modal-actions">${btn("Болдырмау", "close", "secondary")}${btn("Сатып алдық", "wish-buy-confirm", "primary", id)}</div>`,
    );
  }
  if (a === "wish-buy-confirm") {
    await groupAction("wish.buy", { id });
    closeModal();
    render();
    return toast("Сатып алу ортақ шығынға жазылды");
  }
  if (a === "contribute") {
    const g = group.goals.find((x) => x.id === id);
    return modalForm(
      "Мақсатқа жинақ қосу",
      "contribute",
      `<p class="modal-description">${esc(g.name)} · қалды ${money(g.target - g.saved)}</p>${field("Бөлетін сома, ₸", "amount", "number", "", 'min="1" max="' + Math.max(0, Math.min(g.target - g.saved, stats().available)) + '" step="1"')}<p class="field-help">Қолданыстағы ортақ ақшадан мақсатқа бөлінеді. Банк аударымы емес.</p>`,
      id,
    );
  }
  if (a === "goal-withdraw") {
    const g = group.goals.find((g) => g.id === id);
    return modalForm(
      "Мақсат жинағын босату",
      "goal-withdraw",
      `<p class="modal-description">${esc(g.name)} · жиналған ${money(g.saved)}. Босатылған ақша күнделікті ортақ бюджетке қайтады.</p>${field("Босататын сома, ₸", "amount", "number", "", 'min="1" max="' + g.saved + '" step="1"')}`,
      id,
    );
  }
  if (a === "goal-delete")
    return modal(
      "Мақсатты жою?",
      `<p class="modal-description">Мақсат жойылады. Оған бөлінген ақша ортақ қолжетімді бюджетке қайтады.</p><div class="modal-actions">${btn("Қалсын", "close", "secondary")}${btn("Мақсатты жою", "goal-delete-confirm", "danger", id)}</div>`,
    );
  if (a === "goal-delete-confirm") {
    await groupAction("goal.delete", { id });
    closeModal();
    render();
    return toast("Мақсат жойылды. Жинағы босатылды.");
  }
  if (a === "shared-plan")
    return modalForm(
      "Ортақ айлық жоспар",
      "shared-plan",
      `<div class="form-grid">${field("Қолдағы нақты ортақ қалдық, ₸", "balance", "number", stats().balance, 'min="0" max="1000000000" step="1"')}${field("Келесі айлық күні", "next", "date", group.next, `min="${today()}"`)}${field("Ортақ резерв, ₸", "reserve", "number", group.reserve, 'min="0" max="1000000000" step="1"')}</div>`,
    );
  if (a === "subscribe") {
    if (mode === "shared" && !isOwner())
      return toast("Ортақ тарифті бюджет иесі өзгертеді.");
    if (mode === "shared") await groupAction("subscription.demo", { plan: id });
    else {
      personal.plan = id;
      persist();
    }
    render();
    return toast(id.toUpperCase() + " демо тарифі қосылды. Ақша алынбайды.");
  }
  if (a === "copy-invite") {
    try {
      await navigator.clipboard.writeText($("#invite-link").value);
      toast("Шақыру сілтемесі көшірілді");
    } catch {
      $("#invite-link").select();
      toast("Сілтемені таңдап қойдым. Көшіріңіз.");
    }
    return;
  }
  if (a === "rotate-invite") {
    await groupAction("invite.rotate");
    closeModal();
    return invite();
  }
  if (a === "members") return members();
  if (a === "member-remove")
    return modal(
      "Қатысушыны алып тастау?",
      `<p class="modal-description">${esc(memberName(id))} ортақ бюджетке кіре алмайды. Бұрынғы жазбалары сақталады.</p><div class="modal-actions">${btn("Болдырмау", "close", "secondary")}${btn("Алып тастау", "member-remove-confirm", "danger", id)}</div>`,
    );
  if (a === "member-remove-confirm") {
    await groupAction("member.remove", { id });
    members();
    render();
    return;
  }
  if (a === "purchase-confirm") {
    const amount = Number($("#purchase").value);
    if (!Number.isSafeInteger(amount) || amount <= 0)
      return toast("Дұрыс соманы енгізіңіз.");
    personal.entries.push({
      id: uid(),
      amount,
      type: "expense",
      category: "Сатып алу",
      note: "Жоспарланған сатып алу",
      date: today(),
    });
    persist();
    closeModal();
    render();
    return toast("Сатып алу сақталды");
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  e.preventDefault();
  if (b.disabled) return;
  try {
    b.disabled = true;
    await handleAction(b.dataset.action, b.dataset.id, b);
  } catch (err) {
    toast(err.message);
  } finally {
    if (b.isConnected) b.disabled = false;
  }
});
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => (b.onclick = () => switchMode(b.dataset.mode)));
$(".brand").onclick = (e) => {
  e.preventDefault();
  go("overview");
};
document.addEventListener("input", (e) => {
  if (e.target.id === "purchase") purchaseResult();
});
document.addEventListener("submit", async (e) => {
  if (!["modal-form", "plan-form", "chat-form"].includes(e.target.id)) return;
  e.preventDefault();
  const f = e.target,
    v = Object.fromEntries(new FormData(f)),
    submit = f.querySelector("[type=submit]");
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    if (f.id === "chat-form") {
      await askAdvice(v.question);
      return;
    }
    if (f.id === "plan-form") {
      const t = totals(personal);
      personal.opening += Number(v.balance) - t.balance;
      personal.next = v.next;
      personal.savings = Number(v.savings);
      personal.reserve = Number(v.reserve);
      personal.bills = [...document.querySelectorAll(".bill-edit")].map(
        (row) => ({
          id: row.dataset.id,
          paid: row.dataset.paid === "true",
          name: row.querySelector("[name=bill-name]").value.trim(),
          amount: Number(row.querySelector("[name=bill-amount]").value),
          date: row.querySelector("[name=bill-date]").value,
        }),
      );
      persist();
      go("overview");
      toast("Айлық жоспары сақталды");
      return;
    }
    const kind = f.dataset.kind,
      id = f.dataset.id;
    if (kind === "entry") {
      const data = {
        type: v.type,
        amount: Number(v.amount),
        category: v.category,
        note: v.note.trim(),
        date: v.date,
        allocation: v.type === "income" ? v.allocation || "daily" : "daily",
      };
      if (mode === "personal") {
        if (id) {
          const old = personal.entries.find((e) => e.id === id);
          if (
            old.type === "income" &&
            ["savings", "reserve"].includes(old.allocation)
          )
            personal[old.allocation] = Math.max(
              0,
              personal[old.allocation] - old.amount,
            );
        }
        if (
          data.type === "income" &&
          ["savings", "reserve"].includes(data.allocation)
        )
          personal[data.allocation] += data.amount;
        if (id)
          Object.assign(
            personal.entries.find((e) => e.id === id),
            data,
          );
        else personal.entries.push({ ...data, id: uid() });
        persist();
      } else await groupAction("entry.add", data);
    }
    if (kind === "wish")
      await groupAction("wish.add", {
        name: v.name.trim(),
        price: Number(v.price),
        forWhom: v.forWhom.trim(),
        note: v.note.trim(),
      });
    if (kind === "goal")
      await groupAction("goal.add", {
        name: v.name.trim(),
        target: Number(v.target),
        date: v.date,
      });
    if (kind === "contribute")
      await groupAction("goal.contribute", { id, amount: Number(v.amount) });
    if (kind === "goal-withdraw")
      await groupAction("goal.withdraw", { id, amount: Number(v.amount) });
    if (kind === "shared-plan")
      await groupAction("plan.update", {
        balance: Number(v.balance),
        reserve: Number(v.reserve),
        next: v.next,
      });
    if (kind === "profile") {
      personal.name = v.name.trim();
      persist();
    }
    if (kind === "create") {
      if (!serverAvailable)
        throw Error(
          "Онлайн кеңістікті ашу үшін серверді npm start арқылы іске қосыңыз.",
        );
      const data = await api("/api/groups", {
        method: "POST",
        body: JSON.stringify(v),
      });
      token = data.token;
      localStorage.setItem("birqalyp-session", token);
      group = data.group;
      live = true;
      currentInvite = new URL(data.invite.url, location.href).href;
      localStorage.setItem("birqalyp-invite", currentInvite);
      mode = "shared";
      page = "overview";
    }
    if (kind === "join") {
      const data = await api("/api/join", {
        method: "POST",
        body: JSON.stringify(v),
      });
      token = data.token;
      localStorage.setItem("birqalyp-session", token);
      group = data.group;
      live = true;
      currentInvite = "";
      localStorage.removeItem("birqalyp-invite");
      mode = "shared";
      page = "overview";
      history.replaceState(null, "", location.pathname);
    }
    closeModal();
    render();
    toast(kind === "join" ? "Ортақ бюджетке қосылдыңыз!" : "Сақталды");
  } catch (err) {
    toast(err.message);
  } finally {
    if (submit.isConnected) submit.disabled = false;
  }
});
async function init() {
  render();
  try {
    const health = await fetch("/api/health").then((r) => r.json());
    serverAvailable = health.ok === true;
    if (token && serverAvailable) {
      const data = await api("/api/group");
      group = data.group;
      live = true;
    }
  } catch {}
  render();
  const code = new URL(location.href).searchParams.get("invite");
  if (code) await joinView(code);
}
setInterval(async () => {
  if (!live || !token) return;
  try {
    const data = await api("/api/group");
    syncError = false;
    if (data.group.revision !== group.revision) {
      group = data.group;
      if (
        !$("#modal").open &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName,
        )
      )
        render();
    }
  } catch {
    if (!syncError) {
      syncError = true;
      if (mode === "shared") render();
    }
  }
}, 2500);
let lastDay = today();
setInterval(() => {
  if (lastDay !== today()) {
    lastDay = today();
    render();
  }
}, 60000);
init();
