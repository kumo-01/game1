(function (root) {
  'use strict';
  const Sound = typeof module !== 'undefined' && module.exports ? require('./ui-tools').Sound : root.UI.Sound;
  // An original ambient loop, synthesized entirely in the browser.
  class Music extends Sound {
    constructor(enabled = true, volume = .12, contextFactory = null, timers = {}) {
      super(enabled, volume, contextFactory);
      this.setTimer = timers.setTimer || (fn => root.setInterval(fn, 150));
      this.clearTimer = timers.clearTimer || (id => root.clearInterval(id));
      this.timer = null; this.wanted = false; this.nodes = new Set(); this.beat = 0; this.nextAt = 0; this.master = null; this.mood = 'calm';
    }
    start() {
      if (!this.enabled || this.volume <= 0) return;
      this.wanted = true; this.unlock(); const ctx = this.context;
      if (!ctx) return;
      const ready = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      ready.then(() => {
        if (!this.wanted || !this.enabled || this.timer !== null || ctx.state !== 'running') return;
        if (!this.master) { this.master = ctx.createGain(); this.master.connect(ctx.destination); }
        this.master.gain.value = this.volume;
        this.nextAt = ctx.currentTime + .05; this.timer = this.setTimer(() => this.schedule()); this.schedule();
      }).catch(() => {});
    }
    note(frequency, at, duration, amplitude, type = 'sine') {
      const ctx = this.context, osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(amplitude, at + Math.min(.15, duration / 3));
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      osc.connect(gain); gain.connect(this.master);
      const node = { osc, gain }; this.nodes.add(node);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); this.nodes.delete(node); };
      osc.start(at); osc.stop(at + duration + .02);
    }
    schedule() {
      if (!this.wanted || !this.context || this.context.state !== 'running') return;
      const ctx = this.context;
      if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + .05;
      try {
        // Schedule a short horizon; a backgrounded tab cannot accumulate notes.
        while (this.nextAt < ctx.currentTime + .3) {
          const chord = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]][Math.floor(this.beat / 8) % 4];
          const minor = this.mood === 'tense' ? -1 : 0;
          const pitch = n => 130.81 * Math.pow(2, n / 12);
          if (this.beat % 8 === 0) chord.forEach((n, i) => this.note(pitch(n + (i === 1 ? minor : 0)), this.nextAt, 2.7, .045, 'triangle'));
          if (this.beat % 2 === 0) {
            const melody = [12, 16, 19, 14, 19, 16, 21, 19][Math.floor(this.beat / 2) % 8];
            this.note(pitch(melody + minor), this.nextAt, .55, .025);
          }
          this.nextAt += .375; this.beat = (this.beat + 1) % 128;
        }
      } catch { this.stop(); }
    }
    stop() {
      this.wanted = false;
      if (this.timer !== null) this.clearTimer(this.timer);
      this.timer = null;
      for (const node of this.nodes) {
        try { node.osc.stop(); } catch { /* Already ended. */ }
        node.osc.disconnect(); node.gain.disconnect();
      }
      this.nodes.clear();
    }
    setEnabled(enabled) {
      this.enabled = enabled;
      if (enabled) this.start();
      else { this.stop(); if (this.context?.state === 'running') this.context.suspend().catch(() => {}); }
    }
    setVolume(volume) {
      this.volume = Math.max(0, Math.min(1, volume));
      if (this.master) this.master.gain.value = this.volume;
      if (!this.volume) this.stop(); else if (this.enabled) this.start();
    }
  }
  function hash(text) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function choose(list, seed) { return list[seed % list.length]; }
  function staffMessage(s, e, seed) {
    if (s.ended) return choose(['最後まで一緒に働いたみんな、ありがとう。会社の数字の向こうに人がいた。', '経営の年表を読んでいる。あの時の会議、まだ覚えている。'], seed);
    if (s.salary < .9) return choose(['給与明細を見てから、転職サイトを見る時間が増えました。', '利益改善のスライドに、私の家賃は載っていない。'], seed);
    if (e.stress > 60 || s.morale < 45) return choose(['最高売上おめでとうございます。ところで今週も家に帰れていません。', '人が辞める → 仕事が増える → また人が辞める。これ、循環参照では？'], seed);
    if (s.meetings > 40) return choose(['会議を減らす会議の事前会議に呼ばれた。', '資料を作るための資料が完成。製品の進捗は聞かないで。'], seed);
    if (s.metrics.load > 90 && e.dept === '開発') return '営業の「受注しました！」と、監視アラートが同時に鳴っている。';
    if (s.benefits >= 12) return choose(['休みやすくなった。会社が大きくなっても、こういうところは残ってほしい。', '福利厚生、ちゃんと効いてる。今週は少し人間に戻れました。'], seed);
    if (e.trait === '天才') return '技術的負債を直したら、新しい技術的負債が生まれた。仕事は尽きない。';
    if (s.tech > 75 && e.dept === '開発') return '新しい基盤、いい感じ。品質を上げると問い合わせも減るので助かる。';
    return choose(['創業期の全員集合写真、まだ全員の顔がわかる。', '数字が良くても、隣の席の人が元気かは別の話。', '営業と開発で「成功」の定義が違う。今日はそれを話せた。', 'お客さんからありがとうのメール。こういうのがいちばんうれしい。', '社内チャットのスタンプだけが先に大企業になっている。'], seed);
  }
  function publicMessage(s, seed) {
    if (s.ended) return s.ended.retired ? '創業CEOが退任したらしい。次の経営も、使っている人を大事にしてほしい。' : 'あの会社、営業を止めたらしい。便利だったから残念。年表を見ると急な話でもなかったのかも。';
    if (s.metrics.outage > 10) return choose(['またサービスがつながらない。広告より先にサーバーを何とかしてほしい。', '注文しようとしたらエラー。人気なのはわかるけど、使えないと困る。'], seed);
    if (s.trust < 40) return choose(['説明が足りない感じがして、しばらく様子を見ることにした。', '有名な会社だけど、今は友達に薦めにくい。信用って戻すの大変そう。'], seed);
    if (s.metrics.returns > 8) return '返品することになった。対応はさておき、製品を安心して使えるようにしてほしい。';
    if (s.metrics.demand > s.metrics.production * 1.25) return choose(['気になってるけど、在庫が追いついていないみたい。', '人気で売り切れらしい。次はいつ買えるんだろう。'], seed);
    if (s.satisfaction > 80 && s.tech > 65) return choose(['最近、品質が良くなった気がする。地味な改善がありがたい。', '試してみたらちゃんと良かった。広告より使った人の感想を信じたい。'], seed);
    if (s.brand > 65) return choose(['最近どこを見てもこの会社の広告。名前は覚えた。', '話題の会社。知名度と使いやすさ、両方伸びてほしい。'], seed);
    return choose(['新しい会社の製品を試してみた。これからどう育つか楽しみ。', '値段、品質、サポート。全部ちょうどいい会社って意外と難しい。', '小さい会社の丁寧な対応、好き。大きくなっても続けてほしい。', '会社の口コミを読んでる。人によって評価が違うので、自分でも試す。'], seed);
  }
  function record(s) {
    if (!s.life || s.life.version !== 1 || !Array.isArray(s.life.staff) || !Array.isArray(s.life.internet)) s.life = { version: 1, staff: [], internet: [], lastWeek: -1, timelineCount: Math.max(0, s.timeline.length - 4), endingPosted: false };
    const life = s.life;
    const add = (channel, id, author, role, text, seed) => {
      if (life[channel].some(p => p.id === id)) return;
      life[channel].unshift({ id, week: s.week, author, role, text, likes: 1 + seed % (channel === 'staff' ? Math.max(2, s.employees.length) : 450) });
      life[channel] = life[channel].slice(0, 120);
    };
    if (life.lastWeek !== s.week || (s.ended && !life.endingPosted)) {
      for (let i = 0; i < 3; i++) {
        const seed = hash(`${s.seed}:${s.week}:${i}`), e = s.employees.length ? s.employees[seed % s.employees.length] : { name: '元社員', dept: '社内', stress: 0 };
        const suffix = s.ended ? ':end' : '';
        add('staff', `staff:${s.week}:${i}${suffix}`, e.name, `${e.dept} / ${e.trait || '社員'}`, staffMessage(s, e, seed), seed);
        add('internet', `web:${s.week}:${i}${suffix}`, choose(['みなと', '製品ウォッチャー', '週末ユーザー', 'まちの口コミ', '小さな投資家', 'ゆるい消費者', '通りすがり'], seed), '一般ユーザー', publicMessage(s, seed >>> 3), seed);
      }
      life.lastWeek = s.week; life.endingPosted = !!s.ended;
    }
    const start = Math.min(life.timelineCount, s.timeline.length);
    s.timeline.slice(start).forEach((event, index) => {
      const seed = hash(event.text + event.week), id = `news:${start + index}`;
      add('staff', id, '社内の記録係', '社員専用 / 会社の動き', `社内で話題：${event.text}`, seed);
      if (/創業。|公表|公開された|不具合が発覚|炎上|を.*買収|競合|罰金|情報漏洩|倒産|事業停止|取引.*停止|CEO退任|任期満了/.test(event.text)) add('internet', id, '企業観察アカウント', '公開ニュースへの感想', `会社のニュースを見た：${event.text} 数字だけでなく、その後の対応も見ていきたい。`, seed);
    });
    life.timelineCount = s.timeline.length; return life;
  }
  function rooms(s) {
    const m = s.metrics;
    const departmentDescriptions = { 営業: '注文を増やす現場。受注と供給のバランスを確認。', 開発: '品質と技術を支える現場。高負荷や過労が成果に響く。', 人事: '採用と社員の定着を支える現場。', 経理: '会社のお金と管理の精度を見守る現場。', 広報: '知名度を育てる現場。認知と信用は別の指標。', 法務: '法律・規制・不具合対応の危険を減らす現場。' };
    const list = Object.keys(departmentDescriptions).map((dept, i) => {
      const people = s.employees.filter(e => e.dept === dept), stress = people.length ? people.reduce((sum, e) => sum + e.stress, 0) / people.length : 0;
      return { id: `dept-${i}`, name: `${dept}エリア`, icon: ['↗', '⌘', '♙', '▤', '◎', '⚖'][i], kind: 'office', people, count: people.length, severity: stress > 65 ? 'danger' : stress > 45 ? 'warning' : 'healthy', status: !people.length ? '配属なし' : stress > 65 ? '過労' : stress > 45 ? '多忙' : '稼働中', detail: departmentDescriptions[dept], facts: [`社員 ${people.length}名`, `平均ストレス ${Math.round(stress)}`, `平均忠誠 ${people.length ? Math.round(people.reduce((sum, e) => sum + e.loyalty, 0) / people.length) : '—'}`] };
    });
    return list.concat([
      { id: 'server', name: 'サーバールーム', icon: '▥', kind: 'server', count: 0, severity: m.outage > 10 ? 'danger' : m.load > 75 ? 'warning' : 'healthy', status: m.outage > 10 ? '障害発生' : m.load > 75 ? '高負荷' : '正常', detail: '増えた注文を処理する設備。営業が好調でも、ここが赤くなると満足度と売上が落ちます。', facts: [`負荷 ${Math.round(m.load)}%`, `障害率 ${m.outage.toFixed(1)}%`, `容量 ${Math.round(s.server)}`] },
      { id: 'factory', name: '生産・倉庫', icon: '▦', kind: 'factory', count: 0, severity: m.demand > m.production * 1.3 ? 'danger' : s.inventory > s.equipment * 2 ? 'warning' : 'healthy', status: m.demand > m.production * 1.3 ? '供給不足' : s.inventory > s.equipment * 2 ? '在庫過多' : '稼働中', detail: '社員の作業と設備で商品を作り、売れ残りを保管します。山積みの在庫にも毎週の費用がかかります。', facts: [`生産 ${Math.round(m.production)} / 需要 ${Math.round(m.demand)}`, `在庫 ${Math.round(s.inventory)}`, `設備上限 ${Math.round(s.equipment)}`] },
      { id: 'meeting', name: '会議・役員室', icon: '▧', kind: 'meeting', count: s.managers, severity: s.meetings > 65 ? 'danger' : s.meetings > 35 ? 'warning' : 'healthy', status: s.meetings > 65 ? '会議だらけ' : s.stage >= 2 ? '管理職・役員が活動' : '創業CEOが直接管理', detail: '組織をまとめる場所。管理職は助けになりますが、会議や資料が増えると仕事を圧迫します。', facts: [`管理職 ${s.managers}名`, `会議密度 ${Math.round(s.meetings)}`, `管理効率 ${Math.round(m.efficiency)}%`] },
      { id: 'lounge', name: '休憩室・社員食堂', icon: '☕', kind: 'lounge', count: 0, severity: s.morale < 40 ? 'danger' : s.morale < 60 ? 'warning' : 'healthy', status: s.morale < 40 ? '空気が重い' : s.morale < 60 ? '疲れが目立つ' : '穏やか', detail: '働く人の余裕が見える場所。福利厚生と給与、過労や退職が雰囲気に表れます。', facts: [`士気 ${Math.round(s.morale)}`, `平均ストレス ${Math.round(m.stress)}`, `福利厚生 ${Math.round(s.benefits)}万 / 週`] }
    ]);
  }
  const api = { Music, record, rooms };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Life = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
