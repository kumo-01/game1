'use strict';
const $ = id => document.getElementById(id);
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, digits = 0) => Number(n).toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const money = n => `${fmt(n)}万`;
const KEY = 'corporate-entropy-save-v1';
const titles = { overview: '経営概況', people: '人材・組織', market: '市場・M&A', board: '取締役会', history: '会社年表' };
const stages = ['STARTUP', 'DEPARTMENTS', 'MANAGEMENT', 'CORPORATION', 'AUTONOMOUS'];
let state = null, tab = 'overview', selected = 'tech', deptFilter = '全員', sortPeople = 'ability', hireDept = '開発', modalType = '', toastTimer, preview = true;
const PREFS_KEY = 'corporate-entropy-preferences-v1';
let preferences = { mode: 'beginner', sound: true, volume: .25 };
try {
  const p = JSON.parse(localStorage.getItem(PREFS_KEY));
  if (p) preferences = { mode: p.mode === 'advanced' ? 'advanced' : 'beginner', sound: p.sound !== false, volume: Number.isFinite(p.volume) ? Math.max(0, Math.min(1, p.volume)) : .25 };
} catch { /* Preferences are optional, including with older saves. */ }
const sound = new UI.Sound(preferences.sound, preferences.volume);
const playback = new UI.Playback({ tick: advance, canRun: () => !!state && !preview && !state.ended && !state.event && !modalType && !document.hidden, speed: () => Number($('speed').value), changed: running => { $('pause').textContent = running ? 'Ⅱ 停止' : '▶ 再生'; } });
const beginner = () => preferences.mode === 'beginner';
function savePreferences() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); } catch { /* Play still works without storage. */ } }
function updatePreferences() {
  $('experience').value = preferences.mode;
  $('sound-toggle').textContent = preferences.sound ? '♪ 音 ON' : '♪ 音 OFF';
  $('sound-toggle').setAttribute('aria-pressed', String(preferences.sound));
  $('volume').value = Math.round(preferences.volume * 100);
  document.body.classList.toggle('beginner', beginner());
}
function modeChooser() { return `<div class="mode-chooser" role="group" aria-label="説明モード"><button data-mode="beginner" aria-pressed="${beginner()}" class="${beginner() ? 'selected' : ''}"><b>初心者モード</b><small>用語・数字の意味と、今考えることを説明</small></button><button data-mode="advanced" aria-pressed="${!beginner()}" class="${!beginner() ? 'selected' : ''}"><b>ガチ勢モード</b><small>これまでの高密度ダッシュボード</small></button></div>`; }
function setMode(mode) {
  preferences.mode = mode === 'advanced' ? 'advanced' : 'beginner'; savePreferences(); updatePreferences(); render();
  if (modalType === 'event') eventModal();
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b.dataset.mode === preferences.mode); b.setAttribute('aria-pressed', String(b.dataset.mode === preferences.mode)); });
}
let saved = null;
try { const data = localStorage.getItem(KEY); if (data) saved = Sim.restore(data); } catch { /* A damaged or unavailable save must not block founding. */ }

