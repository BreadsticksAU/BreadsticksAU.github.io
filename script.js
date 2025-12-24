// Initial timetable data
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

// State management
var timetable = {};
var assessments = {};
var importantMessages = [];
var changelog = [];
var currentTheme = 'light';
var sidebarCollapsed = false;
var editingCard = null;
var editingDay = null;
var editingAssessment = null;
var editingStatus = null;
var undoHistory = [];
var historyIndex = -1;
var MAX_HISTORY = 50;
var draggedCard = null;
var draggedFromDay = null;
var draggedAssessment = null;
var draggedFromStatus = null;
var dragGhost = null;
var carouselInterval = null;
var currentMessageIndex = 0;
var userIdleTimeout = null;
var lastActivityTime = Date.now();
var currentDropIndicator = null;

// Safe localStorage wrapper
function safeLocalStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error('LocalStorage error:', e);
        if (e.name === 'QuotaExceededError') {
            changelog = changelog.slice(0, 20);
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e2) {
                return false;
            }
        }
        return false;
    }
}

function safeLocalStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.error('LocalStorage read error:', e);
        return null;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadState();
    checkWeeklyReset();
    setupEventListeners();
    renderTimetable();
    renderAssessments();
    renderChangelog();
    renderMessages();
    updateMessageCarousel();
    startCarousel();
    updateUndoRedoButtons();
    dragGhost = document.getElementById('dragGhost');
    setupActivityTracking();
    applyTheme();
    logEvent('Page loaded', 'Application started', new Date().toLocaleString());
});

// Event Listeners Setup
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        sidebarCollapsed = !sidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed');
        saveState();
    });
    
    // Tab navigation
    document.querySelectorAll('.nav-item').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = btn.dataset.tab;
            document.querySelectorAll('.nav-item').forEach(function(b) {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(function(content) {
                content.classList.remove('active');
            });
            document.getElementById(tab + 'Content').classList.add('active');
        });
    });
    
    // Theme toggle in sidebar
    document.getElementById('themeToggle').addEventListener('click', function() {
        if (currentTheme === 'light') {
            setTheme('dark');
        } else if (currentTheme === 'dark') {
            setTheme('vanta');
        } else {
            setTheme('light');
        }
    });
    
    // Theme options in themes tab
    document.querySelectorAll('.theme-option').forEach(function(option) {
        option.addEventListener('click', function() {
            setTheme(option.dataset.theme);
        });
    });
    
    // Undo/Redo buttons
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    
    // Add card buttons
    document.querySelectorAll('.add-card-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var day = btn.dataset.day;
            addCard(day);
        });
    });
    
    // Add assessment buttons
    document.querySelectorAll('.add-assessment-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var status = btn.dataset.status;
            addAssessment(status);
        });
    });
    
    // Modal close buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('closeAssessmentModal').addEventListener('click', closeAssessmentModal);
    
    // Click outside modal to close
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.getElementById('editAssessmentModal').addEventListener('click', function(e) {
        if (e.target === this) closeAssessmentModal();
    });
    
    // Edit inputs
    document.getElementById('editTime').addEventListener('input', updateEditingCard);
    document.getElementById('editTitle').addEventListener('input', updateEditingCard);
    document.getElementById('editLocation').addEventListener('input', updateEditingCard);
    document.getElementById('editNotes').addEventListener('input', updateEditingCard);
    
    document.getElementById('editAssessmentTitle').addEventListener('input', updateEditingAssessment);
    document.getElementById('editAssessmentCourse').addEventListener('input', updateEditingAssessment);
    document.getElementById('editAssessmentDue').addEventListener('input', updateEditingAssessment);
    document.getElementById('editAssessmentNotes').addEventListener('input', updateEditingAssessment);
    
    // Color picker buttons
    document.querySelectorAll('.color-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (!editingCard || !editingDay) return;
            var color = btn.dataset.color;
            document.querySelectorAll('.color-btn').forEach(function(b) {
                b.classList.remove('selected');
            });
            btn.classList.add('selected');
            var idx = timetable[editingDay].findIndex(function(c) { return c.id === editingCard.id; });
            timetable[editingDay][idx].color = color;
            saveState();
            renderTimetable();
        });
    });
    
    // Delete buttons
    document.getElementById('deleteCard').addEventListener('click', function() {
        if (!editingCard || !editingDay) return;
        saveToHistory();
        timetable[editingDay] = timetable[editingDay].filter(function(c) {
            return c.id !== editingCard.id;
        });
        logEvent('Card deleted', editingCard.title + ' deleted from ' + editingDay, new Date().toLocaleString());
        saveState();
        renderTimetable();
        closeModal();
    });
    
    document.getElementById('deleteAssessment').addEventListener('click', function() {
        if (!editingAssessment || !editingStatus) return;
        saveToHistory();
        assessments[editingStatus] = assessments[editingStatus].filter(function(a) {
            return a.id !== editingAssessment.id;
        });
        logEvent('Assessment deleted', editingAssessment.title + ' deleted from ' + editingStatus, new Date().toLocaleString());
        saveState();
        renderAssessments();
        closeAssessmentModal();
    });
    
    // Important messages
    document.getElementById('addMessageBtn').addEventListener('click', function() {
        var input = document.getElementById('newMessageInput');
        var message = input.value.trim();
        if (message) {
            saveToHistory();
            importantMessages.push(message);
            input.value = '';
            saveState();
            renderMessages();
            updateMessageCarousel();
            logEvent('Message added', message, new Date().toLocaleString());
        }
    });
    
    // Settings buttons
    document.getElementById('resetTimetable').addEventListener('click', function() {
        if (confirm('Are you sure you want to reset the timetable to default?')) {
            resetTimetable();
        }
    });
    
    document.getElementById('clearChangelog').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear the changelog?')) {
            changelog = [];
            saveState();
            renderChangelog();
            logEvent('Changelog cleared', 'All changelog entries were deleted', new Date().toLocaleString());
        }
    });
    
    document.getElementById('clearHistory').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear undo/redo history?')) {
            undoHistory = [];
            historyIndex = -1;
            updateUndoRedoButtons();
            logEvent('History cleared', 'Undo/redo history was cleared', new Date().toLocaleString());
        }
    });
    
    document.getElementById('clearMessages').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all important messages?')) {
            saveToHistory();
            importantMessages = [];
            currentMessageIndex = 0;
            saveState();
            renderMessages();
            updateMessageCarousel();
            logEvent('Messages cleared', 'All important messages were deleted', new Date().toLocaleString());
        }
    });
}

