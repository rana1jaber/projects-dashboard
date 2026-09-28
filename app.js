'use strict';

/* =====================================================================
   Wiring: clicks, forms, keyboard, and start-up
   ===================================================================== */

function applyTheme() {
  if (state.theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
}

function setTheme(theme) {
  state.theme = theme === 'dark' ? 'dark' : 'light';
  store.set('theme', state.theme);
  applyTheme();
  applyStaticText();
}

function setLang(lang) {
  state.lang = lang === 'ar' ? 'ar' : 'en';
  store.set('lang', state.lang);
  render();
}

/* ---------- Clicks ---------- */

// Close popovers when clicking outside them (capture phase, before content re-renders)
document.addEventListener('click', (e) => {
  if (!e.target.closest('.pop-wrap')) closePopovers();
}, true);

document.addEventListener('click', (e) => {
  const target = e.target;
  const hit = (sel) => target.closest(sel);

  if (handlePopoverClick(target)) return;

  if (hit('[data-open-add-event]')) return openCalendarOn(todayISO(), true);
  const calOpen = hit('[data-cal-open]');
  if (calOpen) return openCalendarOn(calOpen.dataset.calOpen);

  // Closing modals: the ✕ button, "Cancel", or a click on the dark background
  if (hit('[data-close]')) {
    const backdrop = hit('.modal-backdrop');
    if (backdrop) closeModal(backdrop.id);
    return;
  }
  if (target.classList.contains('modal-backdrop')) return closeModal(target.id);

  // Projects
  if (hit('[data-new-project]')) return openProjectForm();
  const editP = hit('[data-edit-project]');
  if (editP) return openProjectForm(editP.dataset.editProject);
  const delP = hit('[data-delete-project]');
  if (delP) return deleteProject(delP.dataset.deleteProject);

  // Team
  if (hit('[data-add-member]')) return openMemberForm();
  const editM = hit('[data-edit-member]');
  if (editM) return openMemberForm(editM.dataset.editMember);
  if (hit('#memberDelete')) return deleteMember(state.editMemberId);
  if (hit('#uploadPhotoBtn')) return $('#photoInput').click();
  if (hit('#removePhoto')) { memberPhotoDraft = ''; return renderPhotoPreview(); }

  // Filter tabs
  const tab = hit('.tab[data-filter]');
  if (tab) {
    state.filters[tab.parentElement.dataset.group] = tab.dataset.filter;
    applyStaticText();
    return renderView();
  }

  // Tasks
  const layout = hit('[data-task-layout]');
  if (layout) {
    state.taskLayout = layout.dataset.taskLayout;
    store.set('taskLayout', state.taskLayout);
    applyStaticText();
    return renderView();
  }
  const move = hit('[data-move-task]');
  if (move) return setTaskStatus(move.dataset.moveTask, move.dataset.to);
  const delT = hit('[data-delete-task]');
  if (delT) return deleteTask(delT.dataset.deleteTask);
  const delC = hit('[data-del-comment]');
  if (delC) return deleteComment(delC.dataset.delComment);

  if (hit('.check')) return; // checkboxes are handled on "change"

  const openT = hit('[data-open-task]');
  if (openT) return openTask(openT.dataset.openTask);

  const projectEl = hit('[data-project]');
  if (projectEl) {
    if (hit('#taskModal')) closeModal('taskModal');
    return openDetails(projectEl.dataset.project);
  }

  const memberBtn = hit('[data-member-tasks]');
  if (memberBtn) {
    const m = findMember(memberBtn.dataset.memberTasks);
    state.query = m ? pick(m.name) : '';
    $('#searchInput').value = state.query;
    state.filters.tasks = 'all';
    state.taskProject = '';
    location.hash = '#tasks';
    return;
  }

  // Settings / top bar
  const themeBtn = hit('[data-set-theme]');
  if (themeBtn) return setTheme(themeBtn.dataset.setTheme);
  if (hit('#themeToggle')) return setTheme(state.theme === 'dark' ? 'light' : 'dark');
  const langBtn = hit('[data-set-lang]');
  if (langBtn) return setLang(langBtn.dataset.setLang);
  if (hit('#langToggle')) return setLang(state.lang === 'en' ? 'ar' : 'en');
  if (hit('#installBtn')) return installApp();

  // Reports
  if (hit('#exportProjects')) return exportProjects();
  if (hit('#exportTasks')) return exportTasks();
  if (hit('#printReport')) return printReport();

  if (hit('#resetBtn')) {
    if (!state.resetArmed) {
      state.resetArmed = true;
      return applyStaticText();
    }
    state.resetArmed = false;
    undoable(t('dataReset'), () => { db = freshDB(); });
  }
});

// Clicking anywhere else cancels an armed "Reset"
document.addEventListener('pointerdown', (e) => {
  if (state.resetArmed && !e.target.closest('#resetBtn')) {
    state.resetArmed = false;
    applyStaticText();
  }
});

/* ---------- Changes in inputs ---------- */
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('[data-task-check]')) return setTaskStatus(el.dataset.taskCheck, el.checked ? 'done' : 'todo');

  if (el.id === 'detailStatus') {
    const p = findProject(state.openProjectId);
    if (!p) return;
    p.status = el.value;
    saveDB();
    return render();
  }
  if (el.id === 'sortSelect') { state.sort = el.value; return renderView(); }
  if (el.id === 'taskProjectFilter') { state.taskProject = el.value; return renderView(); }

  if (el.closest('#projectForm')) {
    const form = $('#projectForm');
    if (el.name === 'lead' || el.name === 'color') renderProjectFormOptions();
    if (el.name === 'start') form.due.min = form.start.value;
    return;
  }
  if (el.id === 'photoInput') return onPhotoChosen(el);
  if (el.name === 'mcolor') return renderPhotoPreview();
});

document.addEventListener('input', (e) => {
  if (e.target.name === 'mname') renderPhotoPreview();
});

/* ---------- Form submits ---------- */
document.addEventListener('submit', (e) => {
  const form = e.target;
  const handlers = {
    eventForm: submitEventForm,
    addTaskForm: addTaskToProject,
    projectForm: submitProjectForm,
    memberForm: submitMemberForm,
    taskForm: saveTaskForm,
    commentForm: addComment
  };
  const handler = handlers[form.id];
  if (!handler) return;
  e.preventDefault();
  handler(form);
});

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (popoverOpen()) return closePopovers();
    const top = topModal();
    if (top) return closeModal(top);
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.project-card[data-project]')) {
    e.preventDefault();
    openDetails(e.target.dataset.project);
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.board-card[data-open-task]')) {
    e.preventDefault();
    openTask(e.target.dataset.openTask);
  }
  // Ctrl/Cmd + Enter sends a comment
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.id === 'commentInput') {
    e.preventDefault();
    $('#commentForm').requestSubmit();
  }
});

$('#searchInput').addEventListener('input', (e) => {
  state.query = e.target.value;
  if (state.view === 'reports' || state.view === 'settings') {
    location.hash = '#projects';
    return;
  }
  renderView();
});

$('#nameInput').addEventListener('input', (e) => {
  state.userName = e.target.value;
  store.set('userName', state.userName.trim());
  applyStaticText();
});

window.addEventListener('hashchange', () => showView(location.hash.slice(1)));

// Keep tabs of the same browser in sync
window.addEventListener('storage', (e) => {
  if (e.key === DATA_KEY) { db = loadDB(); render(); }
});

/* ---------- Start ---------- */
applyTheme();
applyStaticText();
renderSide();
showView(location.hash.slice(1));
