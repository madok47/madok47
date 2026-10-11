import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBudgetServer } from "../server.mjs";

const CURRENT_DATE = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Qyzylorda",
}).format(new Date());
function futureDate(days) {
  const date = new Date(CURRENT_DATE + "T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "birqalyp-test-"));
  let server = await createBudgetServer({ dataDir, aiKey: "", ...options });
  const listen = async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  let base = await listen();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  });
  return {
    dataDir,
    async restart() {
      await new Promise((resolve) => server.close(resolve));
      server = await createBudgetServer({ dataDir, aiKey: "", ...options });
      base = await listen();
    },
    async request(route, { method = "GET", body, token, headers = {} } = {}) {
      const response = await fetch(`${base}${route}`, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const value = await response.json().catch(() => null);
      return { status: response.status, value, headers: response.headers };
    },
    create(name = "Отбасымыз", displayName = "Мадияр", extra = {}) {
      return this.request("/api/groups", {
        method: "POST",
        body: { name, displayName, ...extra },
      });
    },
    join(code, displayName = "Умида") {
      return this.request("/api/join", {
        method: "POST",
        body: { code, displayName },
      });
    },
    action(token, action, fields = {}) {
      return this.request("/api/group/action", {
        method: "POST",
        token,
        body: { action, ...fields },
      });
    },
  };
}

