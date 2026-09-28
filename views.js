'use strict';

/* =====================================================================
   Pages: home, projects, tasks (list + board), team, reports, settings
   ===================================================================== */

function applyStaticText() {
  const root = document.documentElement;
  root.lang = state.lang;
  root.dir = state.lang === 'ar' ? 'rtl' : 'ltr';

  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); el.title = t(el.dataset.i18nAria); });
  document.title = t('pageTitle');

  const name = displayName();
  $('#greeting').textContent = t('greeting', { name });
  $('#userName').textContent = name;
  $('#userInitial').textContent = initials(name);

  $$('.tabs[data-group]').forEach((tabs) => {
    const current = state.filters[tabs.dataset.group];
    $$('.tab', tabs).forEach((b) => b.classList.toggle('active', b.dataset.filter === current));
  });
  $('#sortSelect').value = state.sort;
  $$('[data-set-lang]').forEach((b) => b.classList.toggle('active', b.dataset.setLang === state.lang));
  $$('[data-set-theme]').forEach((b) => b.classList.toggle('active', b.dataset.setTheme === state.theme));
  $$('[data-task-layout]').forEach((b) => b.classList.toggle('active', b.dataset.taskLayout === state.taskLayout));

  const tt = $('#themeToggle');
  const label = t(state.theme === 'dark' ? 'toLight' : 'toDark');
  tt.setAttribute('aria-label', label);
  tt.title = label;
  tt.setAttribute('aria-pressed', String(state.theme === 'dark'));

  const reset = $('#resetBtn');
  reset.textContent = t(state.resetArmed ? 'sResetConfirm' : 'sResetBtn');
  reset.classList.toggle('danger', state.resetArmed);
}

/* ---------- Project cards ---------- */
function projectCard(p) {
  const pr = progressOf(p);
  const di = dueInfo(p);
  const shown = p.members.slice(0, 3);
  const extra = p.members.length - shown.length;
  return `
    <article class="card project-card" data-project="${p.id}" data-status="${p.status}" style="--accent:${esc(p.color)}"
             tabindex="0" role="button" aria-label="${esc(pick(p.title))} — ${t('details')}">
      <div class="card-top">
        <span class="p-icon">${svg(I[p.icon] || I.folder)}</span>
        <div class="card-top-end">
          <span class="badge s-${p.status}">${t('status_' + p.status)}</span>
          <button type="button" class="icon-btn sm" data-edit-project="${p.id}" aria-label="${t('editProject')}" title="${t('editProject')}">${svg(I.edit)}</button>
        </div>
      </div>
      <h3>${esc(pick(p.title))}</h3>
      <p class="desc">${esc(pick(p.desc)) || '&nbsp;'}</p>
      <div class="progress-row">
        <div class="bar"><span style="width:${pr}%"></span></div>
        <b>${pr}%</b>
      </div>
      <div class="card-foot">
        <div>
          <small>${t('teamMembers')}</small>
          <div class="avatars">${shown.map((id) => avatar(id)).join('')}${extra > 0 ? `<span class="more">+${extra}</span>` : ''}</div>
        </div>
        <div class="due ${di.late ? 'late' : ''}">
          ${svg(I.calendar)}
          <div><small>${t('dueDate')}</small><span>${fmtDate(p.due)}</span></div>
        </div>
      </div>
    </article>`;
}

function renderGrid(el, list) {
  el.innerHTML = list.length ? list.map(projectCard).join('') : `<p class="empty">${t('empty')}</p>`;
}

