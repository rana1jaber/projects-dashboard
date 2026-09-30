'use strict';

/* =====================================================================
   Top-bar popovers: calendar (with events) and notifications
   ===================================================================== */

const cal = { month: null, selected: null, adding: false, dayJump: false };

/* ---------- Notifications ---------- */
function buildNotifications() {
  const list = [];
  db.projects.forEach((p) => {
    const title = pick(p.title);
    if (p.status === 'done') {
      list.push({ id: 'done-' + p.id, kind: 'done', project: p.id, text: t('nDone', { p: title }), sub: fmtDate(p.due), rank: 3 });
      return;
    }
    const d = daysUntil(p.due);
    if (d < 0) list.push({ id: 'late-' + p.id, kind: 'late', project: p.id, text: t('nOverdue', { p: title }), sub: dueInfo(p).text, rank: 0 });
    else if (d === 0) list.push({ id: 'today-' + p.id, kind: 'soon', project: p.id, text: t('nDueToday', { p: title }), sub: fmtDate(p.due), rank: 1 });
    else if (d <= 7) list.push({ id: 'soon-' + p.id, kind: 'soon', project: p.id, text: t('nDueSoon', { p: title }), sub: dueInfo(p).text, rank: 1 });
    if (p.status === 'hold') list.push({ id: 'hold-' + p.id, kind: 'hold', project: p.id, text: t('nHold', { p: title }), sub: fmtDate(p.due), rank: 2 });
  });
  allTasks().forEach((x) => {
    if (x.due && !isDone(x) && daysUntil(x.due) < 0) {
      list.push({ id: 'tlate-' + x.id + '-' + x.due, kind: 'late', task: x.id, text: t('nTaskLate', { t: pick(x.title) }), sub: pick(x.project.title), rank: 0 });
    }
  });
  allEvents().forEach((e) => {
    const d = daysUntil(e.date);
    if (d >= 0 && d <= 7) list.push({ id: 'event-' + e.id + '-' + e.date, kind: 'event', date: e.date, text: t('nEvent', { e: pick(e.title) }), sub: eventWhen(e), rank: 1 });
  });
  return list.sort((a, b) => a.rank - b.rank);
}

const NOTIF_ICON = { late: I.clock, soon: I.flag, hold: I.gear, done: I.check, event: I.calendar };
const isRead = (id) => db.readNotifs.includes(id);

function markRead(ids) {
  ids.forEach((id) => { if (!isRead(id)) db.readNotifs.push(id); });
  // keep the list from growing forever
  const live = new Set(buildNotifications().map((n) => n.id));
  db.readNotifs = db.readNotifs.filter((id) => live.has(id));
  saveDB();
}

function updateNotifBadge() {
  const unread = buildNotifications().filter((n) => !isRead(n.id)).length;
  const badge = $('#notifDot');
  badge.hidden = unread === 0;
  badge.textContent = unread > 9 ? '9+' : unread;
}

function renderNotifs() {
  const list = buildNotifications();
  const unread = list.filter((n) => !isRead(n.id)).length;
  $('#notifPop').innerHTML = `
    <div class="pop-head">
      <strong>${t('notifTitle')}</strong>
      ${unread ? `<button type="button" class="link-btn" data-mark-all>${t('markAllRead')}</button>` : ''}
    </div>
    ${list.length ? `<ul class="notif-list">
      ${list.map((n) => `
        <li>
          <button type="button" class="notif-item ${isRead(n.id) ? '' : 'unread'} k-${n.kind}" data-notif="${esc(n.id)}"
            ${n.project ? `data-notif-project="${n.project}"` : ''} ${n.task ? `data-notif-task="${n.task}"` : ''} ${n.date ? `data-notif-date="${n.date}"` : ''}>
            <span class="n-icon">${svg(NOTIF_ICON[n.kind])}</span>
            <span class="n-text"><span>${esc(n.text)}</span><small>${esc(n.sub)}</small></span>
          </button>
        </li>`).join('')}
    </ul>` : `<p class="pop-empty">${t('allCaught')}</p>`}`;
  updateNotifBadge();
}