test("two independent membership sessions share wishes while personal data and secrets stay private", async (t) => {
  const api = await fixture(t);
  const created = await api.create("Үй бюджеті", "Мадияр", {
    personal: { balance: 123456, privateNote: "never share this" },
  });
  assert.equal(created.status, 201);
  const owner = created.value;
  assert.equal(owner.group.members.length, 1);
  assert.equal(owner.group.opening, 0);
  assert.deepEqual(owner.group.entries, []);
  assert.equal(owner.group.subscriptionStatus, "demo");
  assert.match(owner.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(owner.invite.url, `/?invite=${owner.invite.code}`);
  const invite = await api.request(`/api/invites/${owner.invite.code}`);
  assert.equal(invite.status, 200);
  assert.deepEqual(Object.keys(invite.value).sort(), [
    "expiresAt",
    "members",
    "name",
    "plan",
  ]);
  assert.deepEqual(invite.value.members, [{ name: "Мадияр" }]);
  const joined = await api.join(owner.invite.code);
  assert.equal(joined.status, 201);
  const member = joined.value;
  assert.equal(member.group.members.length, 2);
  assert.notEqual(member.token, owner.token);
  assert.notEqual(member.group.viewerId, owner.group.viewerId);
  const added = await api.action(owner.token, "wish.add", {
    name: "Балама ойыншық алу",
    price: 12000,
    forWhom: "Баламызға",
    note: "Туған күніне",
  });
  assert.equal(added.status, 200);
  const wish = added.value.group.wishes[0];
  const readAsUmida = await api.request("/api/group", { token: member.token });
  assert.deepEqual(readAsUmida.value.group.wishes, added.value.group.wishes);
  assert.equal(readAsUmida.value.group.viewerId, member.group.viewerId);
  assert.equal(
    (await api.action(member.token, "wish.vote", { id: wish.id })).status,
    200,
  );
  const readAsMadiyar = await api.request("/api/group", { token: owner.token });
  assert.deepEqual(readAsMadiyar.value.group.wishes[0].votes, [
    member.group.viewerId,
  ]);
  assert.equal(
    (await api.action(member.token, "wish.delete", { id: wish.id })).status,
    403,
  );
  assert.equal((await api.request("/api/group")).status, 401);
  assert.equal(
    (await api.request("/api/group", { token: "a".repeat(43) })).status,
    401,
  );
  assert.equal(
    (
      await api.action("a".repeat(43), "wish.add", {
        name: "Injected",
        price: 1,
      })
    ).status,
    401,
  );
  const other = await api.create("Басқа отбасы", "Басқа адам");
  assert.deepEqual(
    (await api.request("/api/group", { token: other.value.token })).value.group
      .wishes,
    [],
  );
  const serialized = JSON.stringify(readAsUmida.value);
  for (const forbidden of [
    "privateNote",
    "never share this",
    "tokenHash",
    "inviteHash",
    owner.token,
    owner.invite.code,
    "123456",
  ])
    assert.ok(!serialized.includes(forbidden));
  const disk = await readFile(path.join(api.dataDir, "budgets.json"), "utf8");
  assert.ok(!disk.includes(owner.token));
  assert.ok(!disk.includes(member.token));
  assert.ok(!disk.includes(owner.invite.code));
  assert.ok(!disk.includes("never share this"));
});

test("wish purchase is atomic and idempotent and protects reserve plus goal funds", async (t) => {
  const api = await fixture(t);
  const { token, invite } = (await api.create()).value;
  const member = (await api.join(invite.code)).value;
  assert.equal(
    (
      await api.action(token, "plan.update", {
        opening: 100000,
        reserve: 20000,
        next: futureDate(30),
      })
    ).status,
    200,
  );
  let group = (
    await api.action(token, "goal.add", {
      name: "Сапар",
      target: 50000,
      date: futureDate(230),
    })
  ).value.group;
  const goal = group.goals[0];
  assert.equal(
    (await api.action(token, "goal.contribute", { id: goal.id, amount: 30000 }))
      .status,
    200,
  );
  group = (
    await api.action(member.token, "wish.add", {
      name: "Балама велосипед",
      price: 45000,
      forWhom: "Балаға",
    })
  ).value.group;
  const wish = group.wishes[0];
  const [one, two] = await Promise.all([
    api.action(token, "wish.buy", { id: wish.id }),
    api.action(member.token, "wish.buy", { id: wish.id }),
  ]);
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  const purchased = (await api.request("/api/group", { token })).value.group;
  assert.equal(purchased.wishes[0].bought, true);
  assert.equal(purchased.entries.length, 1);
  assert.equal(purchased.entries[0].amount, 45000);
  assert.equal(purchased.entries[0].type, "expense");
  assert.equal(purchased.entries[0].category, "Сатып алу");
  assert.equal(purchased.entries[0].id, purchased.wishes[0].purchaseEntryId);
  assert.equal(
    (await api.action(token, "wish.buy", { id: wish.id })).value.group.revision,
    purchased.revision,
  );
  assert.equal(
    (await api.action(token, "entry.delete", { id: purchased.entries[0].id }))
      .status,
    409,
  );
  group = (
    await api.action(token, "wish.add", { name: "Екінші қалау", price: 6000 })
  ).value.group;
  const tooExpensive = await api.action(token, "wish.buy", {
    id: group.wishes[0].id,
  });
  assert.equal(tooExpensive.status, 409);
  assert.equal(tooExpensive.value.code, "insufficient_funds");
  assert.equal(
    (await api.request("/api/group", { token })).value.group.entries.length,
    1,
  );
});

test("goal contributions enforce available money and targets; plan limits apply on the server", async (t) => {
  const api = await fixture(t);
  const { token, invite } = (await api.create()).value;
  const member = (await api.join(invite.code)).value;
  await api.action(token, "plan.update", {
    opening: 100,
    reserve: 40,
    next: futureDate(30),
  });
  const goal = (
    await api.action(token, "goal.add", {
      name: "Мақсат",
      target: 70,
      date: futureDate(100),
    })
  ).value.group.goals[0];
  assert.equal(
    (await api.action(token, "goal.contribute", { id: goal.id, amount: 61 }))
      .value.code,
    "insufficient_funds",
  );
  assert.equal(
    (await api.action(token, "goal.contribute", { id: goal.id, amount: 71 }))
      .value.code,
    "target_exceeded",
  );
  assert.equal(
    (
      await api.action(member.token, "goal.contribute", {
        id: goal.id,
        amount: 60,
      })
    ).status,
    200,
  );
  assert.equal(
    (await api.action(token, "goal.contribute", { id: goal.id, amount: 0.01 }))
      .status,
    409,
  );
  await api.action(token, "goal.add", {
    name: "Екінші",
    target: 10,
    date: futureDate(100),
  });
  await api.action(token, "goal.add", {
    name: "Үшінші",
    target: 10,
    date: futureDate(100),
  });
  assert.equal(
    (
      await api.action(token, "goal.add", {
        name: "Төртінші",
        target: 10,
        date: futureDate(100),
      })
    ).value.code,
    "plan_limit",
  );
  assert.equal(
    (await api.action(member.token, "subscription.demo", { plan: "plus" }))
      .status,
    403,
  );
  assert.equal(
    (await api.action(token, "subscription.demo", { plan: "plus" })).status,
    200,
  );
  assert.equal(
    (
      await api.action(token, "goal.add", {
        name: "Төртінші",
        target: 10,
        date: futureDate(100),
      })
    ).status,
    200,
  );
  assert.equal(
    (await api.action(token, "subscription.demo", { plan: "free" })).value.code,
    "downgrade_limit",
  );
  assert.equal(
    (await api.join(invite.code, "Үшінші адам")).value.code,
    "plan_limit",
  );
  assert.equal(
    (await api.action(token, "subscription.demo", { plan: "family" })).status,
    200,
  );
  assert.equal((await api.join(invite.code, "Үшінші адам")).status, 201);
  assert.equal(
    (await api.action(token, "subscription.demo", { plan: "__proto__" }))
      .status,
    400,
  );
  assert.equal(
    (await api.action(token, "subscription.demo", { plan: ["free"] })).status,
    400,
  );
  assert.equal(
    (
      await api.action(token, "entry.add", {
        type: "income",
        amount: 10.01,
        category: "Айлық",
        date: CURRENT_DATE,
      })
    ).status,
    200,
  );
  assert.equal(
    (await api.action(token, "goal.contribute", { id: goal.id, amount: 10 }))
      .status,
    200,
  );
  assert.equal(
    (await api.request("/api/group", { token })).value.group.goals[0].saved,
    70,
  );
  assert.equal(
    (
      await api.action(member.token, "goal.withdraw", {
        id: goal.id,
        amount: 1,
      })
    ).status,
    403,
  );
  assert.equal(
    (await api.action(member.token, "goal.delete", { id: goal.id })).status,
    403,
  );
  assert.equal(
    (await api.action(token, "goal.withdraw", { id: goal.id, amount: 71 }))
      .value.code,
    "saved_exceeded",
  );
  assert.equal(
    (await api.action(token, "goal.withdraw", { id: goal.id, amount: 25 }))
      .value.group.goals[0].saved,
    45,
  );
  assert.equal(
    (await api.action(token, "goal.delete", { id: goal.id })).status,
    200,
  );
  assert.equal(
    (await api.request("/api/group", { token })).value.group.goals.length,
    3,
  );
});

test("invitation rotation, owner permissions and removed-member revocation", async (t) => {
  const api = await fixture(t, { publicUrl: "https://birqalyp.example/" });
  const { token, invite } = (await api.create()).value;
  assert.equal(invite.url, `https://birqalyp.example/?invite=${invite.code}`);
  const member = (await api.join(invite.code)).value;
  assert.equal((await api.action(member.token, "invite.rotate")).status, 403);
  assert.equal(
    (
      await api.action(member.token, "member.remove", {
        id: member.group.ownerId,
      })
    ).status,
    403,
  );
  const rotated = await api.action(token, "invite.rotate");
  assert.equal(rotated.status, 200);
  assert.notEqual(rotated.value.invite.code, invite.code);
  assert.equal((await api.request(`/api/invites/${invite.code}`)).status, 404);
  assert.equal((await api.join(invite.code, "Жаңа адам")).status, 404);
  assert.equal(
    (await api.request(`/api/invites/${rotated.value.invite.code}`)).status,
    200,
  );
  assert.equal(
    (await api.action(token, "member.remove", { id: member.group.ownerId }))
      .value.code,
    "owner_remove",
  );
  assert.equal(
    (await api.action(token, "member.remove", { id: member.group.viewerId }))
      .status,
    200,
  );
  assert.equal(
    (await api.request("/api/group", { token: member.token })).status,
    401,
  );
  assert.equal(
    (
      await api.action(member.token, "wish.add", {
        name: "No access",
        price: 1,
      })
    ).status,
    401,
  );
  assert.equal(
    (await api.join(rotated.value.invite.code, "Қайта кіру")).status,
    201,
  );
});

test("durable store survives restart without plaintext membership or invite tokens", async (t) => {
  const api = await fixture(t);
  const { token, invite } = (await api.create()).value;
  const member = (await api.join(invite.code)).value;
  await api.action(member.token, "wish.add", {
    name: "Тұрақты жазба",
    price: 1234,
  });
  const previous = (await api.request("/api/group", { token })).value.group;
  await api.restart();
  const restored = (await api.request("/api/group", { token })).value.group;
  assert.deepEqual(restored, previous);
  assert.equal(
    (await api.request("/api/group", { token: member.token })).value.group
      .wishes[0].name,
    "Тұрақты жазба",
  );
  assert.equal((await api.request(`/api/invites/${invite.code}`)).status, 200);
});

test("endpoint, origin, body and financial validation reject unsafe requests without changes", async (t) => {
  const api = await fixture(t);
  const { token } = (await api.create()).value;
  const before = (await api.request("/api/group", { token })).value.group;
  for (const fields of [
    { type: "credit", amount: 1, category: "x", date: CURRENT_DATE },
    { type: "expense", amount: -1, category: "x", date: CURRENT_DATE },
    { type: "expense", amount: 1.001, category: "x", date: CURRENT_DATE },
    { type: "expense", amount: "1", category: "x", date: CURRENT_DATE },
    { type: "expense", amount: 1, category: "x", date: "2026-02-30" },
  ])
    assert.equal((await api.action(token, "entry.add", fields)).status, 400);
  assert.equal((await api.action(token, "unknown")).status, 400);
  assert.equal(
    (await api.action(token, "wish.vote", { id: "missing" })).status,
    404,
  );
  assert.equal(
    (
      await api.request("/api/groups", {
        method: "POST",
        body: { name: "x", displayName: "y" },
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await api.request("/api/group/action", {
        method: "POST",
        token,
        body: { action: "wish.add", name: "x".repeat(40000), price: 1 },
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await api.request("/api/group/action", {
        method: "POST",
        token,
        body: { action: "wish.add", name: "x", price: 1 },
        headers: { "Content-Type": "text/plain" },
      })
    ).status,
    415,
  );
  assert.equal((await api.request("/api/groups")).status, 405);
  assert.equal((await api.request("/api/invites/malformed")).status, 404);
  assert.equal((await api.request("/api/health")).status, 200);
  for (const route of [
    "/.data/budgets.json",
    "/.env",
    "/server.mjs",
    "/package.json",
    "/%2e%2e%2fserver.mjs",
    "/api/%2Fgroup",
    "/vendor/../server.mjs",
    "/api/unknown",
  ]) {
    assert.equal((await api.request(route)).status, 404, route);
  }
  assert.deepEqual(
    (await api.request("/api/group", { token })).value.group,
    before,
  );
  const absentAi = await api.request("/api/advice", {
    method: "POST",
    body: { question: "Айлыққа жете ме?", context: { balance: 100 } },
  });
  assert.equal(absentAi.status, 200);
  assert.deepEqual(absentAi.value, { configured: false });
  assert.equal(absentAi.headers.get("cache-control"), "no-store");
  assert.equal(absentAi.headers.get("referrer-policy"), "no-referrer");
});

test("corrupted persistence is reported instead of silently erasing existing data", async (t) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "birqalyp-corrupt-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  await writeFile(path.join(dataDir, "budgets.json"), "corrupted data");
  await assert.rejects(
    createBudgetServer({ dataDir, aiKey: "" }),
    /preserve the existing file/,
  );
  assert.equal(
    await readFile(path.join(dataDir, "budgets.json"), "utf8"),
    "corrupted data",
  );
});

test("configured AI requires membership and Plus/Family; daily quota survives restarts", async (t) => {
  let calls = 0;
  const api = await fixture(t, {
    aiKey: "test-key-not-an-actual-secret",
    aiDailyLimit: 2,
    aiFetch: async (url, request) => {
      calls += 1;
      assert.equal(url, "https://api.openai.com/v1/chat/completions");
      assert.equal(
        request.headers.Authorization,
        "Bearer test-key-not-an-actual-secret",
      );
      const body = JSON.parse(request.body);
      assert.equal(body.max_completion_tokens, 700);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Резервті сақтаңыз." } }],
        }),
        { status: 200 },
      );
    },
  });
  const { token } = (await api.create()).value;
  const advise = (membership) =>
    api.request("/api/advice", {
      method: "POST",
      token: membership,
      body: { question: "Не істеу керек?", context: { available: 100 } },
    });
  assert.equal((await advise()).status, 401);
  assert.equal((await advise(token)).value.code, "ai_plan_required");
  assert.equal(calls, 0);
  await api.action(token, "subscription.demo", { plan: "plus" });
  assert.deepEqual((await advise(token)).value, {
    configured: true,
    answer: "Резервті сақтаңыз.",
  });
  await api.restart();
  assert.equal((await advise(token)).status, 200);
  assert.equal((await advise(token)).value.code, "ai_daily_limit");
  assert.equal(calls, 2);
  const visible = JSON.stringify(
    (await api.request("/api/group", { token })).value,
  );
  assert.ok(!visible.includes("aiUsage"));
  assert.ok(!visible.includes("test-key-not-an-actual-secret"));
});

test("invites expire, rotate into a new seven-day window, and creation is conservatively throttled", async (t) => {
  const api = await fixture(t);
  const { token, invite } = (await api.create()).value;
  assert.ok(
    Date.parse(invite.expiresAt) - Date.now() > 6 * 24 * 60 * 60 * 1000,
  );
  const dbPath = path.join(api.dataDir, "budgets.json");
  const stored = JSON.parse(await readFile(dbPath, "utf8"));
  stored.groups[0].inviteExpiresAt = "2020-01-01T00:00:00.000Z";
  await writeFile(dbPath, JSON.stringify(stored));
  await api.restart();
  assert.equal((await api.request(`/api/invites/${invite.code}`)).status, 404);
  assert.equal((await api.join(invite.code)).status, 404);
  const newInvite = (await api.action(token, "invite.rotate")).value.invite;
  assert.equal(
    (await api.request(`/api/invites/${newInvite.code}`)).status,
    200,
  );
  assert.equal((await api.join(newInvite.code)).status, 201);
  for (let i = 0; i < 5; i += 1)
    assert.equal((await api.create(`Бюджет ${i}`, "Иесі")).status, 201);
  assert.equal((await api.create("Артық бюджет", "Иесі")).status, 429);
});

test("actual-balance reconciliation preserves history and retrying a target creates no duplicate correction", async (t) => {
  const api = await fixture(t);
  const { token } = (await api.create()).value;
  await api.action(token, "entry.add", {
    type: "income",
    amount: 100000,
    category: "Айлық",
    date: CURRENT_DATE,
  });
  const corrected = await api.action(token, "plan.update", {
    balance: 50000,
    reserve: 5000,
    next: futureDate(30),
  });
  assert.equal(corrected.status, 200);
  assert.equal(corrected.value.group.opening, 0);
  assert.equal(corrected.value.group.entries.length, 2);
  assert.deepEqual(
    {
      type: corrected.value.group.entries[0].type,
      amount: corrected.value.group.entries[0].amount,
      category: corrected.value.group.entries[0].category,
      note: corrected.value.group.entries[0].note,
    },
    {
      type: "expense",
      amount: 50000,
      category: "Басқа",
      note: "Қалдықты нақтылау",
    },
  );
  const retried = await api.action(token, "plan.update", {
    balance: 50000,
    reserve: 5000,
    next: futureDate(30),
  });
  assert.equal(retried.value.group.entries.length, 2);
  const more = await api.action(token, "plan.update", {
    balance: 60000,
    reserve: 5000,
    next: futureDate(30),
  });
  assert.equal(more.value.group.entries[0].type, "income");
  assert.equal(more.value.group.entries[0].amount, 10000);
  assert.equal(
    (
      await api.action(token, "plan.update", {
        balance: 30000,
        reserve: -1,
        next: futureDate(30),
      })
    ).status,
    400,
  );
  assert.equal(
    (await api.request("/api/group", { token })).value.group.entries.length,
    3,
  );
  for (const fields of [
    { balance: 60000, reserve: 0, next: "2000-01-01" },
    { balance: 60000, opening: 0, reserve: 0, next: futureDate(30) },
  ])
    assert.equal((await api.action(token, "plan.update", fields)).status, 400);
  assert.equal(
    (
      await api.action(token, "entry.add", {
        type: "expense",
        amount: 1,
        category: "Басқа",
        date: futureDate(1),
      })
    ).value.code,
    "future_entry",
  );
  assert.equal(
    (
      await api.action(token, "goal.add", {
        name: "Өткен",
        target: 1,
        date: "2000-01-01",
      })
    ).value.code,
    "past_goal",
  );
});
