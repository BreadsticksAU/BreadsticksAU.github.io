// Initial timetable data
const INITIAL_TIMETABLE = {
    Monday: [
        { id: 'm1', time: '6:15-7:45am', title: 'Bus: Toowoomba → Ipswich (B1)', location: 'Arrive 7:45am', color: 'blue', notes: '' },
        { id: 'm2', time: '10:00am-12:00pm', title: 'NSC1501 – Bioscience', location: 'M102 Teaching Room', color: 'green', notes: '' },
        { id: 'm3', time: '1:45-3:15pm', title: 'Bus: Ipswich → Toowoomba (B2)', location: 'Depart 1:45pm', color: 'blue', notes: '' }
    ],
    Tuesday: [
        { id: 't1', time: '6:15-7:45am', title: 'Bus: Toowoomba → Ipswich (B1)', location: 'Arrive 7:45am', color: 'blue', notes: '' },
        { id: 't2', time: '8:00-10:00am', title: 'PMC1101 – Public Health', location: 'J131 Lecture Theatre', color: 'yellow', notes: '' },
        { id: 't3', time: '10:00am-12:00pm', title: 'PMC1110 – Intro to Paramedicine', location: 'J131 Lecture Theatre', color: 'red', notes: '' },
        { id: 't4', time: '3:00-5:00pm', title: 'PMC1110 – Intro to Paramedicine', location: 'I113 Teaching Room', color: 'red', notes: '' },
        { id: 't5', time: '5:15-6:45pm', title: 'Bus: Ipswich → Toowoomba (B1)', location: 'Depart 5:15pm', color: 'blue', notes: '' }
    ],
    Thursday: [
        { id: 'th1', time: '6:15-7:45am', title: 'Bus: Toowoomba → Ipswich (B1)', location: 'Arrive 7:45am', color: 'blue', notes: '' },
        { id: 'th2', time: '8:00am-12:00pm', title: 'PMC1110 – Intro to Paramedicine', location: 'I306 Simulated House', color: 'red', notes: '' },
        { id: 'th3', time: '2:00-3:00pm', title: 'PMC1101 – Public Health', location: 'I206 Tutorial Room', color: 'yellow', notes: '' },
        { id: 'th4', time: '5:15-6:45pm', title: 'Bus: Ipswich → Toowoomba (B1)', location: 'Depart 5:15pm', color: 'blue', notes: '' }
    ],
    Friday: [
        { id: 'f1', time: '10:00am-12:00pm', title: 'Bus: Toowoomba → Springfield (B2)', location: 'Arrive 12pm', color: 'blue', notes: '' },
        { id: 'f2', time: '1:00-4:00pm', title: 'NSC1501 – Bioscience', location: 'B406 Multi-Purpose Lab (Springfield)', color: 'green', notes: '' },
        { id: 'f3', time: '4:45-6:45pm', title: 'Bus: Springfield → Toowoomba (B1)', location: 'Depart 4:45pm', color: 'blue', notes: '' }
    ]
};

// State management
let timetable = {};
let changelog = [];
let darkMode = false;
let editingCard = null;
let editingDay = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadState();
    checkWeeklyReset();
    setupEventListeners();
    renderTimetable();
    renderChangelog();
    logEvent('Page loaded');
});

// Load state from localStorage
function loadState() {
    const savedTimetable = localStorage.getItem('universityTimetable');
    const savedChangelog = localStorage.getItem('universityChangelog');
    const savedDarkMode = localStorage.getItem('universityDarkMode');
    
    timetable = savedTimetable ? JSON.parse(savedTimetable) : JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
    changelog = savedChangelog ? JSON.parse(savedChangelog) : [];
    darkMode = savedDarkMode === 'true';
    
    if (darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('sunIcon').classList.add('hidden');
        document.getElementById('moonIcon').classList.remove('hidden');
    }
}

// Save state to localStorage
function saveState() {
    localStorage.setItem('universityTimetable', JSON.stringify(timetable));
    localStorage.setItem('universityChangelog', JSON.stringify(changelog));
    localStorage.setItem('universityDarkMode', darkMode);
}

// Check for weekly reset (Sunday 12:00am AEST)
function checkWeeklyReset() {
    const lastReset = localStorage.getItem('lastTimetableReset');
    const now = new Date();
    
    // Convert to AEST (UTC+10)
    const aestOffset = 10 * 60; // minutes
    const localOffset = now.getTimezoneOffset();
    const aestTime = new Date(now.getTime() + (aestOffset + localOffset) * 60000);
    
    // Check if it's Sunday and past midnight
    const currentDay = aestTime.getDay();
    
    if (lastReset) {
        const lastResetDate = new Date(parseInt(lastReset));
        const lastResetAEST = new Date(lastResetDate.getTime() + (aestOffset + localOffset) * 60000);
        
        // If last reset was before this Sunday midnight
        const daysSinceLastReset = Math.floor((aestTime - lastResetAEST) / (1000 * 60 * 60 * 24));
        
        if (currentDay === 0 && daysSinceLastReset >= 7) {
            resetTimetable(true);
            localStorage.setItem('lastTimetableReset', now.getTime().toString());
        }
    } else {
        localStorage.setItem('lastTimetableReset', now.getTime().toString());
    }
}

