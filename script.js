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
var darkMode = false;
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
var dragGhost = null;
var carouselInterval = null;
var currentMessageIndex = 0;
var userIdleTimeout = null;
var lastActivityTime = Date.now();

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
    logEvent('Page loaded', 'Application started', new Date().toLocaleString());
});

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
    
    darkMode = safeLocalStorageGet('universityDarkMode') === 'true';
    sidebarCollapsed = safeLocalStorageGet('sidebarCollapsed') === 'true';
    
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('sunIcon').classList.add('hidden');
        document.getElementById('moonIcon').classList.remove('hidden');
    }
    
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
    safeLocalStorageSet('universityDarkMode', darkMode);
    safeLocalStorageSet('sidebarCollapsed', sidebarCollapsed);
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
        assessments: JSON.parse(JSON.stringify(assessments))
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
        saveState();
        renderTimetable();
        renderAssessments();
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
        saveState();
        renderTimetable();
        renderAssessments();
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
    // Extract just the start time from "HH:MM-HH:MM" format
    var startTime = timeStr.split('-')[0].trim();
    
    // Extract time and period separately
    var timeMatch = startTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    
    if (!timeMatch) {
        // Fallback if format is unexpected
        return 0;
    }
    
    var hours = parseInt(timeMatch[1]);
    var minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    var period = timeMatch[3].toLowerCase();
    
    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) {
        hours += 12;
    } else if (period === 'am' && hours === 12) {
        hours = 0;
    }
    
    // Return total minutes from midnight
    return hours * 60 + minutes;
}

function sortCardsByTime(cards) {
    return cards.slice().sort(function(a, b) {
        // Pinned cards always come first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
        // If both pinned or both unpinned, sort by time
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
        
        // Only rotate if user has been idle for 7 seconds
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
    
    // Update dots
    dotsEl.innerHTML = '';
    if (importantMessages.length > 1) {
        importantMessages.forEach(function(msg, index) {
            var dot = document.createElement('div');
            dot.className = 'carousel-dot' + (index === currentMessageIndex ? ' active' : '');
            dot.addEventListener('click', function() {
                currentMessageIndex = index;
                updateMessageCarousel();
                lastActivityTime = Date.now(); // Reset idle timer
            });
            dotsEl.appendChild(dot);
        });
    }
}

// Event listeners
function setupEventListeners() {
    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        sidebarCollapsed = !sidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed');
        saveState();
    });
    
    // Click on grid pattern to expand sidebar
    document.querySelector('.main-content').addEventListener('click', function(e) {
        if (sidebarCollapsed && e.clientX <= 110) {
            sidebarCollapsed = false;
            document.getElementById('sidebar').classList.remove('collapsed');
            saveState();
        }
    });
    
    document.getElementById('themeToggle').addEventListener('click', function() {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode');
        document.getElementById('sunIcon').classList.toggle('hidden');
        document.getElementById('moonIcon').classList.toggle('hidden');
        saveState();
        logEvent('Theme changed', 'Switched to ' + (darkMode ? 'dark' : 'light') + ' mode', new Date().toLocaleString());
    });
    
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    
    var navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
        item.addEventListener('click', function() {
            var tabName = item.dataset.tab;
            navItems.forEach(function(i) { i.classList.remove('active'); });
            var allContent = document.querySelectorAll('.tab-content');
            allContent.forEach(function(c) { c.classList.remove('active'); });
            item.classList.add('active');
            document.getElementById(tabName + 'Content').classList.add('active');
            if (tabName === 'changelog') renderChangelog();
            if (tabName === 'messages') renderMessages();
        });
    });
    
    var addBtns = document.querySelectorAll('.add-card-btn');
    addBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            addNewCard(btn.dataset.day);
        });
    });
    
    var addAssessmentBtns = document.querySelectorAll('.add-assessment-btn');
    addAssessmentBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            addNewAssessment(btn.dataset.status);
        });
    });
    
    document.getElementById('addMessageBtn').addEventListener('click', function() {
        var input = document.getElementById('newMessageInput');
        var message = input.value.trim();
        if (message) {
            importantMessages.push(message);
            input.value = '';
            saveState();
            renderMessages();
            updateMessageCarousel();
            logEvent('Message added', message, new Date().toLocaleString());
        }
    });
    
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target.id === 'editModal') closeModal();
    });
    
    document.getElementById('closeAssessmentModal').addEventListener('click', closeAssessmentModal);
    document.getElementById('editAssessmentModal').addEventListener('click', function(e) {
        if (e.target.id === 'editAssessmentModal') closeAssessmentModal();
    });
    
    document.getElementById('editTime').addEventListener('input', updateEditingCard);
    document.getElementById('editTitle').addEventListener('input', updateEditingCard);
    document.getElementById('editLocation').addEventListener('input', updateEditingCard);
    document.getElementById('editNotes').addEventListener('input', updateEditingCard);
    
    document.getElementById('editAssessmentTitle').addEventListener('input', updateEditingAssessment);
    document.getElementById('editAssessmentCourse').addEventListener('input', updateEditingAssessment);
    document.getElementById('editAssessmentDue').addEventListener('input', updateEditingAssessment);
    document.getElementById('editAssessmentNotes').addEventListener('input', updateEditingAssessment);
    
    var colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var color = btn.dataset.color;
            colorBtns.forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            
            if (editingCard && editingDay) {
                saveToHistory();
                var cardIndex = timetable[editingDay].findIndex(function(c) { return c.id === editingCard.id; });
                timetable[editingDay][cardIndex].color = color;
                saveState();
                renderTimetable();
                logEvent('Color changed', editingCard.title + ' color changed to ' + color + ' in ' + editingDay, new Date().toLocaleString());
            }
        });
    });
    
    document.getElementById('deleteCard').addEventListener('click', function() {
        if (editingCard && editingDay && confirm('Delete this card?')) {
            saveToHistory();
            var cardTitle = editingCard.title;
            timetable[editingDay] = timetable[editingDay].filter(function(c) { return c.id !== editingCard.id; });
            saveState();
            renderTimetable();
            closeModal();
            logEvent('Card deleted', cardTitle + ' was deleted from ' + editingDay, new Date().toLocaleString());
        }
    });
    
    document.getElementById('deleteAssessment').addEventListener('click', function() {
        if (editingAssessment && editingStatus && confirm('Delete this assessment?')) {
            saveToHistory();
            var title = editingAssessment.title;
            assessments[editingStatus] = assessments[editingStatus].filter(function(a) { return a.id !== editingAssessment.id; });
            saveState();
            renderAssessments();
            closeAssessmentModal();
            logEvent('Assessment deleted', title + ' was deleted from ' + editingStatus, new Date().toLocaleString());
        }
    });
    
    document.getElementById('resetTimetable').addEventListener('click', function() {
        if (confirm('Reset timetable to default?')) {
            saveToHistory();
            resetTimetable(false);
        }
    });
    
    document.getElementById('clearChangelog').addEventListener('click', function() {
        if (confirm('Clear changelog?')) {
            changelog = [];
            saveState();
            renderChangelog();
            logEvent('Changelog cleared', 'All entries cleared', new Date().toLocaleString());
        }
    });
    
    document.getElementById('clearHistory').addEventListener('click', function() {
        if (confirm('Clear undo/redo history?')) {
            undoHistory = [];
            historyIndex = -1;
            updateUndoRedoButtons();
            logEvent('History cleared', 'Undo/redo history cleared', new Date().toLocaleString());
        }
    });
    
    document.getElementById('clearMessages').addEventListener('click', function() {
        if (confirm('Clear all important messages?')) {
            importantMessages = [];
            currentMessageIndex = 0;
            saveState();
            renderMessages();
            updateMessageCarousel();
            logEvent('Messages cleared', 'All important messages cleared', new Date().toLocaleString());
        }
    });
}

