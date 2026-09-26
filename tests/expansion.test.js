const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../engine');

test('six difficulties consistently increase incident frequency', () => {
  const totals = [];
  for (const difficulty of Object.keys(Sim.DIFFICULTIES)) {
    let incidents=0;
    for(let seed=1;seed<=12;seed++) {
      const s=Sim.create('難易度試験','tech',seed,{difficulty});
      for(let w=0;w<100;w++) {
        s.cash=1e6; s.trust=80; s.legal=10; s.morale=70;
        if(s.event) { incidents++; Sim.decide(s,0); }
        Sim.step(s);
      }
    }
    totals.push(incidents);
  }
  assert.equal(totals.length,6);
  for(let i=1;i<totals.length;i++) assert.ok(totals[i]>totals[i-1], totals.join(','));
});
test('20 new dilemmas are unique, playable, and have opposing consequences',()=>{
  assert.equal(Sim.EVENTS.length,40);
  assert.equal(new Set(Sim.EVENTS.map(e=>e.id)).size,40);
  for(const ev of Sim.EVENTS.slice(20)) for(let i=0;i<ev.choices.length;i++) {
    const s=Sim.create('判断','tech',5); Sim.trigger(s,ev.id);
    assert.ok(Sim.decide(s,i).ok); assert.equal(s.event,null);
    assert.ok(Object.values(s.metrics).every(Number.isFinite));
    assert.notDeepEqual(ev.choices[0].effects,ev.choices[1].effects);
  }
});
test('bankrupt rivals stay visible for eight weeks, then fresh IDs and industries enter',()=>{
  const s=Sim.create('新陳代謝','tech',3); s.cash=1e6; s.eventCooldown=100;
  const r=s.rivals[0]; Sim.trade(s,r.id,10); r.cash=-1000;
  Sim.step(s); assert.equal(r.status,'倒産'); assert.equal(s.equity.holdings[r.id],undefined);
  for(let i=0;i<7;i++) Sim.step(s);
  assert.ok(s.rivals.some(x=>x.id===r.id)); Sim.step(s);
  const entrant=s.rivals[0]; assert.notEqual(entrant.id,r.id); assert.equal(entrant.status,'競争中');
  assert.notEqual(entrant.industry,'総合サービス'); assert.ok(s.timeline.some(t=>t.text.includes('が参入')));
});
test('stock trades preserve cash accounting, enforce constraints and survive saves',()=>{
  const s=Sim.create('投資','tech',8), r=s.rivals[0], cash=s.cash;
  assert.ok(Sim.trade(s,r.id,10).ok); assert.equal(s.equity.holdings[r.id],10);
  assert.ok(Math.abs(s.cash-(cash-10*r.stockPrice*1.01))<1e-8);
  assert.equal(Sim.trade(s,r.id,11,true).ok,false);
  assert.equal(Sim.trade(s,r.id,NaN).ok,false);
  assert.ok(Sim.trade(s,r.id,10,true).ok);
  assert.ok(Math.abs(s.cash-(cash-10*r.stockPrice*.02))<1e-8);
  assert.deepEqual(Sim.restore(Sim.serialize(s)).equity,s.equity);
});
test('incorporation and listing have real funding, dilution and overhead',()=>{
  const s=Sim.create('工房','tech',1,{incorporated:false}); s.cash=10000;
  assert.equal(Sim.corporate(s,'list').ok,false);
  assert.ok(Sim.corporate(s,'incorporate').ok); assert.equal(s.cash,9920);
  while(s.employees.length<20){s.applicants=50;s.actionsLeft=3;Sim.act(s,'hire');}
  s.actionsLeft=3; Sim.calculate(s); const overhead=s.metrics.overhead, cash=s.cash;
  assert.ok(Sim.corporate(s,'list').ok); assert.equal(s.cash,cash+400);
  assert.equal(s.equity.ownership,75); assert.equal(s.metrics.overhead,overhead+8);
  assert.equal(Sim.corporate(s,'list').ok,false);
});
test('outcomes depend on conditions and RNG while exact contracts remain fixed',()=>{
  const good=Sim.create('好条件','tech',12), bad=Sim.create('悪条件','tech',12);
  bad.morale=20;bad.efficiency=30;bad.trust=30;bad.satisfaction=30;bad.economy=.6;Sim.calculate(bad);
  const a=Sim.act(good,'ads'), b=Sim.act(bad,'ads'); assert.ok(a.strength>b.strength);
  const strengths=new Set(); for(let seed=1;seed<15;seed++){const s=Sim.create('乱数','tech',seed); strengths.add(Sim.act(s,'server').strength);}
  assert.ok(strengths.size>10);
  const s=Sim.create('固定契約','tech',2); const cash=s.cash;Sim.act(s,'loan');assert.equal(s.cash,cash+600);assert.equal(s.debt,600);
  const restored=Sim.restore(Sim.serialize(good)); assert.deepEqual(Sim.act(good,'research'),Sim.act(restored,'research'));assert.equal(Sim.serialize(good),Sim.serialize(restored));
});
test('older saves get safe default difficulty, equity and entrant identifiers',()=>{
  const s=Sim.create('旧形式','tech',4);delete s.difficulty;delete s.equity;delete s.nextRival;
  const old=Sim.restore(Sim.serialize(s));assert.equal(old.difficulty,'normal');assert.equal(old.equity.incorporated,true);assert.equal(old.nextRival,4);
  assert.doesNotThrow(()=>Sim.step(old));
});
