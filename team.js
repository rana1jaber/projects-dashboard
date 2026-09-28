'use strict';

/* =====================================================================
   Team members: add, edit (with photo), delete
   ===================================================================== */

let memberPhotoDraft = null;   // photo chosen in the form but not saved yet (null = unchanged, '' = removed)

function renderMemberFormOptions() {
  const form = $('#memberForm');
  const chosenColor = $('input[name="mcolor"]:checked', form)?.value || form.dataset.color || PALETTE[0];
  $('#memberColorPicker').innerHTML = PALETTE.map((c) => `
    <label class="color-opt" style="--sw:${c}" title="${c}">
      <input type="radio" name="mcolor" value="${c}" ${c === chosenColor ? 'checked' : ''} aria-label="${c}">
    </label>`).join('');

  const role = form.mrole.value || form.dataset.mrole || 'dev';
  form.mrole.innerHTML = ROLES.map((r) => `<option value="${r}">${t('role_' + r)}</option>`).join('');
  form.mrole.value = role;

  const st = form.mstatus.value || form.dataset.mstatus || 'online';
  form.mstatus.innerHTML = ['online', 'away', 'offline'].map((s) => `<option value="${s}">${t('st_' + s)}</option>`).join('');
  form.mstatus.value = st;

  renderPhotoPreview();
  const editing = !!state.editMemberId;
  $('#memberFormTitle').textContent = t(editing ? 'editMember' : 'addMember');
  $('#memberSubmit').textContent = t(editing ? 'saveChanges' : 'add');
  $('#memberDelete').hidden = !editing;
}

function renderPhotoPreview() {
  const form = $('#memberForm');
  const m = state.editMemberId ? findMember(state.editMemberId) : null;
  const photo = memberPhotoDraft !== null ? memberPhotoDraft : (m?.photo || '');
  const color = $('input[name="mcolor"]:checked', form)?.value || form.dataset.color || PALETTE[0];
  const name = form.mname.value.trim() || '?';
  $('#photoPreview').innerHTML = photo
    ? `<span class="avatar lg has-photo"><img src="${esc(photo)}" alt=""></span>`
    : `<span class="avatar lg" style="--c:${esc(color)}">${esc(initials(name))}</span>`;
  $('#removePhoto').hidden = !photo;
}

function openMemberForm(editId = null) {
  const form = $('#memberForm');
  const m = editId ? findMember(editId) : null;
  state.editMemberId = m ? m.id : null;
  memberPhotoDraft = null;
  form.reset();
  $('#memberError').hidden = true;
  $('#memberColorPicker').innerHTML = '';
  form.mrole.innerHTML = '';
  form.mstatus.innerHTML = '';
  if (m) {
    form.mname.value = pick(m.name);
    Object.assign(form.dataset, { color: m.color, mrole: m.role, mstatus: m.status });
  } else {
    Object.assign(form.dataset, { color: PALETTE[db.team.length % PALETTE.length], mrole: 'dev', mstatus: 'online' });
  }
  renderMemberFormOptions();
  openModal('memberModal');
  form.mname.focus();
}
modalCloseHooks.memberModal = () => { state.editMemberId = null; memberPhotoDraft = null; };

// Shrink the chosen picture to a small square so it fits in browser storage
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('not an image'));
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function onPhotoChosen(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    memberPhotoDraft = await readPhoto(file);
    $('#memberError').hidden = true;
  } catch (e) {
    const err = $('#memberError');
    err.textContent = t('errPhoto');
    err.hidden = false;
  }
  renderPhotoPreview();
}

function submitMemberForm() {
  const form = $('#memberForm');
  const name = form.mname.value.trim();
  if (!name) {
    const err = $('#memberError');
    err.textContent = t('errName');
    err.hidden = false;
    form.mname.focus();
    return;
  }
  const fields = {
    role: form.mrole.value,
    status: form.mstatus.value,
    color: $('input[name="mcolor"]:checked', form)?.value || PALETTE[0]
  };
  const m = state.editMemberId ? findMember(state.editMemberId) : null;
  const photo = memberPhotoDraft;

  if (m) {
    undoable(t('memberSaved'), () => {
      Object.assign(m, fields);
      m.name = setLocalized(m.name, name);
      if (photo !== null) { if (photo) m.photo = photo; else delete m.photo; }
    });
  } else {
    undoable(t('memberAdded'), () => {
      const nm = { id: 'm' + uid(), name, ...fields };
      if (photo) nm.photo = photo;
      db.team.push(nm);
    });
  }
  closeModal('memberModal');
}

// Removing a member also takes them off projects and un-assigns their tasks
function deleteMember(id) {
  closeModal('memberModal');
  undoable(t('memberDeleted'), () => {
    db.team = db.team.filter((m) => m.id !== id);
    db.projects.forEach((p) => {
      p.members = p.members.filter((mid) => mid !== id);
      if (p.lead === id) p.lead = p.members[0] || '';
      p.tasks.forEach((x) => { if (x.who === id) x.who = ''; });
    });
  });
}
