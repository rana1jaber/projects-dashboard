'use strict';

/* =====================================================================
   App state + small helpers used everywhere
   ===================================================================== */

const VIEWS = ['home', 'projects', 'tasks', 'team', 'reports', 'settings'];

const state = {
  lang: store.get('lang') === 'ar' ? 'ar' : 'en',               // English is the default
  theme: store.get('theme') === 'dark' ? 'dark' : 'light',      // light is the default
  userName: store.get('userName') || '',
  view: 'home',
  query: '',
  filters: { home: 'all', projects: 'all', tasks: 'all' },
  sort: 'due',
  taskLayout: store.get('taskLayout') === 'board' ? 'board' : 'list',
  taskProject: '',            // filter tasks by project ('' = all)
  openProjectId: null,        // project shown in the details modal
  editProjectId: null,        // project being edited (null = creating a new one)
  openTaskId: null,           // task shown in the task modal
  editMemberId: null,         // member being edited (null = adding a new one)
  resetArmed: false
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => root.querySelectorAll(s);

const t = (key, vars = {}) => (i18n[state.lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// Text can be a plain string (typed by the user) or { en, ar } (sample data)
const pick = (v) => (v == null ? '' : typeof v === 'string' ? v : (v[state.lang] ?? v.en ?? ''));
// Update the text for the current language only, keeping the other translation
const setLocalized = (old, value) => (old && typeof old === 'object' ? { ...old, [state.lang]: value } : value);
const allText = (v) => (typeof v === 'string' ? [v] : Object.values(v || {}));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const displayName = () => state.userName.trim() || t('defaultName');

function initials(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (/[؀-ۿ]/.test(name)) return words[0].charAt(0);
  return words.map((w) => w.replace(/^Al-/i, '').charAt(0)).join('').slice(0, 2).toUpperCase();
}

// Round avatar: photo if the member has one, otherwise coloured initials
function avatar(memberId, cls = '') {
  const m = findMember(memberId);
  if (!m) return `<span class="avatar ${cls} avatar-empty" title="${esc(t('unassigned'))}">?</span>`;
  const n = pick(m.name);
  if (m.photo) {
    return `<span class="avatar ${cls} has-photo" title="${esc(n)}"><img src="${esc(m.photo)}" alt=""></span>`;
  }
  return `<span class="avatar ${cls}" style="--c:${esc(m.color)}" title="${esc(n)}">${esc(initials(n))}</span>`;
}

function progressOf(p) {
  if (!p.tasks.length) return p.status === 'done' ? 100 : 0;
  return Math.round((p.tasks.filter(isDone).length / p.tasks.length) * 100);
}

/* ---------- Dates ---------- */
function parseDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const dateLocale = () => (state.lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB');

function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDate(iso));
}

function fmtShortDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(parseDate(iso));
}

function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const locale = state.lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, m));
}

function daysUntil(iso) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDate(iso) - today) / 86400000);
}

function dueInfo(p) {
  if (p.status === 'done') return { text: t('completed'), cls: 'ok', late: false };
  const d = daysUntil(p.due);
  if (d < 0) return { text: t('overdue', { n: -d }), cls: 'late', late: true };
  if (d === 0) return { text: t('dueToday'), cls: 'soon', late: false };
  return { text: t('daysLeft', { n: d }), cls: d <= 7 ? 'soon' : '', late: false };
}

// For a single task: is it late / due soon?
function taskDueClass(x) {
  if (!x.due || isDone(x)) return '';
  const d = daysUntil(x.due);
  return d < 0 ? 'late' : d <= 2 ? 'soon' : '';
}

function eventWhen(e) {
  const d = daysUntil(e.date);
  const day = d === 0 ? t('today') : d === 1 ? t('tomorrow') : fmtDate(e.date);
  return e.time ? `${day} · ${fmtTime(e.time)}` : day;
}

// "5 hours ago" style text for comments
function relTime(ms) {
  const diff = (ms - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(state.lang === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, sec] of units) {
    if (Math.abs(diff) >= sec) return rtf.format(Math.round(diff / sec), unit);
  }
  return t('justNow');
}

/* ---------- Search ---------- */
const queryText = () => state.query.trim().toLowerCase();

function matchesQuery(p) {
  const q = queryText();
  if (!q) return true;
  const texts = [...allText(p.title), ...allText(p.desc)];
  p.members.forEach((id) => { const m = findMember(id); if (m) texts.push(...allText(m.name)); });
  p.tasks.forEach((x) => texts.push(...allText(x.title)));
  return texts.some((s) => s.toLowerCase().includes(q));
}

function taskMatchesQuery(x) {
  const q = queryText();
  if (!q) return true;
  const m = findMember(x.who);
  const texts = [...allText(x.title), ...allText(x.project.title), ...(m ? allText(m.name) : [])];
  return texts.some((s) => s.toLowerCase().includes(q));
}
