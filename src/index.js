import './components/reloadBanner';
import './scripts/auth';
import './components/syncStatus';

import { publish } from './scripts/pubsub';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      publish('NEW_SW_CONTROLLING');
    });

    navigator.serviceWorker.register('/service-worker.js');
  });
}

// Do offline stuff
if (navigator.onLine === false) {
  document.body.classList.add('offline');
}