/* ---------- Calendar ---------- */
function calendarItems(iso) {
  const items = [];
  db.projects.forEach((p) => {
    if (p.due === iso) items.push({ kind: 'due', color: p.color, project: p.id, label: t('calDue'), title: pick(p.title) });
    if (p.start === iso) items.push({ kind: 'start', color: p.color, project: p.id, label: t('calStart'), title: pick(p.title) });
  });
  allTasks().forEach((x) => {
    if (x.due === iso && !isDone(x)) items.push({ kind: 'task', color: x.project.color, task: x.id, label: t('taskDue'), title: pick(x.title) });
  });
  allEvents().forEach((e) => {
    if (e.date === iso) items.push({ kind: 'event', id: e.id, color: 'var(--primary)', project: e.project || null,
      label: e.time ? fmtTime(e.time) : t('calEvent'), title: pick(e.title) });
  });
  return items;
}

function renderCalendar(focusForm = false) {
  const pop = $('#calPop');
  const today = todayISO();
  // keep whatever was typed in the add-event form across re-renders
  const f = $('#eventForm');
  const draft = f ? { title: f.title.value, date: f.date.value, time: f.time.value, project: f.project.value } : {};
  if (cal.dayJump && f) draft.date = cal.selected;
  cal.dayJump = false;
  if (!cal.month) { const n = new Date(); cal.month = new Date(n.getFullYear(), n.getMonth(), 1); }
  if (!cal.selected) cal.selected = today;

  const y = cal.month.getFullYear();
  const m = cal.month.getMonth();
  const locale = state.lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US';
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(cal.month);
  // Week starts on Sunday (2026-09-20 is a Sunday)
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 8, 20 + i)));

  const firstDow = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<span></span>');
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const items = calendarItems(iso);
    const cls = ['cal-day', iso === today ? 'is-today' : '', iso === cal.selected ? 'is-selected' : '', items.length ? 'has-items' : ''].join(' ');
    cells.push(`<button type="button" class="${cls}" data-cal-day="${iso}" aria-label="${fmtDate(iso)}">
      ${d}
      ${items.length ? `<span class="cal-dots">${items.slice(0, 3).map((it) => `<i style="background:${it.color}"></i>`).join('')}</span>` : ''}
    </button>`);
  }

  const selItems = calendarItems(cal.selected);
  const rtl = state.lang === 'ar';

  pop.innerHTML = `
    <div class="pop-head">
      <button type="button" class="icon-btn sm" data-cal-nav="-1" aria-label="${t('prevMonth')}">${svg(rtl ? I.chevR : I.chevL)}</button>
      <strong>${monthLabel}</strong>
      <button type="button" class="icon-btn sm" data-cal-nav="1" aria-label="${t('nextMonth')}">${svg(rtl ? I.chevL : I.chevR)}</button>
    </div>
    <div class="cal-grid cal-week">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
    <div class="cal-foot">
      <div class="cal-foot-head">
        <strong>${fmtDate(cal.selected)}</strong>
        <button type="button" class="link-btn" data-cal-today>${t('today')}</button>
      </div>
      ${selItems.length ? `<ul class="cal-items">
        ${selItems.map((it) => `
          <li ${it.project ? `data-project="${it.project}" class="clickable"` : it.task ? `data-open-task="${it.task}" class="clickable"` : ''}>
            <i style="background:${it.color}"></i>
            <span class="ci-title">${esc(it.title)}</span>
            <small>${esc(it.label)}</small>
            ${it.kind === 'event' ? `<button type="button" class="icon-btn xs" data-del-event="${it.id}" aria-label="${t('deleteEvent')}" title="${t('deleteEvent')}">${svg(I.x)}</button>` : ''}
          </li>`).join('')}
      </ul>` : `<p class="pop-empty">${t('nothingScheduled')}</p>`}
      ${cal.adding ? eventFormHTML(draft) : `
        <button type="button" class="btn ghost sm add-event-btn" data-cal-add>${svg(I.plus)} ${t('addEvent')}</button>`}
    </div>`;

  if (cal.adding && focusForm) $('#eventForm [name="title"]')?.focus();
}

function eventFormHTML(d) {
  return `
    <form class="event-form" id="eventForm" novalidate autocomplete="off">
      <label><span>${t('evTitle')}</span>
        <input name="title" maxlength="60" placeholder="${t('evTitlePh')}" value="${esc(d.title || '')}"></label>
      <div class="ev-row">
        <label><span>${t('evDate')}</span>
          <input type="date" name="date" dir="ltr" value="${esc(d.date || cal.selected)}"></label>
        <label><span>${t('evTime')}</span>
          <input type="time" name="time" dir="ltr" value="${esc(d.time || '')}"></label>
      </div>
      <label><span>${t('evProject')}</span>
        <select name="project">
          <option value="">${t('noProject')}</option>
          ${db.projects.map((p) => `<option value="${p.id}" ${d.project === p.id ? 'selected' : ''}>${esc(pick(p.title))}</option>`).join('')}
        </select></label>
      <p class="form-error" id="eventError" hidden></p>
      <div class="ev-actions">
        <button type="button" class="btn ghost sm" data-cal-cancel>${t('cancel')}</button>
        <button type="submit" class="btn primary sm">${t('save')}</button>
      </div>
    </form>`;
}

