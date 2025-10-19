// Initialize the Power-Up when the SDK is ready
(function() {
    function initPowerUp() {
        if (window.TrelloPowerUp) {
            window.TrelloPowerUp.initialize({
    // 'card-badges' adds a badge to cards
    'card-badges': function(t, options) {
        return [{
            text: 'Tracker',
            icon: 'https://example.com/icon.png',
            color: 'blue',
            callback: function(t) {
                return t.popup({
                    title: 'Card Tracker',
                    url: t.signUrl('./powerup_frame.html')
                });
            }
        }];
    },
    // 'card-detail-badges' adds a badge in card details
    'card-detail-badges': function(t, options) {
        return [{
            title: 'Card Tracker',
            text: 'Open Tracker',
            callback: function(t) {
                return t.popup({
                    title: 'Card Tracker',
                    url: t.signUrl('./powerup_frame.html')
                });
            }
        }];
    },
    // 'board-buttons' adds a button to the board
    'board-buttons': function(t, options) {
        return [{
            icon: 'https://example.com/icon.png',
            text: 'Card Tracker',
            callback: function(t) {
                return t.popup({
                    title: 'Card Tracker Board',
                    url: t.signUrl('./powerup_frame.html')
                });
            }
        }];
    },
    // 'show-settings' displays UI in the card sidebar
    'show-settings': function(t, options) {
        // Return a Promise that resolves to a DOM element
        return new Promise((resolve) => {
            // Create the UI container
            const container = document.createElement('div');
            container.id = 'card-tracker-container';
            container.innerHTML = `
                <h3>Card Tracker</h3>
                <button id="load-metrics-btn">Load Metrics</button>
                <div id="settings">
                    <h4>Display Settings</h4>
                    <label><input type="checkbox" id="show-time-per-list" checked> Time per List</label><br>
                    <label><input type="checkbox" id="show-time-per-member" checked> Time per Member</label><br>
                    <label><input type="checkbox" id="show-total-time" checked> Total Time</label><br>
                    <label><input type="checkbox" id="show-list-counts" checked> List Counts</label><br>
                    <label><input type="checkbox" id="show-move-counts" checked> Move Counts</label><br>
                </div>
                <div id="content">Click "Load Metrics" to see data</div>
                <div id="history">History will appear here</div>
            `;

            // Logic for the UI
            const loadBtn = container.querySelector('#load-metrics-btn');
            const contentDiv = container.querySelector('#content');
            const historyDiv = container.querySelector('#history');

            // Load settings from localStorage
            const checkboxes = [
                'show-time-per-list',
                'show-time-per-member',
                'show-total-time',
                'show-list-counts',
                'show-move-counts'
            ];

            checkboxes.forEach(id => {
                const saved = localStorage.getItem(id);
                if (saved !== null) {
                    container.querySelector(`#${id}`).checked = saved === 'true';
                }
            });

            // Save settings on change
            checkboxes.forEach(id => {
                container.querySelector(`#${id}`).addEventListener('change', (e) => {
                    localStorage.setItem(id, e.target.checked);
                });
            });

            loadBtn.addEventListener('click', async () => {
                try {
                    // Get card context
                    const card = await t.card('id');
                    const cardId = card.id;

                    // Load metrics from backend
                    const backendUrl = window.BACKEND_URL || 'https://undefined-grateful-violations-kong.trycloudflare.com';

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

                    if (container.querySelector('#show-total-time').checked && metrics.total_time !== undefined) {
                        const totalHours = (metrics.total_time / 3600).toFixed(2);
                        html += `<div class="metric-group"><strong>Total Time:</strong> ${totalHours} hours</div>`;
                    }

                    if (container.querySelector('#show-time-per-list').checked && metrics.time_per_list) {
                        html += `<div class="metric-group"><strong>Time per List:</strong><ul>`;
                        for (const [list, time] of Object.entries(metrics.time_per_list)) {
                            const hours = (time / 3600).toFixed(2);
                            html += `<li>${list}: ${hours} hours</li>`;
                        }
                        html += `</ul></div>`;
                    }

                    if (container.querySelector('#show-time-per-member').checked && metrics.time_per_member) {
                        html += `<div class="metric-group"><strong>Time per Member:</strong><ul>`;
                        for (const [member, time] of Object.entries(metrics.time_per_member)) {
                            const hours = (time / 3600).toFixed(2);
                            html += `<li>${member}: ${hours} hours</li>`;
                        }
                        html += `</ul></div>`;
                    }

                    if (container.querySelector('#show-list-counts').checked && metrics.list_counts) {
                        html += `<div class="metric-group"><strong>List Counts:</strong><ul>`;
                        for (const [list, count] of Object.entries(metrics.list_counts)) {
                            html += `<li>${list}: ${count}</li>`;
                        }
                        html += `</ul></div>`;
                    }

                    if (container.querySelector('#show-move-counts').checked && metrics.move_counts_by_member) {
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

            // Return the DOM element for Trello to render
            resolve(container);
        });
    }
            });
        } else {
            console.error('Trello Power-Up SDK not loaded');
        }
    }

    // Wait for SDK to load
    if (window.TrelloPowerUp) {
        initPowerUp();
    } else {
        window.addEventListener('load', function() {
            setTimeout(initPowerUp, 100);
        });
    }
})();