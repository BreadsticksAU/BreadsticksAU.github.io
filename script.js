// script.js — full client-side app logic (timetable, assessments, flashcards, DnD, Shared Resources)
// IMPORTANT: set WEB_APP_URL to your deployed Apps Script web app URL,
// and set APPSCRIPT_TOKEN locally to the SECRET_TOKEN you set in Apps Script.
// DO NOT commit APPSCRIPT_TOKEN into a public repo.

const WEB_APP_URL = 'https://monumental-gelato-a678ff.netlify.app/';
const APPSCRIPT_TOKEN = 'REPLACE_WITH_SECRET_TOKEN';

// -------------------- Initial data / state --------------------
const INITIAL_TIMETABLE = {
  Monday: [
    { id: 'm1', time: '6:15-7:45am', title: 'Bus: Toowoomba → Ipswich (B1)', location: 'Arrive 7:45am', color: 'blue', notes: '', pinned: false },
    { id: 'm2', time: '10:00am-12:00pm', title: 'NSC1501 – Bioscience', location: 'M102 Teaching Room', color: 'green', notes: '', pinned: false },
    { id: 'm3', time: '1:45-3:15pm', title: 'Bus: Ipswich → Toowoomba (B2)', location: 'Depart 1:45pm', color: 'blue', notes: '', pinned: false }
  ],
  Tuesday: [
    { id: 't1', time: '6:15-7:45am', title: 'Bus: Toowoomba → Ipswich (B1)', location: 'Arrive 7:45am', color: 'blue', notes: '', pinned: false },
    { id: 't2', time: '8:00-10:00am', title: 'PMC1101 – Public Health', location: 'J131 Lecture Theatre', color: 'yellow', notes: '', pinned: false },
    { id: 't3', time: '10:00am-12:00pm', title: 'PMC1110 – Intro to Paramedicine', location: 'J131 Lecture Theatre', color: 'red', notes: '', pinned: false },
    { id: 't4', time: '3:00-5:00pm', title: 'PMC1110 – Intro to Paramedicine', location: 'I113 Teaching Room', color: 'red', notes: '', pinned: false },
    { id: 't5', time: '5:15-6:45pm', title: 'Bus: Ipswich → Toowoomba (B1)', location: 'Depart 5:15pm', color: 'blue', notes: '', pinned: false }
  ],
  Thursday: [
    { id: 'th1', time: '6:15-7:45am', title: 'Bus: Toowoomba → Ipswich (B1)', location: 'Arrive 7:45am', color: 'blue', notes: '', pinned: false },
    { id: 'th2', time: '8:00am-12:00pm', title: 'PMC1110 – Intro to Paramedicine', location: 'I306 Simulated House', color: 'red', notes: '', pinned: false },
    { id: 'th3', time: '2:00-3:00pm', title: 'PMC1101 – Public Health', location: 'I206 Tutorial Room', color: 'yellow', notes: '', pinned: false },
    { id: 'th4', time: '5:15-6:45pm', title: 'Bus: Ipswich → Toowoomba (B1)', location: 'Depart 5:15pm', color: 'blue', notes: '', pinned: false }
  ],
  Friday: [
    { id: 'f1', time: '10:00am-12:00pm', title: 'Bus: Toowoomba → Springfield (B2)', location: 'Arrive 12pm', color: 'blue', notes: '', pinned: false },
    { id: 'f2', time: '1:00-4:00pm', title: 'NSC1501 – Bioscience', location: 'B406 Multi-Purpose Lab (Springfield)', color: 'green', notes: '', pinned: false },
    { id: 'f3', time: '4:45-6:45pm', title: 'Bus: Springfield → Toowoomba (B1)', location: 'Depart 4:45pm', color: 'blue', notes: '', pinned: false }
  ]
};

const STORAGE_KEY = 'uni-hub-v5-state-v1';

let timetable = {};
let assessments = { todo: [], inprogress: [], extension: [], completed: [] };
let flashcards = [];
let importantMessages = [];
let currentTheme = 'light';
let dragGhost = null;
let undoStack = [], redoStack = [];
const MAX_STACK = 50;

