(function (root) {
  'use strict';
  // Keep playback intent separate from the temporary pause caused by a dialog.
  class Playback {
    constructor({ tick, canRun, speed, changed, setTimer = (fn, ms) => root.setInterval(fn, ms), clearTimer = id => root.clearInterval(id) }) {
      Object.assign(this, { tick, canRun, speed, changed, setTimer, clearTimer });
      this.timer = null; this.resumePending = false;
    }
    get running() { return this.timer !== null; }
    start() {
      if (this.running || !this.canRun()) return;
      this.timer = this.setTimer(this.tick, this.speed()); this.changed(true);
    }
    pause(forget = true) {
      if (this.running) this.clearTimer(this.timer);
      this.timer = null; if (forget) this.resumePending = false; this.changed(false);
    }
    openModal(terminal = false) {
      this.resumePending = !terminal && (this.resumePending || this.running);
      this.pause(false);
    }
    closeModal(resume = true) {
      const wanted = resume && this.resumePending;
      this.resumePending = false; if (wanted) this.start();
    }
  }
  // Synthesized locally: no audio downloads, assets, or external libraries.
  class Sound {
    constructor(enabled = true, volume = .25, contextFactory = null) {
      this.enabled = enabled; this.volume = volume; this.context = null;
      this.contextFactory = contextFactory || (() => {
        const Audio = root.AudioContext || root.webkitAudioContext;
        return Audio ? new Audio() : null;
      });
    }
    unlock() {
      if (!this.enabled) return;
      try {
        if (!this.context) this.context = this.contextFactory();
        if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
      } catch { this.context = null; }
    }
    play(kind = 'click') {
      if (!this.enabled || this.volume <= 0) return;
      this.unlock(); const ctx = this.context;
      if (!ctx || ctx.state !== 'running') return;
      const notes = { click: [880, 1320], tick: [392, 523], confirm: [523, 659, 784, 1047], celebrate: [523, 659, 784, 1047, 1319, 1568], alert: [784, 587, 784], error: [220, 147], end: [330, 260, 196], start: [523, 784, 1047], save: [784, 1047, 1319] }[kind] || [650];
      const length = kind === 'click' || kind === 'tick' ? .035 : .095;
      try {
        notes.forEach((frequency, i) => {
          const osc = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * (length + .025);
          osc.type = ['end','click','confirm','celebrate'].includes(kind) ? 'triangle' : 'sine'; osc.frequency.value = frequency;
          gain.gain.setValueAtTime(.0001, at);
          gain.gain.exponentialRampToValueAtTime(Math.max(.0001, this.volume * (kind === 'tick' ? .055 : .16)), at + .007);
          gain.gain.exponentialRampToValueAtTime(.0001, at + length);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.onended = () => { osc.disconnect(); gain.disconnect(); };
          osc.start(at); osc.stop(at + length + .015);
        });
      } catch { /* Sound failure must never interrupt a decision. */ }
    }
    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled && this.context?.state === 'running') this.context.suspend().catch(() => {});
      if (enabled) { this.unlock(); this.play('confirm'); }
    }
  }
  const METRICS = {
    手元資金: '今すぐ支払いに使えるお金。売上が高くても、投資や返金でこれが0未満になると倒産します。',
    週次売上: '直前の1週間に商品を売って得た金額。費用を引く前なので、全部が会社の儲けではありません。創業直後は予測値です。',
    営業利益: '売上から材料費、給与、広告費、維持費、利息などを引いた残り。プラスなら現金が増え、マイナスなら減ります。創業直後は予測値です。',
    社員数: '会社で働く人数。増やすと生産力も給与支出も増え、管理が難しくなります。',
    粗利率: '売上のうち、材料費を引いて残る割合。給与や広告費はまだ引いていないので、これだけで黒字とは判断できません。',
    人件費: '社員と管理職へ毎週払う給与。売れない週にも支払いが必要です。',
    離職率: '1週間で社員が辞める確率の目安。士気低下、ストレス、給与削減で上がります。',
    '生産力 / 需要': '左は1週間に作れる数、右はお客さんが欲しがる数。右が多いと売り逃し、左が多すぎると在庫と費用が増えます。',
    在庫: '作ったけれど、まだ売れていない商品。注文を補えますが、保管費用が毎週かかります。',
    返品率: '売った商品が返される割合。品質の低さや障害で上がり、実際の売上を減らします。',
    顧客満足度: 'お客さんが製品や対応に満足している度合い。低いと注文と信用が減ります。',
    ブランド価値: '会社の知名度・存在感。高いほど需要が増えます。話題になっていても信用が高いとは限りません。',
    市場シェア: '市場全体の中で自社が占める割合。競合も成長するため、自社の売上が増えても下がることがあります。',
    広告効率: '広告費1万円に対して売上が何万円あるか。広告以外の効果も含む目安で、儲けの割合ではありません。',
    サーバー負荷: '注文が処理能力をどれだけ使っているか。75%超から障害率が上がり、100%超は能力を超えた状態です。',
    障害率: 'サービスが正常に動かない割合。売上・満足度を下げ、返品を増やします。',
    信用: '顧客や取引先から信頼されている度合い。5以下になると取引が止まり、経営終了です。',
    法務リスク: '法律・規制・不具合対応で抱えている危険の大きさ。99以上で事業停止。監査や法務社員で下げられます。',
    社内士気: '社員のやる気。低いと生産力が下がり、退職が増えます。給与や福利厚生で改善できます。',
    管理効率: '組織が無駄なく仕事を進められる度合い。社員数・会議・無意味なKPIで低下し、管理職や経理社員が助けます。',
    株主期待度: '出資者が会社に求める成長の強さ。高いほど良い指標ではなく、大企業で赤字が続くと追加負担になります。',
    採用応募数: '今、入社を希望している人数。通常採用には3名必要で、知名度・待遇・人事社員で増えます。',
    平均ストレス: '社員が抱える負担の平均。高いと生産力が落ち、辞めやすくなります。',
    平均忠誠度: '社員がこの会社に残りたい気持ちの平均。給与削減で下がり、低いと退職が増えます。',
    会議密度: '会議が仕事を占める度合い。管理職の増加で上がり、実際に管理効率を下げます。',
    CEOカリスマ: 'あなたが頼れる経営者に見えている度合い。利益と士気で変動し、商品を買いたい人の数にも影響します。',
    社内空気: '士気を天気で表したもの。晴れは元気、曇りは不安、雷雨は深刻な状態です。',
    'スライド / 社員': '社員1人あたりの資料の量。増えすぎると資料作りが仕事を圧迫し、管理効率が下がります。',
    意味のないKPI: '測ること自体が目的になった目標の数。増えると実際に管理効率が下がります。',
    販売単価: '商品1個の値段。「1.25万」は12,500円。値上げで1個の売上は増えますが、注文は減ります。',
    '設備 / サーバー容量': '左は作れる数の上限、右は処理できる注文の数。社員を採用するだけでは設備の上限は増えません。',
    '広告 / 福利厚生': '左は宣伝、右は社員の待遇改善へ毎週使う金額。増やした後も支出が続きます。',
    '間接費・利息': '設備やサーバーの維持、広告、福利厚生、借入利息など。材料費と給与以外に毎週払う費用です。',
    海外市場: '進出した地域の数。お客さんは増えますが、固定費・法務・管理の負担も増えます。'
  };
  const ACTIONS = {
    hire: '人を増やして作れる量を増やす。給与は毎週必要。注文が少ないと、人を増やしても儲かりません。',
    fire: '人を減らして毎週の給与を抑える。ただし退職金が必要で、残った社員のやる気や信用も下がります。',
    priceUp: '商品を高く売る。1個の売上は増える一方、買う人は減ります。',
    priceDown: '商品を安く売る。注文は増えますが、1個の儲けが減り、サーバーが忙しくなります。',
    ads: '商品を知ってもらい、注文を増やす。最初の80万円に加え、広告費が毎週12万円増えます。設備とサーバーが足りるか先に確認。',
    adsDown: '宣伝を減らして毎週の支出を抑える。ただし知名度が伸びにくくなります。',
    equipment: '工場や仕事の道具を増やす。作れる量の上限が上がりますが、社員が足りないと使い切れません。維持費も増えます。',
    research: '品質を改善する研究にお金を使う。成果が出るのは4週後なので、それまでの支払いに注意。',
    benefits: '休息や待遇を改善して社員を元気にする。最初の費用に加えて、毎週の支出も増えます。',
    salaryUp: '全社員の給与を上げる。やる気と残りたい気持ちが増えますが、毎週払う給与も増えます。',
    salaryDown: '全社員の給与を下げる。今の支出は減りますが、不満・退職・生産低下につながります。',
    server: '注文を処理する機械を増やす。障害は減りますが、購入費と毎週の維持費が必要です。',
    manager: '現場をまとめる人を増やす。大人数でも仕事を進めやすくなりますが、給与と会議が増えます。',
    compliance: '会社の問題を調べて法律上の危険を減らす。お金がかかり、調査で社員のやる気も少し下がります。',
    overseas: '外国のお客さんにも売る。注文は増えますが、現地費用と法律・組織の複雑さも増えます。',
    loan: '600万円を借りる。すぐ払えるお金は増えますが、返済するまで毎週利息が必要です。売上ではありません。',
    repay: '借りたお金を300万円返す。利息は減りますが、今使える現金も減ります。',
    exit: '経営を次の人へ引き継ぎ、このプレイを終える。倒産せずに年表を確定できます。'
  };
  function priorities(s) {
    const m = s.metrics, tips = [];
    if (s.cash < 300 || m.profit < 0) tips.push({ title: '手元のお金を守ろう', text: `翌週の利益予測は${Math.round(m.profit)}万円。売上ではなく、費用を引いた残りを見ましょう。投資の前に給与・広告・利息を確認。`, focus: '資金・営業利益' });
    if (m.load > 75) tips.push({ title: '注文の処理が追いつかない', text: `サーバー負荷は${Math.round(m.load)}%。注文が増えても障害で売上が減ります。サーバー増強か広告縮小を検討。`, focus: '負荷・障害率' });
    if (s.morale < 60 || m.turnover > 3) tips.push({ title: '社員が疲れている', text: '給与を削ると今は儲かっても、人が辞めて作れる量が減ります。福利厚生や給与改善と毎週の費用を比較。', focus: '士気・離職率' });
    if (s.legal > 50 || s.trust < 40) tips.push({ title: '会社の信用を守ろう', text: '法律上の危険が99になると事業停止、信用が5以下になると取引停止です。内部監査や法務の採用を検討。', focus: '法務・信用' });
    if (m.demand > m.production * 1.1) tips.push({ title: '作れる量より注文が多い', text: '採用は社員の作業能力、設備投資は作れる量の上限を増やします。どちらが不足しているか確認。', focus: '生産力 / 需要' });
    if (!tips.length) tips.push({ title: '今は、比較しながら成長できる', text: '売上は入ってきたお金、利益は費用を引いた残り、資金は今使えるお金。広告で注文を増やす前に、生産とサーバーの余裕を確認。', focus: '売上・利益・資金' });
    return tips.slice(0, 3);
  }
  function choiceGuide(choice) {
    const fx = choice.effects, messages = [];
    if (fx.cash < 0) messages.push('今使える現金が減ります。払った結果0未満になると倒産します。');
    if (fx.cash > 0) messages.push('今使える現金は増えますが、将来の費用や信用とは別です。');
    if (fx.debt > 0) messages.push('借金も増えるため、返済するまで毎週の利息が増えます。');
    if (fx.ads > 0 || fx.benefits > 0) messages.push('広告や待遇の予算は、来週以降も毎週支払います。');
    if (fx.salaryFactor) messages.push(fx.salaryFactor < 1 ? '毎週の給与は減りますが、社員が辞めやすくなります。' : '待遇改善と引き換えに毎週の給与が増えます。');
    if (fx.trust < 0 || fx.legal > 0) messages.push('取引先の信頼や法律上の危険が悪化します。今の利益だけで選ばないようにしましょう。');
    if (fx.tech > 0) messages.push('品質が改善し、返品や障害を抑える助けになります。');
    if (fx.server > 0 || fx.equipment > 0) messages.push('作る・処理する能力は増えますが、毎週の維持費も増えます。');
    if (fx.priceFactor) messages.push('商品の値段を変えると、1個の儲けと買いたい人の数が反対方向に動きます。');
    if (fx.economy) messages.push(fx.economy > 0 ? '景気が良くなり、注文が増えやすくなります。' : '景気が悪くなり、注文が減りやすくなります。');
    if (fx.genius) messages.push('優秀な人を迎えますが、給与の支払いも毎週増えます。');
    if (fx.morale < 0 || fx.stress > 0 || fx.loseAce) messages.push('現場への負担が増え、作れる量や社員の定着に響きます。');
    if (fx.morale > 0 || fx.stress < 0 || fx.loyalty > 0) messages.push('社員が働きやすくなり、生産や定着を支えます。');
    if (fx.brand > 0) messages.push('知名度が上がって注文が増えやすくなります。作れる量とサーバーの余裕も必要です。');
    if (fx.meetings > 0 || fx.nonsense > 0) messages.push('管理のための仕事が増え、効率に負担がかかります。');
    if (choice.delayed) messages.push(`${choice.delayed.weeks}週後にも影響が出ます。先送りした問題は消えません。`);
    return messages.length ? messages.join(' ') : '上の数値はこの選択で変わる量です。増える指標と減る指標の両方を比べましょう。';
  }
  const api = { Playback, Sound, METRICS, ACTIONS, priorities, choiceGuide };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.UI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
