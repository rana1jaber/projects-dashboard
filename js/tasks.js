'use strict';

/* =====================================================================
   Task details window (edit, comments, delete) + board drag & drop
   ===================================================================== */

function openTask(taskId) {
  if (!findTask(taskId)) return;
  state.openTaskId = taskId;
  $('#taskCard').innerHTML = '';
  openModal('taskModal');
  renderTaskModal();
  $('#taskForm [name="title"]')?.focus();
}
modalCloseHooks.taskModal = () => { state.openTaskId = null; };

function renderTaskModal() {
  if (!state.openTaskId) return;
  const found = findTask(state.openTaskId);
  if (!found) { closeModal('taskModal'); return; }
  const { project: p, task: x } = found;
  const card = $('#taskCard');

  // keep anything the user was typing if we re-render (e.g. language switch)
  const old = $('#taskForm', card);
  const draft = old && old.dataset.task === x.id ? {
    title: old.title.value, status: old.status.value, priority: old.priority.value,
    who: old.who.value, due: old.due.value
  } : null;
  const commentDraft = $('#commentInput', card)?.value || '';
  const v = draft || { title: pick(x.title), status: x.status, priority: x.priority, who: x.who, due: x.due };

  card.style.setProperty('--accent', p.color);
  card.innerHTML = `
    <div class="d-head">
      <span class="p-icon">${svg(I.check)}</span>
      <div class="d-title">
        <h3>${t('taskDetails')}</h3>
        <div class="d-tags">
          <span class="chip" data-project="${p.id}" style="--accent:${esc(p.color)}">${esc(pick(p.title))}</span>
        </div>
      </div>
      <button class="icon-btn" type="button" data-close aria-label="${t('close')}" title="${t('close')}">${svg(I.x)}</button>
    </div>

    <form class="d-body task-form" id="taskForm" data-task="${x.id}" novalidate autocomplete="off">
      <label><span>${t('taskTitle')}</span>
        <input name="title" maxlength="100" value="${esc(v.title)}"></label>
      <div class="row2">
        <label><span>${t('fStatus')}</span>
          <select name="status">
            ${TASK_STATUSES.map((s) => `<option value="${s}" ${s === v.status ? 'selected' : ''}>${t('tstatus_' + s)}</option>`).join('')}
          </select></label>
        <label><span>${t('priority')}</span>
          <select name="priority">
            ${PRIORITIES.map((s) => `<option value="${s}" ${s === v.priority ? 'selected' : ''}>${t('prioShort_' + s)}</option>`).join('')}
          </select></label>
      </div>
      <div class="row2">
        <label><span>${t('assignee')}</span>
          <select name="who">
            <option value="">${t('unassigned')}</option>
            ${p.members.map((id) => { const m = findMember(id); return m ? `<option value="${id}" ${id === v.who ? 'selected' : ''}>${esc(pick(m.name))}</option>` : ''; }).join('')}
          </select></label>
        <label><span>${t('taskDue')}</span>
          <input type="date" name="due" dir="ltr" value="${esc(v.due)}"></label>
      </div>
      <p class="form-error" id="taskError" hidden></p>
    </form>

    <div class="d-body d-section comments">
      <h4>${svg(I.comment)} ${t('comments')} <span class="count">${x.comments.length}</span></h4>
      ${x.comments.length ? `<ul class="comment-list">
        ${x.comments.map((c) => `
          <li>
            <span class="avatar xs" style="--c:var(--primary)">${esc(initials(displayName()))}</span>
            <div class="c-body">
              <div class="c-head"><b>${esc(displayName())}</b><small>${esc(relTime(c.at))}</small></div>
              <p>${esc(pick(c.text))}</p>
            </div>
            <button type="button" class="icon-btn xs" data-del-comment="${c.id}" aria-label="${t('delete')}" title="${t('delete')}">${svg(I.x)}</button>
          </li>`).join('')}
      </ul>` : `<p class="muted-note">${t('noComments')}</p>`}
      <form class="add-comment" id="commentForm" autocomplete="off">
        <textarea id="commentInput" name="text" rows="2" maxlength="500" placeholder="${t('addCommentPh')}"></textarea>
        <button class="btn primary sm" type="submit">${svg(I.comment)} ${t('send')}</button>
      </form>
    </div>

    <div class="d-foot">
      <button class="btn danger" type="button" data-delete-task="${x.id}">${svg(I.trash)} ${t('deleteTask')}</button>
      <button class="btn primary" type="submit" form="taskForm">${t('saveChanges')}</button>
    </div>`;

  $('#commentInput', card).value = commentDraft;
}

function saveTaskForm(form) {
  const found = findTask(form.dataset.task);
  if (!found) return;
  const title = form.title.value.trim();
  if (!title) {
    const err = $('#taskError');
    err.textContent = t('errTaskTitle');
    err.hidden = false;
    form.title.focus();
    return;
  }
  const x = found.task;
  undoable(t('taskSaved'), () => {
    x.title = setLocalized(x.title, title);
    x.status = form.status.value;
    x.priority = form.priority.value;
    x.who = form.who.value;
    x.due = form.due.value;
  });
  closeModal('taskModal');
}

function addComment(form) {
  const found = findTask(state.openTaskId);
  const text = form.text.value.trim();
  if (!found || !text) return;
  found.task.comments.push({ id: uid(), text, at: Date.now() });
  form.text.value = '';
  saveDB();
  render();
  $('#commentInput')?.focus();
}

function deleteComment(commentId) {
  const found = findTask(state.openTaskId);
  if (!found) return;
  undoable(t('delete'), () => {
    found.task.comments = found.task.comments.filter((c) => c.id !== commentId);
  });
}

function deleteTask(taskId) {
  const found = findTask(taskId);
  if (!found) return;
  closeModal('taskModal');
  undoable(t('taskDeleted'), () => {
    found.project.tasks = found.project.tasks.filter((k) => k.id !== taskId);
  });
}

/* ---------- Drag & drop on the board ---------- */
let draggedTaskId = null;

document.addEventListener('dragstart', (e) => {
  const card = e.target.closest?.('[data-drag-task]');
  if (!card) return;
  draggedTaskId = card.dataset.dragTask;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', draggedTaskId); } catch (err) { /* ignore */ }
});

document.addEventListener('dragend', (e) => {
  e.target.closest?.('[data-drag-task]')?.classList.remove('dragging');
  $$('.board-col.drop-over').forEach((c) => c.classList.remove('drop-over'));
  draggedTaskId = null;
});

document.addEventListener('dragover', (e) => {
  const col = e.target.closest?.('[data-drop-status]');
  if (!col || !draggedTaskId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  $$('.board-col.drop-over').forEach((c) => { if (c !== col) c.classList.remove('drop-over'); });
  col.classList.add('drop-over');
});

document.addEventListener('drop', (e) => {
  const col = e.target.closest?.('[data-drop-status]');
  if (!col || !draggedTaskId) return;
  e.preventDefault();
  const id = draggedTaskId;
  draggedTaskId = null;
  setTaskStatus(id, col.dataset.dropStatus);
});