// -------------------- Utilities --------------------
function uid(prefix='id') {
  return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

function safeSet(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
    return true;
  } catch (e) {
    console.warn('Failed to save:', e);
    return false;
  }
}
function safeGet(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

function logEvent(title, detail) {
  // simple changelog push; keep minimal
  const now = new Date().toISOString();
  importantMessages.unshift({ title, detail, time: now });
  if (importantMessages.length > 50) importantMessages.pop();
  saveState();
}

// -------------------- Persistence --------------------
function loadState() {
  const s = safeGet(STORAGE_KEY);
  if (s) {
    timetable = s.timetable || JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
    assessments = s.assessments || assessments;
    flashcards = s.flashcards || [];
    currentTheme = s.currentTheme || 'light';
    importantMessages = s.importantMessages || [];
  } else {
    timetable = JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
  }
}

function saveState() {
  const payload = { timetable, assessments, flashcards, currentTheme, importantMessages };
  safeSet(STORAGE_KEY, payload);
}

// -------------------- Time parsing & sorting --------------------
// parseTime handles formats like "1:45-3:15pm", "6:15-7:45am", "10:00am-12:00pm" or "10am"
function parseTime(timeStr) {
  // attempt to extract the start time and normalize to minutes since midnight
  // handle ranges where AM/PM may appear only at the end
  try {
    timeStr = (timeStr || '').trim().toLowerCase();
    if (!timeStr) return 0;
    // If it's a range with hyphen
    let startPart = timeStr;
    if (timeStr.includes('-')) {
      const parts = timeStr.split('-').map(p => p.trim());
      // If second part includes am/pm, and first doesn't, append same suffix
      const start = parts[0];
      const end = parts[1];
      if ((/am|pm/).test(end) && !(/am|pm/).test(start)) {
        // copy suffix from end to start
        const suffix = end.match(/am|pm/)[0];
        startPart = start + suffix;
      } else {
        startPart = start;
      }
    }
    // Ensure meridian presence; default assume am/pm if not present: if hour between 1-6 and we have pm in end maybe.
    // Parse hour/min
    const m = startPart.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!m) return 0;
    let hour = parseInt(m[1], 10);
    let minute = parseInt(m[2] || '0', 10);
    const merd = m[3];
    if (merd) {
      if (merd === 'pm' && hour !== 12) hour += 12;
      if (merd === 'am' && hour === 12) hour = 0;
    } else {
      // no meridian — use heuristic: times 6-11 -> morning (6-11), times 12 -> noon, 1-5 -> afternoon? We'll leave as given.
      // This fallback aims to keep relative ordering correct when times are consistent.
      if (hour === 12) hour = 12;
      // leave others as-is
    }
    return hour * 60 + minute;
  } catch (e) {
    return 0;
  }
}

function sortCardsByTime(arr) {
  arr.sort((a,b) => {
    return parseTime(a.time) - parseTime(b.time);
  });
}

// -------------------- Rendering: Timetable & Assessments --------------------
function renderTimetable() {
  Object.keys(timetable).forEach(day => {
    const container = document.getElementById(day.toLowerCase() + '-cards');
    if (!container) return;
    container.innerHTML = '';
    const cards = timetable[day] || [];
    sortCardsByTime(cards);
    cards.forEach(card => {
      const el = createTimetableCard(card, day);
      container.appendChild(el);
    });
    // append drop indicator placeholder
    const dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
    container.appendChild(dropIndicator);
  });
}

function createTimetableCard(card, day) {
  const el = document.createElement('div');
  el.className = 'timetable-card ' + 'card-' + (card.color || 'blue');
  el.dataset.id = card.id;
  el.dataset.day = day;
  el.draggable = true;
  el.innerHTML = `
    <div class="card-time">${escapeHtml(card.time)}</div>
    <div class="card-title">${escapeHtml(card.title)}</div>
    <div class="card-location">${escapeHtml(card.location)}</div>
  `;
  // event listeners
  el.addEventListener('click', function() {
    openEditModal(card, day);
  });
  el.addEventListener('dragstart', function(e) {
    draggedStart(e, el);
  });
  el.addEventListener('dragend', function(e) {
    draggedEnd(e, el);
  });
  return el;
}

