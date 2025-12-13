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
    var startTime = timeStr.split('-')[0].trim();
    var timeMatch = startTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    
    if (!timeMatch) {
        return 0;
    }
    
    var hours = parseInt(timeMatch[1]);
    var minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    var period = timeMatch[3].toLowerCase();
    
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

// Drop indicator management
function showDropIndicator(container, y) {
    var indicator = container.querySelector('.drop-indicator');
    if (!indicator) return;
    
    var cards = Array.from(container.children).filter(function(el) {
        return el.classList.contains('timetable-card') || el.classList.contains('assessment-card');
    });
    
    if (cards.length === 0) {
        indicator.style.top = '0px';
        indicator.classList.add('active');
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
        var rect = closestCard.getBoundingClientRect();
        var containerRect = container.getBoundingClientRect();
        var position;
        
        if (insertBefore) {
            position = rect.top - containerRect.top - 2;
        } else {
            position = rect.bottom - containerRect.top + 10;
        }
        
        indicator.style.top = position + 'px';
        indicator.classList.add('active');
    }
}

function hideDropIndicator(container) {
    var indicator = container.querySelector('.drop-indicator');
    if (indicator) {
        indicator.classList.remove('active');
    }
}

// Initial timetable data - CONTINUED FROM PREVIOUS (Part 2)
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

function renderTimetable() {
    var days = ['Monday', 'Tuesday', 'Thursday', 'Friday'];
    days.forEach(function(day) {
        var container = document.getElementById(day.toLowerCase() + '-cards');
        var cards = Array.from(container.children).filter(function(el) {
            return el.classList.contains('timetable-card');
        });
        cards.forEach(function(card) {
            card.remove();
        });
        
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
        
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            showDropIndicator(container, e.clientY);
        });
        
        container.addEventListener('dragleave', function(e) {
            if (e.target === container || e.target.classList.contains('drop-indicator')) {
                hideDropIndicator(container);
            }
        });
        
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            hideDropIndicator(container);
            handleDrop(e, day);
        });
    });
}

function handleDrop(e, day) {
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
    
    cardEl.innerHTML = '<div class="card-header-actions"><button class="duplicate-btn" onclick="event.stopPropagation(); duplicateCard(\'' + card.id + '\', \'' + day + '\')" title="Duplicate card"><svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button><button class="pin-btn" onclick="event.stopPropagation(); togglePin(\'' + card.id + '\', \'' + day + '\')" title="' + (card.pinned ? 'Unpin' : 'Pin') + ' card">' + pinIcon + '</button></div><div class="card-time">' + card.time + '</div><div class="card-title">' + card.title + '</div><div class="card-location">' + card.location + '</div>';
    
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
        var cards = Array.from(container.children).filter(function(el) {
            return el.classList.contains('assessment-card');
        });
        cards.forEach(function(card) {
            card.remove();
        });
        
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
            e.dataTransfer.dropEffect = 'move';
            showDropIndicator(container, e.clientY);
        });
        
        container.addEventListener('dragleave', function(e) {
            if (e.target === container || e.target.classList.contains('drop-indicator')) {
                hideDropIndicator(container);
            }
        });
        
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            hideDropIndicator(container);
            
            if (!draggedAssessment || !draggedFromStatus) return;
            
            if (draggedFromStatus !== status) {
                saveToHistory();
                assessments[draggedFromStatus] = assessments[draggedFromStatus].filter(function(a) { 
                    return a.id !== draggedAssessment.id; 
                });
                assessments[status] = sortAssessmentsByUrgency(assessments[status].concat([draggedAssessment]));
                saveState();
                renderAssessments();
                logEvent('Assessment moved', draggedAssessment.title + ' moved from ' + draggedFromStatus + ' to ' + status, new Date().toLocaleString());
            }
            
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
    var dueDate = new Date(assessment.dueDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    cardEl.innerHTML = '<div class="card-header-actions"><button class="duplicate-btn" onclick="event.stopPropagation(); duplicateAssessment(\'' + assessment.id + '\', \'' + status + '\')" title="Duplicate assessment"><svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div><div class="card-title">' + assessment.title + '</div><div class="card-course">' + assessment.course + '</div><div class="card-due">Due: ' + dueDate + '</div>';
    
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
        entryEl.innerHTML = '<div class="changelog-header"><div><div class="changelog-time">' + entry.timestamp + '</div><div class="changelog-text">' + entry.summary + '</div></div><svg class="expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></div><div class="changelog-details">' + entry.details + '</div>';
        entryEl.addEventListener('click', function() {
            entryEl.classList.toggle('expanded');
        });
        container.appendChild(entryEl);
    });
}
