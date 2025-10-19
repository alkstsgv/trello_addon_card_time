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
        'show-move-counts'
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

            if (document.getElementById('show-time-per-member').checked && metrics.time_per_member) {
                html += `<div class="metric-group"><strong>Time per Member:</strong><ul>`;
                for (const [member, time] of Object.entries(metrics.time_per_member)) {
                    const hours = (time / 3600).toFixed(2);
                    html += `<li>${member}: ${hours} hours</li>`;
                }
                html += `</ul></div>`;
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
            }

            if (!html) {
                html = 'No metrics to display based on current settings.';
            }

            contentDiv.innerHTML = html;

            // Display history
            const historyResponse = await fetch(`${backendUrl}/api/card/${cardId}/history`);
            if (!historyResponse.ok) throw new Error(`HTTP error fetching history! status: ${historyResponse.status}`);

            const historyData = await historyResponse.json();

            let historyHtml = '<h4>History</h4><table border="1"><tr><th>Date</th><th>Action</th><th>List</th><th>Member</th></tr>';
            if (historyData && historyData.length > 0) {
                for (const action of historyData) {
                    const date = new Date(action.date).toLocaleString();
                    const type = action.type;
                    const listName = action.data?.listName || 'N/A';
                    const memberId = action.memberCreator?.id || 'N/A';
                    historyHtml += `<tr><td>${date}</td><td>${type}</td><td>${listName}</td><td>${memberId}</td></tr>`;
                }
            } else {
                historyHtml += '<tr><td colspan="4">No history found</td></tr>';
            }
            historyHtml += '</table>';
            historyDiv.innerHTML = historyHtml;

        } catch (err) {
            console.error(err);
            contentDiv.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
            historyDiv.innerHTML = '';
        }
    });
}