// Parse time string to minutes for sorting
function parseTime(timeStr) {
    const startTime = timeStr.split('-')[0].trim();
    let time, period;
    
    if (startTime.includes('am') || startTime.includes('pm')) {
        time = startTime.slice(0, -2);
        period = startTime.slice(-2);
    } else {
        time = startTime;
        period = '';
    }
    
    const timeParts = time.split(':');
    let hours = parseInt(timeParts[0]);
    const minutes = timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
}

// Sort cards by time
function sortCardsByTime(cards) {
    return cards.slice().sort(function(a, b) {
        return parseTime(a.time) - parseTime(b.time);
    });
}

// Log an event to changelog
function logEvent(message) {
    const timestamp = new Date().toLocaleString('en-AU', { 
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    changelog.unshift({ timestamp: timestamp, message: message });
    
    // Keep only last 100 entries
    if (changelog.length > 100) {
        changelog = changelog.slice(0, 100);
    }
    
    saveState();
    if (document.getElementById('changelogContent').classList.contains('active')) {
        renderChangelog();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', function() {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode');
        document.getElementById('sunIcon').classList.toggle('hidden');
        document.getElementById('moonIcon').classList.toggle('hidden');
        saveState();
        logEvent('Switched to ' + (darkMode ? 'dark' : 'light') + ' mode');
    });
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            const tabName = tab.dataset.tab;
            
            const allTabs = document.querySelectorAll('.tab');
            allTabs.forEach(function(t) {
                t.classList.remove('active');
            });
            
            const allContent = document.querySelectorAll('.tab-content');
            allContent.forEach(function(c) {
                c.classList.remove('active');
            });
            
            tab.classList.add('active');
            document.getElementById(tabName + 'Content').classList.add('active');
            
            if (tabName === 'changelog') {
                renderChangelog();
            }
        });
    });
    
    // Add card buttons
    const addBtns = document.querySelectorAll('.add-card-btn');
    addBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const day = btn.dataset.day;
            addNewCard(day);
        });
    });
    
    // Modal close
    document.getElementById('closeModal').addEventListener('click', function() {
        closeModal();
    });
    
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target.id === 'editModal') {
            closeModal();
        }
    });
    
    // Modal form inputs
    document.getElementById('editTime').addEventListener('input', updateEditingCard);
    document.getElementById('editTitle').addEventListener('input', updateEditingCard);
    document.getElementById('editLocation').addEventListener('input', updateEditingCard);
    document.getElementById('editNotes').addEventListener('input', updateEditingCard);
    
    // Color picker
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const color = btn.dataset.color;
            
            const allColorBtns = document.querySelectorAll('.color-btn');
            allColorBtns.forEach(function(b) {
                b.classList.remove('selected');
            });
            btn.classList.add('selected');
            
            if (editingCard && editingDay) {
                const cardIndex = timetable[editingDay].findIndex(function(c) {
                    return c.id === editingCard.id;
                });
                timetable[editingDay][cardIndex].color = color;
                saveState();
                renderTimetable();
                logEvent('Changed card color to ' + color + ': "' + editingCard.title + '"');
            }
        });
    });
    
    // Delete card
    document.getElementById('deleteCard').addEventListener('click', function() {
        if (editingCard && editingDay) {
            if (confirm('Are you sure you want to delete this card?')) {
                const cardTitle = editingCard.title;
                timetable[editingDay] = timetable[editingDay].filter(function(c) {
                    return c.id !== editingCard.id;
                });
                saveState();
                renderTimetable();
                closeModal();
                logEvent('Deleted card from ' + editingDay + ': "' + cardTitle + '"');
            }
        }
    });
    
    // Reset timetable
    document.getElementById('resetTimetable').addEventListener('click', function() {
        if (confirm('Are you sure you want to reset the timetable to default?')) {
            resetTimetable(false);
        }
    });
    
    // Clear changelog
    document.getElementById('clearChangelog').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear the changelog?')) {
            changelog = [];
            saveState();
            renderChangelog();
            logEvent('Changelog cleared');
        }
    });
}

// Reset timetable
function resetTimetable(isAutomatic) {
    timetable = JSON.parse(JSON.stringify(INITIAL_TIMETABLE));
    saveState();
    renderTimetable();
    logEvent(isAutomatic ? 'Automatic weekly reset (Sunday 12:00am AEST)' : 'Manual timetable reset');
}

