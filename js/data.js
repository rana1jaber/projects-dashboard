'use strict';

/* =====================================================================
   Data: sample content, saving to the browser, and upgrading old data
   ===================================================================== */

const T = (en, ar) => ({ en, ar });
let uidSeq = 0;
const uid = () => Date.now().toString(36) + (uidSeq++).toString(36) + Math.random().toString(36).slice(2, 5);

// "YYYY-MM-DD" for today + n days
function isoIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayISO = () => isoIn(0);

const PALETTE = ['#2f6fdb', '#1f8a5b', '#6d4bd8', '#d9822b', '#c2417a', '#0e8a9a', '#d64545', '#8a5a2b'];
const ROLES = ['lead', 'pm', 'dev', 'designer', 'analyst', 'qa'];
const TASK_STATUSES = ['todo', 'doing', 'done'];
const PRIORITIES = ['high', 'medium', 'low'];

/* ---------- Sample data ---------- */
function seedTeam() {
  return [
    { id: 'm0', name: T('Ahmed Al-Otaibi', 'أحمد العتيبي'),      role: 'lead',     status: 'online',  color: '#2f6fdb' },
    { id: 'm1', name: T('Sara Al-Zahrani', 'سارة الزهراني'),     role: 'designer', status: 'online',  color: '#c2417a' },
    { id: 'm2', name: T('Mohammed Al-Qahtani', 'محمد القحطاني'), role: 'dev',      status: 'online',  color: '#1f8a5b' },
    { id: 'm3', name: T('Noura Al-Subaie', 'نورة السبيعي'),      role: 'analyst',  status: 'away',    color: '#d9822b' },
    { id: 'm4', name: T('Abdullah Al-Shehri', 'عبدالله الشهري'), role: 'dev',      status: 'offline', color: '#6d4bd8' },
    { id: 'm5', name: T('Reem Al-Harbi', 'ريم الحربي'),          role: 'designer', status: 'online',  color: '#0e8a9a' },
    { id: 'm6', name: T('Khalid Al-Ghamdi', 'خالد الغامدي'),     role: 'analyst',  status: 'away',    color: '#8a5a2b' },
    { id: 'm7', name: T('Lama Al-Dosari', 'لمى الدوسري'),        role: 'qa',       status: 'online',  color: '#b0457d' }
  ];
}

// task(en, ar, memberId, status, priority, dueInDays)
const task = (en, ar, who, status = 'todo', priority = 'medium', dueIn = null) => ({
  id: uid(), title: T(en, ar), who, status, priority,
  due: dueIn === null ? '' : isoIn(dueIn), comments: []
});