// Functions
function resetTimetable(isAutomatic) {
    timetable = JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
    saveState();
    renderTimetable();
    logEvent('Timetable reset', isAutomatic ? 'Automatic weekly reset (Sunday 12am AEST)' : 'Manual reset', new Date().toLocaleString());
}

function addNewCard(day) {
    saveToHistory();
    var newCard = {
        id: day.toLowerCase() + '-' + Date.now(),
        time: '9:00-10:00am',
        title: 'New Event',
        location: 'Location',
        color: 'blue',
        notes: '',
        pinned: false
    };
    timetable[day] = sortCardsByTime(timetable[day].concat([newCard]));
    saveState();
    renderTimetable();
    logEvent('Card added', 'New Event added to ' + day, new Date().toLocaleString());
}

function addNewAssessment(status) {
    saveToHistory();
    var newAssessment = {
        id: status + '-' + Date.now(),
        title: 'New Assessment',
        course: 'Course Code',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        notes: ''
    };
    assessments[status].push(newAssessment);
    assessments[status] = sortAssessmentsByUrgency(assessments[status]);
    saveState();
    renderAssessments();
    logEvent('Assessment added', 'New Assessment added to ' + status, new Date().toLocaleString());
}

function togglePin(cardId, day) {
    saveToHistory();
    var cardIndex = timetable[day].findIndex(function(c) { return c.id === cardId; });
    var card = timetable[day][cardIndex];
    card.pinned = !card.pinned;
    timetable[day] = sortCardsByTime(timetable[day]);
    saveState();
    renderTimetable();
    logEvent('Card ' + (card.pinned ? 'pinned' : 'unpinned'), card.title + ' in ' + day, new Date().toLocaleString());
}

