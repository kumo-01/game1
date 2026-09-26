(function (root) {
  'use strict';
  const DIFFICULTIES = {
    gentle: { name: 'めちゃかんたん', chance: .09, cooldown: 10, cash: 1800, pressure: .65 },
    easy: { name: 'かんたん', chance: .22, cooldown: 7, cash: 1300, pressure: .8 },
    normal: { name: 'ふつう', chance: .48, cooldown: 3, cash: 1000, pressure: 1 },
    hard: { name: 'むずかしい', chance: .62, cooldown: 2, cash: 900, pressure: 1.15 },
    fierce: { name: 'はげしい', chance: .78, cooldown: 1, cash: 800, pressure: 1.3 },
    extreme: { name: 'げきむず', chance: .94, cooldown: 0, cash: 700, pressure: 1.5 }
  };
  const rows = [
    ['supply', '主要仕入先が操業停止', '材料が届かず、現場と営業が板挟み。', '代替調達', { cash: -110, inventory: 90, trust: 3 }, '在庫で耐える', { inventory: -80, stress: 9, satisfaction: -5 }],
    ['power', '電力価格が急騰', '工場の電気代が予算を超えた。', '省エネ改修', { cash: -130, tech: 5 }, '稼働を縮小', { equipment: -50, morale: -3 }],
    ['leak', '顧客情報の誤送信', '広報と法務が初動を求めている。', '公表と補償', { cash: -150, trust: 5, legal: -5 }, '内部で処理', { legal: 16, trust: -8 }],
    ['warehouse', '倉庫で水漏れ', '在庫の一部が使えなくなった。', '廃棄と復旧', { cash: -80, inventory: -50, trust: 2 }, '検品して出荷', { inventory: -20, tech: -4, legal: 10 }],
    ['labor', '採用市場が過熱', '他社の待遇に応募者が流れている。', '採用広報に投資', { cash: -60, applicants: 12, brand: 3 }, '現場で補う', { stress: 8, morale: -5 }],
    ['fake', '偽公式アカウントが出現', '顧客が偽キャンペーンを信じている。', '注意喚起と対策', { cash: -70, trust: 5, brand: -2 }, '静観する', { satisfaction: -7, legal: 8 }],
    ['refund', '返品窓口に問い合わせ殺到', '品質より、対応の遅さが問題になっている。', '窓口を増員', { cash: -80, satisfaction: 9, stress: -4 }, '返金条件を厳格化', { cash: 50, trust: -9, legal: 7 }],
    ['tax', '税務処理の誤り', '経理が過去の申告を見直したい。', '修正申告', { cash: -110, legal: -10, trust: 3 }, '次期に回す', { legal: 15, efficiency: -4 }],
    ['cloud', 'クラウド契約が値上げ', 'CTOが乗り換えを提案している。', '基盤を移行', { cash: -140, server: 160, stress: 5 }, '契約を縮小', { server: -60, cash: 40 }],
    ['strike', '配送会社がストライキ', '納期と顧客の期待が衝突。', '代替配送を手配', { cash: -90, satisfaction: 4 }, '遅延を説明', { satisfaction: -5, trust: 2, inventory: 50 }],
    ['demo', '展示会直前にデモが故障', '開発者が徹夜を申し出ている。', '展示を縮小', { brand: -4, morale: 6, cash: -30 }, '徹夜で修復', { brand: 8, stress: 14, tech: -2 }],
    ['poach', '競合がチームごと引き抜き', '給与だけでは解決できない。', '待遇と裁量を改善', { cash: -100, loyalty: 14, meetings: -3 }, '引き留めない', { loseAce: 1, morale: -8 }],
    ['payment', '大口顧客の支払い延期', '売上はあるが、現金が入らない。', '早期回収の割引', { cash: -60, trust: 3 }, '支払いを待つ', { cash: -140, expectations: -4 }],
    ['license', '利用ソフトの契約違反疑惑', '法務が全社棚卸しを要求。', '契約を是正', { cash: -100, legal: -12, meetings: 3 }, '調査を限定', { legal: 13, efficiency: 2 }],
    ['access', '社内権限が複雑化', '退職者のアカウントが残っていた。', '権限を整理', { cash: -70, legal: -8, efficiency: 5 }, '運用でカバー', { meetings: 7, stress: 5 }],
    ['health', '社内で体調不良が続出', '出社人数が減り、残った人に負担。', '休暇と在宅を推奨', { cash: -90, stress: -12, morale: 8 }, '納期を最優先', { cash: 40, stress: 15, loyalty: -7 }],
    ['review', '人気レビュー動画が公開', '予想外の需要が押し寄せている。', '予約販売へ切り替え', { brand: 6, satisfaction: 5, cash: -40 }, '一気に売る', { brand: 14, ads: 6, stress: 8 }],
    ['ai', '競合が画期的な新技術を発表', '自社製品が古く見える。', '研究に集中', { cash: -130, tech: 8, morale: 3 }, '広告で対抗', { cash: -60, brand: 8, ads: 5 }],
    ['office', 'オフィスの席が足りない', '会議室に机を並べる案が出た。', '増床する', { cash: -100, efficiency: 5, morale: 5 }, '席を共用', { cash: 20, stress: 6, meetings: 5 }],
    ['quality', '検品工程に抜けが発覚', '今月の売上を守るか、信頼を守るか。', '全品再検査', { cash: -120, tech: 5, trust: 6 }, '販売を継続', { cash: 70, legal: 12, satisfaction: -8 }]
  ];
  const labels = { cash: '資金', inventory: '在庫', trust: '信用', stress: 'ストレス', satisfaction: '満足', tech: '技術', equipment: '設備', morale: '士気', legal: '法務', applicants: '応募', brand: 'ブランド', efficiency: '管理効率', server: '容量', meetings: '会議', loyalty: '忠誠', expectations: '株主期待', ads: '広告/週', loseAce: 'エース退職' };
  const note = fx => Object.entries(fx).map(([k,v]) => `${labels[k]}${v >= 0 ? '＋' : ''}${v}${k === 'cash' ? '万' : ''}`).join(' / ');
  const EVENTS = rows.map(([id,title,text,a,fx,b,fy]) => ({ id,title,text,choices: [{label:a,note:note(fx),effects:fx},{label:b,note:note(fy),effects:fy}] }));
  function init(s, options = {}) {
    s.difficulty = DIFFICULTIES[options.difficulty || s.difficulty] ? options.difficulty || s.difficulty : 'normal';
    if (!s.equity) s.equity = { incorporated: options.incorporated !== false, listed: false, ownership: 100, issued: 10000, holdings: {}, price: 1, lastPrice: 1 };
    s.nextRival = s.nextRival ?? Math.max(...s.rivals.map(r => r.id)) + 1;
    s.rivals.forEach(r => { r.industry ||= '総合サービス'; r.stockPrice ??= r.status === '倒産' ? 0 : Math.max(.05, (r.power + Math.max(0,r.cash) * .2 + r.tech * 2) / 100 * s.economy); });
  }
  function context(s, id) {
    const m = s.metrics;
    const quality = .7 + m.efficiency / 200 + s.morale / 400;
    let factor = quality, reason = '管理効率・士気';
    if (id === 'ads') { factor *= s.economy * (.6 + s.trust / 120) * (.65 + s.satisfaction / 180); reason = '景気・信用・満足度'; }
    if (id === 'research') { factor *= .8 + m.development / Math.max(1,s.employees.length); reason = '開発比率・管理効率・士気'; }
    if (id === 'benefits' || id === 'salaryUp') { factor *= 1 + Math.max(0,65-s.morale) / 100; reason = '現場の疲労・士気'; }
    if (id === 'compliance') { factor *= .85 + s.employees.filter(e=>e.dept === '法務').length * .06; reason = '法務の人員・管理効率'; }
    if (id === 'server') { factor *= .9 + s.tech / 200; reason = '技術・管理効率'; }
    return { factor: Math.max(.55,Math.min(1.65,factor)), reason };
  }
  function price(s) { return Math.max(.1, (Math.max(0,s.cash-s.debt) * .05 + s.metrics.revenue * 3 + s.tech * 4 + s.brand * 3) / 1000 * (.5+s.trust/100) * (.7+s.economy*.3)); }
  const api = { DIFFICULTIES, EVENTS, init, context, price };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Expansion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
