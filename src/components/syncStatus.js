const { subscribe } = require('../scripts/pubsub');

const $syncStatus = document.getElementById('syncStatus');
const $themeColour = document.querySelector('meta[name=theme-color]');
const originalThemeColour = $themeColour.getAttribute('content');

const showSyncMessage = () => {
  $syncStatus.innerHTML = '';
  $syncStatus.style.display = 'flex';
  $themeColour.setAttribute('content', '#0D98FD');
};

const hideSyncMessage = () => {
  $syncStatus.style.display = 'none';
  $themeColour.setAttribute('content', originalThemeColour);
};

const displayMessage = (message) => {
  $syncStatus.innerHTML = message;
};

subscribe('SHOW_SYNC_MESSAGE', showSyncMessage);
subscribe('DISPLAY_MESSAGE', displayMessage);
subscribe('HIDE_SYNC_MESSAGE', hideSyncMessage);