function renderAssessments() {
  ['todo','inprogress','extension','completed'].forEach(status => {
    const container = document.getElementById(status + '-assessments');
    if (!container) return;
    container.innerHTML = '';
    (assessments[status] || []).forEach(a => {
      const el = document.createElement('div');
      el.className = 'assessment-card ' + 'card-' + (a.color || 'purple');
      el.dataset.id = a.id;
      el.dataset.status = status;
      el.draggable = true;
      el.innerHTML = `
        <div class="card-title">${escapeHtml(a.title)}</div>
        <div class="card-course">${escapeHtml(a.course || '')}</div>
        <div class="card-due">${a.due ? escapeHtml(a.due) : ''}</div>
      `;
      el.addEventListener('click', function() {
        openEditAssessmentModal(a, status);
      });
      el.addEventListener('dragstart', function(e) {
        draggedStart(e, el, true);
      });
      el.addEventListener('dragend', function(e) {
        draggedEnd(e, el, true);
      });
      container.appendChild(el);
    });
    const dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
    container.appendChild(dropIndicator);
  });
}

// -------------------- Edit modals (simplified) --------------------
function openEditModal(card, day) {
  editingCard = card;
  editingDay = day;
  document.getElementById('editTime').value = card.time;
  document.getElementById('editTitle').value = card.title;
  document.getElementById('editLocation').value = card.location;
  document.getElementById('editNotes').value = card.notes || '';
  document.getElementById('editModal').classList.remove('hidden');
}

function closeModal() {
  editingCard = null; editingDay = null;
  document.getElementById('editModal').classList.add('hidden');
}

function updateEditingCard() {
  if (!editingCard || !editingDay) return;
  const t = document.getElementById('editTime').value;
  const title = document.getElementById('editTitle').value;
  const loc = document.getElementById('editLocation').value;
  const notes = document.getElementById('editNotes').value;
  const idx = timetable[editingDay].findIndex(c => c.id === editingCard.id);
  if (idx !== -1) {
    timetable[editingDay][idx].time = t;
    timetable[editingDay][idx].title = title;
    timetable[editingDay][idx].location = loc;
    timetable[editingDay][idx].notes = notes;
    saveState();
    renderTimetable();
  }
}

function openEditAssessmentModal(a, status) {
  editingAssessment = a;
  editingStatus = status;
  document.getElementById('editAssessmentTitle').value = a.title || '';
  document.getElementById('editAssessmentCourse').value = a.course || '';
  document.getElementById('editAssessmentDue').value = a.due || '';
  document.getElementById('editAssessmentNotes').value = a.notes || '';
  document.getElementById('editAssessmentModal').classList.remove('hidden');
}

function closeAssessmentModal() {
  editingAssessment = null; editingStatus = null;
  document.getElementById('editAssessmentModal').classList.add('hidden');
}

function updateEditingAssessment() {
  if (!editingAssessment || !editingStatus) return;
  const title = document.getElementById('editAssessmentTitle').value;
  const course = document.getElementById('editAssessmentCourse').value;
  const due = document.getElementById('editAssessmentDue').value;
  const notes = document.getElementById('editAssessmentNotes').value;
  const idx = assessments[editingStatus].findIndex(a => a.id === editingAssessment.id);
  if (idx !== -1) {
    const obj = assessments[editingStatus][idx];
    obj.title = title; obj.course = course; obj.due = due; obj.notes = notes;
    saveState();
    renderAssessments();
  }
}

// -------------------- Add card / assessment helpers --------------------
function addCard(day) {
  const newCard = { id: uid('c'), time: '12:00pm', title: 'New item', location: '', color: 'blue', notes: '', pinned: false };
  timetable[day] = timetable[day] || [];
  timetable[day].push(newCard);
  saveState();
  renderTimetable();
}

function addAssessment(status) {
  const newA = { id: uid('a'), title: 'New assessment', course: '', due: '', notes: '', color: 'purple' };
  assessments[status] = assessments[status] || [];
  assessments[status].push(newA);
  saveState();
  renderAssessments();
}

// -------------------- Drag & Drop (basic inline drop-indicator approach) --------------------
let dragState = {
  source: null, // {type: 'timetable'|'assessment', id, dayOrStatus}
};