// Add card function
function addCard(day) {
    saveToHistory();
    var newCard = {
        id: 'card_' + Date.now(),
        time: '9:00am-10:00am',
        title: 'New Card',
        location: 'Location',
        color: 'blue',
        notes: '',
        pinned: false
    };
    timetable[day].push(newCard);
    timetable[day] = sortCardsByTime(timetable[day]);
    saveState();
    renderTimetable();
    logEvent('Card added', 'New card added to ' + day, new Date().toLocaleString());
}

// Add assessment function
function addAssessment(status) {
    saveToHistory();
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    var dateStr = tomorrow.toISOString().slice(0, 16);
    
    var newAssessment = {
        id: 'assessment_' + Date.now(),
        title: 'New Assessment',
        course: 'Course Code',
        dueDate: dateStr,
        notes: ''
    };
    assessments[status].push(newAssessment);
    assessments[status] = sortAssessmentsByUrgency(assessments[status]);
    saveState();
    renderAssessments();
    logEvent('Assessment added', 'New assessment added to ' + status, new Date().toLocaleString());
}

// Toggle pin function
function togglePin(cardId, day) {
    saveToHistory();
    var idx = timetable[day].findIndex(function(c) { return c.id === cardId; });
    if (idx !== -1) {
        timetable[day][idx].pinned = !timetable[day][idx].pinned;
        timetable[day] = sortCardsByTime(timetable[day]);
        saveState();
        renderTimetable();
        var action = timetable[day][idx].pinned ? 'pinned' : 'unpinned';
        logEvent('Card ' + action, timetable[day][idx].title + ' ' + action + ' in ' + day, new Date().toLocaleString());
    }
}

// Duplicate card function
function duplicateCard(cardId, day) {
    saveToHistory();
    var idx = timetable[day].findIndex(function(c) { return c.id === cardId; });
    if (idx !== -1) {
        var original = timetable[day][idx];
        var duplicate = {
            id: 'card_' + Date.now(),
            time: original.time,
            title: original.title + ' (Copy)',
            location: original.location,
            color: original.color,
            notes: original.notes,
            pinned: false
        };
        timetable[day].push(duplicate);
        timetable[day] = sortCardsByTime(timetable[day]);
        saveState();
        renderTimetable();
        logEvent('Card duplicated', original.title + ' duplicated in ' + day, new Date().toLocaleString());
    }
}

// Duplicate assessment function
function duplicateAssessment(assessmentId, status) {
    saveToHistory();
    var idx = assessments[status].findIndex(function(a) { return a.id === assessmentId; });
    if (idx !== -1) {
        var original = assessments[status][idx];
        var duplicate = {
            id: 'assessment_' + Date.now(),
            title: original.title + ' (Copy)',
            course: original.course,
            dueDate: original.dueDate,
            notes: original.notes
        };
        assessments[status].push(duplicate);
        assessments[status] = sortAssessmentsByUrgency(assessments[status]);
        saveState();
        renderAssessments();
        logEvent('Assessment duplicated', original.title + ' duplicated in ' + status, new Date().toLocaleString());
    }
}