// Add new card
function addNewCard(day) {
    const newCard = {
        id: day.toLowerCase() + '-' + Date.now(),
        time: '9:00-10:00am',
        title: 'New Event',
        location: 'Location',
        color: 'blue',
        notes: ''
    };
    
    timetable[day] = sortCardsByTime(timetable[day].concat([newCard]));
    saveState();
    renderTimetable();
    logEvent('Added new card to ' + day + ': "' + newCard.title + '"');
}

// Update editing card
function updateEditingCard() {
    if (!editingCard || !editingDay) return;
    
    const cardIndex = timetable[editingDay].findIndex(function(c) {
        return c.id === editingCard.id;
    });
    const oldTime = timetable[editingDay][cardIndex].time;
    
    timetable[editingDay][cardIndex].time = document.getElementById('editTime').value;
    timetable[editingDay][cardIndex].title = document.getElementById('editTitle').value;
    timetable[editingDay][cardIndex].location = document.getElementById('editLocation').value;
    timetable[editingDay][cardIndex].notes = document.getElementById('editNotes').value;
    
    if (oldTime !== timetable[editingDay][cardIndex].time) {
        timetable[editingDay] = sortCardsByTime(timetable[editingDay]);
    }
    
    saveState();
    renderTimetable();
    logEvent('Edited card in ' + editingDay + ': "' + timetable[editingDay][cardIndex].title + '"');
}

// Open modal
function openModal(card, day) {
    editingCard = card;
    editingDay = day;
    
    document.getElementById('editTime').value = card.time;
    document.getElementById('editTitle').value = card.title;
    document.getElementById('editLocation').value = card.location;
    document.getElementById('editNotes').value = card.notes;
    
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(function(btn) {
        if (btn.dataset.color === card.color) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    document.getElementById('editModal').classList.remove('hidden');
}

// Close modal
function closeModal() {
    document.getElementById('editModal').classList.add('hidden');
    editingCard = null;
    editingDay = null;
}

// Render timetable
function renderTimetable() {
    const days = ['Monday', 'Tuesday', 'Thursday', 'Friday'];
    
    days.forEach(function(day) {
        const container = document.getElementById(day.toLowerCase() + '-cards');
        container.innerHTML = '';
        
        timetable[day].forEach(function(card) {
            const cardEl = createCardElement(card, day);
            container.appendChild(cardEl);
        });
        
        // Setup drop zone
        container.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        
        container.addEventListener('drop', function(e) {
            e.preventDefault();
            const cardData = e.dataTransfer.getData('application/json');
            if (!cardData) return;
            
            const data = JSON.parse(cardData);
            const card = data.card;
            const fromDay = data.fromDay;
            
            if (fromDay !== day) {
                // Remove from old day
                timetable[fromDay] = timetable[fromDay].filter(function(c) {
                    return c.id !== card.id;
                });
                // Add to new day
                timetable[day] = sortCardsByTime(timetable[day].concat([card]));
                saveState();
                renderTimetable();
                logEvent('Moved card from ' + fromDay + ' to ' + day + ': "' + card.title + '"');
            }
        });
    });
}

// Create card element
function createCardElement(card, day) {
    const cardEl = document.createElement('div');
    cardEl.className = 'timetable-card card-' + card.color;
    cardEl.draggable = true;
    
    cardEl.innerHTML = '<div class="card-grip">' +
        '<svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<circle cx="9" cy="5" r="1"></circle>' +
        '<circle cx="9" cy="12" r="1"></circle>' +
        '<circle cx="9" cy="19" r="1"></circle>' +
        '<circle cx="15" cy="5" r="1"></circle>' +
        '<circle cx="15" cy="12" r="1"></circle>' +
        '<circle cx="15" cy="19" r="1"></circle>' +
        '</svg>' +
        '</div>' +
        '<div class="card-time">' + card.time + '</div>' +
        '<div class="card-title">' + card.title + '</div>' +
        '<div class="card-location">' + card.location + '</div>';
    
    cardEl.addEventListener('dragstart', function(e) {
        cardEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ card: card, fromDay: day }));
    });
    
    cardEl.addEventListener('dragend', function() {
        cardEl.classList.remove('dragging');
    });
    
    cardEl.addEventListener('click', function() {
        openModal(card, day);
    });
    
    return cardEl;
}

// Render changelog
function renderChangelog() {
    const container = document.getElementById('changelogList');
    container.innerHTML = '';
    
    if (changelog.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No events logged yet.</p>';
        return;
    }
    
    changelog.forEach(function(entry) {
        const entryEl = document.createElement('div');
        entryEl.className = 'changelog-item';
        entryEl.innerHTML = '<div class="changelog-time">' + entry.timestamp + '</div>' +
            '<div class="changelog-text">' + entry.message + '</div>';
        container.appendChild(entryEl);
    });
}
