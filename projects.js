'use strict';

/* =====================================================================
   Project details window + new / edit project form
   ===================================================================== */

/* ---------- Details ---------- */
function openDetails(id) {
  if (!findProject(id)) return;
  state.openProjectId = id;
  openModal('detailsModal');
  renderDetails();
  $('#detailsCard').scrollTop = 0;
  $('#detailsCard [data-close]')?.focus();
}
modalCloseHooks.detailsModal = () => { state.openProjectId = null; };

function renderDetails() {
  if (!state.openProjectId) return;
  const card = $('#detailsCard');
  const p = findProject(state.openProjectId);
  if (!p) { closeModal('detailsModal'); return; }

  const pr = progressOf(p);
  const di = dueInfo(p);
  const doneCount = p.tasks.filter(isDone).length;
  const lead = findMember(p.lead);
  const scroll = card.scrollTop;
  const draft = $('#addTaskInput', card)?.value || '';
  const hadFocus = document.activeElement?.id === 'addTaskInput';

  card.style.setProperty('--accent', p.color);
  card.dataset.status = p.status;
  card.setAttribute('aria-label', pick(p.title));

  card.innerHTML = `
    <div class="d-head">
      <span class="p-icon">${svg(I[p.icon] || I.folder)}</span>
      <div class="d-title">
        <h3>${esc(pick(p.title))}</h3>
        <div class="d-tags">
          <span class="badge s-${p.status}">${t('status_' + p.status)}</span>
          <span class="prio prio-${p.priority}">${t('prio_' + p.priority)}</span>
        </div>
      </div>
      <button class="icon-btn" type="button" data-edit-project="${p.id}" aria-label="${t('editProject')}" title="${t('editProject')}">${svg(I.edit)}</button>
      <button class="icon-btn" type="button" data-close aria-label="${t('close')}" title="${t('close')}">${svg(I.x)}</button>
    </div>

    <div class="d-body">
      <p class="d-desc">${esc(pick(p.desc)) || t('noDesc')}</p>

      <div class="d-progress">
        <div class="range-head"><span>${t('progressLbl')}</span><b>${pr}%</b></div>
        <div class="bar lg"><span style="width:${pr}%"></span></div>
        <small>${t('tasksDone', { d: doneCount, n: p.tasks.length })}</small>
      </div>

      <div class="d-info">
        <div><small>${svg(I.calendar)}${t('startDate')}</small><b>${fmtDate(p.start)}</b></div>
        <div><small>${svg(I.flag)}${t('dueDate')}</small><b>${fmtDate(p.due)}</b></div>
        <div><small>${svg(I.clock)}${t('timeLeft')}</small><b class="${di.cls}">${di.text}</b></div>
        <div><small>${svg(I.user)}${t('leadLbl')}</small><b>${lead ? avatar(p.lead, 'xs') + esc(pick(lead.name)) : '—'}</b></div>
      </div>

      <div class="d-section">
        <h4>${t('teamMembers')} <span class="count">${p.members.length}</span></h4>
        <ul class="d-members">
          ${p.members.map((id) => {
            const m = findMember(id);
            return m ? `
            <li>${avatar(id, 'xs')}
              <span>${esc(pick(m.name))} ${id === p.lead ? `<span class="lead-star" title="${t('leadLbl')}">★</span>` : ''}</span>
              <small>${t('role_' + m.role)}</small>
            </li>` : '';
          }).join('')}
        </ul>
      </div>

      <div class="d-section">
        <h4>${t('tasks')} <span class="count">${doneCount}/${p.tasks.length}</span></h4>
        <ul class="d-tasks">
          ${p.tasks.length ? p.tasks.map((x) => `
            <li class="${isDone(x) ? 'done' : ''}">
              <input type="checkbox" class="check" data-task-check="${x.id}" ${isDone(x) ? 'checked' : ''} aria-label="${esc(pick(x.title))}">
              <button type="button" class="t-title" data-open-task="${x.id}">${esc(pick(x.title))}</button>
              <span class="tstatus ts-${x.status}">${t('tstatus_' + x.status)}</span>
              ${x.due ? `<span class="t-due ${taskDueClass(x)}">${fmtShortDate(x.due)}</span>` : ''}
              ${x.comments.length ? `<span class="t-comments">${svg(I.comment)}${x.comments.length}</span>` : ''}
              ${avatar(x.who, 'xs')}
            </li>`).join('') : `<li class="empty">${t('noTasksYet')}</li>`}
        </ul>
        <form class="add-task" id="addTaskForm" autocomplete="off">
          <input id="addTaskInput" name="task" maxlength="80" placeholder="${t('addTaskPh')}" required>
          <select name="who" aria-label="${t('assignee')}">
            ${p.members.map((id) => { const m = findMember(id); return m ? `<option value="${id}">${esc(pick(m.name))}</option>` : ''; }).join('')}
          </select>
          <button class="btn primary sm" type="submit">${t('add')}</button>
        </form>
      </div>
    </div>

    <div class="d-foot">
      <label>
        <span>${t('fStatus')}</span>
        <select id="detailStatus">
          ${['planned', 'progress', 'done', 'hold'].map((s) =>
            `<option value="${s}" ${s === p.status ? 'selected' : ''}>${t('status_' + s)}</option>`).join('')}
        </select>
      </label>
      <button class="btn danger" type="button" data-delete-project="${p.id}">${svg(I.trash)} ${t('delete')}</button>
    </div>`;

  card.scrollTop = scroll;
  const input = $('#addTaskInput', card);
  input.value = draft;
  if (hadFocus) input.focus();
}