// Reset timetable function
function resetTimetable(isAutoReset) {
    saveToHistory();
    timetable = JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
    saveState();
    renderTimetable();
    var resetType = isAutoReset ? 'Weekly auto-reset performed' : 'Manual reset to default';
    logEvent('Timetable reset', resetType, new Date().toLocaleString());
}

function updateEditingCard() {
    if (!editingCard || !editingDay) return;
    var cardIndex = timetable[editingDay].findIndex(function(c) { return c.id === editingCard.id; });
    timetable[editingDay][cardIndex].time = document.getElementById('editTime').value;
    timetable[editingDay][cardIndex].title = document.getElementById('editTitle').value;
    timetable[editingDay][cardIndex].location = document.getElementById('editLocation').value;
    timetable[editingDay][cardIndex].notes = document.getElementById('editNotes').value;
    timetable[editingDay] = sortCardsByTime(timetable[editingDay]);
    saveState();
    renderTimetable();
}

function updateEditingAssessment() {
    if (!editingAssessment || !editingStatus) return;
    var idx = assessments[editingStatus].findIndex(function(a) { return a.id === editingAssessment.id; });
    assessments[editingStatus][idx].title = document.getElementById('editAssessmentTitle').value;
    assessments[editingStatus][idx].course = document.getElementById('editAssessmentCourse').value;
    assessments[editingStatus][idx].dueDate = document.getElementById('editAssessmentDue').value;
    assessments[editingStatus][idx].notes = document.getElementById('editAssessmentNotes').value;
    assessments[editingStatus] = sortAssessmentsByUrgency(assessments[editingStatus]);
    saveState();
    renderAssessments();
}

function openModal(card, day) {
    editingCard = card;
    editingDay = day;
    document.getElementById('editTime').value = card.time;
    document.getElementById('editTitle').value = card.title;
    document.getElementById('editLocation').value = card.location;
    document.getElementById('editNotes').value = card.notes;
    var colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(function(btn) {
        btn.classList.toggle('selected', btn.dataset.color === card.color);
    });
    document.getElementById('editModal').classList.remove('hidden');
}

function closeModal() {
    if (editingCard && editingDay) {
        saveToHistory();
        var idx = timetable[editingDay].findIndex(function(c) { return c.id === editingCard.id; });
        if (idx !== -1) {
            var card = timetable[editingDay][idx];
            logEvent('Card edited', card.title + ' edited in ' + editingDay + ' at ' + card.time, new Date().toLocaleString());
        }
    }
    var modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    editingCard = null;
    editingDay = null;
}

function openAssessmentModal(assessment, status) {
    editingAssessment = assessment;
    editingStatus = status;
    document.getElementById('editAssessmentTitle').value = assessment.title;
    document.getElementById('editAssessmentCourse').value = assessment.course;
    document.getElementById('editAssessmentDue').value = assessment.dueDate;
    document.getElementById('editAssessmentNotes').value = assessment.notes;
    document.getElementById('editAssessmentModal').classList.remove('hidden');
}

function closeAssessmentModal() {
    if (editingAssessment && editingStatus) {
        saveToHistory();
        var idx = assessments[editingStatus].findIndex(function(a) { return a.id === editingAssessment.id; });
        if (idx !== -1) {
            var assessment = assessments[editingStatus][idx];
            logEvent('Assessment edited', assessment.title + ' edited in ' + editingStatus + ' (Due: ' + new Date(assessment.dueDate).toLocaleString() + ')', new Date().toLocaleString());
        }
    }
    var modal = document.getElementById('editAssessmentModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    editingAssessment = null;
    editingStatus = null;
}

function renderMessages() {
    var container = document.getElementById('messagesList');
    container.innerHTML = '';
    
    if (importantMessages.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No important messages yet.</p>';
        return;
    }
    
    importantMessages.forEach(function(message, index) {
        var messageEl = document.createElement('div');
        messageEl.className = 'message-item';
        
        var textEl = document.createElement('div');
        textEl.className = 'message-text';
        textEl.textContent = message;
        
        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'message-delete';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = '<svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        deleteBtn.addEventListener('click', function() {
            saveToHistory();
            importantMessages.splice(index, 1);
            if (currentMessageIndex >= importantMessages.length && currentMessageIndex > 0) {
                currentMessageIndex = importantMessages.length - 1;
            }
            saveState();
            renderMessages();
            updateMessageCarousel();
            logEvent('Message deleted', message, new Date().toLocaleString());
        });
        
        messageEl.appendChild(textEl);
        messageEl.appendChild(deleteBtn);
        container.appendChild(messageEl);
    });
}

