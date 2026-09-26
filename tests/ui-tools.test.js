const test = require('node:test');
const assert = require('node:assert/strict');
const { Playback, Sound, METRICS, ACTIONS, priorities, choiceGuide } = require('../ui-tools');
const Sim = require('../engine');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('browser timer functions are invoked with their global receiver', () => {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`globalThis.setInterval = function () { if (this !== globalThis) throw new TypeError('Illegal invocation'); return 7; }; globalThis.clearInterval = function () { if (this !== globalThis) throw new TypeError('Illegal invocation'); };`, sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../ui-tools.js'), 'utf8'), sandbox);
  vm.runInContext(`const player = new UI.Playback({tick: () => {}, canRun: () => true, speed: () => 600, changed: () => {}}); player.start(); player.openModal(); player.closeModal(); player.pause();`, sandbox);
});

function playbackFixture() {
  let allowed = true, delay = 600, nextId = 0;
  const active = new Map(), changes = [];
  const player = new Playback({ tick: () => {}, canRun: () => allowed, speed: () => delay, changed: value => changes.push(value), setTimer: (fn, ms) => { const id = nextId++; active.set(id, ms); return id; }, clearTimer: id => active.delete(id) });
  return { player, active, changes, allow: value => { allowed = value; }, speed: value => { delay = value; } };
}
test('a running game pauses for a decision and resumes once at the selected speed', () => {
  const f = playbackFixture(); f.player.start(); assert.equal(f.active.size, 1);
  f.player.openModal(); f.allow(false);
  assert.equal(f.active.size, 0); assert.equal(f.player.resumePending, true);
  // Re-rendering a dialog must preserve the original playback intent.
  f.player.openModal(); f.speed(1400); f.allow(true); f.player.closeModal();
  assert.equal(f.player.running, true); assert.deepEqual([...f.active.values()], [1400]);
  f.player.closeModal(); f.player.start(); assert.equal(f.active.size, 1);
});
test('a manually paused game stays paused after choosing or closing help', () => {
  const f = playbackFixture(); f.player.openModal(); f.player.closeModal(); assert.equal(f.player.running, false);
  f.player.start(); f.player.pause(); f.player.openModal(); f.player.closeModal(); assert.equal(f.player.running, false);
});
test('endings, new games, unresolved events and hidden pages cannot accidentally resume', () => {
  for (const reason of ['ending', 'new', 'hidden', 'unresolved']) {
    const f = playbackFixture(); f.player.start(); f.player.openModal(reason === 'ending');
    if (reason === 'hidden') f.player.pause();
    if (reason === 'unresolved' || reason === 'ending') f.allow(false);
    f.player.closeModal(reason !== 'new');
    assert.equal(f.active.size, 0, reason); assert.equal(f.player.resumePending, false, reason);
  }
});
test('muted, zero volume and unavailable audio do not create sound or interrupt play', () => {
  let factories = 0;
  const sound = new Sound(false, .25, () => { factories++; throw Error('unavailable'); });
  sound.play('alert'); assert.equal(factories, 0);
  sound.enabled = true; sound.volume = 0; sound.play('alert'); assert.equal(factories, 0);
  sound.volume = .25; assert.doesNotThrow(() => sound.play('confirm'));
  assert.equal(sound.context, null);
});
test('synthesized feedback has bounded volume, finite duration, cleanup and mute', () => {
  const nodes = [], peaks = [];
  const context = { state: 'running', currentTime: 10, destination: {}, suspend() { this.state = 'suspended'; return Promise.resolve(); }, resume() { this.state = 'running'; return Promise.resolve(); }, createOscillator() { const node = { frequency: {}, connect() {}, disconnect() { this.cleaned = true; }, start(at) { this.started = at; }, stop(at) { this.stopped = at; } }; nodes.push(node); return node; }, createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime(value) { peaks.push(value); } }, connect() {}, disconnect() {} }; } };
  const sound = new Sound(true, .25, () => context);
  sound.play('confirm'); assert.equal(nodes.length, 4);
  assert.ok(peaks.every(v => v > 0 && v <= .04));
  assert.ok(nodes.every(n => n.stopped > n.started && n.stopped - n.started < .2));
  nodes.forEach(n => n.onended()); assert.ok(nodes.every(n => n.cleaned));
  sound.setEnabled(false); assert.equal(context.state, 'suspended');
  sound.play('alert'); assert.equal(nodes.length, 4);
});
test('beginner explanations cover every decision and explain real risks and delayed costs', () => {
  for (const id of Object.keys(Sim.ACTIONS)) assert.ok(ACTIONS[id]?.length > 20, id);
  assert.equal(Object.keys(METRICS).length, 34);
  const s = Sim.create('説明テスト', 'tech', 1);
  const before = Sim.serialize(s);
  priorities(s); assert.equal(Sim.serialize(s), before, 'guidance must not change game balance or randomness');
  s.cash = 200; s.metrics.load = 130;
  assert.ok(priorities(s).some(t => t.focus.includes('資金')));
  assert.ok(priorities(s).some(t => t.focus.includes('負荷')));
  const concealed = Sim.EVENTS.find(e => e.id === 'defect').choices[1];
  assert.match(choiceGuide(concealed), /8週後/);
  assert.match(choiceGuide(concealed), /法律上の危険/);
});
