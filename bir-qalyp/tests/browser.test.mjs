import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBudgetServer } from '../server.mjs';

const require = createRequire(import.meta.url);
let playwright;
for (const module of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright', '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'].filter(Boolean)) {
  try { playwright = require(module); break; } catch {}
}
const personalKey = 'birqalyp-v5';
const money = amount => `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
const personalState = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), personalKey);
const personalBalance = state => state.opening + state.entries.reduce((sum, entry) => sum + (entry.type === 'income' ? entry.amount : entry.type === 'expense' ? -entry.amount : 0), 0) - state.bills.filter(bill => bill.paid).reduce((sum, bill) => sum + bill.amount, 0);
const click = (page, action, id) => page.locator(`[data-action="${action}"]${id ? `[data-id="${id}"]` : ''}:visible`).first().click();
const navigate = (page, id) => page.locator(`#nav [data-action="page"][data-id="${id}"]`).click();
async function saveModal(page) {
  await page.locator('#modal-form button[type="submit"]').click();
  try { await page.waitForFunction(() => !document.querySelector('#modal').open, null, { timeout: 10000 }); }
  catch (error) { throw new Error(`Modal did not save: ${await page.locator('#toast').innerText()}`, { cause: error }); }
}
async function sharedState(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/group', { headers: { Authorization: `Bearer ${localStorage.getItem('birqalyp-session')}` } });
    if (!response.ok) throw Error(`Shared state returned ${response.status}`);
    return (await response.json()).group;
  });
}
async function noOverflow(page, name) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, dialog: document.querySelector('#modal').open ? document.querySelector('#modal').getBoundingClientRect().toJSON() : null }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, `${name}: document ${dimensions.document}px overflows viewport ${dimensions.viewport}px`);
  assert.ok(dimensions.body <= dimensions.viewport + 1, `${name}: body overflow`);
  if (dimensions.dialog) {
    assert.ok(dimensions.dialog.left >= -1 && dimensions.dialog.right <= dimensions.viewport + 1, `${name}: dialog extends beyond screen`);
  }
}