// Load state
function loadState() {
    var saved = safeLocalStorageGet('universityTimetable');
    if (saved) {
        try {
            timetable = JSON.parse(saved);
        } catch (e) {
            timetable = JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
        }
    } else {
        timetable = JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
    }
    
    saved = safeLocalStorageGet('universityAssessments');
    if (saved) {
        try {
            assessments = JSON.parse(saved);
        } catch (e) {
            assessments = { todo: [], inprogress: [], extension: [], completed: [] };
        }
    } else {
        assessments = { todo: [], inprogress: [], extension: [], completed: [] };
    }
    
    saved = safeLocalStorageGet('universityMessages');
    if (saved) {
        try {
            importantMessages = JSON.parse(saved);
        } catch (e) {
            importantMessages = [];
        }
    } else {
        importantMessages = [];
    }
    
    saved = safeLocalStorageGet('universityChangelog');
    if (saved) {
        try {
            changelog = JSON.parse(saved);
        } catch (e) {
            changelog = [];
        }
    } else {
        changelog = [];
    }
    
    currentTheme = safeLocalStorageGet('universityTheme') || 'light';
    sidebarCollapsed = safeLocalStorageGet('sidebarCollapsed') === 'true';
    
    if (sidebarCollapsed) {
        document.getElementById('sidebar').classList.add('collapsed');
    }
}

// Save state
function saveState() {
    safeLocalStorageSet('universityTimetable', JSON.stringify(timetable));
    safeLocalStorageSet('universityAssessments', JSON.stringify(assessments));
    safeLocalStorageSet('universityMessages', JSON.stringify(importantMessages));
    safeLocalStorageSet('universityChangelog', JSON.stringify(changelog));
    safeLocalStorageSet('universityTheme', currentTheme);
    safeLocalStorageSet('sidebarCollapsed', sidebarCollapsed);
}

// Theme management
function applyTheme() {
    var body = document.body;
    body.classList.remove('dark-mode', 'vanta-black-mode');
    
    if (currentTheme === 'dark') {
        body.classList.add('dark-mode');
        document.getElementById('sunIcon').classList.add('hidden');
        document.getElementById('moonIcon').classList.remove('hidden');
    } else if (currentTheme === 'vanta') {
        body.classList.add('vanta-black-mode');
        document.getElementById('sunIcon').classList.add('hidden');
        document.getElementById('moonIcon').classList.remove('hidden');
    } else {
        document.getElementById('sunIcon').classList.remove('hidden');
        document.getElementById('moonIcon').classList.add('hidden');
    }
    
    // Update theme selector
    document.querySelectorAll('.theme-option').forEach(function(option) {
        option.classList.toggle('active', option.dataset.theme === currentTheme);
    });
}

function setTheme(theme) {
    currentTheme = theme;
    applyTheme();
    saveState();
    logEvent('Theme changed', 'Switched to ' + theme + ' mode', new Date().toLocaleString());
}

// Weekly reset check
function checkWeeklyReset() {
    var lastReset = safeLocalStorageGet('lastTimetableReset');
    var now = new Date();
    var aestOffset = 10 * 60;
    var localOffset = now.getTimezoneOffset();
    var aestTime = new Date(now.getTime() + (aestOffset + localOffset) * 60000);
    var currentDay = aestTime.getDay();
    
    if (lastReset) {
        var lastResetDate = new Date(parseInt(lastReset));
        var lastResetAEST = new Date(lastResetDate.getTime() + (aestOffset + localOffset) * 60000);
        var daysSinceLastReset = Math.floor((aestTime - lastResetAEST) / (1000 * 60 * 60 * 24));
        
        if (currentDay === 0 && daysSinceLastReset >= 7) {
            resetTimetable(true);
            importantMessages = [];
            saveState();
            safeLocalStorageSet('lastTimetableReset', now.getTime().toString());
        }
    } else {
        safeLocalStorageSet('lastTimetableReset', now.getTime().toString());
    }
}

// History management
function saveToHistory() {
    var state = {
        timetable: JSON.parse(JSON.stringify(timetable)),
        assessments: JSON.parse(JSON.stringify(assessments)),
        messages: JSON.parse(JSON.stringify(importantMessages))
    };
    
    undoHistory = undoHistory.slice(0, historyIndex + 1);
    undoHistory.push(state);
    
    if (undoHistory.length > MAX_HISTORY) {
        undoHistory.shift();
    } else {
        historyIndex++;
    }
    
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        var state = undoHistory[historyIndex];
        timetable = JSON.parse(JSON.stringify(state.timetable));
        assessments = JSON.parse(JSON.stringify(state.assessments));
        importantMessages = JSON.parse(JSON.stringify(state.messages));
        saveState();
        renderTimetable();
        renderAssessments();
        renderMessages();
        updateMessageCarousel();
        updateUndoRedoButtons();
        logEvent('Undo action', 'Reverted to previous state', new Date().toLocaleString());
    }
}