function setTaskStatus(taskId, status) {
  const found = findTask(taskId);
  if (!found || !TASK_STATUSES.includes(status)) return;
  found.task.status = status;
  saveDB();
  render();
}

function addTaskToProject(form) {
  const p = findProject(state.openProjectId);
  const input = $('#addTaskInput', $('#detailsCard'));
  const text = input.value.trim();
  if (!p || !text) return;
  p.tasks.push({ id: uid(), title: text, who: form.who.value || '', status: 'todo', priority: 'medium', due: '', comments: [] });
  input.value = '';
  saveDB();
  render();
  toast(t('taskAdded'));
  $('#addTaskInput', $('#detailsCard'))?.focus();
}

function deleteProject(id) {
  undoable(t('projectDeleted'), () => {
    db.projects = db.projects.filter((p) => p.id !== id);
    db.userEvents.forEach((e) => { if (e.project === id) e.project = ''; });
  });
  closeModal('detailsModal');
}

/* ---------- New / edit project form ---------- */
const projectForm = () => $('#projectForm');

function renderProjectFormOptions() {
  const form = projectForm();
  const chosenIcon = $('input[name="icon"]:checked', form)?.value || form.dataset.icon || 'folder';
  const chosenColor = $('input[name="color"]:checked', form)?.value || form.dataset.color || PALETTE[0];

  $('#colorPicker').innerHTML = PALETTE.map((c) => `
    <label class="color-opt" style="--sw:${c}" title="${c}">
      <input type="radio" name="color" value="${c}" ${c === chosenColor ? 'checked' : ''} aria-label="${c}">
    </label>`).join('');

  $('#iconPicker').style.setProperty('--accent', chosenColor);
  $('#iconPicker').innerHTML = Object.entries(ICON_CHOICES).map(([key, names]) => {
    const label = names[state.lang === 'ar' ? 1 : 0];
    return `<label class="icon-opt" title="${esc(label)}">
      <input type="radio" name="icon" value="${key}" ${key === chosenIcon ? 'checked' : ''} aria-label="${esc(label)}">
      ${svg(I[key])}
    </label>`;
  }).join('');

  const leadSel = form.lead;
  const currentLead = leadSel.value || form.dataset.lead || db.team[0]?.id || '';
  leadSel.innerHTML = db.team.map((m) => `<option value="${m.id}">${esc(pick(m.name))} — ${t('role_' + m.role)}</option>`).join('');
  leadSel.value = currentLead;

  const rendered = $$('input[name="members"]', form).length > 0;
  const checked = rendered
    ? new Set([...$$('input[name="members"]:checked', form)].map((c) => c.value))
    : new Set((form.dataset.members || '').split(',').filter(Boolean));
  $('#memberChecks').innerHTML = db.team.map((m) => {
    const isLead = m.id === leadSel.value;
    return `<label>
      <input type="checkbox" class="check" name="members" value="${m.id}" ${isLead || checked.has(m.id) ? 'checked' : ''} ${isLead ? 'disabled' : ''}>
      ${avatar(m.id, 'xs')} <span>${esc(pick(m.name))}</span>
    </label>`;
  }).join('');

  const editing = !!state.editProjectId;
  $('#projectFormTitle').textContent = t(editing ? 'editProject' : 'newProject');
  $('#projectSubmit').textContent = t(editing ? 'saveChanges' : 'create');
}

