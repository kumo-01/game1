const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../engine');
const Life = require('../company-life');

test('SNS uses real employees, is deterministic, and does not consume simulation randomness', () => {
  const a = Sim.create('声の会社', 'tech', 42), b = Sim.restore(Sim.serialize(a)), rng = a.rng;
  Life.record(a); Life.record(b);
  assert.equal(a.rng, rng); assert.deepEqual(a.life, b.life);
  const staff = a.life.staff.filter(p => p.id.startsWith('staff:'));
  assert.ok(staff.every(p => a.employees.some(e => e.name === p.author)));
  const count = a.life.staff.length; Life.record(a); Life.record(a);
  assert.equal(a.life.staff.length, count, 'switching tabs must not flood the feed');
});
test('employee and internet voices react to different real company problems', () => {
  const s = Sim.create('疲れた会社', 'tech', 7);
  s.salary = .7; s.metrics.outage = 25; Life.record(s);
  assert.ok(s.life.staff.some(p => /給与|利益改善/.test(p.text)));
  assert.ok(s.life.internet.some(p => /サーバー|エラー/.test(p.text)));
});
test('concealed internal decisions stay off the internet until public revelation', () => {
  const s = Sim.create('秘密', 'tech', 9); Life.record(s);
  s.timeline.push({ week: 0, text: '内部告発が届いた → 握りつぶす' }); Life.record(s);
  assert.ok(s.life.staff.some(p => p.text.includes('握りつぶす')));
  assert.ok(!s.life.internet.some(p => p.text.includes('握りつぶす')));
  s.timeline.push({ week: 0, text: '告発文が公開された。隠蔽の代償。' }); Life.record(s);
  assert.ok(s.life.internet.some(p => p.text.includes('公開された')));
});
test('both feeds are bounded, survive older saves, and remain in the company save', () => {
  const s = Sim.restore(Sim.serialize(Sim.create('保存', 'tech', 12)));
  assert.equal(s.life, undefined); Life.record(s);
  for (let i = 1; i <= 60; i++) { s.week = i; Life.record(s); }
  assert.equal(s.life.staff.length, 120); assert.equal(s.life.internet.length, 120);
  const restored = Sim.restore(Sim.serialize(s)); assert.deepEqual(restored.life, s.life);
  Life.record(restored); assert.deepEqual(restored.life, s.life);
});
test('the map reflects actual headcount, empty departments, infrastructure and morale', () => {
  const s = Sim.create('マップ', 'tech', 22);
  const before = Sim.serialize(s), rooms = Life.rooms(s);
  assert.equal(Sim.serialize(s), before, 'looking at the map must not change the company');
  assert.equal(rooms.filter(r => r.kind === 'office').reduce((n, r) => n + r.count, 0), s.employees.length);
  assert.equal(rooms.find(r => r.name === '法務エリア').status, '配属なし');
  s.metrics.load = 150; s.metrics.outage = 35; s.morale = 20;
  s.employees.filter(e => e.dept === '開発').forEach(e => e.stress = 85);
  const bad = Life.rooms(s);
  assert.equal(bad.find(r => r.id === 'server').severity, 'danger');
  assert.equal(bad.find(r => r.id === 'lounge').severity, 'danger');
  assert.equal(bad.find(r => r.name === '開発エリア').severity, 'danger');
});
function audioFixture() {
  const timers = new Map(), nodes = []; let timerId = 0;
  const ctx = { state: 'running', currentTime: 0, destination: {}, resume() { this.state = 'running'; return Promise.resolve(); }, suspend() { this.state = 'suspended'; return Promise.resolve(); }, createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }, createOscillator() { const node = { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() { this.disconnected = true; }, start(at) { this.startAt = at; }, stop(at) { this.stopAt = at; this.stopped = true; } }; nodes.push(node); return node; } };
  const music = new Life.Music(true, .12, () => ctx, { setTimer: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimer: id => timers.delete(id) });
  ctx.sampleRate = 8000;
  ctx.createBuffer = (channels, frames) => ({ getChannelData: () => new Float32Array(frames) });
  ctx.createBufferSource = () => { const n = { connect() {}, disconnect() { this.disconnected=true; }, start(at) {this.startAt=at;},stop(at){this.stopAt=at;this.stopped=true;} };nodes.push(n);return n; };
  return { music, timers, nodes, ctx };
}
test('BGM starts once, loops with a bounded horizon, and cleans up on mute', async () => {
  const f = audioFixture(); f.music.start(); f.music.start(); await Promise.resolve();
  assert.equal(f.timers.size, 1); assert.ok(f.nodes.length >= 7, 'chords, bass, melody and percussion');
  assert.ok(f.nodes.every(n => n.stopAt > n.startAt && n.stopAt - n.startAt < 3));
  assert.ok(f.nodes.some(n=>n.buffer), 'noise percussion is scheduled with the melody');
  for (let i = 1; i < 35; i++) {
    f.ctx.currentTime = i * .375;
    f.music.schedule();
    for (const node of f.nodes.filter(n => n.stopAt <= f.ctx.currentTime && !n.disconnected)) node.onended();
    assert.ok(f.music.nodes.size <= 30, 'short notes must not accumulate across the loop');
  }
  f.music.setVolume(.2); assert.equal(f.music.master.gain.value, .2);
  f.music.setEnabled(false); assert.equal(f.timers.size, 0); assert.equal(f.music.nodes.size, 0);
  assert.ok(f.nodes.every(n => n.stopped && n.disconnected));
});
test('BGM handles pending starts, zero volume, unsupported browsers and restart safely', async () => {
  const f = audioFixture(); f.music.start(); f.music.stop(); await Promise.resolve();
  assert.equal(f.timers.size, 0); assert.equal(f.nodes.length, 0);
  f.music.start(); await Promise.resolve(); assert.equal(f.timers.size, 1);
  f.music.setVolume(0); assert.equal(f.timers.size, 0);
  f.music.setVolume(.1); await Promise.resolve(); assert.equal(f.timers.size, 1);
  f.music.stop();
  const missing = new Life.Music(true, .1, () => null);
  assert.doesNotThrow(() => missing.start()); assert.equal(missing.timer, null);
});