function redo() {
    if (historyIndex < undoHistory.length - 1) {
        historyIndex++;
        var state = undoHistory[historyIndex];
        timetable = JSON.parse(JSON.stringify(state.timetable));
        assessments = JSON.parse(JSON.stringify(state.assessments));
        importantMessages = JSON.parse(JSON.stringify(state.messages));
        saveState();
        renderTimetable();
        renderAssessments();
        renderMessages();
        updateMessageCarousel();
        updateUndoRedoButtons();
        logEvent('Redo action', 'Restored next state', new Date().toLocaleString());
    }
}

function updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('redoBtn').disabled = historyIndex >= undoHistory.length - 1;
}

// Improved time parsing for proper AM/PM sorting
function parseTime(timeStr) {
    // Accept ranges like "6:15-7:45am", "1:45-3:15pm", "10:00am-12:00pm", or single times.
    // If start part lacks am/pm, inherit am/pm from end part when possible.
    var parts = timeStr.split('-').map(function(p){ return p.trim(); });
    var startPart = parts[0] || '';
    var endPart = parts[1] || '';
    
    // Detect AM/PM on start
    var startMatch = startPart.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    var endMatch = endPart.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    
    // If start doesn't have am/pm but end does, append end's period to start for parsing.
    if (!startMatch && endMatch) {
        startPart = startPart + (endMatch[3] ? endMatch[3].toLowerCase() : '');
        startMatch = startPart.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    }
    
    if (!startMatch) {
        // Try to parse plain hour:minute without am/pm as local time day morning (fallback)
        var genericMatch = parts[0].match(/(\d{1,2}):?(\d{2})?/);
        if (!genericMatch) return 0;
        var hours = parseInt(genericMatch[1]);
        var minutes = genericMatch[2] ? parseInt(genericMatch[2]) : 0;
        return hours * 60 + minutes;
    }
    
    var hours = parseInt(startMatch[1]);
    var minutes = startMatch[2] ? parseInt(startMatch[2]) : 0;
    var period = startMatch[3].toLowerCase();
    
    if (period === 'pm' && hours !== 12) {
        hours += 12;
    } else if (period === 'am' && hours === 12) {
        hours = 0;
    }
    
    return hours * 60 + minutes;
}

function sortCardsByTime(cards) {
    return cards.slice().sort(function(a, b) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
        var timeA = parseTime(a.time);
        var timeB = parseTime(b.time);
        return timeA - timeB;
    });
}

// Urgency calculation
function calculateUrgency(dueDate) {
    if (!dueDate) return 'green';
    
    var now = new Date();
    var due = new Date(dueDate);
    var diffTime = due - now;
    var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'red';
    if (diffDays <= 2) return 'red';
    if (diffDays <= 7) return 'orange';
    if (diffDays <= 14) return 'yellow';
    return 'green';
}