function openProjectForm(editId = null) {
  const form = projectForm();
  const p = editId ? findProject(editId) : null;
  state.editProjectId = p ? p.id : null;

  form.reset();
  $('#iconPicker').innerHTML = '';
  $('#colorPicker').innerHTML = '';
  $('#memberChecks').innerHTML = '';
  $('#formError').hidden = true;

  if (p) {
    form.title.value = pick(p.title);
    form.desc.value = pick(p.desc);
    form.status.value = p.status;
    form.priority.value = p.priority;
    form.start.value = p.start;
    form.due.value = p.due;
    Object.assign(form.dataset, { icon: p.icon, color: p.color, lead: p.lead, members: p.members.join(',') });
  } else {
    form.start.value = todayISO();
    Object.assign(form.dataset, {
      icon: 'folder', color: PALETTE[db.projects.length % PALETTE.length],
      lead: db.team[0]?.id || '', members: ''
    });
  }
  form.lead.value = '';
  renderProjectFormOptions();
  form.due.min = form.start.value;
  openModal('projectModal');
  form.title.focus();
}
modalCloseHooks.projectModal = () => { state.editProjectId = null; };

function showFormError(msg, field) {
  const el = $('#formError');
  el.textContent = msg;
  el.hidden = false;
  field?.focus();
}

function submitProjectForm() {
  const form = projectForm();
  const title = form.title.value.trim();
  const start = form.start.value;
  const due = form.due.value;
  if (!title) return showFormError(t('errTitle'), form.title);
  if (!start || !due) return showFormError(t('errDates'), start ? form.due : form.start);
  if (due < start) return showFormError(t('dueBeforeStart'), form.due);

  const lead = form.lead.value;
  const members = [lead, ...[...$$('input[name="members"]:checked', form)].map((c) => c.value).filter((id) => id !== lead)];
  const icon = $('input[name="icon"]:checked', form)?.value;
  const color = $('input[name="color"]:checked', form)?.value;
  const fields = {
    icon: I[icon] ? icon : 'folder',
    color: PALETTE.includes(color) ? color : PALETTE[0],
    status: form.status.value,
    priority: form.priority.value,
    start, due, lead, members
  };

  const editing = state.editProjectId && findProject(state.editProjectId);
  if (editing) {
    const p = editing;
    undoable(t('projectSaved'), () => {
      Object.assign(p, fields);
      p.title = setLocalized(p.title, title);
      p.desc = setLocalized(p.desc, form.desc.value.trim());
    });
    closeModal('projectModal');
    return;
  }

  const p = { id: 'p' + uid(), ...fields, title, desc: form.desc.value.trim(), tasks: [] };
  db.projects.unshift(p);
  saveDB();
  closeModal('projectModal');
  state.filters.home = 'all';
  state.filters.projects = 'all';
  render();
  toast(t('projectCreated'));
  openDetails(p.id); // open it so tasks can be added straight away
}
