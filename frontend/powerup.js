document.addEventListener("DOMContentLoaded", () => {
	const loadBtn = document.getElementById('load-metrics-btn');
	const contentDiv = document.getElementById('content');

	// Создаём UI для настроек
	const settingsDiv = document.createElement('div');
	settingsDiv.id = 'settings';
	settingsDiv.innerHTML = `
    <h4>Display Settings</h4>
    <label><input type="checkbox" id="show-time-per-list" checked> Time per List</label><br>
    <label><input type="checkbox" id="show-time-per-member" checked> Time per Member</label><br>
    <label><input type="checkbox" id="show-total-time" checked> Total Time</label><br>
    <label><input type="checkbox" id="show-list-counts" checked> List Counts</label><br>
    <label><input type="checkbox" id="show-move-counts" checked> Move Counts</label><br>
  `;
	// Проверяем, что contentDiv существует и находится в DOM
	if (contentDiv.parentNode) {
		contentDiv.parentNode.insertBefore(settingsDiv, contentDiv);
	} else {
		// Если contentDiv не в DOM, просто добавляем в body
		document.body.appendChild(settingsDiv);
	}

	// Загружаем настройки из localStorage
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
			document.getElementById(id).checked = saved === 'true';
		}
	});

	// Сохраняем настройки при изменении
	checkboxes.forEach(id => {
		document.getElementById(id).addEventListener('change', (e) => {
			localStorage.setItem(id, e.target.checked);
		});
	});

	// Проверяем, что Trello Power-Up API доступен
	if (!window.TrelloPowerUp) {
		console.error("Trello Power-Up API не загружен. Страница не работает вне iframe Trello.");
		return;
	}

	// Получаем iframe-контекст Power-Up
	const t = window.TrelloPowerUp.iframe();

	loadBtn.addEventListener('click', async () => {
		try {
			const card = await t.card('id');
			const cardId = card.id;

			// Загружаем метрики с бэкенда через HTTPS-туннель
			const response = await fetch(`${window.BACKEND_URL}/api/card/${cardId}/metrics`); // <-- Замените на ваш URL
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

			const metrics = await response.json();

			// Формируем HTML для отображения метрик
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
		} catch (err) {
			console.error(err);
			contentDiv.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
		}
	});
});