test('browser: private budgets, real family collaboration, subscriptions and mobile layout', { skip: !playwright, timeout: 120_000 }, async t => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'birqalyp-qa-'));
  let server = await createBudgetServer({ dataDir, aiKey: '' });
  const port = Number(process.env.BIRQALYP_BROWSER_PORT || 4181);
  const listen = () => new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  await listen();
  const base = `http://127.0.0.1:${port}`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await playwright.chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ['--no-sandbox'] });
  const errors = [];
  const contexts = [];
  async function newPage(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true, ...options });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()} (${message.location().url})`); });
    await page.goto(base, { waitUntil: 'networkidle' });
    return page;
  }
  t.after(async () => {
    for (const context of contexts) await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  });
  async function screenshot(page, name) {
    if (!process.env.BIRQALYP_SCREENSHOTS_DIR) return;
    await mkdir(process.env.BIRQALYP_SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.BIRQALYP_SCREENSHOTS_DIR, `${name}.png`), fullPage: true });
  }

  await t.test('personal operations edit the daily limit, persist, simulate safely and pay a bill once', async () => {
    const page = await newPage();
    assert.deepEqual(await page.locator('#nav .label').allTextContents(), ['Шолу', 'Айлық жоспары', 'Операциялар', 'ЖИ кеңес']);
    assert.ok(!(await page.locator('body').innerText()).includes('Әсел'));
    await navigate(page, 'plan');
    await page.locator('#plan-form [name="balance"]').fill('1000000');
    await page.locator('#plan-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('h1').textContent.includes('Сәлем'));
    const initial = await personalState(page);
    assert.equal(personalBalance(initial), 1_000_000);
    const initialLimit = await page.locator('.hero-money').innerText();
    await click(page, 'entry');
    await page.locator('#modal-form [name="amount"]').fill('5000');
    await page.locator('#modal-form [name="note"]').fill('Жеке құпия кофе');
    await saveModal(page);
    assert.equal(personalBalance(await personalState(page)), 995_000);
    assert.notEqual(await page.locator('.hero-money').innerText(), initialLimit);
    await navigate(page, 'transactions');
    const row = page.locator('.tx-row').filter({ hasText: 'Жеке құпия кофе' });
    await row.locator('[data-action="entry-edit"]').click();
    await page.locator('#modal-form [name="amount"]').fill('10000');
    await saveModal(page);
    const edited = await personalState(page);
    assert.equal(personalBalance(edited), 990_000);
    assert.equal(edited.entries.filter(entry => entry.note === 'Жеке құпия кофе').length, 1);
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await personalState(page), edited);
    const limit = await page.locator('.hero-money').innerText();
    await click(page, 'whatif');
    await page.locator('#purchase').fill('100000');
    assert.ok((await page.locator('#purchase-result').innerText()).includes('Сатып алғаннан кейін'));
    await page.locator('#modal [data-action="close"]').first().click();
    assert.deepEqual(await personalState(page), edited);
    assert.equal(await page.locator('.hero-money').innerText(), limit);
    const bill = edited.bills.find(item => item.name === 'Интернет');
    await click(page, 'bill-pay', bill.id);
    const paid = await personalState(page);
    assert.equal(personalBalance(paid), personalBalance(edited) - bill.amount);
    assert.equal(await page.locator('.hero-money').innerText(), limit, 'paying a previously reserved bill must not reduce free funds again');
    await navigate(page, 'plan');
    assert.equal(await page.locator(`.bill-edit[data-id="${bill.id}"]`).getAttribute('data-paid'), 'true');
    await page.locator('#plan-form button[type="submit"]').click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(personalBalance(await personalState(page)), personalBalance(paid));
    assert.equal(await page.locator('.hero-money').innerText(), limit);
    await screenshot(page, 'birqalyp-personal-desktop');
  });

  await t.test('Free gates CSV; Plus provides actual CSV and a forecast without charging or mutating money', async () => {
    const page = await newPage();
    await navigate(page, 'plan');
    await page.locator('#plan-form [name="balance"]').fill('800000');
    await page.locator('#plan-form button[type="submit"]').click();
    const before = await personalState(page);
    await navigate(page, 'transactions');
    await click(page, 'export');
    assert.equal(await page.locator('.pricing-grid .price-card').count(), 3);
    assert.match(await page.locator('#toast').innerText(), /Plus.*Family/);
    await click(page, 'subscribe', 'plus');
    assert.match(await page.locator('#toast').innerText(), /Ақша алынбайды/);
    const after = await personalState(page);
    assert.equal(after.plan, 'plus');
    assert.equal(personalBalance(after), personalBalance(before));
    assert.deepEqual(after.entries, before.entries);
    await navigate(page, 'transactions');
    const downloadPromise = page.waitForEvent('download');
    await click(page, 'export');
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^birqalyp-personal-\d{4}-\d\d-\d\d\.csv$/);
    const csv = await readFile(await download.path(), 'utf8');
    assert.match(csv, /Күні.*Түрі.*Санат.*Сома/);
    assert.match(csv, /Азық-түлік/);
    assert.match(csv, /18500/);
    assert.match(csv, /Мадияр/);
    await click(page, 'report');
    assert.match(await page.locator('#modal').innerText(), /Тамақ/);
    await click(page, 'forecast');
    assert.equal(await page.locator('.forecast-col').count(), 5);
    assert.match(await page.locator('#modal').innerText(), /Болашақ кіріс автоматты қосылмайды/);
    const forecast = await personalState(page);
    assert.equal(personalBalance(forecast), personalBalance(before));
    await page.locator('#modal [data-action="close"]').first().click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await personalState(page)).plan, 'plus');
  });

  await t.test('independent people join by real QR/link, share wishes and votes, buy once, reserve goals and recover after restart', async () => {
    const owner = await newPage();
    await navigate(owner, 'plan');
    await owner.locator('#plan-form [name="balance"]').fill('999999');
    await owner.locator('#plan-form button[type="submit"]').click();
    await click(owner, 'entry');
    await owner.locator('#modal-form [name="amount"]').fill('100');
    await owner.locator('#modal-form [name="note"]').fill('PRIVATE-OWNER-ENTRY');
    await saveModal(owner);
    const ownerPersonal = await personalState(owner);
    await owner.locator('[data-mode="shared"]').click();
    assert.deepEqual(await owner.locator('#nav .label').allTextContents(), ['Ортақ шолу', 'Мақсаттар', 'Хотелкалар', 'ЖИ кеңес']);
    assert.ok(!(await owner.locator('#app').innerText()).includes('PRIVATE-OWNER-ENTRY'));
    assert.ok(!(await owner.locator('#app').innerText()).includes(money(999899)));
    assert.equal(await owner.locator('[title="Умида"]').count(), 1);
    await click(owner, 'create-group');
    await owner.locator('#modal-form [name="name"]').fill('Біздің QA отбасымыз');
    await saveModal(owner);
    assert.match(await owner.locator('.family-banner').innerText(), /синхрондалады/);
    const newlyCreated = await sharedState(owner);
    assert.equal(newlyCreated.opening, 0);
    assert.deepEqual(newlyCreated.entries, []);
    await click(owner, 'invite');
    const inviteLink = await owner.locator('#invite-link').inputValue();
    assert.equal(new URL(inviteLink).origin, base);
    assert.match(new URL(inviteLink).searchParams.get('invite'), /^[A-Za-z0-9_-]{43}$/);
    assert.equal(await owner.locator('#qr-box svg').count(), 1);
    assert.equal(await owner.locator('#qr-box svg').getAttribute('aria-label'), 'Ортақ бюджетке шақыру QR коды');
    await screenshot(owner, 'birqalyp-invitation-desktop');
    const umida = await newPage();
    await umida.goto(inviteLink, { waitUntil: 'networkidle' });
    await umida.waitForSelector('#modal-form[data-kind="join"]');
    assert.equal(await umida.locator('#modal-form [name="displayName"]').inputValue(), 'Умида');
    await saveModal(umida);
    assert.equal(await umida.locator('#profile-name').innerText(), 'Умида');
    assert.notEqual(await owner.evaluate(() => localStorage.getItem('birqalyp-session')), await umida.evaluate(() => localStorage.getItem('birqalyp-session')));
    await owner.locator('#modal [data-action="close"]').first().click();
    await click(owner, 'shared-plan');
    await owner.locator('#modal-form [name="balance"]').fill('200000');
    await owner.locator('#modal-form [name="reserve"]').fill('20000');
    await owner.locator('#modal-form [name="next"]').fill(ownerPersonal.next);
    await saveModal(owner);
    await navigate(owner, 'wishes');
    await click(owner, 'wish');
    await owner.locator('#modal-form [name="name"]').fill('Балама ойыншық алу');
    await owner.locator('#modal-form [name="price"]').fill('15000');
    await owner.locator('#modal-form [name="forWhom"]').fill('Баламызға');
    await owner.locator('#modal-form [name="note"]').fill('Туған күніне');
    await saveModal(owner);
    const added = await sharedState(owner);
    assert.equal(added.opening + added.entries.reduce((sum, entry) => sum + (entry.type === 'income' ? entry.amount : -entry.amount), 0), 200000);
    assert.equal(added.entries.filter(entry => entry.type === 'expense').length, 0, 'wish itself must not deduct money');
    assert.ok(!JSON.stringify(added).includes('PRIVATE-OWNER-ENTRY'));
    await navigate(umida, 'wishes');
    await umida.waitForSelector('.wish-card', { timeout: 10000 });
    assert.match(await umida.locator('.wish-card').innerText(), /Балама ойыншық алу/);
    assert.match(await umida.locator('.wish-card').innerText(), /15 000 ₸/);
    await click(umida, 'vote', added.wishes[0].id);
    await owner.waitForFunction(() => document.querySelector('.vote-btn').textContent.includes('1'), null, { timeout: 10000 });
    assert.deepEqual((await sharedState(owner)).wishes[0].votes, [(await sharedState(umida)).viewerId]);
    await click(owner, 'wish-buy', added.wishes[0].id);
    await click(owner, 'wish-buy-confirm', added.wishes[0].id);
    await umida.waitForFunction(() => document.querySelector('.wish-card').textContent.includes('Сатып алынды'), null, { timeout: 10000 });
    const purchased = await sharedState(owner);
    assert.equal(purchased.entries.filter(entry => entry.type === 'expense').length, 1);
    const purchaseEntry = purchased.entries.find(entry => entry.type === 'expense');
    assert.equal(purchaseEntry.amount, 15000);
    assert.equal(purchaseEntry.id, purchased.wishes[0].purchaseEntryId);
    assert.equal(await owner.locator('[data-action="wish-buy"]').count(), 0);
    assert.equal(await umida.locator('[data-action="wish-buy"]').count(), 0);
    await navigate(owner, 'goals');
    await click(owner, 'goal');
    await owner.locator('#modal-form [name="name"]').fill('Отбасымен демалыс');
    await owner.locator('#modal-form [name="target"]').fill('100000');
    await saveModal(owner);
    const goal = (await sharedState(owner)).goals[0];
    await click(owner, 'contribute', goal.id);
    await owner.locator('#modal-form [name="amount"]').fill('30000');
    await saveModal(owner);
    await navigate(owner, 'overview');
    assert.equal(await owner.locator('.hero-money').innerText(), money(185000));
    assert.match(await owner.locator('.hero-stats').innerText(), /135 000 ₸/);
    assert.match(await owner.locator('.hero-stats').innerText(), /30 000 ₸/);
    assert.deepEqual(await personalState(owner), ownerPersonal);
    await screenshot(owner, 'birqalyp-shared-desktop');
    const beforeRestart = await sharedState(owner);
    await new Promise(resolve => server.close(resolve));
    server = await createBudgetServer({ dataDir, aiKey: '' });
    await listen();
    await umida.reload({ waitUntil: 'networkidle' });
    await umida.locator('[data-mode="shared"]').click();
    await navigate(umida, 'wishes');
    assert.match(await umida.locator('.wish-card').innerText(), /Сатып алынды/);
    assert.deepEqual((await sharedState(owner)).wishes, beforeRestart.wishes);
    assert.deepEqual((await sharedState(umida)).goals, beforeRestart.goals);
    assert.equal(await umida.locator('#profile-name').innerText(), 'Умида');
    await navigate(umida, 'ai');
    await click(umida, 'advice', 'Хотелкаларға ақша жете ме?');
    assert.match(await umida.locator('.chat-message.assistant').last().innerText(), /қолжетімді/);
    assert.ok(!(await umida.locator('#app').innerText()).includes('PRIVATE-OWNER-ENTRY'));
  });

  await t.test('390px mobile layouts keep shared overview, wishes, tariffs and forms within the screen', async () => {
    const page = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await noOverflow(page, 'personal overview');
    await page.locator('[data-mode="shared"]').click();
    await noOverflow(page, 'shared overview');
    await screenshot(page, 'birqalyp-shared-mobile');
    await navigate(page, 'wishes');
    await noOverflow(page, 'wishes');
    await screenshot(page, 'birqalyp-wishes-mobile');
    await click(page, 'wish');
    await noOverflow(page, 'wish modal');
    await screenshot(page, 'birqalyp-wish-modal-mobile');
    await page.locator('#modal [data-action="close"]').first().click();
    await click(page, 'pricing');
    await noOverflow(page, 'pricing');
    await screenshot(page, 'birqalyp-pricing-mobile');
    await page.locator('[data-mode="personal"]').click();
    await navigate(page, 'plan');
    await noOverflow(page, 'monthly plan');
    await navigate(page, 'transactions');
    await click(page, 'entry');
    await noOverflow(page, 'entry modal');
  });

  await t.test('browser has no unhandled JavaScript or CSP errors', () => {
    assert.deepEqual([...new Set(errors)], []);
  });
});
