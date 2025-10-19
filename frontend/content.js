// content.js - Logic for content.html and popup.html
document.addEventListener('DOMContentLoaded', function() {
    console.log('Content.js loaded, TrelloPowerUp available:', !!window.TrelloPowerUp);
    console.log('Window location:', window.location.href);
    console.log('URL params:', window.location.search);

    // Wait for Trello SDK to load with timeout
    let waitCount = 0;
    const maxWait = 100; // 10 seconds max

    function waitForTrelloSDK() {
        waitCount++;
        if (window.TrelloPowerUp) {
            console.log('Trello SDK loaded after', waitCount, 'checks, initializing...');
            initContent();
        } else if (waitCount < maxWait) {
            console.log('Waiting for Trello SDK... attempt', waitCount);
            setTimeout(waitForTrelloSDK, 100);
        } else {
            console.error('Trello SDK failed to load within timeout');
            initContent(); // Try to initialize anyway
        }
    }

    waitForTrelloSDK();
});

function initContent() {
    console.log('Initializing content...');

    // Add resize functionality
    addResizeFunctionality();

    const loadBtn = document.getElementById('load-metrics-btn');
    const contentDiv = document.getElementById('content');
    const historyDiv = document.getElementById('history');

    if (!loadBtn || !contentDiv || !historyDiv) {
        console.error('Required DOM elements not found');
        return;
    }

    const checkboxes = [
        'show-time-per-list',
        'show-time-per-member',
        'show-total-time',
        'show-list-counts',
        'show-move-counts',
        'show-history',
        'show-detailed-history'
    ];

    // Load settings from localStorage
    checkboxes.forEach(id => {
        const saved = localStorage.getItem(id);
        if (saved !== null) {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.checked = saved === 'true';
            }
        }
    });

    // Save settings on change
    checkboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                localStorage.setItem(id, e.target.checked);
            });
        }
    });

    loadBtn.addEventListener('click', async () => {
        try {
            // For popup context, we need to get card ID from Trello Power-Up context
            // The popup is opened from a card button, so we should have access to card context
            let cardId = null;

            // For popup context, card ID should be available in the hash/fragment
            // Parse the hash to get context information
            const hash = window.location.hash;
            if (hash) {
                try {
                    const hashData = JSON.parse(decodeURIComponent(hash.substring(1)));
                    if (hashData.context && hashData.context.card) {
                        cardId = hashData.context.card;
                        console.log('Got card ID from hash context:', cardId);
                    }
                } catch (e) {
                    console.log('Could not parse hash data:', e);
                }
            }

            // Fallback: try Trello Power-Up iframe context
            if (!cardId && window.TrelloPowerUp && typeof window.TrelloPowerUp.iframe === 'function') {
                try {
                    console.log('Trying Trello iframe fallback...');
                    const t = window.TrelloPowerUp.iframe();
                    if (t && typeof t.getContext === 'function') {
                        const context = t.getContext();
                        cardId = context.card;
                        console.log('Got card ID from Trello context fallback:', cardId);
                    }
                } catch (e) {
                    console.log('Trello iframe fallback failed:', e);
                }
            }

            // Alternative: try to get from URL parameters (if passed)
            if (!cardId) {
                const urlParams = new URLSearchParams(window.location.search);
                cardId = urlParams.get('cardId') || urlParams.get('card');
                if (cardId) {
                    console.log('Got card ID from URL:', cardId);
                }
            }

            if (!cardId) {
                contentDiv.innerHTML = 'No card selected. Please open this popup from a card button.';
                historyDiv.innerHTML = '';
                console.log('No card ID found');
                return;
            }
            const backendUrl = window.BACKEND_URL || 'http://localhost:8000';

            // Use default token from backend
            const token = null; // Will use default token from .env

            // First fetch history to populate DB
            const fetchResponse = await fetch(`${backendUrl}/api/card/${cardId}/fetch-history`);
            if (!fetchResponse.ok) {
                console.error(`Error fetching history: ${fetchResponse.status} ${fetchResponse.statusText}`);
            } else {
                console.log("History fetched successfully.");
            }

            // Then get metrics
            const response = await fetch(`${backendUrl}/api/card/${cardId}/metrics`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const metrics = await response.json();

            // Display metrics
            let html = '';

            if (document.getElementById('show-total-time').checked && metrics.total_time !== undefined) {
                const totalHours = (metrics.total_time / 3600).toFixed(2);
                html += `<div class="metric-group"><strong>Total Time:</strong> ${totalHours} hours</div>`;
            }

            if (document.getElementById('show-time-per-list').checked && metrics.time_per_list) {
                html += `<div class="metric-group"><strong>Time per List:</strong><ul>`;
                for (const [list, time] of Object.entries(metrics.time_per_list)) {
                    const hours = (time / 3600).toFixed(2);
                    html += `<li>${list}: ${hours} hours</li>`;
                }
                html += `</ul></div>`;
            }

            if (document.getElementById('show-time-per-member').checked && metrics.member_time_stats) {
                html += `<div class="metric-group"><strong>Time per Member:</strong><table border="1"><tr><th>Member</th><th>Action</th><th>Time per Card</th><th>Times Appears</th><th>Times Leaves</th></tr>`;
                for (const [member, stats] of Object.entries(metrics.member_time_stats)) {
                    const hours = (stats.total_time / 3600).toFixed(2);
                    const action = stats.sessions.length > 0 ? 'Multiple Sessions' : 'No Sessions';
                    html += `<tr><td>${member}</td><td>${action}</td><td>${hours} hours</td><td>${stats.appears_count}</td><td>${stats.leaves_count}</td></tr>`;
                }
                html += `</table></div>`;
            } else if (document.getElementById('show-time-per-member').checked) {
                html += `<div class="metric-group"><strong>Time per Member:</strong><br>No member time data available</div>`;
            }

            if (document.getElementById('show-list-counts').checked && metrics.list_counts) {
                html += `<div class="metric-group"><strong>List Counts:</strong><ul>`;
                for (const [list, count] of Object.entries(metrics.list_counts)) {
                    html += `<li>${list}: ${count}</li>`;
                }
                html += `</ul></div>`;
            }

            if (document.getElementById('show-move-counts').checked && metrics.move_counts_by_member) {
                html += `<div class="metric-group"><strong>Move Counts by Member:</strong><ul>`;
                for (const [member, counts] of Object.entries(metrics.move_counts_by_member)) {
                    html += `<li>${member}: `;
                    const subItems = [];
                    for (const [list, count] of Object.entries(counts)) {
                        subItems.push(`${list} (${count})`);
                    }
                    html += subItems.join(', ');
                    html += `</li>`;
                }
                html += `</ul></div>`;
            } else if (document.getElementById('show-move-counts').checked) {
                html += `<div class="metric-group"><strong>Move Counts by Member:</strong><br>No move count data available</div>`;
            }

            if (!html) {
                html = 'No metrics to display based on current settings.';
            }

            contentDiv.innerHTML = html;

            // Display history conditionally
            let historyHtml = '';

            if (document.getElementById('show-history').checked) {
                const historyResponse = await fetch(`${backendUrl}/api/card/${cardId}/history`);
                if (!historyResponse.ok) throw new Error(`HTTP error fetching history! status: ${historyResponse.status}`);

                const historyData = await historyResponse.json();

                historyHtml += '<h4>History</h4><table border="1"><tr><th>Date</th><th>Action</th><th>List</th><th>List Counts</th></tr>';
                if (historyData && historyData.length > 0) {
                    for (const action of historyData) {
                        const date = new Date(action.date).toLocaleString();
                        const type = action.type;
                        const listName = action.data?.listName || 'N/A';
                        const visitCount = action.data?.visitCount || 1;
                        historyHtml += `<tr><td>${date}</td><td>${type}</td><td>${listName}</td><td>${visitCount}</td></tr>`;
                    }
                } else {
                    historyHtml += '<tr><td colspan="4">No history found</td></tr>';
                }
                historyHtml += '</table>';
            }

            if (document.getElementById('show-detailed-history').checked) {
                if (historyHtml) {
                    historyHtml += '<hr style="border: 1px solid black; margin: 20px 0;">';
                }

                const detailedHistoryResponse = await fetch(`${backendUrl}/api/card/${cardId}/detailed-history`);
                if (!detailedHistoryResponse.ok) throw new Error(`HTTP error fetching detailed history! status: ${detailedHistoryResponse.status}`);

                const detailedHistoryData = await detailedHistoryResponse.json();

                historyHtml += '<h4>Detailed History</h4><table border="1"><tr><th>Date</th><th>Action</th><th>Member</th><th>Move To</th></tr>';
                if (detailedHistoryData && detailedHistoryData.length > 0) {
                    for (const action of detailedHistoryData) {
                        const date = new Date(action.date).toLocaleString();
                        const type = action.type;
                        const memberName = action.memberCreator?.name || 'N/A';
                        const moveTo = action.data?.moveTo || 'N/A';
                        historyHtml += `<tr><td>${date}</td><td>${type}</td><td>${memberName}</td><td>${moveTo}</td></tr>`;
                    }
                } else {
                    historyHtml += '<tr><td colspan="4">No detailed history found</td></tr>';
                }
                historyHtml += '</table>';
            }

            historyDiv.innerHTML = historyHtml;

        } catch (err) {
            console.error(err);
            contentDiv.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
            historyDiv.innerHTML = '';
        }
    });
}

function addResizeFunctionality() {
    // Find or create resize handle
    let resizeHandle = document.querySelector('.resize-handle');
    if (!resizeHandle) {
        resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        document.body.style.position = 'relative';
        document.body.appendChild(resizeHandle);
    }

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startHeight = parseInt(localStorage.getItem('card-tracker-iframe-height') || '500');
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaY = e.clientY - startY;
        const newHeight = Math.max(300, Math.min(1200, startHeight + deltaY));

        // Save to localStorage (use different key for card back section)
        const isCardBack = window.location.href.includes('popup.html');
        const storageKey = isCardBack ? 'card-tracker-card-back-height' : 'card-tracker-iframe-height';
        localStorage.setItem(storageKey, newHeight.toString());

        // Notify parent window to resize iframe
        if (window.parent && window.parent.postMessage) {
            window.parent.postMessage({
                type: 'resize-iframe',
                height: newHeight
            }, '*');
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
        }
    });
}