(function (root) {
  'use strict';
  const Expansion = typeof module !== 'undefined' && module.exports ? require('./expansion') : root.Expansion;
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  const DEPTS = ['営業', '開発', '人事', '経理', '広報', '法務'];
  const STRATEGIES = {
    budget: { name: '格安路線', desc: '薄利多売。需要は多いが、設備と現場が悲鳴を上げる。', price: .85, brand: 28, tech: 24, ads: 18 },
    premium: { name: '高級路線', desc: '高い利益率。顧客の期待も高く、不具合には厳しい。', price: 1.8, brand: 58, tech: 32, ads: 14 },
    tech: { name: '技術重視', desc: '優秀な開発陣。品質で勝負、知名度と人件費が課題。', price: 1.25, brand: 32, tech: 55, ads: 12 },
    ads: { name: '広告重視', desc: 'まずは話題に。売上の波と過負荷を乗りこなせ。', price: 1.15, brand: 45, tech: 25, ads: 40 }
  };
  const ACTIONS = {
    hire: { name: '採用する', desc: '3名 / 採用費30万＋週給。供給↑ 管理負荷↑', cost: 30 },
    fire: { name: '人員整理', desc: '2名 / 退職金40万。固定費↓ 士気・信用↓', cost: 40 },
    priceUp: { name: '値上げ +10%', desc: '単価↑ 需要↓ 顧客満足↓', cost: 0 },
    priceDown: { name: '値下げ −10%', desc: '需要↑ 粗利率↓ サーバー負荷↑', cost: 0 },
    ads: { name: '広告を拡大', desc: '80万 / 広告予算＋12万/週。需要↑ 負荷↑', cost: 80 },
    adsDown: { name: '広告を縮小', desc: '広告予算−12万/週。支出↓ 認知の成長↓', cost: 0 },
    equipment: { name: '設備投資', desc: '180万 / 生産設備＋180。維持費↑ 在庫リスク↑', cost: 180 },
    research: { name: '研究開発', desc: '140万 / 4週後に技術＋10。短期資金↓ 品質↑', cost: 140 },
    benefits: { name: '福利厚生', desc: '60万 / 厚生予算＋6万/週。士気↑ 定着↑', cost: 60 },
    salaryUp: { name: '給与 +10%', desc: '週の人件費↑ 忠誠・応募・士気↑', cost: 0 },
    salaryDown: { name: '給与 −10%', desc: '短期利益↑ ストレス・離職↑', cost: 0 },
    server: { name: 'サーバー増強', desc: '120万 / 処理容量＋220。維持費↑ 障害↓', cost: 120 },
    manager: { name: '管理職を登用', desc: '80万 / 管理容量↑ 会議↑ 給与↑', cost: 80, unlock: 20 },
    compliance: { name: '内部監査', desc: '100万 / 法務リスク↓ 技術課題解消。士気↓', cost: 100 },
    overseas: { name: '海外進出', desc: '400万 / 市場＋45%。法務・管理負荷↑', cost: 400, unlock: 45 },
    loan: { name: '融資を受ける', desc: '資金＋600万 / 負債＋600万。週利0.8%', cost: 0 },
    repay: { name: '借入返済', desc: '300万 / 負債−300万。利息↓ 手元資金↓', cost: 300 },
    exit: { name: 'CEOを退任', desc: '経営を引き継ぎ、会社年表を確定する。', cost: 0, unlock: 120 }
  };
  // Effects are data, so events, executive decisions and tests use the same rules.
  const EVENTS = [
    { id: 'defect', title: '製品に重大な不具合', text: '開発部は販売停止を要求。営業部は今期目標を守りたい。隠した問題は後から戻ってくる。', choices: [
      { label: '公表して自主回収', note: '資金−120 / 信用＋8 / ブランド−4', effects: { cash: -120, trust: 8, brand: -4, tech: 3 } },
      { label: '販売を継続', note: '資金＋90 / 法務＋18 / 8週後に返金・信用喪失', effects: { cash: 90, legal: 18 }, delayed: { weeks: 8, text: '隠していた不具合が発覚。集団返金と監査。', effects: { cash: -380, trust: -24, legal: 20, satisfaction: -15 }, scandal: true } }] },
    { id: 'viral', title: '社員食堂がSNSでバズった', text: '製品より定食が有名になっている。広報が食堂公式アカウントを求めている。', choices: [
      { label: '定食も事業だ', note: '資金−50 / ブランド＋12 / 会議＋5', effects: { cash: -50, brand: 12, meetings: 5, morale: 6 } },
      { label: '本業に戻ろう', note: '技術＋3 / 士気−4', effects: { tech: 3, morale: -4 } }] },
    { id: 'pricewar', title: '競合が緊急値下げ', text: '顧客が比較サイトに殺到。価格を守るか、シェアを守るか。', choices: [
      { label: '価格で対抗', note: '単価−12% / 満足＋4', effects: { priceFactor: .88, satisfaction: 4 } },
      { label: '品質で対抗', note: '資金−100 / 技術＋5 / ブランド＋4', effects: { cash: -100, tech: 5, brand: 4 } }] },
    { id: 'outage', title: 'サーバー障害・顧客が足止め', text: '営業が受けた契約をインフラが処理しきれない。', choices: [
      { label: '緊急復旧と補償', note: '資金−140 / 容量＋100 / 信用＋3', effects: { cash: -140, server: 100, trust: 3 } },
      { label: '現場で耐える', note: '満足−12 / 士気−10 / 法務＋5', effects: { satisfaction: -12, morale: -10, legal: 5 } }] },
    { id: 'ace', title: 'エース社員に競合からオファー', text: '「評価はありがたいですが、家にも帰りたいです」', choices: [
      { label: '特別賞与で引き留める', note: '資金−100 / 忠誠＋12 / 士気＋4', effects: { cash: -100, loyalty: 12, morale: 4 } },
      { label: '新天地へ送り出す', note: '最も優秀な社員が退職 / 技術−4', effects: { loseAce: 1, tech: -4 } }] },
    { id: 'regulation', title: '新たな業界規制', text: '帳票が増える。法務は歓迎し、開発は絶望している。', choices: [
      { label: '先行して対応', note: '資金−130 / 法務−18 / 会議＋4', effects: { cash: -130, legal: -18, meetings: 4, trust: 4 } },
      { label: '対応を先送り', note: '法務＋14 / 10週後に罰金180万', effects: { legal: 14 }, delayed: { weeks: 10, text: '規制対応の期限が切れ、行政から罰金。', effects: { cash: -180, trust: -8 } } }] },
    { id: 'whistle', title: '内部告発が届いた', text: '数字の水増し疑惑。経理部の達成率だけが異常に高い。', choices: [
      { label: '第三者調査を依頼', note: '資金−160 / 法務−20 / 信用＋6', effects: { cash: -160, legal: -20, trust: 6, morale: -3 } },
      { label: '握りつぶす', note: '法務＋22 / 6週後に炎上', effects: { legal: 22 }, delayed: { weeks: 6, text: '告発文が公開された。隠蔽の代償。', effects: { trust: -30, cash: -250, brand: -20 }, scandal: true } }] },
    { id: 'trend', title: '業界がSNSトレンド入り', text: '問い合わせが止まらない。今こそ売るべきか、受け入れを絞るべきか。', choices: [
      { label: '全力で受注', note: 'ブランド＋15 / 広告予算＋8/週 / ストレス＋8', effects: { brand: 15, ads: 8, stress: 8 } },
      { label: '受注を限定', note: '満足＋8 / 信用＋4 / 資金＋30', effects: { satisfaction: 8, trust: 4, cash: 30 } }] },
    { id: 'recession', title: '景気後退・財布の紐が固くなる', text: '市場が冷え込む。株主はコスト削減を、人事は雇用維持を要求。', choices: [
      { label: '雇用を守る', note: '景気−0.18 / 資金−70 / 士気＋8', effects: { economy: -.18, cash: -70, morale: 8 } },
      { label: '給与を一時削減', note: '景気−0.18 / 給与−8% / 士気−12', effects: { economy: -.18, salaryFactor: .92, morale: -12 } }] },
    { id: 'boom', title: '好景気、資金が市場へ流入', text: '採用競争も激化している。成長に賭けるか、備えるか。', choices: [
      { label: '攻めの投資', note: '景気＋0.15 / 資金−120 / 設備＋150 / ブランド＋7', effects: { economy: .15, cash: -120, equipment: 150, brand: 7 } },
      { label: '現金を積む', note: '景気＋0.1 / 資金＋80 / 株主期待−5', effects: { economy: .1, cash: 80, expectations: -5 } }] },
    { id: 'shareholder', title: '株主から成長要求', text: '「先週より数字が大きければ、たぶん経営は順調です」', choices: [
      { label: '成長を約束', note: '資金＋250 / 期待＋15 / 広告＋10/週', effects: { cash: 250, expectations: 15, ads: 10 } },
      { label: '安定を優先', note: '期待−12 / 管理効率＋4 / 信用＋4', effects: { expectations: -12, efficiency: 4, trust: 4 } }] },
    { id: 'faction', title: '営業派と技術派が対立', text: '製品ロードマップ会議が四日目に突入。スライドは増えている。', choices: [
      { label: '技術派を支持', note: '技術＋6 / 士気−5 / ブランド−3', effects: { tech: 6, morale: -5, brand: -3 } },
      { label: '営業派を支持', note: 'ブランド＋8 / 技術−4 / 法務＋6', effects: { brand: 8, tech: -4, legal: 6 } },
      { label: '調整会議を増設', note: '会議＋12 / 士気＋3 / 資金−30', effects: { meetings: 12, morale: 3, cash: -30 } }] },
    { id: 'burnout', title: '現場が燃え尽きた', text: '最高売上を祝うメールに、誰も返信しない。', choices: [
      { label: '全社休暇', note: '資金−100 / ストレス−20 / 士気＋14', effects: { cash: -100, stress: -20, morale: 14 } },
      { label: '気合いで乗り切る', note: '資金＋60 / ストレス＋12 / 士気−10', effects: { cash: 60, stress: 12, morale: -10 } }] },
    { id: 'audit', title: '監査法人の訪問', text: '積み上がった法務リスクに、名前と請求額がついた。', choices: [
      { label: '全面協力', note: '資金−220 / 法務−25 / 信用＋4', effects: { cash: -220, legal: -25, trust: 4 } },
      { label: '形式的な資料で対応', note: '資金−50 / スライド＋20 / 5週後に信用−15', effects: { cash: -50, slides: 20 }, delayed: { weeks: 5, text: '監査で説明不足を指摘された。', effects: { trust: -15, legal: 15 } } }] },
    { id: 'talent', title: '天才が求人に応募', text: '履歴書の志望動機は「ここの技術的負債、面白そう」。', choices: [
      { label: '破格の条件で採用', note: '資金−90 / 天才社員1名 / 士気−3', effects: { cash: -90, genius: 1, morale: -3 } },
      { label: '通常採用を続ける', note: '応募＋4 / 士気＋3', effects: { applicants: 4, morale: 3 } }] },
    { id: 'scandal', title: '広告表現が炎上', text: '広報は「解釈の相違」、法務は「それは言わないで」と主張。', choices: [
      { label: '謝罪と広告撤回', note: '資金−80 / ブランド−8 / 信用＋5', effects: { cash: -80, brand: -8, trust: 5 } },
      { label: '話題性を利用', note: 'ブランド＋10 / 信用−12 / 法務＋10', effects: { brand: 10, trust: -12, legal: 10 } }] },
    { id: 'ransom', title: 'セキュリティ脆弱性が発覚', text: 'CTOは即時改修を求めるが、今週の新機能が延期される。', choices: [
      { label: '改修を優先', note: '資金−120 / 技術＋4 / 法務−10', effects: { cash: -120, tech: 4, legal: -10 } },
      { label: 'リリース優先', note: '資金＋70 / 7週後に損失・信用−18', effects: { cash: 70 }, delayed: { weeks: 7, text: '脆弱性による情報漏洩。顧客への補償が発生。', effects: { cash: -300, trust: -18, legal: 18 }, scandal: true } }] },
    { id: 'meeting', title: '会議削減のための会議', text: '議事録が38ページ。意思決定はまだゼロ。', choices: [
      { label: '会議を半分にする', note: '会議−15 / 管理効率−4 / 士気＋6', effects: { meetings: -15, efficiency: -4, morale: 6 } },
      { label: 'KPIで管理する', note: '無意味なKPI＋8 / 管理効率＋3 / 士気−4', effects: { nonsense: 8, efficiency: 3, morale: -4 } }] },
    { id: 'union', title: '社員代表が改善を要求', text: '離職率の棒グラフが、社員からの手紙に添付されている。', choices: [
      { label: '労働環境を改善', note: '厚生予算＋8/週 / 士気＋12 / ストレス−10', effects: { benefits: 8, morale: 12, stress: -10 } },
      { label: '成果報酬を導入', note: '給与−5% / 士気−8 / 株主期待＋5', effects: { salaryFactor: .95, morale: -8, expectations: 5 } }] },
    { id: 'patent', title: '特許ライセンスの提案', text: '他社の技術を導入できる。ランニングコストもついてくる。', choices: [
      { label: 'ライセンス購入', note: '資金−180 / 技術＋12 / 負債＋80', effects: { cash: -180, tech: 12, debt: 80 } },
      { label: '自社開発に賭ける', note: '資金−60 / 6週後に技術＋8', effects: { cash: -60 }, delayed: { weeks: 6, text: '自社開発の新技術が完成。', effects: { tech: 8 } } }] }
  ];
  function random(s) { s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function pick(s, list) { return list[Math.floor(random(s) * list.length)]; }
  function log(s, text, type = 'info') { s.logs.unshift({ week: s.week, text, type }); s.logs = s.logs.slice(0, 160); }
  function milestone(s, text) { s.timeline.push({ week: s.week, text }); log(s, text, 'milestone'); }
  function employee(s, dept, special) {
    const name = pick(s, ['佐藤', '高橋', '林', '小林', '田中', '中村', '伊藤', '森', '山本', '石川', '加藤', '渡辺']) + ' ' + pick(s, ['葵', '蓮', '凛', '悠', '陽菜', '誠', '結衣', '光', '湊', '玲', '智也', '杏']);
    const trait = special || pick(s, s.strategy === 'tech' ? ['堅実', '職人', '職人', '人気者', '野心家', '問題社員', '天才', '天才'] : s.strategy === 'ads' ? ['人気者', '人気者', '野心家', '問題社員', '堅実', '天才'] : ['堅実', '堅実', '職人', '人気者', '野心家', '問題社員', '天才']);
    return { id: ++s.nextEmployee, name, dept: dept || pick(s, DEPTS.slice(0, s.employees.length < 20 ? 2 : 6)), ability: trait === '天才' ? 96 : 35 + Math.floor(random(s) * 51), salary: trait === '天才' ? 15 : 7 + random(s) * 4, stress: 10 + random(s) * 15, loyalty: 55 + random(s) * 25, trait, joined: s.week };
  }
  EVENTS.push(...Expansion.EVENTS);
  function create(name = 'ノヴァ株式会社', strategy = 'tech', seed = Date.now(), options = {}) {
    const st = STRATEGIES[strategy] || STRATEGIES.tech;
    const s = { version: 1, name: name.trim().slice(0, 24) || 'ノヴァ株式会社', strategy: STRATEGIES[strategy] ? strategy : 'tech', rng: seed >>> 0, seed: seed >>> 0, week: 0, cash: 1000, debt: 0, price: st.price, brand: st.brand, tech: st.tech, ads: st.ads, benefits: 0, salary: 1, equipment: 260, server: 320, inventory: 40, morale: 72, satisfaction: 76, trust: 78, legal: 8, efficiency: 85, meetings: 5, slides: 8, nonsense: 2, charisma: 65, expectations: 45, economy: 1, overseas: 0, managers: 0, stage: 0, autonomy: 'balanced', employees: [], nextEmployee: 0, applicants: 6, pending: [], event: null, eventCooldown: 3, proposals: [], logs: [], timeline: [], history: [], culture: { tech: 0, sales: 0, care: 0, bureaucracy: 0, chaos: 0 }, stats: { peakRevenue: 0, peakEmployees: 6, scandals: 0, acquisitions: 0, departures: 0, ceos: ['あなた（創業CEO）'] }, actionsLeft: 3, fragile: 0, ended: null, lastRevenue: 0 };
    for (let i = 0; i < 6; i++) s.employees.push(employee(s, i < 3 ? '開発' : '営業', i === 0 ? '創業者' : undefined));
    s.rivals = ['ASTER LABS', '格安総研', 'ORBIT SYSTEMS', 'ミライ商会'].map((name, i) => ({ id: i, name, price: .8 + random(s), power: 160 + random(s) * 150, tech: 25 + random(s) * 35, staff: 12 + i * 7, cash: 700 + random(s) * 700, debt: 50 + random(s) * 200, share: 0, status: '競争中', style: ['技術', '価格', '拡大', 'ブランド'][i] }));
    Expansion.init(s, options); s.cash = Expansion.DIFFICULTIES[s.difficulty].cash;
    s.eventCooldown = Expansion.DIFFICULTIES[s.difficulty].cooldown + 1;
    milestone(s, `${s.name} 創業。「${st.name}」で市場へ。難易度：${Expansion.DIFFICULTIES[s.difficulty].name} / ${s.equity.incorporated ? '株式会社' : '非株式会社'}`);
    calculate(s); return s;
  }
  function culture(s) {
    const a = Object.entries(s.culture).sort((a, b) => b[1] - a[1]);
    return a[0][1] < 3 ? '創業期' : ({ tech: '技術至上主義', sales: '体育会系', care: '顧客第一', bureaucracy: '官僚的', chaos: 'カオス' })[a[0][0]];
  }
  function calculate(s) {
    const count = s.employees.length;
    const avg = key => count ? s.employees.reduce((t, e) => t + e[key], 0) / count : 0;
    const stress = avg('stress');
    const complexity = Math.max(0, count - 12) * .75 + s.overseas * 15 + s.stats.acquisitions * 12;
    const efficiency = clamp(s.efficiency - complexity / (1 + s.managers * .8) - s.meetings * .22 - s.nonsense * .25 - s.slides / Math.max(1,count) * .12, 12, 98);
    const development = s.employees.filter(e => e.dept === '開発').length;
    const sales = s.employees.filter(e => e.dept === '営業').length;
    const productivity = count * (20 + avg('ability') * .3) * (.45 + s.morale / 140) * (1 - stress / 160) * (.5 + efficiency / 160) * (.85 + avg('loyalty') / 500) * (1 + s.tech / 220) * (culture(s) === '技術至上主義' ? 1.08 : 1);
    const production = Math.max(0, Math.min(s.equipment, productivity));
    const publicity = s.employees.filter(e => e.dept === '広報').length;
    const attraction = (90 + s.brand * 3 + sales * 15 + s.ads * 2.8 + publicity * 6) * (.45 + s.satisfaction / 120) * (.5 + s.trust / 140) * (1 + s.tech / 180) * (culture(s) === '体育会系' ? 1.1 : 1) / Math.pow(s.price, 1.2);
    const rivalPower = s.rivals.filter(r => r.status === '競争中').reduce((t, r) => t + r.power / Math.pow(r.price, .7), 0);
    const share = attraction / (attraction + rivalPower + 180) * 100;
    const competition = clamp(1.12 - rivalPower / 9000, .75, 1.1);
    const demand = attraction * .58 * s.economy * competition * (.9 + s.charisma / 650) * (1 + s.overseas * .45);
    const sold = Math.min(production + s.inventory, demand);
    const load = demand / s.server * 100;
    const outage = clamp(Math.max(0, load - 75) * .45 + Math.max(0, 38 - s.tech) * .2, 0, 85);
    const returns = clamp(1.5 + Math.max(0, 55 - s.tech) * .13 + outage * .2 + Math.max(0, stress - 50) * .07, 1, 40);
    const revenue = sold * s.price * (1 - outage / 180) * (1 - returns / 100);
    const cogs = production * (.31 - s.tech * .0013);
    const payroll = s.employees.reduce((t, e) => t + e.salary, 0) * s.salary + s.managers * 16;
    const overhead = 16 + s.equipment * .024 + s.server * .017 + count * .25 + s.managers * 5 + s.overseas * 28 + s.ads + s.benefits + s.debt * .008 + s.inventory * .008 + (s.equity?.listed ? 8 : 0);
    const profit = revenue - cogs - payroll - overhead;
    const turnover = clamp(Math.max(0, 55 - s.morale) * .12 + Math.max(0, stress - 40) * .08 + Math.max(0, 1 - s.salary) * 15 + Math.max(0, 50 - avg('loyalty')) * .08, 0, 22);
    s.metrics = { revenue, profit, margin: revenue ? (revenue - cogs) / revenue * 100 : 0, payroll, overhead, production, demand, sold, load, outage, returns, share, turnover, stress, efficiency, loyalty: avg('loyalty'), adEfficiency: revenue / Math.max(1, s.ads), control: clamp(100 - complexity * .6 - s.managers * 2, 18, 100), development };
    const total = attraction + rivalPower + 180;
    s.rivals.forEach(r => r.share = r.status === '競争中' ? r.power / Math.pow(r.price, .7) / total * 100 : 0);
    if (s.equity) s.equity.price = Expansion.price(s);
    return s.metrics;
  }
  function effects(s, fx) {
    for (const [key, value] of Object.entries(fx)) {
      if (key === 'priceFactor') s.price = clamp(s.price * value, .35, 4);
      else if (key === 'salaryFactor') s.salary = clamp(s.salary * value, .45, 2.5);
      else if (key === 'stress' || key === 'loyalty') s.employees.forEach(e => e[key] = clamp(e[key] + value));
      else if (key === 'loseAce' && s.employees.length) { const ace = s.employees.reduce((a, e) => a.ability > e.ability ? a : e); s.employees = s.employees.filter(e => e.id !== ace.id); s.stats.departures++; milestone(s, `${ace.name}（${ace.trait}）が退職。`); }
      else if (key === 'genius') s.employees.push(employee(s, '開発', '天才'));
      else if (typeof s[key] === 'number') s[key] += value;
    }
    normalize(s);
  }
  function normalize(s) {
    ['brand', 'tech', 'morale', 'satisfaction', 'trust', 'legal', 'efficiency', 'expectations', 'charisma', 'meetings'].forEach(k => s[k] = clamp(s[k]));
    s.economy = clamp(s.economy, .55, 1.5); s.ads = clamp(s.ads, 0, 500); s.benefits = clamp(s.benefits, 0, 200); s.salary = clamp(s.salary, .45, 2.5); s.price = clamp(s.price, .35, 4); s.debt = Math.max(0, s.debt); s.inventory = Math.max(0, s.inventory);
  }
  function available(s, id) {
    const a = ACTIONS[id];
    if (!a) return '不明な操作';
    if (s.ended) return '経営は終了しています';
    if (s.event) return '先に経営判断を選択してください';
    if (s.actionsLeft <= 0) return '今週の決裁枠を使い切りました';
    if (a.unlock && s.employees.length < a.unlock) return `${a.unlock}名以上で解放`;
    if (s.cash < a.cost) return '資金が足りません';
    if (id === 'hire' && s.applicants < 3) return '応募者が3名必要です';
    if (id === 'hire' && s.employees.length >= 1500) return '社員上限です';
    if (id === 'fire' && s.employees.length < 4) return '最低2名を維持してください';
    if (id === 'loan' && s.debt >= 1800) return '融資枠を使い切りました';
    if (id === 'repay' && s.debt < 300) return '返済対象が300万未満です';
    if (id === 'overseas' && s.overseas >= 3) return '進出可能市場の上限です';
    return '';
  }
  function act(s, id, dept = '開発', automated = false) {
    const error = available(s, id); if (error) return { ok: false, reason: error };
    const before = { ...s }, context = Expansion.context(s, id);
    const variable = !['hire', 'fire', 'loan', 'repay', 'exit', 'overseas', 'manager', 'adsDown'].includes(id);
    const strength = variable ? Math.max(.4, Math.min(1.9, context.factor * (.75 + random(s) * .5))) : 1;
    const a = ACTIONS[id]; s.cash -= a.cost; s.actionsLeft--;
    switch (id) {
      case 'hire': for (let i = 0; i < 3; i++) s.employees.push(employee(s, DEPTS.includes(dept) ? dept : '開発')); s.applicants -= 3; break;
      case 'fire': s.employees.sort((a, b) => b.ability - a.ability); s.employees.splice(-2); effects(s, { morale: -10, trust: -3 }); s.stats.departures += 2; s.culture.sales++; break;
      case 'priceUp': effects(s, { priceFactor: 1.1, satisfaction: -4 }); break;
      case 'priceDown': effects(s, { priceFactor: .9, satisfaction: 2 }); break;
      case 'ads': s.ads += 12; s.brand += 4; s.culture.sales += 2; break;
      case 'adsDown': s.ads = Math.max(0, s.ads - 12); break;
      case 'equipment': s.equipment += 180; break;
      case 'research': s.pending.push({ due: s.week + 4, text: `研究開発が完了。技術＋${(10 * strength).toFixed(1)}。`, effects: { tech: 10 * strength } }); s.culture.tech += 2; break;
      case 'benefits': s.benefits += 6; effects(s, { morale: 8, loyalty: 4 }); s.culture.care += 2; break;
      case 'salaryUp': effects(s, { salaryFactor: 1.1, morale: 6, loyalty: 5 }); s.culture.care++; break;
      case 'salaryDown': effects(s, { salaryFactor: .9, morale: -9, loyalty: -8, stress: 5 }); s.culture.sales += 2; break;
      case 'server': s.server += 220; break;
      case 'manager': s.managers++; s.meetings += 4; s.culture.bureaucracy += 2; break;
      case 'compliance': effects(s, { legal: -22, trust: 4, tech: 2, morale: -3 }); break;
      case 'overseas': s.overseas++; s.legal += 12; s.culture.chaos += 3; milestone(s, `海外市場 #${s.overseas} に進出。`); break;
      case 'loan': s.cash += 600; s.debt += 600; break;
      case 'repay': s.debt -= 300; break;
      case 'exit': end(s, 'CEO退任：巨大組織は次の経営者へ', true); break;
    }
    if (variable) {
      // Contracts and recurring budgets stay exact; only implementation outcomes vary.
      for (const key of ['brand', 'equipment', 'server', 'morale', 'trust', 'legal', 'tech', 'price']) s[key] = before[key] + (s[key] - before[key]) * strength;
    }
    s.lastAction = { id, strength, reason: variable ? context.reason : '契約・人数は固定', week: s.week };
    normalize(s); calculate(s); log(s, `${automated ? '【委任決裁】' : '【CEO決裁】'}${a.name}${id === 'hire' ? ` / ${dept}に3名` : ''}${variable ? ` / 実効${Math.round(strength * 100)}%（${context.reason}）` : ''}`, automated ? 'auto' : 'info');
    checkStage(s); return { ok: true, strength, reason: s.lastAction.reason };
  }
  function checkStage(s) {
    const n = s.employees.length;
    const stage = n >= 120 ? 4 : n >= 60 ? 3 : n >= 20 ? 2 : n >= 12 ? 1 : 0;
    if (stage > s.stage) { s.stage = stage; milestone(s, ['創業期', '部署と部門KPIが解放。目標の衝突が始まる。', '管理職・役員提案・委任が解放。', '派閥政治が本格化。決裁枠が減少。', '株主が介入。会社が自ら判断を始める。'][stage]); }
    s.stats.peakEmployees = Math.max(s.stats.peakEmployees, n);
  }
  function trigger(s, id) {
    const ev = EVENTS.find(e => e.id === id);
    if (ev && !s.event && !s.ended) { s.event = { id, week: s.week }; log(s, `【要判断】${ev.title}`, 'warning'); }
  }
  function decide(s, index) {
    if (!s.event || s.ended) return { ok: false, reason: '判断対象がありません' };
    const ev = EVENTS.find(e => e.id === s.event.id); const choice = ev.choices[index];
    if (!choice) return { ok: false, reason: '不明な選択肢' };
    const strength = clamp((.75 + random(s) * .5) * (.8+s.metrics.efficiency/400), .5, 1.5);
    const outcome = { ...choice.effects };
    for (const key of ['tech','brand','morale','trust','efficiency']) if (outcome[key] !== undefined) outcome[key] *= strength;
    effects(s, outcome);
    log(s, `判断の実効${Math.round(strength*100)}%（管理効率・実施のばらつき / 契約・費用は固定）`);
    if (choice.delayed) s.pending.push({ ...choice.delayed, due: s.week + choice.delayed.weeks });
    if (['defect', 'whistle', 'scandal'].includes(ev.id)) s.stats.scandals++;
    if (index === 0) s.culture.care++; else s.culture.chaos++;
    milestone(s, `${ev.title} → ${choice.label}`); s.event = null; s.eventCooldown = Expansion.DIFFICULTIES[s.difficulty || 'normal'].cooldown + Math.floor(random(s) * 3);
    calculate(s); checkEnd(s); return { ok: true };
  }
  function acquire(s, id) {
    if (s.event || s.ended || s.actionsLeft < 1 || s.employees.length < 20) return { ok: false, reason: '20名以上・決裁枠1・未解決判断なしが必要です' };
    const r = s.rivals.find(r => r.id === id);
    if (!r || r.status !== '競争中') return { ok: false, reason: '買収できません' };
    const cost = valuation(r);
    if (s.cash < cost) return { ok: false, reason: '買収資金が足りません' };
    s.cash -= cost; s.actionsLeft--; s.debt += r.debt; s.tech += r.tech * .12; s.brand += 7;
    s.equipment += r.staff * 20; s.server += r.staff * 12;
    for (let i = 0; i < Math.min(r.staff, 1500 - s.employees.length); i++) s.employees.push(employee(s));
    s.morale -= 12; s.meetings += 8; s.legal += 8; s.culture.chaos += 5; s.stats.acquisitions++;
    s.pending.push({ due: s.week + 6, text: `${r.name} の統合摩擦で離職と追加費用が発生。`, effects: { cash: -r.staff * 4, morale: -6, loseAce: 1 } });
    r.status = '買収済'; r.inactiveAt = s.week; settleShares(s, r, .8); milestone(s, `${r.name} を${Math.round(cost)}万円で買収。負債${Math.round(r.debt)}万円を継承。`);
    normalize(s); calculate(s); checkStage(s); return { ok: true };
  }
  function valuation(r) { return Math.round(180 + r.power * 1.1 + r.staff * 8 + Math.max(0, r.cash) * .12); }
  function executives(s) {
    if (s.stage < 2) { s.proposals = []; return; }
    s.proposals = [
      { role: 'CFO', name: '黒田 理沙', bias: '現金・利益を最優先', action: s.metrics.profit < 0 ? 'salaryDown' : 'priceUp', quote: s.metrics.profit < 0 ? '人件費を抑えれば、今期の利益は守れます。' : '単価を上げましょう。利益率が評価を決めます。' },
      { role: 'CTO', name: '水野 蒼', bias: '技術と可用性を最優先', action: s.metrics.load > 70 ? 'server' : 'research', quote: s.metrics.load > 70 ? '受注より先にインフラです。壊れてからでは遅い。' : '機能追加より基盤技術への投資が必要です。' },
      { role: 'CHRO', name: '井上 真琴', bias: '定着・社員満足を最優先', action: s.morale < 65 ? 'benefits' : 'hire', quote: s.morale < 65 ? '離職はコストです。現場に還元しましょう。' : '採用を増やせば、既存社員の負荷を減らせます。' },
      { role: 'CSO', name: '藤原 直', bias: '売上・シェアを最優先', action: 'ads', quote: '認知を取りましょう。供給は後から追いつきます。' }
    ];
  }
  function autonomous(s) {
    if (s.stage < 2) return;
    const forced = s.stage >= 4;
    if (s.autonomy === 'manual' && !forced) return;
    if (s.week % (forced ? 2 : 4) !== 0) return;
    let id;
    const m = s.metrics;
    if (forced && random(s) < .22) { id = 'ads'; s.culture.chaos++; log(s, `営業役員がCEO方針を上書き。${s.equity.incorporated ? '株主への成長公約' : '営業部の売上目標'}を優先。`, 'warning'); }
    else if (s.autonomy === 'growth') id = s.week % 8 === 0 ? 'hire' : 'ads';
    else if (s.autonomy === 'profit') id = m.profit < 0 ? 'salaryDown' : 'priceUp';
    else if (m.load > 85) id = 'server';
    else if (s.morale < 55) id = 'benefits';
    else if (s.legal > 50) id = 'compliance';
    else if (m.demand > m.production * 1.15) id = s.equipment < m.production * 1.1 ? 'equipment' : 'hire';
    else id = 'research';
    const result = act(s, id, s.week % 8 === 0 ? '営業' : '開発', true);
    if (!result.ok) log(s, `【委任見送り】${ACTIONS[id].name}：${result.reason}`, 'auto');
  }
  function step(s) {
    if (s.ended || s.event) return false;
    s.week++;
    s.equity.lastPrice = s.equity.price;
    const difficulty = Expansion.DIFFICULTIES[s.difficulty || 'normal'];
    const m = calculate(s);
    s.cash += m.profit;
    s.inventory = clamp(s.inventory + m.production - m.sold, 0, s.equipment * 4);
    const overload = Math.max(0, m.demand / Math.max(1, m.production) - 1);
    const currentCulture = culture(s);
    s.employees.forEach(e => {
      e.stress = clamp(e.stress + overload * 3 + s.meetings * .025 + (e.trait === '問題社員' ? 1.2 : 0) + (currentCulture === '体育会系' ? .35 : 0) - s.benefits / Math.max(5, s.employees.length) * 2 - .8);
      e.loyalty = clamp(e.loyalty + (s.morale - 60) * .04 + (s.salary - 1) * 1.2 - e.stress * .009);
    });
    s.morale += (65 - s.morale) * .025 + (s.salary - 1) * 1.4 + s.benefits / Math.max(5, s.employees.length) * .65 - m.stress * .02 - Math.max(0, 55 - m.efficiency) * .018;
    s.morale += s.employees.filter(e => e.trait === '人気者').length / Math.max(1, s.employees.length) * .8;
    if (currentCulture === '顧客第一') { s.satisfaction += .35; s.morale += .15; }
    const expectedQuality = s.strategy === 'premium' ? 85 : 72;
    s.satisfaction += (s.tech + 35 - expectedQuality) * .055 - m.outage * .07 - m.returns * .045 - Math.max(0, m.demand - m.sold) / Math.max(1, m.demand) * 2 + .7;
    s.brand += s.ads * .025 + (s.satisfaction - 60) * .018 - .35;
    s.trust += (s.satisfaction - 65) * .015 - Math.max(0, s.legal - 55) * .025;
    const legalStaff = s.employees.filter(e => e.dept === '法務').length;
    const hrStaff = s.employees.filter(e => e.dept === '人事').length;
    s.legal += (s.employees.length * .007 + s.overseas * .2 + m.returns * .04) * difficulty.pressure - legalStaff * .25 - .18;
    if (currentCulture === '官僚的') { s.legal -= .35; s.meetings += .15; }
    if (currentCulture === 'カオス') s.legal += .25;
    s.efficiency += (s.employees.filter(e => e.dept === '経理').length * .12 + s.managers * .13 - .18);
    s.tech += m.development * .018 - .12;
    s.applicants = Math.min(50, s.applicants + Math.max(0, Math.floor((s.brand / 30 + s.morale / 40 + hrStaff * .2) * s.salary)));
    let quit = 0;
    s.employees = s.employees.filter(e => {
      const chance = m.turnover / 100 * (e.trait === '野心家' ? 1.5 : e.trait === '創業者' ? .5 : 1) + Math.max(0, 30 - e.loyalty) * .002;
      if (s.employees.length - quit > 2 && random(s) < chance) { quit++; s.stats.departures++; log(s, `${e.name}（${e.trait} / ${e.dept}）が退職。`, 'warning'); return false; } return true;
    });
    if (quit) s.morale -= Math.min(8, quit * 1.2);
    s.economy += (1 - s.economy) * .02 + (random(s) - .5) * .02;
    for (const r of s.rivals.filter(r => r.status === '競争中')) {
      r.power = clamp(r.power * (1 + (random(s) - .46) * .04), 70, 2000);
      r.cash += r.share * 2 - r.staff * 1.4 + (random(s) - .5) * 35;
      if (s.week % 8 === 0) { r.price = clamp(r.price * (r.style === '価格' ? .97 : 1 + (random(s) - .5) * .1), .45, 2.7); r.staff += Math.floor(random(s) * 4); r.tech = clamp(r.tech + random(s) * 2); }
      if (s.week % 17 === 0 && random(s) < .3) { r.power *= 1.22; log(s, `${r.name} が新製品を投入。市場で急成長。`, 'market'); }
      r.stockPrice = Math.max(.05, (r.power + Math.max(0,r.cash) * .2 + r.tech * 2) / 100 * s.economy);
      if (r.cash < -250) { r.status = '倒産'; r.stockPrice = 0; r.inactiveAt = s.week; settleShares(s, r, 0); milestone(s, `競合 ${r.name} が資金難で倒産。保有株式は無価値に。`); }
    }
    if (s.week % 26 === 0) {
      const rivals = s.rivals.filter(r => r.status === '競争中');
      if (rivals.length >= 2 && random(s) < .3) { const buyer = rivals[0], target = rivals[rivals.length - 1]; buyer.power += target.power * .6; buyer.debt += target.debt; target.status = '他社が買収'; target.inactiveAt = s.week; settleShares(s, target, 1); milestone(s, `${buyer.name} が ${target.name} を買収。市場再編。`); }
    }
    s.rivals = s.rivals.map(r => {
      if (r.status === '競争中') return r;
      r.inactiveAt ??= s.week;
      if (s.week - r.inactiveAt < 8) return r;
      const id = s.nextRival++, industry = pick(s, ['AI物流', 'グリーン製造', '健康テック', '宇宙通信', '教育サービス', 'ロボット']);
      const entrant = { id, name: `${pick(s, ['ネクスト', '青空', 'LUMEN', 'PICO', '新星'])} ${industry} #${id}`, industry, price: .7+random(s), power: 180+random(s)*220, tech: 35+random(s)*40, staff: 10+Math.floor(random(s)*18), cash: 1000+random(s)*800, debt: random(s)*150, share: 0, status: '競争中', style: pick(s,['技術','価格','拡大','ブランド']), stockPrice: 3 };
      entrant.stockPrice = Math.max(.05,(entrant.power+entrant.cash*.2+entrant.tech*2)/100*s.economy);
      milestone(s, `${r.name} の退出から8週。新産業「${industry}」の ${entrant.name} が参入。`); return entrant;
    });
    const due = s.pending.filter(p => p.due <= s.week); s.pending = s.pending.filter(p => p.due > s.week);
    for (const p of due) { effects(s, p.effects); milestone(s, p.text); if (p.scandal) s.stats.scandals++; }
    s.meetings += s.managers * .03; s.slides = Math.round(s.meetings * (1 + s.nonsense * .1));
    s.expectations += s.equity.incorporated && (s.stage >= 4 || s.equity.listed) ? (m.revenue > s.lastRevenue ? .5 : 1.1) : -.04;
    s.charisma = clamp(s.charisma + (m.profit > 0 ? .15 : -.3) + (s.morale - 60) * .008);
    if (s.equity.incorporated && (s.stage >= 4 || s.equity.listed) && s.expectations > 85 && m.profit < 0) { s.cash -= 80; s.trust -= 1; log(s, '株主の要求により事業再編費用80万円。', 'warning'); }
    normalize(s); checkStage(s);
    s.actionsLeft = s.stage >= 3 ? 2 : 3;
    calculate(s); autonomous(s); executives(s);
    s.stats.peakRevenue = Math.max(s.stats.peakRevenue, m.revenue);
    s.stats.peakEmployees = Math.max(s.stats.peakEmployees, s.employees.length);
    s.history.push({ week: s.week, revenue: m.revenue, profit: m.profit, cash: s.cash, employees: s.employees.length }); s.history = s.history.slice(-104);
    s.lastRevenue = m.revenue;
    if (s.week % 4 === 0) log(s, `週次決算：売上${Math.round(m.revenue)}万 / 利益${Math.round(m.profit)}万 / 在庫${Math.round(s.inventory)}`, m.profit < 0 ? 'warning' : 'finance');
    checkEnd(s); if (s.ended) return true;
    s.eventCooldown--;
    if (s.eventCooldown <= 0 && random(s) < Math.min(.99, difficulty.chance * (currentCulture === 'カオス' ? 1.3 : 1))) {
      let pool = EVENTS.filter(e => (e.id !== 'shareholder' || s.equity.incorporated) && (!['shareholder', 'faction'].includes(e.id) || s.stage >= 2));
      const themed = { budget: ['pricewar', 'union', 'burnout'], premium: ['defect', 'patent', 'ace'], tech: ['talent', 'patent', 'ransom'], ads: ['scandal', 'trend', 'viral'] }[s.strategy];
      pool = pool.concat(EVENTS.filter(e => themed.includes(e.id)));
      const risks = s.metrics.load > 85 ? ['cloud','access','leak'] : s.metrics.stress > 45 ? ['health','poach','labor'] : s.inventory > s.equipment ? ['warehouse','supply'] : s.legal > 40 ? ['tax','license','quality'] : ['ai','review','demo'];
      pool = pool.concat(EVENTS.filter(e=>risks.includes(e.id)));
      let id = pick(s, pool).id;
      if (s.metrics.load > 130 && random(s) < .65) id = 'outage';
      else if (s.legal > 70 && random(s) < .65) id = 'audit';
      else if (s.metrics.stress > 65 && random(s) < .6) id = 'burnout';
      trigger(s, id);
    }
    return true;
  }
  function checkEnd(s) {
    if (s.ended) return;
    if (s.cash < 0) end(s, '資金枯渇：支払い不能により倒産');
    else if (s.trust <= 5) end(s, '信用崩壊：顧客と金融機関が取引を停止');
    else if (s.legal >= 99) end(s, '行政処分：累積した法務リスクで事業停止');
    else if (s.week >= 520) end(s, '創業10周年：任期満了、次のCEOへ', true);
  }
  function end(s, reason, retired = false) { s.ended = { reason, retired, week: s.week }; milestone(s, reason); }
  function serialize(s) { return JSON.stringify(s); }
  function restore(json) {
    const s = JSON.parse(json);
    if (!s || s.version !== 1 || typeof s.name !== 'string' || !STRATEGIES[s.strategy] || ['employees', 'rivals', 'pending', 'history', 'logs', 'timeline', 'proposals'].some(k => !Array.isArray(s[k])) || !s.stats || !s.culture || !Number.isFinite(s.rng) || !Array.isArray(s.stats.ceos)) throw new Error('対応していないセーブデータ');
    const numeric = ['week', 'cash', 'debt', 'price', 'brand', 'tech', 'ads', 'benefits', 'salary', 'equipment', 'server', 'inventory', 'morale', 'satisfaction', 'trust', 'legal', 'efficiency', 'meetings', 'expectations', 'actionsLeft'];
    if (numeric.some(k => !Number.isFinite(s[k])) || s.employees.some(e => !DEPTS.includes(e.dept) || !Number.isFinite(e.ability) || !Number.isFinite(e.salary) || !Number.isFinite(e.stress) || !Number.isFinite(e.loyalty)) || (s.event && !EVENTS.some(e => e.id === s.event.id))) throw new Error('壊れたセーブデータ');
    Expansion.init(s);
    const e = s.equity;
    if (typeof e.incorporated !== 'boolean' || typeof e.listed !== 'boolean' || !e.holdings || typeof e.holdings !== 'object' || Array.isArray(e.holdings) || ['ownership','issued','price','lastPrice'].some(k=>!Number.isFinite(e[k])) || Object.values(e.holdings).some(v=>!Number.isInteger(v) || v < 0) || !Number.isInteger(s.nextRival)) throw new Error('壊れた株式データ');
    calculate(s); return s;
  }
  function settleShares(s, r, rate) {
    const quantity = s.equity.holdings[r.id] || 0;
    if (quantity) { const payout = quantity * r.stockPrice * rate; s.cash += payout; delete s.equity.holdings[r.id]; log(s, `${r.name} 保有株${quantity}株を清算：${Math.round(payout)}万円`, 'finance'); }
  }
  function trade(s, id, quantity, sell = false) {
    const r = s.rivals.find(r=>r.id === id);
    if (s.ended || s.event || !r || r.status !== '競争中' || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000 || s.actionsLeft < 1) return {ok:false,reason:'取引できません（競争中・決裁枠1・1〜1000株）'};
    const held = s.equity.holdings[id] || 0, amount = quantity * r.stockPrice;
    if (sell ? held < quantity : s.cash < amount * 1.01) return {ok:false,reason:sell ? '保有株が足りません' : '資金が足りません'};
    s.cash += sell ? amount * .99 : -amount * 1.01; s.equity.holdings[id] = held + (sell ? -quantity : quantity); s.actionsLeft--;
    log(s, `${r.name} ${quantity}株を${sell ? '売却' : '購入'}（手数料1%）`, 'finance'); calculate(s); return {ok:true};
  }
  function corporate(s, action) {
    if (s.ended || s.event || s.actionsLeft < 1) return {ok:false,reason:'未解決判断なし・決裁枠1が必要です'};
    const e = s.equity;
    if (action === 'incorporate' && !e.incorporated && s.cash >= 80) { s.cash -= 80; e.incorporated = true; s.trust += 3; milestone(s,'株式会社へ移行。株式による資金調達が可能に。'); }
    else if (action === 'list' && e.incorporated && !e.listed && s.employees.length >= 20 && s.trust >= 60 && s.cash >= 200) { s.cash -= 200; s.cash += 600; e.listed = true; e.ownership = 75; e.issued += 3333; s.expectations += 15; milestone(s,'株式公開：差引400万円を調達。CEO持分75%、開示費用8万円/週。'); }
    else return {ok:false,reason:'株式会社化は80万円。上場は株式会社・20名・信用60・準備資金200万円が必要です'};
    s.actionsLeft--; normalize(s); calculate(s); return {ok:true};
  }
  const api = { create, step, act, acquire, decide, trigger, calculate, available, culture, valuation, serialize, restore, trade, corporate, actionContext: Expansion.context, DIFFICULTIES: Expansion.DIFFICULTIES, ACTIONS, EVENTS, STRATEGIES, DEPTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
