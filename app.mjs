import { filterQuestions, normalizeSnapshot } from './model.mjs';

const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  activity: '<path d="M2 12h4l3-8 6 16 3-8h4"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  command: '<path d="M9 7V5a2 2 0 1 0-2 2h10a2 2 0 1 0-2-2v14a2 2 0 1 0 2-2H7a2 2 0 1 0 2 2V7Z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  game: '<path d="M7 7h10c3 0 5 10 3 11-2 1-4-3-5-3H9c-1 0-3 4-5 3-2-1 0-11 3-11Z"/><path d="M7 9v4m-2-2h4m6-1h.01m3 3h.01"/>',
  chevrons: '<path d="m8 9 4-4 4 4m-8 6 4 4 4-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 3h.01"/>',
  sliders: '<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  mask: '<path d="M3 6c6 3 12 3 18 0v7c0 6-9 9-9 9s-9-3-9-9V6Z"/><path d="m6 11 3 1m6 0 3-1m-9 6c2-2 4-2 6 0"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  file: '<path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8l-6-6Z"/><path d="M14 2v6h6M8 13h8m-8 4h5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = n => n.toLocaleString('en-US');
function icons(scope = document) { scope.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
icons();
let data;
let snapshot = null;
let view = 'overview';
let tab = 'all';
let search = '';
let round = 'all';
let page = 1;
let selectedId = null;
let reveal = true;
let showSuggestions = true;
let toastTimer;
const pageSize = 6;
const events = [];
const titles = { overview: ['Behind the bluff', 'A closer look at the game. All the facts, none of the guesswork.'], answers: ['The answer archive', 'Every truth and built-in decoy, straight from the game files.'], players: ['Meet the bluffers', 'Gameplay details from your imported host snapshot.'], activity: ['Follow the trail', 'A transparent record of this companion session.'], findings: ['Under the hood', 'What the archive reveals — and what it cannot tell us.'] };

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3800);
}
function log(title, description, type = 'file') {
  events.unshift({ title, description, type, time: new Date() });
}
function questionText(text) {
  return esc(text).replace(/&lt;BLANK&gt;|_{3,}/gi, '<span class="blank">_______</span>');
}
function setView(next) {
  if (!data) return;
  view = next;
  page = 1;
  document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  $('#breadcrumb-title').textContent = { overview: 'Overview', answers: 'Truths & lies', players: 'Players', activity: 'Activity log', findings: 'Archive findings' }[view];
  $('#page-title').innerHTML = `${esc(titles[view][0])}<span>.</span>`;
  $('#page-description').textContent = titles[view][1];
  $('#hero').hidden = view !== 'overview';
  $('#hero').style.display = view === 'overview' ? '' : 'none';
  render();
}
function openMenu() {
  if ($('#import-dialog').open) $('#import-dialog').close();
  const dialog = $('#mod-dialog');
  if (dialog.open) dialog.close(); else dialog.showModal();
}
function openImport() {
  if ($('#mod-dialog').open) $('#mod-dialog').close();
  $('#import-error').textContent = '';
  $('#snapshot-file').value = '';
  $('#import-dialog').showModal();
}
function render() {
  const main = $('#view-content');
  main.className = 'view-enter';
  if (view === 'players') renderPlayers(main);
  else if (view === 'activity') renderActivity(main);
  else if (view === 'findings') renderFindings(main);
  else renderArchive(main);
}
function renderArchive(main) {
  const questions = filterQuestions(data.questions, search, round);
  page = Math.max(1, Math.min(page, Math.ceil(questions.length / pageSize)));
  const slice = questions.slice((page - 1) * pageSize, page * pageSize);
  const q = data.questions.find(q => q.id === selectedId) || slice[0] || data.questions[0];
  const selected = selectedId ?? q.id;
  main.innerHTML = `<div class="content-grid">
    <section class="archive-section"><div class="section-header"><div><h2>Truths & lies <span>THE ARCHIVE</span></h2><p>A little less mystery. A lot more information.</p></div><button class="text-button" id="archive-export">Export ${icon('download')}</button></div>
    <div class="panel"><div class="archive-controls"><div class="tabs" role="tablist" aria-label="Answer type">
      ${[['all', 'All questions', data.questions.length], ['truths', 'Truths', data.questions.length], ['lies', 'Lies', data.questions.reduce((n,q) => n + q.suggestions.length,0)]].map(([id,label,count]) => `<button class="tab ${tab === id ? 'active' : ''}" role="tab" aria-selected="${tab === id}" data-tab="${id}">${label}<span>${number(count)}</span></button>`).join('')}
    </div><select class="round-select" id="round-filter" aria-label="Filter by round"><option value="all" ${round === 'all' ? 'selected' : ''}>All rounds</option><option ${round === 'Fibbage' ? 'selected' : ''}>Fibbage</option><option ${round === 'Final Fibbage' ? 'selected' : ''}>Final Fibbage</option></select></div>
    <div class="search-row"><label class="search-box">${icon('search')}<input type="search" id="archive-search" placeholder="Search questions, answers, or categories..." aria-label="Search archive" value="${esc(search)}"><span class="search-shortcut">/</span></label><button class="filter-button" id="filter-button" aria-label="Focus round filter">${icon('sliders')}</button></div>
    <div class="table-scroll"><table class="archive-table"><thead><tr><th>QUESTION / CATEGORY</th><th>${tab === 'lies' ? 'BUILT-IN SUGGESTIONS' : 'CORRECT ANSWER'}</th><th>${tab === 'truths' ? 'VIEW' : 'LIES'}</th></tr></thead><tbody>
    ${slice.map(item => `<tr tabindex="0" data-question="${item.id}" class="${item.id === selected ? 'selected' : ''}" aria-label="Inspect ${esc(item.category)}"><td><div class="category-line">${esc(item.category)} <span class="question-index">#${item.id}</span></div><div class="question-preview">${questionText(item.question)}</div></td><td>${tab === 'lies' ? `<div class="lie-value">${showSuggestions ? esc(item.suggestions.slice(0,2).join(', ')) + (item.suggestions.length > 2 ? '…' : '') : 'Suggestions hidden'}</div>` : `<div class="truth-value">${icon('check-circle')}${reveal ? esc(item.truth) : '••••••'}</div>`}</td><td><div class="table-action">${tab !== 'truths' ? `<span class="count-tag">${item.suggestions.length}</span>` : ''}${icon('right')}</div></td></tr>`).join('')}
    </tbody></table>${!slice.length ? '<div class="empty-state">No matching questions. Try a different search or round.</div>' : ''}</div>
    <div class="table-footer"><span>${questions.length ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, questions.length)} of ${number(questions.length)} questions` : '0 questions'}</span><div class="pagination"><button id="prev-page" aria-label="Previous page" ${page === 1 ? 'disabled' : ''}>${icon('left')}</button><button class="current" aria-label="Current page ${page}">${page}</button><button id="next-page" aria-label="Next page" ${page * pageSize >= questions.length ? 'disabled' : ''}>${icon('right')}</button></div></div></div></section>
    <aside class="right-column"><div class="section-header"><h2>Quick look</h2><span class="live-label"><i></i> ARCHIVE DATA</span></div><section class="panel inspect-panel" aria-label="Selected question"><div class="panel-eyebrow">QUESTION SPOTLIGHT<span>#${q.id}</span></div><h3 class="question-label">${esc(q.category)} <span class="question-index">/ ${esc(q.round)}</span></h3><p class="selected-question">${questionText(q.question)}</p><div class="answer-box"><div class="answer-label">${icon('check-circle')} THE TRUTH</div><span class="answer-text">${reveal ? esc(q.truth) : 'Answer hidden'}</span></div><div class="suggestions-label">THE BLUFFS <span>${q.suggestions.length} suggestions</span></div><div class="suggestion-chips">${showSuggestions ? q.suggestions.map(s => `<span class="suggestion-chip">${esc(s)}</span>`).join('') : '<span class="inspect-note">Hidden using the mod menu.</span>'}</div><p class="inspect-note">Built-in suggestions, not lies submitted by players.${q.alternateSpellings.length && reveal ? ` Also accepted: ${esc(q.alternateSpellings.join(', '))}.` : ''}</p><div class="source-line" title="${esc(q.source)}">${icon('file')} Extracted from ${esc(q.source.split('/').slice(-3).join('/'))}</div></section><div class="session-note"><span>${icon('help')}</span><div><strong>Looking for live player data?</strong><p>The game archive knows the answers, not who's playing. Import a host snapshot to see player details and their lies.</p><button class="text-button" id="inline-import">Import a session ${icon('arrow')}</button></div></div></aside></div>`;
  main.querySelectorAll('[data-tab]').forEach(el => el.addEventListener('click', () => { tab = el.dataset.tab; render(); }));
  main.querySelectorAll('[data-question]').forEach(el => {
    const choose = () => { selectedId = Number(el.dataset.question); render(); };
    el.addEventListener('click', choose);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
  });
  $('#archive-search').addEventListener('input', e => {
    const position = e.target.selectionStart;
    search = e.target.value; page = 1; render();
    $('#archive-search').focus();
    $('#archive-search').setSelectionRange(position, position);
  });
  $('#round-filter').addEventListener('change', e => { round = e.target.value; page = 1; render(); });
  $('#filter-button').addEventListener('click', () => { $('#round-filter').focus(); $('#round-filter').showPicker?.(); });
  $('#prev-page').addEventListener('click', () => { page--; render(); });
  $('#next-page').addEventListener('click', () => { page++; render(); });
  $('#archive-export').addEventListener('click', exportData);
  $('#inline-import').addEventListener('click', openImport);
}
function renderPlayers(main) {
  main.innerHTML = `<div class="section-header"><div><h2>Player roster <span>${snapshot ? 'IMPORTED SNAPSHOT' : 'NO SESSION'}</span></h2><p>Only explicitly supplied gameplay information is displayed.</p></div><button class="button" id="players-import">${icon('upload')}Import snapshot</button></div><section class="panel">
  ${!snapshot ? `<div class="empty-state"><span>${icon('users')}</span><h3>The bluffers haven't arrived. Yet.</h3><p>Connected users cannot be listed from static game files. Import an authorized host snapshot to view player names, IDs, scores, connection states, and submitted lies.</p><button class="button primary" id="empty-import">${icon('upload')}Import session snapshot</button></div>` :
    `<div class="snapshot-banner"><span>Snapshot imported ${esc(new Date(snapshot.importedAt).toLocaleTimeString())} · Not a live connection</span><button id="clear-session">Clear session ×</button></div><div class="players-grid">${snapshot.players.map(p => `<article class="player-card"><div class="player-avatar">${esc(p.name.slice(0,2).toUpperCase())}</div><h3>${esc(p.name)}</h3><p>ID: ${esc(p.id)}</p><p>Score: ${p.score == null ? 'Not supplied' : number(p.score)}</p><span class="player-state ${p.connected !== true ? 'offline' : ''}">${p.connected === true ? '● Connected in snapshot' : p.connected === false ? '○ Disconnected in snapshot' : '○ Connection state not supplied'}</span></article>`).join('') || '<div class="empty-state">This snapshot contains no players.</div>'}</div><div class="player-lies"><h3>Player-submitted lies <span class="question-index">${snapshot.questionId == null ? 'Question not supplied' : `Question #${snapshot.questionId}`}</span></h3>${snapshot.lies.map(l => `<div class="submitted-lie">${esc(l.text)}<span>${esc(snapshot.players.find(p => p.id === l.playerId)?.name || 'Unattributed')}</span></div>`).join('') || '<p class="inspect-note">No player-written lies supplied in this snapshot.</p>'}${snapshot.questionId != null ? '<button class="text-button" id="snapshot-question">Inspect this question →</button>' : ''}</div>`}</section>`;
  $('#players-import').addEventListener('click', openImport);
  $('#empty-import')?.addEventListener('click', openImport);
  $('#clear-session')?.addEventListener('click', () => { snapshot = null; updateStats(); log('Session cleared', 'Imported player data removed from memory.', 'users'); render(); toast('Session snapshot cleared.'); });
  $('#snapshot-question')?.addEventListener('click', () => { selectedId = snapshot.questionId; search = String(snapshot.questionId); round = 'all'; setView('answers'); });
}
function renderActivity(main) {
  main.innerHTML = `<div class="section-header"><div><h2>Companion activity <span>${events.length} EVENTS</span></h2><p>Local actions only. Native game events are not monitored.</p></div></div><section class="panel activity-list">${events.map(e => `<article class="activity-item"><span class="activity-icon">${icon(e.type)}</span><div><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p></div><time>${esc(e.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</time></article>`).join('')}</section>`;
}
function renderFindings(main) {
  const core = data.evidence.find(e => e.source === 'Fibbage XL/FibbageXL.swf');
  main.innerHTML = `<div class="section-header"><div><h2>Reverse-engineering notes <span>STATIC ANALYSIS</span></h2><p>Evidence from your supplied Fibbage XL archive.</p></div></div><section class="panel findings-body"><h3>Yes, the game holds player and answer information.</h3><p>Static string inspection of <code>FibbageXL.swf</code> identifies symbols including <code>players</code>, <code>getPlayerByUserId</code>, <code>score</code>, <code>lastLie</code>, and <code>currentLies</code>. These indicate runtime player and lie handling. They do not make live data accessible to this browser, and this analysis does not establish a public roster endpoint.</p><h3>The answers are stored in plain JSON.</h3><p>The <code>.jet</code> question records contain <code>QuestionText</code>, <code>CorrectText</code>, <code>Suggestions</code>, and <code>AlternateSpellings</code>. This archive contains ${number(data.questions.length)} questions: 282 regular and 49 Final Fibbage records, with ${number(data.questions.reduce((n,q)=>n+q.suggestions.length,0))} built-in suggestions. All are browsable and exportable here.</p><div class="finding-box">${data.limitations.map(l => `<div>↳ ${esc(l)}</div>`).join('')}</div><h3>About the F6 menu</h3><p>F6 toggles companion controls while this browser page is focused. It can reveal or hide truths and suggestions and navigate to player data. It is not an injected overlay, a global hotkey, or a native game patch.</p><h3>Static symbol evidence</h3><p>These are strings extracted from decompressed SWF files, not a full ActionScript decompilation.</p>${data.evidence.map(e => `<details class="evidence-file" ${e === core ? 'open' : ''}><summary>${esc(e.source)} · ${e.symbols.length} matching strings</summary><div class="evidence-symbols">${e.symbols.map(s=>`<code>${esc(s)}</code>`).join('') || '<p>No matching strings found.</p>'}</div></details>`).join('')}</section>`;
}
function updateStats() {
  $('#players-stat').innerHTML = `${snapshot?.players.length ?? 0}<span>/ 8</span>`;
  $('#player-nav-count').textContent = snapshot?.players.length ?? 0;
  $('#players-caption').textContent = snapshot ? `${snapshot.players.filter(p=>p.connected === true).length} connected in imported snapshot` : 'Awaiting a session snapshot';
}
function exportData() {
  if (!data) return toast('The archive has not loaded yet.');
  const payload = { game: data.game, questions: data.questions, snapshot, limitations: data.limitations };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'fibbage-xl-inspector.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log('Archive exported', `${data.questions.length} truths, built-in suggestions${snapshot ? ', and the imported session' : ''} exported as JSON.`, 'download');
  toast('Archive exported as JSON.');
  if (view === 'activity') render();
}

document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => setView(el.dataset.view)));
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); setView('overview'); });
document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => {
  if (el.dataset.go === 'players') setView('players');
  else { tab = el.dataset.go === 'rounds' ? 'all' : el.dataset.go; round = 'all'; search = ''; setView('answers'); }
}));
$('#explore-button').addEventListener('click', () => { search = ''; round = 'all'; tab = 'all'; setView('answers'); });
$('#import-button').addEventListener('click', openImport);
$('#export-button').addEventListener('click', exportData);
$('#help-button').addEventListener('click', () => setView('findings'));
$('#profile-button').addEventListener('click', () => toast("Dez's Minion · Local Fibbage XL companion"));
$('#menu-toggle').addEventListener('click', openMenu);
$('#sidebar-menu').addEventListener('click', openMenu);
$('#close-menu').addEventListener('click', () => $('#mod-dialog').close());
$('#close-import').addEventListener('click', () => $('#import-dialog').close());
$('#menu-players').addEventListener('click', () => { $('#mod-dialog').close(); setView('players'); });
$('#menu-answers').addEventListener('click', () => { $('#mod-dialog').close(); setView('answers'); });
$('#reveal-toggle').addEventListener('change', e => { reveal = e.target.checked; log(reveal ? 'Truths revealed' : 'Truths hidden', 'Answer visibility updated in the companion.', 'sliders'); if (data) render(); });
$('#suggestions-toggle').addEventListener('change', e => { showSuggestions = e.target.checked; log(showSuggestions ? 'Suggestions shown' : 'Suggestions hidden', 'Built-in suggestion visibility updated in the companion.', 'sliders'); if (data) render(); });
document.addEventListener('keydown', e => {
  if (e.key === 'F6') { e.preventDefault(); if (!e.repeat) openMenu(); }
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !$('#mod-dialog').open && !$('#import-dialog').open && $('#archive-search')) { e.preventDefault(); $('#archive-search').focus(); }
});
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  }
}));
$('#snapshot-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (!data) throw new Error('Wait for the game archive to load before importing.');
    if (file.size > 2 * 1024 * 1024) throw new Error('The snapshot exceeds the 2 MB limit.');
    let value;
    try { value = JSON.parse(await file.text()); } catch (error) {
      if (error instanceof SyntaxError) throw new Error('Invalid JSON. Check the snapshot format and try again.');
      throw error;
    }
    const imported = normalizeSnapshot(value, new Set(data.questions.map(q => q.id)));
    snapshot = imported;
    updateStats();
    log('Session snapshot imported', `${snapshot.players.length} players and ${snapshot.lies.length} player-written lies loaded. This is not a live connection.`, 'users');
    $('#import-dialog').close();
    setView('players');
    toast('Session snapshot imported. Player data stays in this tab.');
  } catch (error) {
    $('#import-error').textContent = error.message;
  }
});

try {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error(`Archive request failed (${response.status}).`);
  data = await response.json();
  if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error('The question archive is empty or invalid.');
  selectedId = data.questions[0].id;
  $('#truths-stat').textContent = number(data.questions.length);
  $('#lies-stat').textContent = number(data.questions.reduce((n,q) => n + q.suggestions.length, 0));
  $('#question-nav-count').textContent = data.questions.length;
  log('Archive ready to explore', `${number(data.questions.length)} truths and ${number(data.questions.reduce((n,q)=>n+q.suggestions.length,0))} built-in lie suggestions indexed.`, 'check-circle');
  log('Game files inspected', `Question records and SWF strings analyzed from ${data.archive}. No native game process attached.`, 'code');
  render();
} catch (error) {
  $('#view-content').innerHTML = `<div class="error-state"><strong>The archive could not be loaded.</strong><br>${esc(error.message)}<br>Serve this project using npm start, then reload this page.</div>`;
}