function draggedStart(e, el, isAssessment=false) {
  const id = el.dataset.id;
  dragGhost = document.getElementById('dragGhost');
  dragGhost.innerHTML = el.innerHTML;
  dragGhost.classList.remove('hidden');
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
  el.classList.add('dragging');
  dragState.source = {
    type: isAssessment ? 'assessment' : 'timetable',
    id: id,
    origin: isAssessment ? el.dataset.status : el.dataset.day
  };
  // show indicators on containers
  document.querySelectorAll('.cards-container').forEach(c => {
    c.addEventListener('dragover', containerDragOver);
    c.addEventListener('dragleave', containerDragLeave);
    c.addEventListener('drop', containerDrop);
  });
}

function draggedEnd(e, el) {
  el.classList.remove('dragging');
  if (dragGhost) {
    dragGhost.classList.add('hidden');
    dragGhost.innerHTML = '';
  }
  document.querySelectorAll('.drop-indicator').forEach(d => d.classList.remove('active'));
  document.querySelectorAll('.cards-container').forEach(c => {
    c.removeEventListener('dragover', containerDragOver);
    c.removeEventListener('dragleave', containerDragLeave);
    c.removeEventListener('drop', containerDrop);
  });
  dragState = { source: null };
  saveState();
}

function containerDragOver(e) {
  e.preventDefault();
  const container = e.currentTarget;
  // show drop indicator as last child
  const indicator = container.querySelector('.drop-indicator');
  if (indicator) indicator.classList.add('active');
}

function containerDragLeave(e) {
  const container = e.currentTarget;
  const indicator = container.querySelector('.drop-indicator');
  if (indicator) indicator.classList.remove('active');
}

function containerDrop(e) {
  e.preventDefault();
  const container = e.currentTarget;
  const indicator = container.querySelector('.drop-indicator');
  if (indicator) indicator.classList.remove('active');
  const targetContainerId = container.id; // e.g. monday-cards or todo-assessments
  if (!dragState.source) return;

  // determine destination
  if (targetContainerId.endsWith('-cards')) {
    // timetable destination -> day = id before '-cards'
    const day = targetContainerId.replace('-cards','');
    moveTimetableItem(dragState.source, day);
  } else if (targetContainerId.endsWith('-assessments')) {
    const status = targetContainerId.replace('-assessments','');
    moveAssessmentItem(dragState.source, status);
  }
  renderTimetable();
  renderAssessments();
}

function moveTimetableItem(source, destDay) {
  if (source.type !== 'timetable') return;
  const originDay = source.origin;
  if (!timetable[originDay]) return;
  const idx = timetable[originDay].findIndex(c => c.id === source.id);
  if (idx === -1) return;
  const card = timetable[originDay].splice(idx,1)[0];
  timetable[destDay] = timetable[destDay] || [];
  timetable[destDay].push(card);
  logEvent('Card moved', card.title + ' moved to ' + destDay);
  saveState();
}

function moveAssessmentItem(source, destStatus) {
  if (source.type !== 'assessment') return;
  const originStatus = source.origin;
  if (!assessments[originStatus]) return;
  const idx = assessments[originStatus].findIndex(a => a.id === source.id);
  if (idx === -1) return;
  const a = assessments[originStatus].splice(idx,1)[0];
  assessments[destStatus] = assessments[destStatus] || [];
  assessments[destStatus].push(a);
  logEvent('Assessment moved', a.title + ' moved to ' + destStatus);
  saveState();
}

// -------------------- Flashcards --------------------
function renderFlashcards() {
  const list = document.getElementById('flashcardsList');
  if (!list) return;
  list.innerHTML = '';
  flashcards.forEach(fc => {
    const card = document.createElement('div');
    card.className = 'flash-card';
    card.dataset.id = fc.id;
    card.innerHTML = `
      <div class="course">${escapeHtml(fc.course || '')}</div>
      <div class="question">${escapeHtml(fc.question)}</div>
      <div class="answer">${escapeHtml(fc.answer)}</div>
      <div class="reveal-overlay">Tap to reveal</div>
    `;
    // Reveal flow: click => start 5s countdown then reveal
    card.addEventListener('click', function() {
      if (card.classList.contains('revealed')) return;
      startRevealCountdown(card, fc.id);
    });
    // small delete button
    const ctrl = document.createElement('div');
    ctrl.className = 'controls';
    const del = document.createElement('button');
    del.className = 'small-btn';
    del.textContent = 'Delete';
    del.addEventListener('click', function(ev) {
      ev.stopPropagation();
      deleteFlashcard(fc.id);
    });
    ctrl.appendChild(del);
    card.appendChild(ctrl);
    list.appendChild(card);
  });
}