function seedProjects() {
  const list = [
    { id: 'p1', icon: 'code', color: '#6d4bd8', status: 'progress', priority: 'high',
      start: '2026-07-01', due: '2026-10-15', lead: 'm0', members: ['m0', 'm1', 'm2', 'm5', 'm7'],
      title: T('Internal Website Development', 'تطوير الموقع الداخلي'),
      desc: T('Design and build the user interface and connect it to the database.', 'تصميم وتطوير واجهة المستخدم وربطها بقاعدة البيانات.'),
      tasks: [
        task('Gather requirements', 'جمع المتطلبات', 'm1', 'done', 'high'),
        task('Design UI wireframes', 'تصميم النماذج الأولية للواجهات', 'm5', 'done', 'medium'),
        task('Build front-end pages', 'برمجة صفحات الواجهة الأمامية', 'm7', 'done', 'high'),
        task('Connect to the database', 'الربط مع قاعدة البيانات', 'm2', 'doing', 'high', 4),
        task('User testing', 'اختبار المستخدم', 'm1', 'todo', 'medium', 12)
      ] },
    { id: 'p2', icon: 'database', color: '#1f8a5b', status: 'progress', priority: 'high',
      start: '2026-08-01', due: '2026-09-30', lead: 'm2', members: ['m2', 'm3', 'm1', 'm6'],
      title: T('Contract Data Analysis', 'تحليل بيانات العقود'),
      desc: T('Process and compare contract system data and prepare reports.', 'معالجة ومقارنة البيانات من نظام العقود وإعداد التقارير.'),
      tasks: [
        task('Export contract data', 'استخراج بيانات العقود', 'm2', 'done', 'medium'),
        task('Clean and validate data', 'تنظيف البيانات والتحقق منها', 'm3', 'done', 'high'),
        task('Compare contract terms', 'مقارنة شروط العقود', 'm6', 'doing', 'high', 2),
        task('Prepare the final report', 'إعداد التقرير النهائي', 'm3', 'todo', 'medium', 5)
      ] },
    { id: 'p3', icon: 'chart', color: '#2f6fdb', status: 'planned', priority: 'medium',
      start: '2026-10-01', due: '2026-11-20', lead: 'm1', members: ['m1', 'm0', 'm2', 'm4', 'm6'],
      title: T('Internal Operations Improvement', 'تحسين العمليات الداخلية'),
      desc: T('Study the workflow and propose solutions to increase efficiency.', 'دراسة سير العمل واقتراح حلول لزيادة الكفاءة.'),
      tasks: [
        task('Map the current workflow', 'توثيق سير العمل الحالي', 'm1', 'done', 'medium'),
        task('Interview department staff', 'مقابلة موظفي الأقسام', 'm4', 'todo', 'medium', 14),
        task('Identify bottlenecks', 'تحديد نقاط التعطل', 'm6', 'todo', 'high', 20),
        task('Propose improvements', 'اقتراح التحسينات', 'm0', 'todo', 'medium', 30),
        task('Present recommendations', 'عرض التوصيات', 'm1', 'todo', 'low', 40)
      ] },
    { id: 'p4', icon: 'presentation', color: '#d9822b', status: 'done', priority: 'low',
      start: '2026-07-15', due: '2026-08-25', lead: 'm0', members: ['m0', 'm1', 'm4', 'm5'],
      title: T('Presentation Preparation', 'إعداد العروض التقديمية'),
      desc: T('Prepare a presentation of the latest project results for the supervisor.', 'تحضير عرض لنتائج آخر المشاريع وتقديمه للمشرف.'),
      tasks: [
        task('Collect project results', 'جمع نتائج المشاريع', 'm4', 'done', 'medium'),
        task('Design the slides', 'تصميم الشرائح', 'm5', 'done', 'medium'),
        task('Rehearse the presentation', 'التدرب على العرض', 'm0', 'done', 'low')
      ] },
    { id: 'p5', icon: 'gear', color: '#d64545', status: 'hold', priority: 'medium',
      start: '2026-08-10', due: '2026-12-10', lead: 'm4', members: ['m4', 'm2', 'm3', 'm0', 'm7'],
      title: T('Database Optimization', 'تحسين قاعدة البيانات'),
      desc: T('Improve queries and overall system performance.', 'تطوير الاستعلامات وتحسين أداء النظام.'),
      tasks: [
        task('Analyze slow queries', 'تحليل الاستعلامات البطيئة', 'm4', 'done', 'high'),
        task('Add indexes', 'إضافة الفهارس', 'm2', 'todo', 'medium', -3),
        task('Load testing', 'اختبار الأداء تحت الضغط', 'm7', 'todo', 'low', 25)
      ] },
    { id: 'p6', icon: 'phone', color: '#0e8a9a', status: 'progress', priority: 'high',
      start: '2026-08-20', due: '2026-11-05', lead: 'm7', members: ['m7', 'm0', 'm2', 'm4', 'm5'],
      title: T('Internal App Development', 'تطوير تطبيق داخلي'),
      desc: T('Build a trial version of the internal app and test the user experience.', 'إنشاء نسخة تجريبية للتطبيق الداخلي وتجربة المستخدم.'),
      tasks: [
        task('Define app features', 'تحديد مزايا التطبيق', 'm0', 'done', 'high'),
        task('Design app screens', 'تصميم شاشات التطبيق', 'm5', 'done', 'medium'),
        task('Build the trial version', 'بناء النسخة التجريبية', 'm7', 'done', 'high'),
        task('Collect user feedback', 'جمع ملاحظات المستخدمين', 'm2', 'doing', 'medium', 6),
        task('Fix reported issues', 'إصلاح المشكلات', 'm4', 'todo', 'medium', 15)
      ] }
  ];
  // A couple of example comments
  list[0].tasks[3].comments.push({ id: uid(), text: T('The API is ready, starting the connection today.', 'واجهة الـ API جاهزة، أبدأ الربط اليوم.'), at: Date.now() - 3600e3 * 5 });
  list[1].tasks[2].comments.push({ id: uid(), text: T('Waiting for the legal team’s notes.', 'بانتظار ملاحظات الفريق القانوني.'), at: Date.now() - 3600e3 * 26 });
  return list;
}

