'use strict';

/* =====================================================================
   Export: Excel (CSV) files and print / save as PDF
   ===================================================================== */

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// When the page is opened inside the Claude viewer, files are saved through its own
// save feature; everywhere else (GitHub Pages, your computer) a normal download is used.
let claudeDownloads = null;
if (window.claude && typeof window.claude.use === 'function') {
  window.claude.use('downloads').then((d) => { claudeDownloads = d; }).catch(() => {});
}

async function downloadCSV(filename, rows) {
  // The BOM (\uFEFF) at the start makes Excel read Arabic text correctly
  const text = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  if (claudeDownloads) {
    try {
      await claudeDownloads.save({ filename, data: blob });
      toast(t('exported'));
    } catch (e) { /* the viewer declined, or saving is not possible here */ }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('exported'));
}

const memberName = (id) => { const m = findMember(id); return m ? pick(m.name) : ''; };

function exportProjects() {
  const rows = [[t('colName'), t('colStatus'), t('colPriority'), t('colStart'), t('colDue'),
    t('colProgress'), t('colLead'), t('colMembers'), t('colTasks')]];
  db.projects.forEach((p) => {
    rows.push([
      pick(p.title), t('status_' + p.status), t('prioShort_' + p.priority), p.start, p.due,
      progressOf(p), memberName(p.lead),
      p.members.map(memberName).filter(Boolean).join(' / '),
      `${p.tasks.filter(isDone).length}/${p.tasks.length}`
    ]);
  });
  downloadCSV(`projects-${todayISO()}.csv`, rows);
}

function exportTasks() {
  const rows = [[t('colTask'), t('colProject'), t('colStatus'), t('colPriority'), t('colAssignee'), t('colDue'), t('colComments')]];
  allTasks().forEach((x) => {
    rows.push([pick(x.title), pick(x.project.title), t('tstatus_' + x.status), t('prioShort_' + x.priority),
      memberName(x.who), x.due, x.comments.length]);
  });
  downloadCSV(`tasks-${todayISO()}.csv`, rows);
}

// Print always uses the light theme so it looks good on paper
function printReport() {
  const wasDark = state.theme === 'dark';
  if (wasDark) delete document.documentElement.dataset.theme;
  const restore = () => {
    if (wasDark) document.documentElement.dataset.theme = 'dark';
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
  setTimeout(restore, 1000);
}