function renderStats() {
  const total = db.projects.length;
  const active = db.projects.filter((p) => p.status === 'progress').length;
  const avg = total ? Math.round(db.projects.reduce((a, p) => a + progressOf(p), 0) / total) : 0;
  const tasks = allTasks();
  const open = tasks.filter((x) => !isDone(x)).length;

  const stats = [
    { icon: I.target, tone: 'green', label: t('avgCompletion'), value: avg + '%', sub: t('acrossAll') },
    { icon: I.briefcase, tone: 'teal', label: t('activeProjects'), value: active, sub: t('ofTotal', { n: total }), go: 'projects' },
    { icon: I.check, tone: 'blue', label: t('openTasks'), value: open, sub: t('ofTasks', { n: tasks.length }), go: 'tasks' },
    { icon: I.users, tone: 'indigo', label: t('totalMembers'), value: db.team.length, sub: t('inAll'), go: 'team' }
  ];

  $('#stats').innerHTML = stats.map((s) => `
    <${s.go ? `a href="#${s.go}"` : 'div'} class="card stat ${s.go ? 'stat-link' : ''}">
      <div>
        <small>${s.label}</small>
        <strong>${s.value}</strong>
        <span class="sub">${s.sub}</span>
      </div>
      <span class="stat-icon tone-${s.tone}">${svg(s.icon)}</span>
    </${s.go ? 'a' : 'div'}>`).join('');
}

function renderHome() {
  renderStats();
  const f = state.filters.home;
  renderGrid($('#homeGrid'), db.projects.filter((p) => (f === 'all' || p.status === f) && matchesQuery(p)));
}

function renderProjectsView() {
  const f = state.filters.projects;
  const list = db.projects.filter((p) => (f === 'all' || p.status === f) && matchesQuery(p));
  const sorters = {
    due: (a, b) => a.due.localeCompare(b.due),
    progress: (a, b) => progressOf(b) - progressOf(a),
    name: (a, b) => pick(a.title).localeCompare(pick(b.title), state.lang)
  };
  list.sort(sorters[state.sort] || sorters.due);
  renderGrid($('#projectsGrid'), list);
}

/* ---------- Tasks: list and board ---------- */
function filteredTasks() {
  return allTasks().filter((x) =>
    (!state.taskProject || x.project.id === state.taskProject) && taskMatchesQuery(x));
}

function taskMeta(x) {
  const dueCls = taskDueClass(x);
  return `
    <span class="chip" data-project="${x.project.id}" style="--accent:${esc(x.project.color)}">${esc(pick(x.project.title))}</span>
    <span class="prio prio-${x.priority}">${t('prioShort_' + x.priority)}</span>
    ${x.due ? `<span class="t-due ${dueCls}">${svg(I.calendar)}${fmtShortDate(x.due)}</span>` : ''}
    ${x.comments.length ? `<span class="t-comments">${svg(I.comment)}${x.comments.length}</span>` : ''}`;
}

function renderTaskList(list) {
  const f = state.filters.tasks;
  list = list.filter((x) => (f === 'open' ? !isDone(x) : f === 'done' ? isDone(x) : true));
  const order = { doing: 0, todo: 1, done: 2 };
  list.sort((a, b) => (order[a.status] - order[b.status]) || (a.due || '9999').localeCompare(b.due || '9999'));

  $('#taskList').innerHTML = list.length ? list.map((x) => `
    <li class="task-row ${isDone(x) ? 'done' : ''}">
      <input type="checkbox" class="check" data-task-check="${x.id}" ${isDone(x) ? 'checked' : ''} aria-label="${esc(pick(x.title))}">
      <div class="t-main">
        <button type="button" class="t-title" data-open-task="${x.id}">${esc(pick(x.title))}</button>
        <div class="t-meta">
          <span class="tstatus ts-${x.status}">${t('tstatus_' + x.status)}</span>
          ${taskMeta(x)}
        </div>
      </div>
      ${avatar(x.who, 'xs')}
    </li>`).join('') : `<li class="empty">${t('emptyTasks')}</li>`;
}