function sortAssessmentsByUrgency(items) {
    var urgencyOrder = { red: 0, orange: 1, yellow: 2, green: 3 };
    return items.slice().sort(function(a, b) {
        var urgencyA = calculateUrgency(a.dueDate);
        var urgencyB = calculateUrgency(b.dueDate);
        
        if (urgencyOrder[urgencyA] !== urgencyOrder[urgencyB]) {
            return urgencyOrder[urgencyA] - urgencyOrder[urgencyB];
        }
        
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
}

// Changelog
function logEvent(summary, details, timestamp) {
    var time = timestamp || new Date().toLocaleString('en-AU', { 
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    changelog.unshift({ 
        timestamp: time,
        summary: summary,
        details: details
    });
    
    if (changelog.length > 100) {
        changelog = changelog.slice(0, 100);
    }
    
    saveState();
}

// Carousel management
function setupActivityTracking() {
    var activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    activityEvents.forEach(function(event) {
        document.addEventListener(event, function() {
            lastActivityTime = Date.now();
        }, true);
    });
}

function startCarousel() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
    
    carouselInterval = setInterval(function() {
        var timeSinceActivity = Date.now() - lastActivityTime;
        
        if (timeSinceActivity >= 7000 && importantMessages.length > 1) {
            currentMessageIndex = (currentMessageIndex + 1) % importantMessages.length;
            updateMessageCarousel();
        }
    }, 7000);
}

function updateMessageCarousel() {
    var carousel = document.getElementById('importantMessagesCarousel');
    var messageEl = document.getElementById('carouselMessage');
    var dotsEl = document.getElementById('carouselDots');
    
    if (importantMessages.length === 0) {
        carousel.classList.add('hidden');
        return;
    }
    
    carousel.classList.remove('hidden');
    messageEl.textContent = importantMessages[currentMessageIndex];
    
    dotsEl.innerHTML = '';
    if (importantMessages.length > 1) {
        importantMessages.forEach(function(msg, index) {
            var dot = document.createElement('div');
            dot.className = 'carousel-dot' + (index === currentMessageIndex ? ' active' : '');
            dot.addEventListener('click', function() {
                currentMessageIndex = index;
                updateMessageCarousel();
                lastActivityTime = Date.now();
            });
            dotsEl.appendChild(dot);
        });
    }
}

// Drop indicator / placeholder management
function showDropIndicator(container, y) {
    var indicator = container.querySelector('.drop-indicator');
    if (!indicator) return;
    
    // Get card elements (exclude any placeholder)
    var cards = Array.from(container.children).filter(function(el) {
        return (el.classList && (el.classList.contains('timetable-card') || el.classList.contains('assessment-card')));
    });
    
    if (cards.length === 0) {
        // Empty container: place indicator at top
        container.appendChild(indicator);
        indicator.classList.add('active');
        indicator._dropIndex = 0;
        container._dropIndex = 0;
        return;
    }
    
    var closestCard = null;
    var closestDistance = Infinity;
    var insertBefore = true;
    
    cards.forEach(function(card) {
        var rect = card.getBoundingClientRect();
        var cardMiddle = rect.top + rect.height / 2;
        var distance = Math.abs(y - cardMiddle);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestCard = card;
            insertBefore = y < cardMiddle;
        }
    });
    
    if (closestCard) {
        if (insertBefore) {
            container.insertBefore(indicator, closestCard);
        } else {
            // Insert after: if nextSibling exists and is the drop indicator, put after that
            var next = closestCard.nextSibling;
            if (next) {
                container.insertBefore(indicator, next);
            } else {
                container.appendChild(indicator);
            }
        }
        
        indicator.classList.add('active');
        // compute drop index
        var children = Array.from(container.children).filter(function(el){ return el !== indicator && el.classList && (el.classList.contains('timetable-card') || el.classList.contains('assessment-card')); });
        var index = children.indexOf(closestCard);
        if (!insertBefore) index = index + 1;
        container._dropIndex = index;
        indicator._dropIndex = index;
    }
}

function hideDropIndicator(container) {
    var indicator = container.querySelector('.drop-indicator');
    if (indicator) {
        indicator.classList.remove('active');
        delete indicator._dropIndex;
    }
    if (container) {
        delete container._dropIndex;
    }
}

function renderTimetable() {
    var days = ['Monday', 'Tuesday', 'Thursday', 'Friday'];
    days.forEach(function(day) {
        var container = document.getElementById(day.toLowerCase() + '-cards');
        if (!container) return;
        // Remove existing timetable-card nodes
        var existingCards = Array.from(container.children).filter(function(el) {
            return el.classList && el.classList.contains('timetable-card');
        });
        existingCards.forEach(function(card) { card.remove(); });
        
        var sortedCards = sortCardsByTime(timetable[day]);
        var indicator = container.querySelector('.drop-indicator');
        sortedCards.forEach(function(card) {
            var cardEl = createCardElement(card, day);
            if (indicator) {
                container.insertBefore(cardEl, indicator);
            } else {
                container.appendChild(cardEl);
            }
        });
        
        // Setup drag/drop handlers on container
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
            showDropIndicator(container, e.clientY);
        });
        
        container.addEventListener('dragleave', function(e) {
            // If leaving to an element outside the container, hide
            if (e.target === container || e.target.classList && e.target.classList.contains('drop-indicator')) {
                hideDropIndicator(container);
            }
        });
        
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            hideDropIndicator(container);
            handleDrop(e, day, container);
        });
    });
}

function handleDrop(e, day, container) {
    if (!draggedCard || (typeof container._dropIndex === 'undefined')) return;
    
    saveToHistory();
    var targetIndex = container._dropIndex;
    var sourceDay = draggedFromDay;
    // Find and remove from source
    var removedCard = null;
    if (sourceDay && timetable[sourceDay]) {
        var srcIndex = timetable[sourceDay].findIndex(function(c){ return c.id === draggedCard.id; });
        if (srcIndex !== -1) {
            removedCard = timetable[sourceDay].splice(srcIndex, 1)[0];
            // If moving within same day and srcIndex < targetIndex, targetIndex should shift left by 1
            if (sourceDay === day && srcIndex < targetIndex) {
                targetIndex = targetIndex - 1;
            }
        }
    }
    // If not found in timetable (shouldn't happen), try to use draggedCard directly
    var cardToInsert = removedCard || draggedCard;
    
    // Insert into destination at targetIndex
    timetable[day].splice(targetIndex, 0, cardToInsert);
    // Re-sort keeping pinned priority but preserve inserted order (we will re-sort except pins)
    timetable[day] = sortCardsByTime(timetable[day]);
    saveState();
    renderTimetable();
    logEvent('Card moved', cardToInsert.title + ' moved from ' + (sourceDay || 'unknown') + ' to ' + day, new Date().toLocaleString());
    
    draggedCard = null;
    draggedFromDay = null;
}