function startRevealCountdown(cardEl, id) {
  const overlay = cardEl.querySelector('.reveal-overlay');
  let remaining = 5;
  overlay.textContent = remaining + 's';
  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(interval);
      cardEl.classList.add('revealed');
      overlay.style.display = 'none';
    } else {
      overlay.textContent = remaining + 's';
    }
  }, 1000);
}

function saveFlashcard() {
  const course = document.getElementById('flashCourse').value.trim();
  const question = document.getElementById('flashQuestion').value.trim();
  const answer = document.getElementById('flashAnswer').value.trim();
  if (!question) return alert('Add a question');
  const newFc = { id: uid('fc'), course, question, answer };
  flashcards.push(newFc);
  saveState();
  renderFlashcards();
  closeAddFlashcardModal();
}

function deleteFlashcard(id) {
  flashcards = flashcards.filter(f => f.id !== id);
  saveState();
  renderFlashcards();
}

function openAddFlashcardModal() {
  document.getElementById('flashCourse').value = '';
  document.getElementById('flashQuestion').value = '';
  document.getElementById('flashAnswer').value = '';
  document.getElementById('addFlashcardModal').classList.remove('hidden');
}
function closeAddFlashcardModal() {
  document.getElementById('addFlashcardModal').classList.add('hidden');
}

// -------------------- Shared Resources (Apps Script integration) --------------------
function setupSharedResourcesUI() {
  const dropArea = document.getElementById('uploadDropArea');
  const addBtn = document.getElementById('addResourceBtn');
  const modal = document.getElementById('resourceModal');
  let pendingFile = null;
  if (!dropArea || !addBtn || !modal) return;

  function openModalForFile(file) {
    pendingFile = file;
    const preview = document.getElementById('resourcePreview');
    preview.innerHTML = `<div style="font-size:13px; margin-bottom:8px;">File: ${escapeHtml(file.name)} (${Math.round(file.size/1024)} KB)</div>`;
    document.getElementById('resourceTitle').value = file.name;
    modal.classList.remove('hidden');
  }

  dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.style.background = 'rgba(0,0,0,0.02)'; });
  dropArea.addEventListener('dragleave', e => { dropArea.style.background = ''; });
  dropArea.addEventListener('drop', e => {
    e.preventDefault();
    dropArea.style.background = '';
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) openModalForFile(f);
  });

  addBtn.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.onchange = () => { if (inp.files && inp.files[0]) openModalForFile(inp.files[0]); };
    inp.click();
  });

  document.getElementById('cancelUploadBtn').addEventListener('click', () => { modal.classList.add('hidden'); pendingFile = null; });
  document.getElementById('closeResourceModal').addEventListener('click', () => { modal.classList.add('hidden'); pendingFile = null; });

  document.getElementById('confirmUploadBtn').addEventListener('click', () => {
    if (!pendingFile) return;
    const friendlyTitle = (document.getElementById('resourceTitle').value || pendingFile.name).trim();
    const reader = new FileReader();
    reader.onload = function(evt) {
      const dataUrl = evt.target.result;
      const base64 = dataUrl.split(',')[1];
      const approxBytes = (base64.length * 3 / 4);
      if (approxBytes > 30 * 1024 * 1024) {
        alert('File is too large for the Apps Script uploader (recommended < 30 MB).');
        return;
      }
      const progressEl = document.getElementById('uploadProgress');
      progressEl.textContent = 'Uploading...';
      fetch(WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: pendingFile.name,
          mimeType: pendingFile.type,
          base64: base64,
          title: friendlyTitle,
          uploaderName: (getSignedInUserEmail() || 'You')
        })
      }).then(r => r.json()).then(res => {
        if (res && res.success) {
          progressEl.textContent = 'Upload complete';
          modal.classList.add('hidden');
          pendingFile = null;
          loadSharedList();
        } else {
          progressEl.textContent = 'Upload failed: ' + (res && res.error ? res.error : 'unknown');
        }
      }).catch(err => {
        progressEl.textContent = 'Upload error: ' + err.message;
      });
    };
    reader.readAsDataURL(pendingFile);
  });

  // Initial load
  loadSharedList();
}