function renderTaskBoard(list) {
  const rtl = state.lang === 'ar';
  $('#taskBoard').innerHTML = TASK_STATUSES.map((s, i) => {
    const col = list.filter((x) => x.status === s);
    const prev = TASK_STATUSES[i - 1];
    const next = TASK_STATUSES[i + 1];
    return `
      <section class="board-col" data-drop-status="${s}">
        <header><span class="tstatus ts-${s}">${t('tstatus_' + s)}</span><span class="count">${col.length}</span></header>
        <div class="board-cards">
          ${col.map((x) => `
            <article class="board-card" draggable="true" data-drag-task="${x.id}" data-open-task="${x.id}"
                     tabindex="0" role="button" aria-label="${esc(pick(x.title))}" style="--accent:${esc(x.project.color)}">
              <span class="t-title">${esc(pick(x.title))}</span>
              <div class="t-meta">${taskMeta(x)}</div>
              <div class="bc-foot">
                ${avatar(x.who, 'xs')}
                <span class="bc-move">
                  ${prev ? `<button type="button" class="icon-btn xs" data-move-task="${x.id}" data-to="${prev}" aria-label="${esc(t('moveTo', { s: t('tstatus_' + prev) }))}" title="${esc(t('moveTo', { s: t('tstatus_' + prev) }))}">${svg(rtl ? I.chevR : I.chevL)}</button>` : ''}
                  ${next ? `<button type="button" class="icon-btn xs" data-move-task="${x.id}" data-to="${next}" aria-label="${esc(t('moveTo', { s: t('tstatus_' + next) }))}" title="${esc(t('moveTo', { s: t('tstatus_' + next) }))}">${svg(rtl ? I.chevL : I.chevR)}</button>` : ''}
                </span>
              </div>
            </article>`).join('') || `<p class="board-empty">${t('dropHere')}</p>`}
        </div>
      </section>`;
  }).join('');
}

function renderTasksView() {
  // project filter dropdown
  const sel = $('#taskProjectFilter');
  sel.innerHTML = `<option value="">${t('allProjects')}</option>` +
    db.projects.map((p) => `<option value="${p.id}">${esc(pick(p.title))}</option>`).join('');
  if (state.taskProject && !findProject(state.taskProject)) state.taskProject = '';
  sel.value = state.taskProject;

  const board = state.taskLayout === 'board';
  $('#taskList').hidden = board;
  $('#taskBoard').hidden = !board;
  $('[data-group="tasks"]').hidden = board;

  const list = filteredTasks();
  if (board) renderTaskBoard(list); else renderTaskList(list);
}

/* ---------- Team ---------- */
function renderTeamView() {
  const q = queryText();
  const tasks = allTasks();
  const cards = db.team.filter((m) => !q || allText(m.name).some((s) => s.toLowerCase().includes(q))).map((m) => {
    const projCount = db.projects.filter((p) => p.members.includes(m.id)).length;
    const mine = tasks.filter((x) => x.who === m.id);
    const open = mine.filter((x) => !isDone(x)).length;
    return `
      <div class="card member-card">
        <button type="button" class="icon-btn sm m-edit" data-edit-member="${m.id}" aria-label="${t('editMember')}" title="${t('editMember')}">${svg(I.edit)}</button>
        <div class="av-wrap">${avatar(m.id, 'lg')}<span class="status-dot ${m.status}"></span></div>
        <strong>${esc(pick(m.name))}</strong>
        <small>${t('role_' + m.role)} · ${t('st_' + m.status)}</small>
        <div class="m-stats">
          <div><b>${projCount}</b><span>${t('mProjects')}</span></div>
          <div><b>${open}</b><span>${t('mOpen')}</span></div>
          <div><b>${mine.length - open}</b><span>${t('mDone')}</span></div>
        </div>
        <button class="btn ghost sm" type="button" data-member-tasks="${m.id}">${svg(I.list)} ${t('viewTasks')}</button>
      </div>`;
  });
  $('#memberGrid').innerHTML = cards.length ? cards.join('') : `<p class="empty">${t('emptyMembers')}</p>`;
}