// Meetings are placed relative to today so the demo always has upcoming dates
const seedEvents = [
  { id: 'e1', title: T('Project follow-up meeting', 'اجتماع متابعة المشروع'), date: isoIn(1), time: '10:00' },
  { id: 'e2', title: T('Review analysis results', 'مراجعة نتائج التحليل'), date: isoIn(5), time: '11:30' },
  { id: 'e3', title: T('Present progress to supervisor', 'عرض التقدم للمشرف'), date: isoIn(9), time: '09:00' }
];

/* ---------- Safe browser storage ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

const DATA_KEY = 'pd-data-v3';

function freshDB() {
  return { v: 3, projects: seedProjects(), team: seedTeam(), userEvents: [], hiddenEvents: [], readNotifs: [] };
}

function readJSON(key, fallback) {
  try { const v = JSON.parse(store.get(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
}

// Upgrade data saved by the previous version (members were numbers, tasks had done: true/false)
function migrateV2() {
  const old = readJSON('projects-data-v2', null);
  if (!Array.isArray(old)) return null;
  const mid = (i) => (typeof i === 'number' ? 'm' + i : i);
  const projects = old.map((p) => ({
    ...p,
    lead: mid(p.lead),
    members: (p.members || []).map(mid),
    tasks: (p.tasks || []).map((x) => ({
      id: x.id || uid(), title: x.title, who: mid(x.who),
      status: x.status || (x.done ? 'done' : 'todo'),
      priority: x.priority || 'medium', due: x.due || '', comments: x.comments || []
    }))
  }));
  return {
    v: 3, projects, team: seedTeam(),
    userEvents: readJSON('userEvents', []),
    hiddenEvents: readJSON('hiddenEvents', []),
    readNotifs: readJSON('readNotifs', [])
  };
}

function isValidDB(d) {
  return d && d.v === 3 && Array.isArray(d.projects) && Array.isArray(d.team);
}

function loadDB() {
  const saved = readJSON(DATA_KEY, null);
  if (isValidDB(saved)) {
    saved.userEvents = Array.isArray(saved.userEvents) ? saved.userEvents : [];
    saved.hiddenEvents = Array.isArray(saved.hiddenEvents) ? saved.hiddenEvents : [];
    saved.readNotifs = Array.isArray(saved.readNotifs) ? saved.readNotifs : [];
    return saved;
  }
  return migrateV2() || freshDB();
}

let db = loadDB();
if (!store.get(DATA_KEY)) saveDB(); // save straight away after upgrading old data

function saveDB() {
  store.set(DATA_KEY, JSON.stringify(db));
}

// Undo support: take a copy before a change, put it back if the user clicks "Undo"
const snapshot = () => JSON.stringify(db);
function restoreSnapshot(snap) {
  db = JSON.parse(snap);
  saveDB();
}

/* ---------- Lookups ---------- */
const findProject = (id) => db.projects.find((p) => p.id === id);
const findMember = (id) => db.team.find((m) => m.id === id);
function findTask(taskId) {
  for (const p of db.projects) {
    const x = p.tasks.find((k) => k.id === taskId);
    if (x) return { project: p, task: x };
  }
  return null;
}
const allTasks = () => db.projects.flatMap((p) => p.tasks.map((x) => ({ ...x, project: p })));
const isDone = (x) => x.status === 'done';

function allEvents() {
  const hidden = new Set(db.hiddenEvents);
  return [...seedEvents.filter((e) => !hidden.has(e.id)), ...db.userEvents]
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}