function loadSharedList() {
  const listEl = document.getElementById('sharedList');
  if (!listEl) return;
  listEl.innerHTML = 'Loading...';
  fetch(WEB_APP_URL, { method: 'GET' })
    .then(r => r.json())
    .then(json => {
      if (!json.success) {
        listEl.innerHTML = '<div style="color:var(--text-secondary);">Failed to fetch list: ' + (json.error || '') + '</div>';
        return;
      }
      const items = json.items || [];
      if (!items.length) {
        listEl.innerHTML = '<div style="color:var(--text-secondary);">No shared files yet.</div>';
        return;
      }
      listEl.innerHTML = '';
      items.reverse();
      items.forEach(i => {
        const card = document.createElement('div');
        card.className = 'flash-card';
        const title = i.title || i.filename || 'Untitled';
        const uploader = i.uploader || '';
        const createdAt = i.createdAt ? new Date(i.createdAt).toLocaleString() : '';
        card.innerHTML = `<div class="course">${escapeHtml(uploader)}</div>
                          <div class="question" style="font-size:14px;">${escapeHtml(title)}</div>
                          <div style="margin-top:8px;"><a href="${i.downloadUrl}" target="_blank" rel="noopener noreferrer">Open</a> &nbsp; <span style="color:var(--text-secondary); font-size:12px;">${createdAt}</span></div>`;
        listEl.appendChild(card);
      });
    })
    .catch(err => { listEl.innerHTML = 'Error loading list: ' + err.message; });
}

// -------------------- Minimal auth helper (client-side only) --------------------
// This is a best-effort helper: when page served under Google domain cookies, Apps Script may know user.
// We offer a client-side stub for uploader name; it's not authoritative.
function getSignedInUserEmail() {
  // no reliable client-side method without Google Identity integration; return null
  return null;
}

// -------------------- Theme --------------------
function setTheme(t) {
  currentTheme = t;
  document.body.classList.remove('dark-mode','vanta-black-mode');
  if (t === 'dark') document.body.classList.add('dark-mode');
  if (t === 'vanta') document.body.classList.add('vanta-black-mode');
  saveState();
}

// -------------------- Helper: sanitize --------------------
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// -------------------- Init --------------------
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderTimetable();
  renderAssessments();
  renderFlashcards();
  try { setupSharedResourcesUI(); } catch (e) { /* no-op */ }
  // Wire basic UI controls we rely on being present:
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) sidebarToggle.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));
  const addFlashBtn = document.getElementById('addFlashcardBtn');
  if (addFlashBtn) addFlashBtn.addEventListener('click', openAddFlashcardModal);
  const saveFlash = document.getElementById('saveFlashcardBtn');
  if (saveFlash) saveFlash.addEventListener('click', saveFlashcard);
  const cancelFlash = document.getElementById('cancelFlashcardBtn');
  if (cancelFlash) cancelFlash.addEventListener('click', closeAddFlashcardModal);
  // Modal close handlers
  const closeModalBtn = document.getElementById('closeModal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  const closeAssessmentBtn = document.getElementById('closeAssessmentModal');
  if (closeAssessmentBtn) closeAssessmentBtn.addEventListener('click', closeAssessmentModal);
  // Bind delete buttons if present
  const deleteCardBtn = document.getElementById('deleteCard');
  if (deleteCardBtn) deleteCardBtn.addEventListener('click', function() {
    if (!editingCard || !editingDay) return;
    timetable[editingDay] = timetable[editingDay].filter(c => c.id !== editingCard.id);
    saveState();
    renderTimetable();
    closeModal();
  });
  const deleteAssessmentBtn = document.getElementById('deleteAssessment');
  if (deleteAssessmentBtn) deleteAssessmentBtn.addEventListener('click', function() {
    if (!editingAssessment || !editingStatus) return;
    assessments[editingStatus] = assessments[editingStatus].filter(a => a.id !== editingAssessment.id);
    saveState();
    renderAssessments();
    closeAssessmentModal();
  });
});