function createCardElement(card, day) {
    var cardEl = document.createElement('div');
    cardEl.className = 'timetable-card card-' + card.color;
    if (card.pinned) cardEl.classList.add('pinned-card');
    cardEl.draggable = true;
    
    // Build actions wrapper
    var actions = document.createElement('div');
    actions.className = 'card-header-actions';
    
    var dupBtn = document.createElement('button');
    dupBtn.className = 'duplicate-btn';
    dupBtn.title = 'Duplicate card';
    dupBtn.innerHTML = '<svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    dupBtn.addEventListener('click', function(evt) {
        evt.stopPropagation();
        duplicateCard(card.id, day);
    });
    actions.appendChild(dupBtn);
    
    var pinBtn = document.createElement('button');
    pinBtn.className = 'pin-btn';
    pinBtn.title = 'Pin/unpin';
    pinBtn.innerHTML = card.pinned ? '<svg class="icon-small" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3"></path></svg>' : '<svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3"></path></svg>';
    pinBtn.addEventListener('click', function(evt) {
        evt.stopPropagation();
        togglePin(card.id, day);
    });
    actions.appendChild(pinBtn);
    
    cardEl.appendChild(actions);
    
    var timeEl = document.createElement('div');
    timeEl.className = 'card-time';
    timeEl.textContent = card.time || '';
    cardEl.appendChild(timeEl);
    
    var titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = card.title || '';
    cardEl.appendChild(titleEl);
    
    var locEl = document.createElement('div');
    locEl.className = 'card-location';
    locEl.textContent = card.location || '';
    cardEl.appendChild(locEl);
    
    // Events for dragging
    cardEl.addEventListener('dragstart', function(e) {
        cardEl.classList.add('dragging');
        draggedCard = card;
        draggedFromDay = day;
        
        var ghost = cardEl.cloneNode(true);
        ghost.style.width = cardEl.offsetWidth + 'px';
        ghost.classList.remove('dragging');
        dragGhost.innerHTML = '';
        dragGhost.appendChild(ghost);
        dragGhost.classList.remove('hidden');
        
        try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setDragImage(dragGhost, 0, 0);
        } catch (err) {}
    });
    
    cardEl.addEventListener('drag', function(e) {
        if (e.clientX === 0 && e.clientY === 0) return;
        dragGhost.style.left = e.clientX + 10 + 'px';
        dragGhost.style.top = e.clientY + 10 + 'px';
    });
    
    cardEl.addEventListener('dragend', function() {
        cardEl.classList.remove('dragging');
        dragGhost.classList.add('hidden');
        var allContainers = document.querySelectorAll('.cards-container');
        allContainers.forEach(function(container) {
            hideDropIndicator(container);
        });
    });
    
    cardEl.addEventListener('click', function() {
        openModal(card, day);
    });
    
    return cardEl;
}

function renderAssessments() {
    var statuses = ['todo', 'inprogress', 'extension', 'completed'];
    statuses.forEach(function(status) {
        var container = document.getElementById(status + '-assessments');
        if (!container) return;
        var existingCards = Array.from(container.children).filter(function(el) {
            return el.classList && el.classList.contains('assessment-card');
        });
        existingCards.forEach(function(card) { card.remove(); });
        
        var sorted = sortAssessmentsByUrgency(assessments[status]);
        var indicator = container.querySelector('.drop-indicator');
        sorted.forEach(function(assessment) {
            var cardEl = createAssessmentElement(assessment, status);
            if (indicator) {
                container.insertBefore(cardEl, indicator);
            } else {
                container.appendChild(cardEl);
            }
        });
        
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
            showDropIndicator(container, e.clientY);
        });
        
        container.addEventListener('dragleave', function(e) {
            if (e.target === container || e.target.classList && e.target.classList.contains('drop-indicator')) {
                hideDropIndicator(container);
            }
        });
        
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            hideDropIndicator(container);
            
            if (!draggedAssessment || (typeof container._dropIndex === 'undefined')) return;
            saveToHistory();
            var targetIndex = container._dropIndex;
            var sourceStatus = draggedFromStatus;
            var removed = null;
            if (sourceStatus && assessments[sourceStatus]) {
                var srcIndex = assessments[sourceStatus].findIndex(function(a){ return a.id === draggedAssessment.id; });
                if (srcIndex !== -1) {
                    removed = assessments[sourceStatus].splice(srcIndex, 1)[0];
                    if (sourceStatus === status && srcIndex < targetIndex) {
                        targetIndex = targetIndex - 1;
                    }
                }
            }
            var toInsert = removed || draggedAssessment;
            assessments[status].splice(targetIndex, 0, toInsert);
            assessments[status] = sortAssessmentsByUrgency(assessments[status]);
            saveState();
            renderAssessments();
            logEvent('Assessment moved', toInsert.title + ' moved from ' + (sourceStatus || 'unknown') + ' to ' + status, new Date().toLocaleString());
            draggedAssessment = null;
            draggedFromStatus = null;
        });
    });
}

