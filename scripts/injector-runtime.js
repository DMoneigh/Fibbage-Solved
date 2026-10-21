(function () {
  'use strict';

  const records = /* FIBBAGE_RECORDS */ [];
  const prefix = "[Dez's Minion]";
  const previous = window.fibbageMinion;
  if (previous && typeof previous.stop === 'function') previous.stop();

  function normalize(text) {
    return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/['\u2018\u2019\u02bc]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  function plainQuestion(text) {
    return text.replace(/<blank>/gi, '\u0001').replace(/<[^>]*>/g, '')
      .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ');
  }

  function questionPattern(text) {
    const parts = plainQuestion(text).split('\u0001').map(normalize);
    const escaped = parts.map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`(?:^| )${escaped.join('[a-z0-9 ]{0,120}?')}(?= |$)`);
  }

  const indexed = records.map(record => ({
    ...record,
    pattern: questionPattern(record.question),
    answers: new Set([record.truth, ...record.alternateSpellings].map(normalize).filter(Boolean)),
  }));

  function findQuestion(text) {
    const normalized = normalize(text);
    const matches = indexed.filter(record => record.pattern.test(normalized));
    return { question: matches.length === 1 ? matches[0] : null, matches: matches.length };
  }

  // Exposed for the existing Node test runner without creating a browser dependency.
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = { normalize, findQuestion, records };
    return;
  }

  const defaults = {
    questionSelector: '',
    answerSelector: 'button, [role="button"], input[type="button"], input[type="submit"], input[type="radio"], label',
    autoSelect: true,
    settleMs: 700,
  };
  let options = { ...defaults };
  let stopped = false;
  let timer;
  let pending = null;
  let lastMessage = '';
  let current = null;
  const answered = new Set();
  const host = document.createElement('div');
  host.id = 'fibbage-minion-panel';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{all:initial;position:fixed;right:18px;top:18px;z-index:2147483647;color:#eee7f6;font:13px/1.5 system-ui,sans-serif}
    :host([hidden]){display:none!important}
    *{box-sizing:border-box}section{width:310px;max-width:calc(100vw - 36px);background:#21192c;border:1px solid #785890;border-radius:12px;box-shadow:0 12px 48px #0008;padding:18px}
    h2{margin:0 0 4px;font-size:16px}small{color:#b69bc8;font-size:11px}
    #status{padding:12px;background:#16101f;border:1px solid #40304e;border-radius:6px;overflow-wrap:anywhere}
    #truth{color:#d3f99a;overflow-wrap:anywhere}label{display:flex;gap:8px;align-items:center;margin:12px 0}
    button{font:inherit;border:1px solid #6d4e84;background:#362342;color:#e9d6f8;padding:7px 9px;border-radius:5px;cursor:pointer}
    button:hover{background:#493055}button:focus-visible,input:focus-visible{outline:2px solid #d3f99a}
    .buttons{display:flex;flex-wrap:wrap;gap:7px}p{margin:12px 0}footer{font-size:10px;color:#a38ab4;margin-top:13px}
  </style><section aria-label="Dez's Minion answer selector"><h2>Dez's Minion · Fibbage XL</h2><small>F6 to hide / show · local DOM only</small>
    <p id="status" role="status">Looking for a known question…</p><p id="truth"></p>
    <label><input id="auto" type="checkbox" checked>Auto-select the truth</label>
    <div class="buttons"><button id="scan">Scan now</button><button id="reset">Reset answered</button><button id="stop">Stop & remove</button></div>
    <footer>Only an exact, unique answer is clicked. No typing, submission buttons, screenshots, or game-network access.</footer></section>`;
  (document.body || document.documentElement).append(host);
  const status = shadow.getElementById('status');
  const truth = shadow.getElementById('truth');
  const auto = shadow.getElementById('auto');

  function report(message) {
    status.textContent = message;
    if (message !== lastMessage) console.info(prefix, message);
    lastMessage = message;
  }

  function visible(element) {
    if (!element.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    if (typeof element.checkVisibility === 'function' && !element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    return element.getClientRects().length > 0;
  }

  function enabled(element) {
    return !element.matches(':disabled') && !element.closest('[aria-disabled="true"], [inert]');
  }

  function textOf(element) {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'radio') return Array.from(element.labels || []).filter(visible).map(label => label.innerText).join(' ') || element.getAttribute('aria-label') || '';
      return element.value;
    }
    return element.innerText?.trim() || element.getAttribute('aria-label') || '';
  }

  function choices() {
    const result = new Map();
    for (const element of document.querySelectorAll(options.answerSelector)) {
      let target = element;
      if (element instanceof HTMLLabelElement) {
        if (!element.control || element.control.type !== 'radio') continue;
        target = element.control;
      }
      if (!visible(element) || !enabled(element) || !enabled(target)) continue;
      const text = normalize(textOf(element));
      if (!text) continue;
      // Radio inputs and their labels refer to one choice, not two answers.
      if (!result.has(target)) result.set(target, { target, clickTarget: element, text });
    }
    return [...result.values()];
  }

  function scan() {
    if (stopped) return;
    const roots = options.questionSelector
      ? [...document.querySelectorAll(options.questionSelector)].filter(visible)
      : [document.body].filter(Boolean);
    const text = roots.map(root => root.innerText).join('\n');
    const match = findQuestion(text);
    current = match.question;
    truth.textContent = current ? `Truth: ${current.truth}` : '';
    if (!current) {
      pending = null;
      report(match.matches > 1 ? 'Multiple archive questions are visible. Narrow questionSelector; no answer selected.' : 'No unique known question visible. Waiting for question text in this document.');
      return;
    }
    if (answered.has(current.id)) {
      pending = null;
      report(`Question #${current.id} already selected. Waiting for a different question.`);
      return;
    }
    const available = choices();
    const matching = available.filter(choice => current.answers.has(choice.text));
    if (matching.length !== 1) {
      pending = null;
      report(matching.length > 1
        ? `Question #${current.id}: multiple matching answer controls; no click. Narrow answerSelector.`
        : `Question #${current.id} identified. Waiting for the truth to appear as a visible answer choice.`);
      return;
    }
    if (!options.autoSelect) {
      pending = null;
      report(`Question #${current.id} identified. Auto-select is paused.`);
      return;
    }
    const answer = matching[0];
    const signature = available.map(choice => choice.text).sort().join('\u0000');
    if (!pending || pending.id !== current.id || pending.target !== answer.target || pending.signature !== signature) {
      pending = { id: current.id, target: answer.target, signature, since: performance.now() };
      report(`Question #${current.id}: truth found. Waiting for choices to settle…`);
      return;
    }
    if (performance.now() - pending.since < options.settleMs) return;
    if (!visible(answer.clickTarget) || !enabled(answer.target)) {
      pending = null;
      report('The answer control changed before selection. Waiting for stable choices.');
      return;
    }
    const id = current.id;
    answered.add(id);
    pending = null;
    report(`Selecting the truth for question #${id}: ${current.truth}.`);
    answer.clickTarget.click();
    console.info(prefix, 'Selection click dispatched. Server acceptance is not observable by this script.');
  }

  function safeScan() {
    try { scan(); } catch (error) {
      options.autoSelect = false;
      auto.checked = false;
      pending = null;
      report(`Paused due to an error: ${error.message}`);
      console.error(prefix, error);
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(safeScan, 120);
  }
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'disabled', 'aria-disabled', 'aria-hidden', 'value'] });
  const interval = setInterval(safeScan, 350);
  function onKey(event) {
    if (event.key === 'F6') {
      event.preventDefault();
      if (!event.repeat) host.hidden = !host.hidden;
    }
  }
  document.addEventListener('keydown', onKey, true);

  function configure(next = {}) {
    const allowed = Object.keys(defaults);
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Configuration must be an object.');
    for (const key of Object.keys(next)) if (!allowed.includes(key)) throw new Error(`Unknown option: ${key}`);
    const candidate = { ...options, ...next };
    if (typeof candidate.questionSelector !== 'string' || typeof candidate.answerSelector !== 'string' || !candidate.answerSelector.trim()) throw new Error('Selectors must be strings; answerSelector cannot be empty.');
    document.querySelector(candidate.answerSelector);
    if (candidate.questionSelector) document.querySelector(candidate.questionSelector);
    if (typeof candidate.autoSelect !== 'boolean') throw new Error('autoSelect must be true or false.');
    if (!Number.isFinite(candidate.settleMs) || candidate.settleMs < 300) throw new Error('settleMs must be at least 300 milliseconds.');
    options = candidate;
    auto.checked = options.autoSelect;
    pending = null;
    schedule();
    return { ...options };
  }
  function stop() {
    stopped = true;
    observer.disconnect();
    clearTimeout(timer);
    clearInterval(interval);
    document.removeEventListener('keydown', onKey, true);
    host.remove();
    if (window.fibbageMinion === api) delete window.fibbageMinion;
    console.info(prefix, 'Stopped and removed.');
  }
  const api = {
    configure,
    scan: safeScan,
    pause: () => configure({ autoSelect: false }),
    resume: () => configure({ autoSelect: true }),
    reset: () => { answered.clear(); pending = null; schedule(); },
    stop,
    get status() { return { stopped, questionId: current?.id ?? null, message: lastMessage, answered: [...answered], options: { ...options } }; },
  };
  window.fibbageMinion = api;
  auto.addEventListener('change', () => configure({ autoSelect: auto.checked }));
  shadow.getElementById('scan').addEventListener('click', safeScan);
  shadow.getElementById('reset').addEventListener('click', api.reset);
  shadow.getElementById('stop').addEventListener('click', stop);
  report(`Loaded ${records.length} truths. Auto-select is on. Use only in a game you have permission to automate.`);
  safeScan();
}());