function submitEventForm(f) {
  const title = f.title.value.trim();
  const err = $('#eventError');
  if (!title) { err.textContent = t('errEvTitle'); err.hidden = false; f.title.focus(); return; }
  if (!f.date.value) { err.textContent = t('errDates'); err.hidden = false; f.date.focus(); return; }
  const date = f.date.value;
  db.userEvents.push({ id: 'u' + uid(), title, date, time: f.time.value || '', project: f.project.value || '' });
  saveDB();
  f.remove();
  cal.adding = false;
  cal.selected = date;
  const d = parseDate(date);
  cal.month = new Date(d.getFullYear(), d.getMonth(), 1);
  renderSide();
  renderPopovers();
  toast(t('eventAdded'));
}

function deleteEvent(id) {
  undoable(t('eventDeleted'), () => {
    if (db.userEvents.some((e) => e.id === id)) db.userEvents = db.userEvents.filter((e) => e.id !== id);
    else if (!db.hiddenEvents.includes(id)) db.hiddenEvents.push(id);
  });
}

/* ---------- Open / close ---------- */
function openPopover(which) {
  const isCal = which === 'cal';
  closePopovers();
  if (isCal) { cal.month = null; cal.selected = null; cal.adding = false; renderCalendar(); } else renderNotifs();
  $(isCal ? '#calPop' : '#notifPop').hidden = false;
  $(isCal ? '#calBtn' : '#notifBtn').setAttribute('aria-expanded', 'true');
}

function openCalendarOn(iso, adding = false) {
  openPopover('cal');
  cal.selected = iso;
  const d = parseDate(iso);
  cal.month = new Date(d.getFullYear(), d.getMonth(), 1);
  cal.adding = adding;
  renderCalendar(adding);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closePopovers() {
  $('#calPop').hidden = true;
  $('#notifPop').hidden = true;
  $('#calBtn').setAttribute('aria-expanded', 'false');
  $('#notifBtn').setAttribute('aria-expanded', 'false');
}

const popoverOpen = () => !$('#calPop').hidden || !$('#notifPop').hidden;

function renderPopovers() {
  if (!$('#calPop').hidden) renderCalendar();
  if (!$('#notifPop').hidden) renderNotifs();
  updateNotifBadge();
}

// Returns true if the click was handled here
function handlePopoverClick(target) {
  if (target.closest('#calBtn')) { $('#calPop').hidden ? openPopover('cal') : closePopovers(); return true; }
  if (target.closest('#notifBtn')) { $('#notifPop').hidden ? openPopover('notif') : closePopovers(); return true; }

  const nav = target.closest('[data-cal-nav]');
  if (nav) {
    cal.month = new Date(cal.month.getFullYear(), cal.month.getMonth() + Number(nav.dataset.calNav), 1);
    renderCalendar();
    return true;
  }
  const day = target.closest('[data-cal-day]');
  if (day) { cal.selected = day.dataset.calDay; cal.dayJump = true; renderCalendar(); return true; }
  if (target.closest('[data-cal-today]')) { cal.month = null; cal.selected = null; renderCalendar(); return true; }
  if (target.closest('[data-cal-add]')) { cal.adding = true; renderCalendar(true); return true; }
  if (target.closest('[data-cal-cancel]')) { cal.adding = false; $('#eventForm')?.remove(); renderCalendar(); return true; }
  const del = target.closest('[data-del-event]');
  if (del) { deleteEvent(del.dataset.delEvent); return true; }

  if (target.closest('[data-mark-all]')) {
    markRead(buildNotifications().map((n) => n.id));
    renderNotifs();
    return true;
  }
  const item = target.closest('[data-notif]');
  if (item) {
    markRead([item.dataset.notif]);
    updateNotifBadge();
    closePopovers();
    if (item.dataset.notifProject) openDetails(item.dataset.notifProject);
    else if (item.dataset.notifTask) openTask(item.dataset.notifTask);
    else if (item.dataset.notifDate) openCalendarOn(item.dataset.notifDate);
    return true;
  }
  // A project/task inside the calendar list: close the popover, the main handler opens it
  if (target.closest('.popover [data-project], .popover [data-open-task]')) closePopovers();
  return false;
}
