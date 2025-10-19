/* global TrelloPowerUp */

var GRAY_ICON = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDhDMTIgOS4xIDEwLjkgMTAgOCA5LjEgNy4xIDEwIDYgOSA2IDggNy4xIDcgOCA2LjkgOS4xIDcgMTAgOCA5IDEwLjkgMTAgMTIgOTh6IiBmaWxsPSIjNmI3NzhjIi8+Cjwvc3ZnPgo=';

var cardButtonCallback = function(t){
  return t.popup({
    title: 'Card Tracker',
    url: t.signUrl('./popup.html')
  });
};

var boardButtonCallback = function(t){
  return t.modal({
    title: 'Card Tracker - Board Settings',
    url: t.signUrl('./board-settings.html'),
    height: 600
  });
};

TrelloPowerUp.initialize({
  'card-badges': function(t, options) {
    return new Promise(async (resolve) => {
      const board = await t.board('id');
      const backendUrl = window.BACKEND_URL || 'http://localhost:8000';

      // Get current card info
      const card = await t.card('id', 'idList');
      const badges = [];

      try {
        // Fetch metrics for this card (history should already be loaded)
        const response = await fetch(`${backendUrl}/api/card/${card.id}/metrics`);
        if (response.ok) {
          const metrics = await response.json();

          // Check board settings
          const showCurrentListTime = localStorage.getItem(`${board.id}_show-current-list-time`) === 'true';
          const showTotalTime = localStorage.getItem(`${board.id}_show-total-time`) === 'true';
          const showSpecificListsTime = localStorage.getItem(`${board.id}_show-specific-lists-time`) === 'true';
          const showPersonalTime = localStorage.getItem(`${board.id}_show-personal-time`) === 'true';

          const currentListColor = localStorage.getItem(`${board.id}_current-list-color`) || '#0079bf';
          const totalTimeColor = localStorage.getItem(`${board.id}_total-time-color`) || '#61bd4f';
          const specificListsColor = localStorage.getItem(`${board.id}_specific-lists-color`) || '#ff9f43';
          const personalTimeColor = localStorage.getItem(`${board.id}_personal-time-color`) || '#eb5a46';

          // Get selected lists for specific lists time
          const selectedLists = JSON.parse(localStorage.getItem(`${board.id}_selected-lists`) || '[]');

          // Current list time badge
          if (showCurrentListTime && metrics.time_per_list) {
            // Find current list name - we need to get it from Trello
            const listsResponse = await fetch(`${backendUrl}/api/board/${board.id}/lists`);
            if (listsResponse.ok) {
              const lists = await listsResponse.json();
              const currentList = lists.find(l => l.id === card.idList);
              if (currentList && metrics.time_per_list[currentList.name]) {
                const hours = (metrics.time_per_list[currentList.name] / 3600).toFixed(1);
                badges.push({
                  text: `${currentList.name}: ${hours}h`,
                  color: currentListColor
                });
              }
            }
          }

          // Total time badge
          if (showTotalTime && metrics.total_time !== undefined) {
            const hours = (metrics.total_time / 3600).toFixed(1);
            badges.push({
              text: `Total: ${hours}h`,
              color: totalTimeColor
            });
          }

          // Specific lists time badge - only show if card is in one of the selected lists
          if (showSpecificListsTime && metrics.time_per_list && selectedLists.length > 0 && selectedLists.includes(card.idList)) {
            const listsResponse = await fetch(`${backendUrl}/api/board/${board.id}/lists`);
            if (listsResponse.ok) {
              const lists = await listsResponse.json();
              const currentList = lists.find(l => l.id === card.idList);
              if (currentList && metrics.time_per_list[currentList.name]) {
                const hours = (metrics.time_per_list[currentList.name] / 3600).toFixed(1);
                badges.push({
                  text: `${currentList.name}: ${hours}h`,
                  color: specificListsColor
                });
              }
            }
          }

          // Personal time badge - this would require user context
          // For now, we'll skip this as it needs more complex implementation
          // The analysis shows this is technically possible but complex
        }
      } catch (e) {
        console.error('Error loading card badges:', e);
      }

      // Fallback badge if no custom badges
      if (badges.length === 0) {
        badges.push({
          text: 'Tracker',
          color: 'blue'
        });
      }

      resolve(badges);
    });
  },
  // Remove card-detail-badges to avoid duplicate buttons
  'card-detail-badges': function(t, options) {
    return [{
      title: 'Card Tracker',
      text: 'Open Tracker',
      icon: GRAY_ICON,
      callback: cardButtonCallback
    }];
  },
  'card-back-section': function(t, options) {
    // Get saved height from localStorage
    const savedHeight = localStorage.getItem('card-tracker-card-back-height') || 300;
    return {
      title: 'Card Tracker',
      icon: GRAY_ICON,
      content: {
        type: 'iframe',
        url: t.signUrl('./popup.html'),
        height: parseInt(savedHeight)
      }
    };
  },
  'board-buttons': function(t, options) {
    return [{
      icon: GRAY_ICON,
      text: 'Card Tracker',
      callback: boardButtonCallback
    }];
  },
  'card-buttons': function(t, options) {
    return [{
      icon: GRAY_ICON,
      text: 'Open Tracker',
      callback: cardButtonCallback
    }];
  },
  'content': function(t, options) {
    // Get saved height from localStorage
    const savedHeight = localStorage.getItem('card-tracker-iframe-height') || 500;
    return {
      title: 'Card Tracker',
      icon: GRAY_ICON,
      content: {
        type: 'iframe',
        url: t.signUrl('./content.html'),
        height: parseInt(savedHeight)
      }
    };
  },
  'show-settings': function(t, options) {
    return new Promise(async (resolve) => {
      const container = document.createElement('div');
      container.id = 'card-tracker-container';

      // Get board info to fetch lists
      const board = await t.board('id', 'name');
      const backendUrl = window.BACKEND_URL || 'http://localhost:8000';

      // Fetch current lists from Trello API
      let lists = [];
      try {
        const listsResponse = await fetch(`${backendUrl}/api/board/${board.id}/lists`);
        if (listsResponse.ok) {
          lists = await listsResponse.json();
        }
      } catch (e) {
        console.error('Error fetching lists:', e);
      }

      container.innerHTML = `
        <h3>Card Tracker - Board Settings</h3>
        <style>
          .badge-setting { margin: 15px 0; padding: 10px; border: 1px solid #ddd; }
          .color-picker { display: inline-block; width: 30px; height: 30px; border: 1px solid #ccc; cursor: pointer; margin-left: 10px; }
          .list-selector { margin-top: 5px; }
          .list-selector select { width: 100%; height: 120px; }
        </style>

        <div class="badge-setting">
          <label><input type="checkbox" id="show-current-list-time"> Show time in current list</label>
          <button class="color-picker" id="current-list-color" style="background-color: #0079bf;"></button>
        </div>

        <div class="badge-setting">
          <label><input type="checkbox" id="show-total-time"> Show total time</label>
          <button class="color-picker" id="total-time-color" style="background-color: #61bd4f;"></button>
        </div>

        <div class="badge-setting">
          <label><input type="checkbox" id="show-specific-lists-time"> Show time in specific lists</label>
          <button class="color-picker" id="specific-lists-color" style="background-color: #ff9f43;"></button>
          <div class="list-selector">
            <select multiple id="selected-lists" size="5">
              ${lists.map(list => `<option value="${list.id}">${list.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="badge-setting">
          <label><input type="checkbox" id="show-personal-time"> Show time only for me</label>
          <button class="color-picker" id="personal-time-color" style="background-color: #eb5a46;"></button>
        </div>

        <button id="save-settings-btn" style="margin-top: 20px; padding: 10px 20px; background: #0079bf; color: white; border: none; cursor: pointer;">Save Settings</button>
      `;

      // Load saved settings
      const settings = [
        'show-current-list-time',
        'show-total-time',
        'show-specific-lists-time',
        'show-personal-time'
      ];

      settings.forEach(id => {
        const saved = localStorage.getItem(`${board.id}_${id}`);
        if (saved !== null) {
          const checkbox = container.querySelector(`#${id}`);
          if (checkbox) checkbox.checked = saved === 'true';
        }
      });

      // Load saved colors
      const colors = ['current-list-color', 'total-time-color', 'specific-lists-color', 'personal-time-color'];
      colors.forEach(id => {
        const savedColor = localStorage.getItem(`${board.id}_${id}`);
        if (savedColor) {
          container.querySelector(`#${id}`).style.backgroundColor = savedColor;
        }
      });

      // Load selected lists
      const savedLists = localStorage.getItem(`${board.id}_selected-lists`);
      if (savedLists) {
        const selectedListIds = JSON.parse(savedLists);
        const selectElement = container.querySelector('#selected-lists');
        selectedListIds.forEach(listId => {
          const option = selectElement.querySelector(`option[value="${listId}"]`);
          if (option) option.selected = true;
        });
      }

      // Color picker functionality
      colors.forEach(colorId => {
        const colorBtn = container.querySelector(`#${colorId}`);
        colorBtn.addEventListener('click', () => {
          const colorPicker = document.createElement('input');
          colorPicker.type = 'color';
          colorPicker.value = colorBtn.style.backgroundColor || '#0079bf';
          colorPicker.addEventListener('change', (e) => {
            colorBtn.style.backgroundColor = e.target.value;
          });
          colorPicker.click();
        });
      });

      // Save settings
      container.querySelector('#save-settings-btn').addEventListener('click', () => {
        settings.forEach(id => {
          const checkbox = container.querySelector(`#${id}`);
          localStorage.setItem(`${board.id}_${id}`, checkbox.checked);
        });

        colors.forEach(id => {
          const colorBtn = container.querySelector(`#${id}`);
          localStorage.setItem(`${board.id}_${id}`, colorBtn.style.backgroundColor);
        });

        const selectedLists = Array.from(container.querySelector('#selected-lists').selectedOptions).map(option => option.value);
        localStorage.setItem(`${board.id}_selected-lists`, JSON.stringify(selectedLists));

        alert('Settings saved! Refresh the board to see changes.');
      });

      resolve(container);
    });
  }
});

console.log('Loaded by: ' + document.referrer);