function updateEditingCard() {
    if (!editingCard || !editingDay) return;
    saveToHistory();
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
    saveToHistory();
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
        deleteBtn.innerHTML = '<svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        deleteBtn.addEventListener('click', function() {
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

function renderTimetable() {
    var days = ['Monday', 'Tuesday', 'Thursday', 'Friday'];
    days.forEach(function(day) {
        var container = document.getElementById(day.toLowerCase() + '-cards');
        container.innerHTML = '';
        
        var sortedCards = sortCardsByTime(timetable[day]);
        sortedCards.forEach(function(card) {
            container.appendChild(createCardElement(card, day));
        });
        
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', function(e) { handleDrop(e, day); });
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e, day) {
    e.preventDefault();
    
    if (!draggedCard || !draggedFromDay) return;
    
    if (draggedFromDay !== day) {
        saveToHistory();
        timetable[draggedFromDay] = timetable[draggedFromDay].filter(function(c) { 
            return c.id !== draggedCard.id; 
        });
        
        timetable[day] = sortCardsByTime(timetable[day].concat([draggedCard]));
        
        saveState();
        renderTimetable();
        logEvent('Card moved', draggedCard.title + ' moved from ' + draggedFromDay + ' to ' + day, new Date().toLocaleString());
    }
    
    draggedCard = null;
    draggedFromDay = null;
}

function createCardElement(card, day) {
    var cardEl = document.createElement('div');
    cardEl.className = 'timetable-card card-' + card.color;
    if (card.pinned) cardEl.classList.add('pinned-card');
    cardEl.draggable = true;
    
    var pinIcon = card.pinned ? 
        '<svg class="icon-small" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>' :
        '<svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>';
    
    cardEl.innerHTML = '<div class="card-header-actions"><button class="pin-btn" onclick="event.stopPropagation(); togglePin(\'' + card.id + '\', \'' + day + '\')" title="' + (card.pinned ? 'Unpin' : 'Pin') + ' card">' + pinIcon + '</button></div><div class="card-time">' + card.time + '</div><div class="card-title">' + card.title + '</div><div class="card-location">' + card.location + '</div>';
    
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
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setDragImage(dragGhost, 0, 0);
    });
    
    cardEl.addEventListener('drag', function(e) {
        if (e.clientX === 0 && e.clientY === 0) return;
        dragGhost.style.left = e.clientX + 10 + 'px';
        dragGhost.style.top = e.clientY + 10 + 'px';
    });
    
    cardEl.addEventListener('dragend', function() {
        cardEl.classList.remove('dragging');
        dragGhost.classList.add('hidden');
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
        container.innerHTML = '';
        var sorted = sortAssessmentsByUrgency(assessments[status]);
        sorted.forEach(function(assessment) {
            container.appendChild(createAssessmentElement(assessment, status));
        });
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            var data = e.dataTransfer.getData('application/json');
            if (!data) return;
            var parsed = JSON.parse(data);
            var assessment = parsed.assessment;
            var fromStatus = parsed.fromStatus;
            if (fromStatus !== status) {
                saveToHistory();
                assessments[fromStatus] = assessments[fromStatus].filter(function(a) { return a.id !== assessment.id; });
                assessments[status] = sortAssessmentsByUrgency(assessments[status].concat([assessment]));
                saveState();
                renderAssessments();
                logEvent('Assessment moved', assessment.title + ' moved from ' + fromStatus + ' to ' + status, new Date().toLocaleString());
            }
        });
    });
}

function createAssessmentElement(assessment, status) {
    var cardEl = document.createElement('div');
    var urgency = calculateUrgency(assessment.dueDate);
    cardEl.className = 'assessment-card urgency-' + urgency;
    cardEl.draggable = true;
    var dueDate = new Date(assessment.dueDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    cardEl.innerHTML = '<div class="card-title">' + assessment.title + '</div><div class="card-course">' + assessment.course + '</div><div class="card-due">Due: ' + dueDate + '</div>';
    cardEl.addEventListener('dragstart', function(e) {
        cardEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ assessment: assessment, fromStatus: status }));
    });
    cardEl.addEventListener('dragend', function() {
        cardEl.classList.remove('dragging');
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
        entryEl.innerHTML = '<div class="changelog-header"><div><div class="changelog-time">' + entry.timestamp + '</div><div class="changelog-text">' + entry.summary + '</div></div><svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div><div class="changelog-details">' + entry.details + '</div>';
        entryEl.addEventListener('click', function() {
            entryEl.classList.toggle('expanded');
        });
        container.appendChild(entryEl);
    });
}