function createAssessmentElement(assessment, status) {
    var cardEl = document.createElement('div');
    var urgency = calculateUrgency(assessment.dueDate);
    cardEl.className = 'assessment-card urgency-' + urgency;
    cardEl.draggable = true;
    var dueDate = '';
    try {
        dueDate = new Date(assessment.dueDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (err) {}
    
    var actions = document.createElement('div');
    actions.className = 'card-header-actions';
    var dupBtn = document.createElement('button');
    dupBtn.className = 'duplicate-btn';
    dupBtn.title = 'Duplicate assessment';
    dupBtn.innerHTML = '<svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    dupBtn.addEventListener('click', function(evt) {
        evt.stopPropagation();
        duplicateAssessment(assessment.id, status);
    });
    actions.appendChild(dupBtn);
    cardEl.appendChild(actions);
    
    var titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = assessment.title;
    cardEl.appendChild(titleEl);
    
    var courseEl = document.createElement('div');
    courseEl.className = 'card-course';
    courseEl.textContent = assessment.course;
    cardEl.appendChild(courseEl);
    
    var dueEl = document.createElement('div');
    dueEl.className = 'card-due';
    dueEl.textContent = dueDate;
    cardEl.appendChild(dueEl);
    
    cardEl.addEventListener('dragstart', function(e) {
        cardEl.classList.add('dragging');
        draggedAssessment = assessment;
        draggedFromStatus = status;
        
        var ghost = cardEl.cloneNode(true);
        ghost.style.width = cardEl.offsetWidth + 'px';
        ghost.classList.remove('dragging');
        dragGhost.innerHTML = '';
        dragGhost.appendChild(ghost);
        dragGhost.classList.remove('hidden');
        
        try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setDragImage(dragGhost, 0, 0);
        } catch (err) {}
    });
    
    cardEl.addEventListener('drag', function(e) {
        if (e.clientX === 0 && e.clientY === 0) return;
        dragGhost.style.left = e.clientX + 10 + 'px';
        dragGhost.style.top = e.clientY + 10 + 'px';
    });
    
    cardEl.addEventListener('dragend', function() {
        cardEl.classList.remove('dragging');
        dragGhost.classList.add('hidden');
        var allContainers = document.querySelectorAll('.cards-container');
        allContainers.forEach(function(container) {
            hideDropIndicator(container);
        });
    });
    
    cardEl.addEventListener('click', function() {
        openAssessmentModal(assessment, status);
    });
    
    return cardEl;
}

function renderChangelog() {
    var container = document.getElementById('changelogList');
    container.innerHTML = '';
    if (changelog.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No events logged yet.</p>';
        return;
    }
    changelog.forEach(function(entry) {
        var entryEl = document.createElement('div');
        entryEl.className = 'changelog-item';
        var header = document.createElement('div');
        header.className = 'changelog-header';
        var left = document.createElement('div');
        var time = document.createElement('div');
        time.className = 'changelog-time';
        time.textContent = entry.timestamp;
        var text = document.createElement('div');
        text.className = 'changelog-text';
        text.textContent = entry.summary;
        left.appendChild(time);
        left.appendChild(text);
        header.appendChild(left);
        var expandIcon = document.createElement('svg');
        expandIcon.className = 'expand-icon';
        expandIcon.setAttribute('viewBox', '0 0 24 24');
        expandIcon.innerHTML = '<path d="M6 9l6 6 6-6"></path>';
        header.appendChild(expandIcon);
        entryEl.appendChild(header);
        var details = document.createElement('div');
        details.className = 'changelog-details';
        details.textContent = entry.details;
        entryEl.appendChild(details);
        entryEl.addEventListener('click', function() {
            entryEl.classList.toggle('expanded');
        });
        container.appendChild(entryEl);
    });
}
