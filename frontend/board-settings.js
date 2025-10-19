// board-settings.js - Logic for board-settings.html
document.addEventListener('DOMContentLoaded', function() {
    console.log('Board settings.js loaded, TrelloPowerUp available:', !!window.TrelloPowerUp);

    // Wait for Trello SDK to load
    let waitCount = 0;
    const maxWait = 100;

    function waitForTrelloSDK() {
        waitCount++;
        if (window.TrelloPowerUp) {
            console.log('Trello SDK loaded after', waitCount, 'checks, initializing board settings...');
            initBoardSettings();
        } else if (waitCount < maxWait) {
            console.log('Waiting for Trello SDK... attempt', waitCount);
            setTimeout(waitForTrelloSDK, 100);
        } else {
            console.error('Trello SDK failed to load within timeout');
            initBoardSettings();
        }
    }

    waitForTrelloSDK();
});

function initBoardSettings() {
    console.log('Initializing board settings...');

    const container = document.getElementById('board-settings-container');
    const saveBtn = document.getElementById('save-settings-btn');

    if (!container || !saveBtn) {
        console.error('Required DOM elements not found');
        return;
    }

    // Get board context
    let boardId = null;
    if (window.TrelloPowerUp && typeof window.TrelloPowerUp.iframe === 'function') {
        try {
            const t = window.TrelloPowerUp.iframe();
            if (t && typeof t.getContext === 'function') {
                const context = t.getContext();
                boardId = context.board;
                console.log('Got board ID from Trello context:', boardId);
            }
        } catch (e) {
            console.log('Trello iframe context failed:', e);
        }
    }

    // Fallback: try to get from URL parameters
    if (!boardId) {
        const urlParams = new URLSearchParams(window.location.search);
        boardId = urlParams.get('boardId') || urlParams.get('board');
        if (boardId) {
            console.log('Got board ID from URL:', boardId);
        }
    }

    if (!boardId) {
        container.innerHTML = '<p style="color: red;">Error: Board context not found. Please open this from a board button.</p>';
        return;
    }

    const backendUrl = window.BACKEND_URL || 'http://localhost:8000';

    // Load lists for the multi-select
    loadBoardLists(boardId, backendUrl);

    // Load saved settings
    loadSavedSettings(boardId);

    // Set up color pickers
    setupColorPickers();

    // Save settings on button click
    saveBtn.addEventListener('click', () => {
        saveSettings(boardId);
    });
}

async function loadBoardLists(boardId, backendUrl) {
    try {
        const response = await fetch(`${backendUrl}/api/board/${boardId}/lists`);
        if (response.ok) {
            const lists = await response.json();
            const selectElement = document.getElementById('selected-lists');

            lists.forEach(list => {
                const option = document.createElement('option');
                option.value = list.id;
                option.textContent = list.name;
                selectElement.appendChild(option);
            });
        } else {
            console.error('Failed to load board lists:', response.status);
        }
    } catch (e) {
        console.error('Error loading board lists:', e);
    }
}

function loadSavedSettings(boardId) {
    const settings = [
        'show-current-list-time',
        'show-total-time',
        'show-specific-lists-time',
        'show-personal-time'
    ];

    settings.forEach(id => {
        const saved = localStorage.getItem(`${boardId}_${id}`);
        if (saved !== null) {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.checked = saved === 'true';
        }
    });

    // Load saved colors
    const colors = ['current-list-color', 'total-time-color', 'specific-lists-color', 'personal-time-color'];
    colors.forEach(id => {
        const savedColor = localStorage.getItem(`${boardId}_${id}`);
        if (savedColor) {
            const colorBtn = document.getElementById(id);
            if (colorBtn) colorBtn.style.backgroundColor = savedColor;
        }
    });

    // Load selected lists
    const savedLists = localStorage.getItem(`${boardId}_selected-lists`);
    if (savedLists) {
        const selectedListIds = JSON.parse(savedLists);
        const selectElement = document.getElementById('selected-lists');
        if (selectElement) {
            selectedListIds.forEach(listId => {
                const option = selectElement.querySelector(`option[value="${listId}"]`);
                if (option) option.selected = true;
            });
        }
    }
}

function setupColorPickers() {
    const colors = ['current-list-color', 'total-time-color', 'specific-lists-color', 'personal-time-color'];

    colors.forEach(colorId => {
        const colorBtn = document.getElementById(colorId);
        if (colorBtn) {
            colorBtn.addEventListener('click', () => {
                const colorPicker = document.createElement('input');
                colorPicker.type = 'color';
                colorPicker.value = colorBtn.style.backgroundColor || '#0079bf';
                colorPicker.addEventListener('change', (e) => {
                    colorBtn.style.backgroundColor = e.target.value;
                });
                colorPicker.click();
            });
        }
    });
}

function saveSettings(boardId) {
    const settings = [
        'show-current-list-time',
        'show-total-time',
        'show-specific-lists-time',
        'show-personal-time'
    ];

    // Save checkboxes
    settings.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            localStorage.setItem(`${boardId}_${id}`, checkbox.checked);
        }
    });

    // Save colors
    const colors = ['current-list-color', 'total-time-color', 'specific-lists-color', 'personal-time-color'];
    colors.forEach(id => {
        const colorBtn = document.getElementById(id);
        if (colorBtn) {
            localStorage.setItem(`${boardId}_${id}`, colorBtn.style.backgroundColor);
        }
    });

    // Save selected lists
    const selectElement = document.getElementById('selected-lists');
    if (selectElement) {
        const selectedLists = Array.from(selectElement.selectedOptions).map(option => option.value);
        localStorage.setItem(`${boardId}_selected-lists`, JSON.stringify(selectedLists));
    }

    alert('Settings saved! Refresh the board to see changes on cards.');
}