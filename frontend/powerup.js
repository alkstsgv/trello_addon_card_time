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
    return t.modal({
      title: 'Card Tracker - Board Settings',
      url: t.signUrl('./board-settings.html'),
      height: 600
    });
  }
});

console.log('Loaded by: ' + document.referrer);