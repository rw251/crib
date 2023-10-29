import { subscribe } from '../scripts/pubsub';

const $banner = document.getElementById('reloadBanner');

$banner.addEventListener('click', () => {
  window.location.reload();
});

const makeVisible = () => {
  $banner.style.display = 'block';
};

subscribe('NEW_SW_CONTROLLING', makeVisible);