/* ---------- Reports ---------- */
function renderReports() {
  const total = db.projects.length || 1;
  const statuses = ['progress', 'planned', 'done', 'hold'];
  const counts = Object.fromEntries(statuses.map((s) => [s, db.projects.filter((p) => p.status === s).length]));

  const tasks = allTasks();
  const done = tasks.filter(isDone).length;
  const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const overdue = db.projects.filter((p) => dueInfo(p).late).length;

  const byProgress = [...db.projects].sort((a, b) => progressOf(b) - progressOf(a));
  const workload = db.team.map((m) => ({ m, n: tasks.filter((x) => x.who === m.id && !isDone(x)).length }))
    .sort((a, b) => b.n - a.n);
  const maxLoad = Math.max(1, ...workload.map((w) => w.n));

  $('#reports').innerHTML = `
    <div class="card report">
      <h3>${t('rByStatus')}</h3>
      <div class="stacked">
        ${statuses.map((s) => `<span style="width:${(counts[s] / total) * 100}%;background:var(--c-${s})"></span>`).join('')}
      </div>
      <ul class="legend">
        ${statuses.map((s) => `<li><i style="background:var(--c-${s})"></i>${t('status_' + s)}<b>${counts[s]}</b></li>`).join('')}
      </ul>
    </div>

    <div class="card report">
      <h3>${t('rTasks')}</h3>
      <div class="donut-wrap">
        <div class="donut" style="--p:${rate}" data-label="${rate}%"></div>
        <ul class="legend" style="grid-template-columns:1fr;flex:1">
          <li><i style="background:var(--primary)"></i>${t('rDone')}<b>${done}</b></li>
          <li><i style="background:var(--track)"></i>${t('rOpen')}<b>${tasks.length - done}</b></li>
          <li><i style="background:var(--danger)"></i>${t('rOverdue')}<b>${overdue}</b></li>
        </ul>
      </div>
    </div>

    <div class="card report wide">
      <h3>${t('rProgress')}</h3>
      <ul class="hbars">
        ${byProgress.map((p) => {
          const pr = progressOf(p);
          return `<li class="clickable" data-project="${p.id}" style="--accent:${esc(p.color)}">
            <span>${esc(pick(p.title))}</span>
            <div class="bar" data-status="${p.status}"><span style="width:${pr}%"></span></div>
            <b>${pr}%</b></li>`;
        }).join('')}
      </ul>
    </div>

    <div class="card report wide">
      <h3>${t('rWorkload')}</h3>
      <ul class="hbars">
        ${workload.map((w) => `<li style="--accent:${esc(w.m.color)}">
            <span>${esc(pick(w.m.name))}</span>
            <div class="bar"><span style="width:${(w.n / maxLoad) * 100}%"></span></div>
            <b>${w.n}</b></li>`).join('')}
      </ul>
    </div>`;
}

function renderSettings() {
  const input = $('#nameInput');
  if (document.activeElement !== input) input.value = state.userName;
  input.placeholder = t('defaultName');
  renderInstallSetting();
}

/* ---------- Side panel ---------- */
function renderSide() {
  $('#teamList').innerHTML = db.team.slice(0, 5).map((m) => `
    <li>
      ${avatar(m.id)}
      <div class="person">
        <strong>${esc(pick(m.name))}</strong>
        <small>${t('role_' + m.role)}</small>
      </div>
      <span class="status-dot ${m.status}" title="${t('st_' + m.status)}"></span>
    </li>`).join('');

  const upcoming = allEvents().filter((e) => e.date >= todayISO()).slice(0, 4);
  $('#eventList').innerHTML = upcoming.length ? upcoming.map((e) => `
    <li class="clickable" data-cal-open="${e.date}" title="${t('calTitle')}">
      ${svg(I.calendar)}
      <div><strong>${esc(pick(e.title))}</strong><small>${esc(eventWhen(e))}</small></div>
    </li>`).join('') : `<li class="muted-note">${t('noUpcoming')}</li>`;
}

/* ---------- Render everything ---------- */
const viewRenderers = {
  home: renderHome,
  projects: renderProjectsView,
  tasks: renderTasksView,
  team: renderTeamView,
  reports: renderReports,
  settings: renderSettings
};

function renderView() {
  viewRenderers[state.view]();
  renderPopovers();
}

function render() {
  applyStaticText();
  renderSide();
  renderView();
  renderDetails();
  renderTaskModal();
  if (!$('#projectModal').hidden) renderProjectFormOptions();
  if (!$('#memberModal').hidden) renderMemberFormOptions();
}

function showView(view) {
  state.view = VIEWS.includes(view) ? view : 'home';
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== state.view; });
  $$('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === state.view;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  renderView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