function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000); }
function save(manual = false) {
  if (!state) return;
  if (preview) return;
  try { localStorage.setItem(KEY, Sim.serialize(state)); saved = Sim.restore(Sim.serialize(state)); $('save-status').textContent = `保存済み：W${state.week} · ${new Date().toLocaleTimeString('ja-JP')}`; if (manual) toast('このブラウザに保存しました'); }
  catch { $('save-status').textContent = '保存不可：ブラウザのストレージを確認'; if (manual) toast('保存できません。ブラウザの保存設定を確認してください'); }
}
function pause() { playback.pause(); }
function play() {
  if (!state || state.ended || modalType || state.event) return;
  if (playback.running) { pause(); sound.play('click'); return; }
  playback.start(); sound.play('start');
}
function advance() {
  if (!state || state.ended || modalType) return;
  if (!Sim.step(state)) return;
  render(); save();
  if (state.event) eventModal();
  else if (state.ended) endModal();
  else sound.play('tick');
}
function openModal(type, html) {
  playback.openModal(type === 'end'); modalType = type;
  if (type === 'found') html = html.replace('<div class="company-input">', `${modeChooser()}<div class="company-input">`);
  $('modal-root').innerHTML = `<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">${html}</section></div>`;
  $('modal-root').querySelector('.modal').focus();
}
function closeModal(resume = true) { modalType = ''; $('modal-root').innerHTML = ''; $('step').focus(); playback.closeModal(resume); }
function foundingModal() {
  openModal('found', `<div class="modal-top"><span>NEW VENTURE / 001</span>${!preview ? '<button class="close-modal" data-close aria-label="閉じる">×</button>' : ''}</div><h2 id="modal-title">あなたの会社は、<br>どこまで制御できるか。</h2><p>売上、社員、会議、そして問題。増えていく数字の向こうで、<br>組織はいつの間にか、あなたの手を離れていく。</p><div class="company-input"><label for="company-name">会社名</label><input id="company-name" maxlength="24" value="ノヴァ株式会社" autocomplete="off"></div><div class="strategy-grid">${Object.entries(Sim.STRATEGIES).map(([id, st]) => `<button class="strategy ${id === selected ? 'selected' : ''}" data-strategy="${id}"><b>${st.name} ${id === selected ? '↗' : ''}</b><small>${st.desc}</small></button>`).join('')}</div><div class="help-callout">資本金 1,000万円 · 創業メンバー 6名<br>1週に3つの決裁。イベント中は時間停止。大企業ほど決裁権が減ります。</div><div class="modal-actions">${saved ? '<button data-resume>保存した会社を再開</button>' : ''}<button class="primary" data-found>会社を設立する →</button></div>${saved ? '<p class="hint">設立すると、このブラウザの既存セーブを上書きします。</p>' : ''}`);
}
function eventModal() {
  if (modalType !== 'event') sound.play('alert');
  const resumes = playback.running || playback.resumePending;
  const ev = Sim.EVENTS.find(e => e.id === state.event.id);
  openModal('event', `<div class="modal-top"><span>DECISION REQUIRED</span><span class="warn">TIME PAUSED</span></div><div class="event-meta"><span>W${state.week.toString().padStart(3, '0')}</span><span>CEO決裁 / 決裁枠は消費しません</span></div><h2 id="modal-title">${ev.title}</h2><p>${ev.text}</p>${beginner() ? '<div class="help-callout">目先のお金だけでなく、社員・お客さん・将来の費用も比べましょう。下の数値は、今の値からどれだけ変わるかを表しています。</div>' : ''}${ev.choices.map((c, i) => `<button class="event-choice" data-choice="${i}"><b>${i + 1}. ${c.label} →</b><small>${c.note}</small>${beginner() ? `<span class="choice-guide">${UI.choiceGuide(c)}</span>` : ''}</button>`).join('')}<p class="hint">資金 ${money(state.cash)}円 / 信用 ${fmt(state.trust)} / 法務リスク ${fmt(state.legal)}。資金不足でも判断できますが、支払い不能になると倒産します。</p><p class="hint">${resumes ? '選択すると、元の速度で再生を自動再開します。' : '停止中のため、選択後も停止を維持します。'}</p>`);
}
function endModal() {
  sound.play('end');
  openModal('end', `<div class="modal-top"><span>END OF TENURE</span><button class="close-modal" data-close aria-label="閉じる">×</button></div><h2 id="modal-title" class="${state.ended.retired ? 'positive' : 'end-title'}">${state.ended.retired ? '会社は、あなたを超えた。' : '数字だけでは、守れなかった。'}</h2><p>${esc(state.name)} / ${esc(state.ended.reason)}</p>${endStats()}<p>売上が伸びても、現金・信用・現場は別の速度で動きます。<br>今回の経営判断は、会社年表に残っています。</p><div class="modal-actions"><button data-end-history>会社年表を読む</button><button class="primary" data-new>もう一度、創業する →</button></div>`);
}
function helpModal() {
  openModal('help', `<div class="modal-top"><span>CEO FIELD MANUAL</span><button class="close-modal" data-close aria-label="閉じる">×</button></div><h2 id="modal-title">成長を、制御する。</h2><ol><li><b>1週進める</b>で決算。資金は週次利益と投資・返金で変わります。再生で自動進行できます。</li><li><b>今週の決裁枠</b>を使い、採用・価格・設備などを選択。広告・福利厚生・給与は毎週の費用です。</li><li><b>需要と供給</b>を比較。広告で受注が増えても、生産とサーバーが追いつかなければ利益も信用も崩れます。</li><li><b>20名</b>から管理職と役員が登場。60名で決裁枠が2に、120名で手動方針でも役員が自律決裁を始めます。</li><li><b>イベント</b>は時間を止めます。後から返ってくる影響もあるので、判断は年表と経営ログで確認。</li><li><b>倒産条件</b>は資金0未満、信用5以下、法務リスク99以上。120名以上でCEO退任、520週で任期満了です。</li></ol><div class="help-callout">まずはサーバー負荷85%以下、士気60以上、法務50以下を目安に。人材・組織で法務や経理にも採用すると、長期のリスクを抑えられます。</div><p>自動保存はこのブラウザのみ。通信・課金・外部ライブラリはありません。スペースで再生/停止、Nで次の週。</p>`);
}
function panel(title, body, meta = '', cls = '') { return `<section class="panel ${cls}"><div class="panel-head"><h2>${title}</h2>${meta}</div>${body}</section>`; }
function meter(value, color = 'var(--cyan)') { return `<div class="meter"><i style="width:${Math.max(0, Math.min(100, value))}%;background:${color}"></i></div>`; }
function delta(key) {
  const h = state.history, now = h.length ? h[h.length - 1][key] : state.metrics[key];
  if (h.length < 2 || !Number.isFinite(now)) return '— 前週比';
  const prev = h[h.length - 2][key]; const d = now - prev;
  return `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '↗ +' : '↘ '}${fmt(d)}万</span> 前週比`;
}
function spark(key, color) {
  const points = state.history.slice(-20).map(h => h[key]);
  if (points.length < 2) return '';
  const min = Math.min(...points), range = Math.max(1, Math.max(...points) - min);
  return `<svg class="spark" viewBox="0 0 90 26" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${points.map((n, i) => `${i / (points.length - 1) * 90},${25 - (n - min) / range * 24}`).join(' ')}"/></svg>`;
}
function kpis() {
  const m = state.metrics;
  const settled = state.history.length ? state.history[state.history.length - 1] : m;
  const list = [
    ['手元資金', 'CASH BALANCE', fmt(state.cash), '万円', `借入 ${money(state.debt)}円`, 'cash', state.cash < 250 ? 'negative' : 'positive'],
    ['週次売上', 'WEEKLY REVENUE', fmt(settled.revenue), '万円', delta('revenue'), 'revenue', ''],
    ['営業利益', 'OPERATING PROFIT', `${settled.profit >= 0 ? '+' : ''}${fmt(settled.profit)}`, '万円 / 週', delta('profit'), 'profit', settled.profit >= 0 ? 'cyan' : 'negative'],
    ['社員数', 'HEADCOUNT', fmt(state.employees.length), '名', `累計離職 ${state.stats.departures}名 · 管理職 ${state.managers}名`, 'employees', '']
  ];
  $('kpis').innerHTML = list.map(([label, en, n, unit, foot, key, cls]) => `<article class="kpi"><div class="kpi-label">${label}<span>${en}</span></div><div class="kpi-value ${cls}">${n}<small>${unit}</small></div>${spark(key, cls === 'negative' ? '#ff7c83' : '#b4ef65')}<div class="kpi-foot"><span>${foot}</span><span>${key === 'employees' ? stages[state.stage] : 'JPY'}</span></div>${beginner() ? `<p class="metric-guide">${UI.METRICS[label]}</p>` : ''}</article>`).join('');
}
function metric(label, value, unit = '', level = null, bad = false) {
  return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value ${bad ? 'negative' : ''}">${value}<small>${unit}</small></div>${level === null ? '' : meter(level, bad ? 'var(--red)' : 'var(--cyan)')}${beginner() ? `<p class="metric-guide">${UI.METRICS[label] || ''}</p>` : ''}</div>`;
}
function allMetrics() {
  const s = state, m = s.metrics;
  return panel('オペレーション指標', `<div class="metrics-grid">${[
    metric('粗利率', fmt(m.margin, 1), '%'), metric('人件費', fmt(m.payroll), '万 / 週'), metric('離職率', fmt(m.turnover, 1), '% / 週', m.turnover * 5, m.turnover > 4),
    metric('生産力 / 需要', `${fmt(m.production)} / ${fmt(m.demand)}`, '個', null, m.production < m.demand * .75), metric('在庫', fmt(s.inventory), '個'), metric('返品率', fmt(m.returns, 1), '%', m.returns * 5, m.returns > 8),
    metric('顧客満足度', fmt(s.satisfaction), '/ 100', s.satisfaction, s.satisfaction < 50), metric('ブランド価値', fmt(s.brand), '/ 100', s.brand), metric('市場シェア', fmt(m.share, 1), '%', m.share),
    metric('広告効率', fmt(m.adEfficiency, 1), '売上 / 広告費'), metric('サーバー負荷', fmt(m.load), '%', m.load, m.load > 90), metric('障害率', fmt(m.outage, 1), '%', m.outage, m.outage > 10),
    metric('信用', fmt(s.trust), '/ 100', s.trust, s.trust < 35), metric('法務リスク', fmt(s.legal), '/ 100', s.legal, s.legal > 55), metric('社内士気', fmt(s.morale), '/ 100', s.morale, s.morale < 55),
    metric('管理効率', fmt(m.efficiency), '%', m.efficiency, m.efficiency < 45), metric('株主期待度', fmt(s.expectations), '/ 100', s.expectations, s.expectations > 80), metric('採用応募数', s.applicants, '名'),
    metric('平均ストレス', fmt(m.stress), '/ 100', m.stress, m.stress > 60), metric('平均忠誠度', fmt(m.loyalty), '/ 100', m.loyalty), metric('会議密度', fmt(s.meetings), '/ 100', s.meetings, s.meetings > 50),
    metric('CEOカリスマ', fmt(s.charisma), '/ 100'), metric('社内空気', s.morale > 65 ? '晴れ' : s.morale > 40 ? '曇り' : '雷雨'), metric('スライド / 社員', fmt(s.slides / Math.max(1, s.employees.length), 1), '枚'),
    metric('意味のないKPI', s.nonsense, '個'), metric('販売単価', fmt(s.price, 2), '万 / 個'), metric('設備 / サーバー容量', `${fmt(s.equipment)} / ${fmt(s.server)}`, '個'),
    metric('広告 / 福利厚生', `${fmt(s.ads)} / ${fmt(s.benefits)}`, '万 / 週'), metric('間接費・利息', fmt(m.overhead), '万 / 週'), metric('海外市場', s.overseas, '地域')
  ].join('')}</div>`, '<small>LIVE · 30 METRICS</small>');
}
function actions() {
  return panel('経営アクション', `<div class="forecast"><span>翌週予測：売上 ${money(state.metrics.revenue)}円 / 利益 ${money(state.metrics.profit)}円</span><span>毎週の費用に注意</span></div><div class="actions-grid">${Object.entries(Sim.ACTIONS).map(([id, a]) => {
    const reason = Sim.available(state, id);
    return `<button class="action" data-action="${id}" ${reason ? 'disabled' : ''} title="${esc(reason || a.desc)}"><b>${a.name}<span>${a.cost ? `${a.cost}万` : '→'}</span></b><small>${a.desc}</small>${beginner() ? `<span class="action-guide">${UI.ACTIONS[id]}</span>` : ''}${reason ? `<div class="action-lock">${reason}</div>` : ''}</button>`;
  }).join('')}</div><div class="action-selector">採用先<select id="hire-dept" aria-label="採用先部署">${Sim.DEPTS.map(d => `<option ${hireDept === d ? 'selected' : ''}>${d}</option>`).join('')}</select> <span class="hint">部署を変えると自動改善する指標も変わります。</span></div>`, `<span class="tag">決裁枠 ${state.actionsLeft} / ${state.stage >= 3 ? 2 : 3}</span>`);
}
function chartPanel() {
  return panel('業績推移', `<div class="chart-wrap">${state.history.length ? '<canvas id="chart" aria-label="週次売上と営業利益の推移"></canvas>' : '<div class="chart-empty">決算データを待っています<span>1週進めて、あなたの経営を始めましょう。</span></div>'}</div><div class="chart-footer"><span>直近 ${Math.min(26, state.history.length)}週間 / 単位：万円</span><span>Y${Math.floor(state.week / 52) + 1} · W${state.week % 52 + 1}</span></div>`, '<div class="chart-legend"><span><i></i>売上</span><span><i class="profit"></i>利益</span><span><i class="loss"></i>赤字</span></div>');
}
function health() {
  const m = state.metrics;
  const list = [
    ['稼働の余白', Math.max(0, 100 - m.load), `サーバー負荷 ${fmt(m.load)}% · 75%超から障害率が上昇`],
    ['組織の健全性', state.morale, `士気 ${fmt(state.morale)} · ストレス ${fmt(m.stress)} · 離職 ${fmt(m.turnover, 1)}%`],
    ['経営の制御力', m.control, `${state.managers}名の管理職 · 管理効率 ${fmt(m.efficiency)}%`],
    ['信用の余力', state.trust, `法務リスク ${fmt(state.legal)} · 信用5以下で取引停止`]
  ];
  return panel('会社の体温', list.map(([label, val, note]) => `<div class="health-item"><div class="health-label"><span>${label}</span><b class="${val < 35 ? 'negative' : 'positive'}">${fmt(val)}%</b></div>${meter(val, val < 35 ? 'var(--red)' : 'var(--green)')}<div class="health-caption">${note}</div></div>`).join('') + '<div class="chain">連鎖を読む<br>広告 <b>↑</b> → 需要 <b>↑</b> → 負荷 <b>↑</b><br>→ 障害 <b>↑</b> → 満足・信用 <b>↓</b></div>', '<small>SYSTEM HEALTH</small>');
}
function logs() { return panel('経営ログ', `<div class="log-list">${state.logs.slice(0, 40).map(l => `<div class="log-row ${l.type}"><time>W${String(l.week).padStart(3, '0')}</time><span>${esc(l.text)}</span></div>`).join('')}</div>`, `<small>${state.logs.length} RECORDS</small>`); }
function news() {
  const market = state.logs.filter(l => l.type === 'market' || (l.type === 'milestone' && l.text.includes('競合'))).slice(0, 3);
  return panel('マーケットワイヤー', `<div class="news-item"><small>ECONOMY / NOW</small>${state.economy > 1.08 ? '景気は拡大。受注機会と人材争奪が増加。' : state.economy < .9 ? '消費が減速。価格と固定費への圧力。' : '市場は平常運転。競合は次の一手を探る。'}</div>${market.map(l => `<div class="news-item"><small>MARKET / W${l.week}</small>${esc(l.text)}</div>`).join('')}<div class="news-item"><small>ORGANIZATION / CULTURE</small>${Sim.culture(state)} · ${stages[state.stage]}<br><span class="hint">12名：部署 / 20名：役員 / 60名：政治 / 120名：株主・自律化</span></div>`, '<span class="live-dot"></span>');
}
function pendingPanel() { return panel('進行中の案件', state.pending.length ? state.pending.map(p => `<div class="news-item"><small>DUE W${p.due} · あと${p.due - state.week}週</small>${esc(p.text)}</div>`).join('') : '<div class="note">未決案件はありません。研究開発や経営判断の遅延効果がここに表示されます。</div>', `<small>${state.pending.length} PENDING</small>`); }
function overview() { return `<div class="layout"><div class="stack">${beginner() ? `${chartPanel()}${actions()}<details class="guide-details"><summary>30指標の意味と現在値を詳しく見る</summary>${allMetrics()}</details>` : `${chartPanel()}${allMetrics()}${actions()}`}</div><aside class="stack">${health()}${news()}${logs()}${pendingPanel()}</aside></div>`; }
function coaching() {
  const context = { overview: '1万円＝10,000円。「1週進める」で会社の収入と支出が計算されます。決裁枠は今週選べる操作の回数です。', people: '部署は社員の役割です。営業は注文、開発は技術、人事は応募、経理は管理、広報は認知、法務は法律上の安全に貢献します。人数だけ増やすと給与も増えます。', market: '競合は同じお客さんを取り合う会社です。買収は他社を丸ごと引き取ること。社員や技術だけでなく、借金と組織の問題も引き継ぎます。', board: '役員は担当分野の責任者です。全員の提案を採用すると、目的がぶつかります。委任はあなたの代わりにお金と決裁枠を使って判断する設定です。', history: '年表はこれまでの判断と、その後に起きた出来事の記録です。失敗したときは、最後の数字だけでなく問題が始まった判断を振り返ってみましょう。' };
  return `<section class="coach"><div class="coach-heading"><b>はじめての経営 / ${titles[tab]}</b><span>説明だけを追加 · 数値・難易度は同じ</span></div><p>${context[tab]}</p>${tab === 'overview' ? `<div class="coach-tips">${UI.priorities(state).map(t => `<article><small>${t.focus}</small><h3>${t.title}</h3><p>${t.text}</p></article>`).join('')}</div>` : ''}</section>`;
}
const goals = { 営業: ['売上と受注', '供給能力に関係なく、契約を増やしたい。'], 開発: ['技術品質', '新機能を延期しても、基盤を直したい。'], 人事: ['定着と採用', '待遇改善にお金を使いたい。'], 経理: ['管理と利益', '投資を抑え、管理精度を高めたい。'], 広報: ['ブランド認知', '露出を増やしたい。炎上も認知になる。'], 法務: ['コンプライアンス', '成長を遅らせても、リスクを潰したい。'] };
function people() {
  const depts = state.stage >= 1 ? `<div class="three-col">${Sim.DEPTS.map(d => {
    const team = state.employees.filter(e => e.dept === d), morale = team.length ? team.reduce((t, e) => t + e.loyalty, 0) / team.length : 0;
    const kpi = { 営業: `${money(state.metrics.revenue)}円 / 週`, 開発: `技術 ${fmt(state.tech)}`, 人事: `離職率 ${fmt(state.metrics.turnover, 1)}%`, 経理: `管理効率 ${fmt(state.metrics.efficiency)}%`, 広報: `ブランド ${fmt(state.brand)}`, 法務: `リスク ${fmt(state.legal)}` }[d];
    return `<section class="panel department"><h3>${d}<span class="tag" style="float:right">${team.length}名</span></h3><p>${goals[d][1]}</p><div class="department-stat"><span>${goals[d][0]}</span><b>${kpi}</b></div><div class="department-stat"><span>平均忠誠</span><b>${fmt(morale)}</b></div>${meter(morale)}</section>`;
  }).join('')}</div>` : panel('組織の成長', '<div class="note">創業メンバーで直接経営中。社員12名で正式な部署とKPIが解放されます。営業と開発は創業時から需要と技術に貢献します。</div>');
  const employees = state.employees.filter(e => deptFilter === '全員' || e.dept === deptFilter).slice().sort((a, b) => sortPeople === 'joined' ? a.joined - b.joined : b[sortPeople] - a[sortPeople]);
  return `<div class="stack">${depts}${panel('社員名簿', `<div class="table-wrap"><table><thead><tr><th>名前</th><th>部署</th><th>特性・性格</th><th>能力</th><th>給与 / 週</th><th>ストレス</th><th>忠誠度</th><th>入社</th></tr></thead><tbody>${employees.slice(0, 200).map(e => `<tr><td>${esc(e.name)} <small class="founder">${e.joined === 0 ? '創業' : e.ability >= 85 ? 'ACE' : ''}</small></td><td>${e.dept}</td><td><span class="employee-trait ${e.trait === '天才' ? 'positive' : ''}">${e.trait}</span></td><td class="num">${e.ability}</td><td class="num">${fmt(e.salary * state.salary, 1)}万</td><td class="num ${e.stress > 65 ? 'negative' : ''}">${fmt(e.stress)}</td><td class="num ${e.loyalty < 35 ? 'negative' : 'positive'}">${fmt(e.loyalty)}</td><td class="num">W${e.joined}</td></tr>`).join('')}</tbody></table></div><div class="scroll-indicator">${employees.length}名中 ${Math.min(200, employees.length)}名を表示 · 給与倍率 ${fmt(state.salary, 2)}× · 全員が週ごとにストレス・忠誠・退職判定を持ちます。</div>`, `<div class="filter-tools"><select id="dept-filter" aria-label="部署フィルター">${['全員', ...Sim.DEPTS].map(d => `<option ${deptFilter === d ? 'selected' : ''}>${d}</option>`).join('')}</select><select id="people-sort" aria-label="社員の並び順">${[['ability', '能力順'], ['stress', 'ストレス順'], ['loyalty', '忠誠度順'], ['joined', '入社順']].map(([k, n]) => `<option value="${k}" ${sortPeople === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`)}${actions()}</div>`;
}
function market() {
  const colors = ['#b4ef65', '#65d9d0', '#aa99dd', '#f0be64', '#7ba1d5'];
  return `<div class="stack">${panel('市場構成', `<div class="panel-body"><div class="share-legend">${[state.name, ...state.rivals.map(r => r.name)].map((n, i) => `<span><i style="background:${colors[i]}"></i>${esc(n)} ${fmt(i === 0 ? state.metrics.share : state.rivals[i - 1].share, 1)}%</span>`).join('')}</div><div class="market-bar">${[state.metrics.share, ...state.rivals.map(r => r.share)].map((v, i) => `<div style="width:${v}%;background:${colors[i]}"></div>`).join('')}</div><div class="hint">灰色はその他の企業。競合は価格・採用・製品を変え、倒産や企業間買収も発生します。</div></div>`, `<span class="tag">市場環境 ${fmt(state.economy, 2)}×</span>`)}<div class="two-col">${state.rivals.map(r => {
    const value = Sim.valuation(r), disabled = state.ended || state.event || r.status !== '競争中' || state.cash < value || state.employees.length < 20 || state.actionsLeft < 1;
    return panel(`<span class="rival-name">${r.name}</span>`, `<div class="panel-body"><div class="hint">方針：${r.style}重視 / ${r.status}</div><div class="rival-metrics"><div><span>市場シェア</span><b>${fmt(r.share, 1)}%</b></div><div><span>販売価格</span><b>${fmt(r.price, 2)}万</b></div><div><span>社員 / 技術</span><b>${r.staff}名 / ${fmt(r.tech)}</b></div><div><span>継承する負債</span><b class="warn">${money(r.debt)}円</b></div></div><button class="rival-buy" data-acquire="${r.id}" ${disabled ? 'disabled' : ''}>${r.status === '競争中' ? `${money(value)}円で買収 →` : r.status}</button><p class="hint">${state.employees.length < 20 ? '20名以上でM&A解放。' : ''}買収で人材・技術・供給能力を獲得。士気−12、会議＋8、法務＋8。6週後に統合費用とエース退職。</p></div>`, `<small>${r.status === '競争中' ? 'LIVE' : 'CLOSED'}</small>`);
  }).join('')}</div>${chartPanel()}${logs()}</div>`;
}
function board() {
  const s = state;
  const names = { tech: '技術至上主義', sales: '体育会系', care: '顧客第一', bureaucracy: '官僚的', chaos: 'カオス' };
  return `<div class="stack">${panel('権限と経営方針', `<div class="panel-body"><div class="policy-row"><label for="autonomy">委任ポリシー</label><select id="autonomy" ${s.stage < 2 || s.ended ? 'disabled' : ''}>${[['manual', 'CEOが直接管理'], ['balanced', 'バランス：危険を優先'], ['growth', '成長：採用・広告を優先'], ['profit', '利益：値上げ・給与抑制']].map(([k, v]) => `<option value="${k}" ${s.autonomy === k ? 'selected' : ''}>${v}</option>`).join('')}</select><small>制御力 ${fmt(s.metrics.control)}% · 週の決裁枠 ${s.stage >= 3 ? 2 : 3}</small></div><p class="hint">20名以上で4週ごとに委任決裁。120名以上では2週ごとに、手動方針でも役員が判断します。委任は決裁枠と資金を使い、ときには役員が成長目標を優先します。</p></div>`, `<span class="tag">${stages[s.stage]}</span>`)}${s.stage >= 2 ? `<div class="two-col">${s.proposals.map(p => panel(p.role + ' / 経営提案', `<div class="panel-body"><div class="executive"><div class="avatar">${p.role.slice(0, 2)}</div><div><b>${p.name}</b><small>${p.role}</small></div></div><div class="quote">「${p.quote}」</div><div class="bias">利害：${p.bias}</div><button class="proposal-button" data-action="${p.action}" ${Sim.available(s, p.action) ? 'disabled' : ''}>提案を採用：${Sim.ACTIONS[p.action].name} →</button><p class="hint">${Sim.ACTIONS[p.action].desc}</p></div>`)).join('')}</div>` : panel('役員提案', '<div class="empty"><b>まだ、すべてを見渡せる。</b>社員20名で役員が登場。彼らは会社全体より、自分のKPIを信じています。</div>')}${panel('企業文化', `<div class="panel-body"><div class="culture-name">${Sim.culture(s)}</div><div class="culture-grid">${Object.entries(s.culture).map(([k, v]) => `<div><span>${names[k]}</span>${meter(v * 5)}<b>${v}</b></div>`).join('')}</div><p class="hint">研究開発・待遇・広告・管理・判断の積み重ねが文化になります。技術至上主義は生産力＋8%。会議と無意味なKPIは実際に管理効率を削ります。</p></div>`, '<small>CULTURE IS A SIDE EFFECT</small>')}${pendingPanel()}</div>`;
}
function endStats() {
  return `<div class="history-stats">${[['創業年数', `${fmt(state.week / 52, 1)}年`], ['最高週次売上', `${money(state.stats.peakRevenue)}円`], ['最大社員数', `${state.stats.peakEmployees}名`], ['炎上 / 買収', `${state.stats.scandals} / ${state.stats.acquisitions}`]].map(([n, v]) => `<div><span>${n}</span><b>${v}</b></div>`).join('')}</div>`;
}
function history() {
  return `${endStats()}<div class="stack">${panel('経営の記録', `<div class="note"><strong>${esc(state.name)}</strong> · 方針：${Sim.STRATEGIES[state.strategy].name}<br>歴代CEO：${state.stats.ceos.map(esc).join(' → ')}<br>${state.ended ? `最終理由：${esc(state.ended.reason)}` : `W${state.week} · 経営は続いています。`}<br>累計離職 ${state.stats.departures}名 · 最終文化 ${Sim.culture(state)}</div>`)}${panel('会社年表', `<div class="timeline">${state.timeline.slice().reverse().map(t => `<article class="timeline-item"><small>YEAR ${String(Math.floor(t.week / 52) + 1).padStart(2, '0')} / WEEK ${String(t.week % 52 + 1).padStart(2, '0')} · W${t.week}</small>${esc(t.text)}</article>`).join('')}</div>`, '<small>EVERY DECISION LEAVES A TRACE</small>')}</div>`;
}
function render() {
  if (!state) return;
  Sim.calculate(state);
  if (state.stage >= 2 && !state.proposals.length) {
    // Initial proposals appear on the next weekly executive report.
    state.proposals = [{ role: 'CTO', name: '水野 蒼', bias: '技術と可用性を最優先', action: 'research', quote: '組織拡大の前に、技術へ投資しましょう。' }];
  }
  $('company-title').textContent = state.name;
  $('view-title').innerHTML = `${titles[tab]}<span class="title-dot">.</span>`;
  $('subtitle').textContent = `${state.name} · ${Sim.STRATEGIES[state.strategy].name} · ${Sim.culture(state)}`;
  $('date').textContent = `YEAR ${String(Math.floor(state.week / 52) + 1).padStart(2, '0')} · WEEK ${String(state.week % 52 + 1).padStart(2, '0')} / W${state.week}`;
  $('nav').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('step').disabled = !!state.ended || !!state.event;
  $('pause').disabled = !!state.ended || !!state.event;
  $('ticker').innerHTML = `<span><span class="live-dot"></span> ${stages[state.stage]}</span><span>ECONOMY <b class="${state.economy >= 1 ? 'up' : 'down'}">${fmt(state.economy, 2)}×</b></span>${state.rivals.map(r => `<span>${r.name} <b>${fmt(r.share, 1)}%</b> <span class="${r.status === '競争中' ? 'cyan' : 'down'}">${r.status}</span></span>`).join('')}<span>CONTROL <b class="warn">${fmt(state.metrics.control)}%</b></span>`;
  const warning = state.metrics.load > 100 ? `サーバー負荷${fmt(state.metrics.load)}%。広告による需要が処理能力を超えています。` : state.morale < 50 ? '士気が低下。離職が生産力と残った社員に連鎖します。' : state.cash < 250 ? '手元資金が少なくなっています。利益と固定費を確認してください。' : state.legal > 60 ? '法務リスクが上昇。内部監査や法務の採用が必要です。' : '';
  $('alerts').innerHTML = state.ended ? `<div class="end-inline"><button data-end-show>最終レポート</button>${esc(state.ended.reason)} · 年表で経営を振り返れます。</div>` : state.event ? '<div class="alert-bar">△ 未解決の経営判断があります。<button data-event-show>判断を開く →</button></div>' : warning ? `<div class="alert-bar">△ ${warning}</div>` : '';
  updatePreferences(); kpis(); $('content').innerHTML = (beginner() ? coaching() : '') + ({ overview, people, market, board, history })[tab]();
  drawChart();
}
function drawChart() {
  const canvas = $('chart'); if (!canvas) return;
  const box = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = box.width * dpr; canvas.height = box.height * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const w = box.width, h = box.height, left = 49, right = w - 14, top = 14, bottom = h - 27;
  const values = state.history.slice(-26), max = Math.max(100, ...values.map(v => v.revenue), ...values.map(v => v.profit)) * 1.12, min = Math.min(0, ...values.map(v => v.profit)) * 1.18;
  const y = v => bottom - (v - min) / (max - min) * (bottom - top);
  ctx.font = '9px Consolas'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const v = min + (max - min) / 4 * i; ctx.strokeStyle = '#23303a'; ctx.beginPath(); ctx.moveTo(left, y(v)); ctx.lineTo(right, y(v)); ctx.stroke(); ctx.fillStyle = '#617c8e'; ctx.fillText(fmt(v), left - 8, y(v) + 3); }
  const dx = (right - left) / Math.max(1, values.length), zero = y(0);
  for (let i = 0; i < values.length; i++) { const v = values[i]; ctx.fillStyle = v.profit >= 0 ? '#65d9d047' : '#ff7c8366'; ctx.fillRect(left + i * dx + dx * .2, Math.min(zero, y(v.profit)), Math.max(2, dx * .6), Math.max(1, Math.abs(y(v.profit) - zero))); }
  ctx.strokeStyle = '#b4ef65'; ctx.lineWidth = 2; ctx.beginPath(); values.forEach((v, i) => i ? ctx.lineTo(left + dx * (i + .5), y(v.revenue)) : ctx.moveTo(left + dx * .5, y(v.revenue))); ctx.stroke();
  ctx.fillStyle = '#b4ef65'; values.forEach((v, i) => { ctx.beginPath(); ctx.arc(left + dx * (i + .5), y(v.revenue), 2.3, 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = '#46555f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, zero); ctx.lineTo(right, zero); ctx.stroke();
  ctx.fillStyle = '#617c8e'; ctx.textAlign = 'left'; ctx.fillText(`W${values[0].week}`, left, h - 7); ctx.textAlign = 'right'; ctx.fillText(`W${values[values.length - 1].week}`, right, h - 7);
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset;
  if (b.id !== 'pause' && !d.choice && !d.action) sound.play('click');
  if (d.tab) { tab = d.tab; render(); }
  else if (d.strategy) { selected = d.strategy; document.querySelectorAll('[data-strategy]').forEach(el => { el.classList.toggle('selected', el.dataset.strategy === selected); }); }
  else if (d.mode) setMode(d.mode);
  else if ('found' in d) { state = Sim.create($('company-name').value, selected); preview = false; tab = 'overview'; closeModal(false); render(); save(); sound.play('confirm'); toast('創業しました。まずは1週進めて決算を確認しましょう'); }
  else if ('resume' in d) { state = Sim.restore(Sim.serialize(saved)); preview = false; closeModal(false); render(); if (state.event) eventModal(); else if (state.ended) endModal(); }
  else if ('close' in d) closeModal();
  else if (d.action) { const result = Sim.act(state, d.action, $('hire-dept')?.value || '開発'); sound.play(result.ok ? 'confirm' : 'error'); if (!result.ok) toast(result.reason); render(); save(); if (state.ended) endModal(); }
  else if (d.choice !== undefined) { const result = Sim.decide(state, Number(d.choice)); sound.play(result.ok ? 'confirm' : 'error'); closeModal(); render(); save(); if (state.ended) endModal(); }
  else if (d.acquire !== undefined) {
    const r = state.rivals.find(r => r.id === Number(d.acquire));
    openModal('acquire', `<div class="modal-top"><span>ACQUISITION REVIEW</span><button class="close-modal" data-close aria-label="閉じる">×</button></div><h2 id="modal-title">${r.name} を統合する</h2><p>買収費用 ${money(Sim.valuation(r))}円 / 社員 ${r.staff}名 / 継承負債 ${money(r.debt)}円</p><div class="help-callout">設備・サーバー・技術・ブランドを獲得。<br>士気−12 / 会議＋8 / 法務＋8<br>6週後：統合費用 ${r.staff * 4}万円とエース社員の退職。</div><div class="modal-actions"><button data-close>見送る</button><button class="primary" data-buy="${r.id}">買収を実行 →</button></div>`);
  }
  else if (d.buy !== undefined) { const result = Sim.acquire(state, Number(d.buy)); sound.play(result.ok ? 'confirm' : 'error'); closeModal(); if (!result.ok) toast(result.reason); render(); save(); }
  else if ('new' in d) foundingModal();
  else if ('eventShow' in d) eventModal();
  else if ('endShow' in d) endModal();
  else if ('endHistory' in d) { closeModal(); tab = 'history'; render(); }
});
$('pause').addEventListener('click', play); $('step').addEventListener('click', advance);
$('speed').addEventListener('change', () => { if (playback.running) { pause(); play(); } });
$('save').addEventListener('click', () => save(true)); $('restart').addEventListener('click', foundingModal); $('help').addEventListener('click', helpModal);
document.addEventListener('change', e => {
  if (e.target.id === 'experience') setMode(e.target.value);
  if (e.target.id === 'hire-dept') hireDept = e.target.value;
  if (e.target.id === 'dept-filter') { deptFilter = e.target.value; render(); }
  if (e.target.id === 'people-sort') { sortPeople = e.target.value; render(); }
  if (e.target.id === 'autonomy') { state.autonomy = e.target.value; save(); toast('委任ポリシーを変更しました'); }
});
$('sound-toggle').addEventListener('click', () => { preferences.sound = !preferences.sound; sound.setEnabled(preferences.sound); savePreferences(); updatePreferences(); });
$('volume').addEventListener('input', e => { preferences.volume = Number(e.target.value) / 100; sound.volume = preferences.volume; savePreferences(); });
$('volume').addEventListener('change', () => sound.play('confirm'));
document.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
document.addEventListener('keydown', () => sound.unlock(), { capture: true });
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && modalType) {
    const focusable = [...$('modal-root').querySelectorAll('button:not(:disabled),input,select')];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement.classList.contains('modal'))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (modalType) { if (e.key === 'Escape' && ['help', 'acquire', 'end'].includes(modalType)) closeModal(); return; }
  if (e.code === 'Space') { e.preventDefault(); play(); } else if (e.key.toLowerCase() === 'n') advance();
});
window.addEventListener('resize', drawChart);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('beforeunload', () => { if (state) save(); });
// The opening screen previews the actual dashboard without writing a save.
state = Sim.create('ノヴァ株式会社', 'tech', 42); render(); foundingModal();
