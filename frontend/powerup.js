window.TrelloPowerUp.initialize({
  'card-buttons': function(t, options) {
    // Кнопка, которая появляется на карточке (не в боковой панели)
    return [{
      icon: 'https://cdn.hackernoon.com/images/0*4GzUhaAr1vMfs05I.png', // Замените на URL вашей иконки
      text: 'Card Tracker',
      callback: async function(t) {
        // Открывает всплывающее окно или панель с вашим UI
        return t.popup({
          title: 'Card Tracker Metrics',
          url: /* ваш iframe URL, если нужно, или */ './card-tracker-ui.html' // или открывает другую вкладку
        });
      }
    }];
  },
  'show-settings': function(t, options) {
    // Отображение UI в боковой панели карточки
    return t.render(function(t) {
      // Создаём HTML для отображения в боковой панели
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

      // Вставляем в контейнер боковой панели
      document.body.appendChild(container);

      // --- Логика --- (та же, что и раньше, но без window.TrelloPowerUp проверки в начале)
      const loadBtn = document.getElementById('load-metrics-btn');
      const contentDiv = document.getElementById('content');
      const historyDiv = document.getElementById('history'); // Новый div для истории

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

      loadBtn.addEventListener('click', async () => {
        try {
          // Получаем контекст Trello Power-Up *внутри* render функции
          const card = await t.card('id');
          const cardId = card.id;

          // Загружаем метрики с бэкенда через HTTPS-туннель
          // window.BACKEND_URL должен быть определён выше или передан сюда
          // Лучше всего передать через window или получить через t.set/t.get если нужно хранить на сервере
          // Пока используем хардкод или window.location.origin
          const backendUrl = window.BACKEND_URL || window.location.origin; // Убедитесь, что BACKEND_URL установлен где-то

          // Сначала fetch-history, чтобы данные были в БД
          const fetchResponse = await fetch(`${backendUrl}/api/card/${cardId}/fetch-history`);
          if (!fetchResponse.ok) {
            console.error(`Error fetching history: ${fetchResponse.status} ${fetchResponse.statusText}`);
            // Продолжаем, даже если fetch не удался
          } else {
            console.log("History fetched successfully.");
          }

          // Затем получаем метрики
          const response = await fetch(`${backendUrl}/api/card/${cardId}/metrics`);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

          const metrics = await response.json();

          // --- Отображение метрик ---
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

          // --- Отображение истории ---
          // Загружаем историю
          const historyResponse = await fetch(`${backendUrl}/api/card/${cardId}/history`); // Новый эндпоинт!
          if (!historyResponse.ok) throw new Error(`HTTP error fetching history! status: ${historyResponse.status}`);

          const historyData = await historyResponse.json();

          let historyHtml = '<h4>History</h4><table border="1"><tr><th>Date</th><th>Action</th><th>List Before</th><th>List After</th><th>Member</th></tr>';
          if (historyData && historyData.length > 0) {
            for (const action of historyData) {
              const date = new Date(action.date).toLocaleString();
              const type = action.type;
              const listBefore = action.data?.listBefore?.name || 'N/A';
              const listAfter = action.data?.listAfter?.name || 'N/A';
              const member = action.memberCreator?.username || 'N/A';
              historyHtml += `<tr><td>${date}</td><td>${type}</td><td>${listBefore}</td><td>${listAfter}</td><td>${member}</td></tr>`;
            }
          } else {
            historyHtml += '<tr><td colspan="5">No history found</td></tr>';
          }
          historyHtml += '</table>';
          historyDiv.innerHTML = historyHtml;

        } catch (err) {
          console.error(err);
          contentDiv.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
          historyDiv.innerHTML = '';
        }
      });

      // Возвращаем DOM-элемент, который будет отображён
      return container;
    });
  }
});

// Убедитесь, что window.BACKEND_URL установлен, например:
// window.BACKEND_URL = 'https://ваш-туннель.trycloudflare.com';
// Это можно сделать в powerup.html перед подключением скрипта, или передать иным способом.
// В новом подходе, где UI внутри render(), вы можете определить его тут или получить из настроек.