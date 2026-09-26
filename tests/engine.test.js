const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../engine.js');

test('all founding strategies produce finite, distinct economies', () => {
  const prices = new Set();
  for (const strategy of Object.keys(Sim.STRATEGIES)) {
    const s = Sim.create('試験株式会社', strategy, 42);
    assert.equal(s.employees.length, 6); assert.equal(s.cash, 1000);
    assert.ok(Object.values(s.metrics).every(Number.isFinite)); prices.add(s.price);
  }
  assert.equal(prices.size, 4);
});
test('advertising grows demand and load; salary cuts degrade morale and loyalty', () => {
  const s = Sim.create('連鎖', 'tech', 2);
  const initial = { ...s.metrics }, morale = s.morale, loyalty = s.employees[0].loyalty;
  assert.ok(Sim.act(s, 'ads').ok);
  assert.ok(s.metrics.demand > initial.demand); assert.ok(s.metrics.load > initial.load);
  assert.ok(Sim.act(s, 'salaryDown').ok);
  assert.ok(s.morale < morale); assert.ok(s.employees[0].loyalty < loyalty);
  assert.ok(s.metrics.payroll < initial.payroll);
  Sim.act(s, 'salaryDown');
  assert.ok(!Sim.act(s, 'loan').ok, 'weekly decision budget is enforced');
});
test('unresolved events pause time; concealed defects produce deferred consequences', () => {
  const s = Sim.create('不具合', 'tech', 3); s.cash = 100000;
  Sim.trigger(s, 'defect'); assert.equal(Sim.step(s), false); assert.equal(s.week, 0);
  Sim.decide(s, 1); assert.equal(s.pending[0].due, 8);
  for (let i = 0; i < 8; i++) { if (s.event) Sim.decide(s, 0); Sim.step(s); }
  assert.ok(s.timeline.some(t => t.text.includes('隠していた不具合')));
  assert.ok(s.stats.scandals >= 2);
});
function grow(s, target) {
  s.cash = 100000; s.applicants = 50;
  while (s.employees.length < target) { s.actionsLeft = 3; s.applicants = 50; Sim.act(s, 'hire', '開発'); }
  return s;
}
test('growth unlocks executives; large corporations override manual control', () => {
  const s = grow(Sim.create('巨大企業', 'tech', 12), 120);
  assert.equal(s.stage, 4); s.autonomy = 'manual'; s.eventCooldown = 100;
  Sim.step(s); Sim.step(s);
  assert.ok(s.proposals.length >= 4);
  assert.ok(s.logs.some(l => l.text.includes('委任決裁')));
  assert.ok(s.metrics.control < 60);
});
test('acquisition adds workforce, debt and delayed integration liabilities', () => {
  const s = grow(Sim.create('買収会社', 'tech', 4), 21), before = s.employees.length;
  const r = s.rivals[0], debt = r.debt;
  s.actionsLeft = 3; assert.ok(Sim.acquire(s, r.id).ok);
  assert.equal(s.employees.length, before + r.staff);
  assert.equal(s.debt, debt); assert.equal(s.stats.acquisitions, 1);
  assert.equal(r.status, '買収済'); assert.equal(r.share, 0);
  assert.ok(s.pending.some(p => p.due === 6));
  assert.ok(!Sim.acquire(s, r.id).ok);
});
test('save and restore preserve random sequence and simulation', () => {
  const a = Sim.create('再現', 'ads', 813), b = Sim.restore(Sim.serialize(a));
  for (let i = 0; i < 30; i++) {
    if (a.event) { Sim.decide(a, 0); Sim.decide(b, 0); }
    Sim.step(a); Sim.step(b);
    assert.equal(Sim.serialize(a), Sim.serialize(b));
  }
  assert.throws(() => Sim.restore('{"version":999}'));
});
test('cash, trust, and legal endings generate a final timeline and block further actions', () => {
  for (const [key, value, reason] of [['cash', -10000, '資金枯渇'], ['trust', 0, '信用崩壊'], ['legal', 100, '行政処分']]) {
    const s = Sim.create('失敗', 'tech', 99); s[key] = value;
    Sim.step(s); assert.ok(s.ended.reason.includes(reason));
    assert.ok(s.timeline.at(-1).text.includes(reason));
    assert.ok(!Sim.act(s, 'loan').ok); assert.equal(Sim.step(s), false);
  }
});
test('balanced active management can grow, and 100 seeded runs stay finite through their ending', () => {
  let peak = 0, completed = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const s = Sim.create('ストレス試験', ['tech', 'ads', 'budget', 'premium'][seed % 4], seed);
    while (!s.ended && s.week <= 520) {
      if (s.event) Sim.decide(s, 0);
      if (s.ended) break;
      const m = s.metrics;
      const actions = seed % 2 ? [m.load > 80 ? 'server' : m.demand > m.production ? (s.equipment <= m.production * 1.05 ? 'equipment' : 'hire') : 'ads', s.morale < 58 ? 'benefits' : s.legal > 50 ? 'compliance' : 'research'] : ['salaryDown', 'ads', 'hire'];
      for (const id of actions) Sim.act(s, id, s.employees.length % 5 === 0 ? '法務' : '開発');
      Sim.step(s);
      assert.ok(Object.values(s.metrics).every(Number.isFinite), `seed ${seed}, W${s.week}`);
      assert.ok(s.employees.length >= 2); peak = Math.max(peak, s.stats.peakEmployees);
    }
    assert.ok(s.ended, `seed ${seed} must reach a real ending`); completed++;
  }
  assert.equal(completed, 100); assert.ok(peak >= 20, `growth should unlock management, peak ${peak}`);
});
test('an unmodified founding economy can reach autonomous scale and finish a full tenure', () => {
  const s = Sim.create('長期経営', 'tech', 1);
  while (!s.ended) {
    if (s.event) Sim.decide(s, 0);
    if (s.ended) break;
    const m = s.metrics;
    if (s.cash > 1200 && s.employees.length >= 20) {
      const rival = s.rivals.find(r => r.status === '競争中' && s.cash > Sim.valuation(r) + 500);
      if (rival) Sim.acquire(s, rival.id);
    }
    const id = m.load > 85 ? 'server' : s.morale < 60 ? 'benefits' : s.legal > 50 ? 'compliance' : s.employees.length >= 45 && s.overseas < 3 ? 'overseas' : s.managers < s.employees.length / 25 && s.employees.length >= 20 ? 'manager' : m.demand > m.production * 1.02 ? (s.equipment <= m.production * 1.05 ? 'equipment' : 'hire') : s.tech < 75 ? 'research' : 'ads';
    Sim.act(s, id, s.employees.length % 4 === 0 ? '営業' : '開発');
    Sim.step(s);
  }
  assert.ok(s.stats.peakEmployees >= 120);
  assert.equal(s.stage, 4);
  assert.ok(s.stats.acquisitions > 0);
  assert.equal(s.week, 520);
  assert.equal(s.ended.retired, true);
});
