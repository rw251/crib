import { addList, sync, getListsWithProgress } from '../scripts/db';
import { doList } from './crib';
import { showButtonBar, hideAllPages, hideButtonBar } from '../scripts/utils';
import { getBarChart } from './barChart';
import { subscribe } from '../scripts/pubsub';

const homePage = document.getElementById('homePage');
const homePageContent = document.getElementById('homePageContent');
const addButton = document.getElementById('add');
const homeButton = document.getElementById('home');
const newList = document.getElementById('new-list');
const loadButton = document.getElementById('load');
const syncButton = document.getElementById('sync');

const showHomePage = async (isInitialLoad) => {
  hideAllPages();
  hideButtonBar();
  newList.style.display = 'none';
  homePageContent.innerHTML = 'Starting sync...';
  homePageContent.style.display = 'flex';
  if (isInitialLoad) await sync();
  const currentLocalLists = await getListsWithProgress();
  homePageContent.innerHTML = [...currentLocalLists]
    .map(
      ({ list, overview }) =>
        `<button class="list-loader" data-id="${list}">${list}
          <div style="margin-top:10px;pointer-events:none">
          ${
            overview.newWordCount
              ? `<span style="background-color:blue;padding:4px;border-radius:12px">${overview.newWordCount}</span>`
              : ''
          }
          ${
            overview.gotWrongWordCount
              ? `<span style="background-color:red;padding:4px;border-radius:12px">${overview.gotWrongWordCount}</span>`
              : ''
          }
          <span style="background-color:orange;padding:4px;border-radius:12px">${
            overview.existingWordCount
          }</span>
          </div>
          <div data-bar-id="${list}" style="pointer-events:none;margin-top:10px">
          </div>
        </button>`
    )
    .join('');
  [...currentLocalLists].forEach(({ list, datesDue }) => {
    document.querySelector(`[data-bar-id="${list}"]`).appendChild(getBarChart(datesDue));
  });
  homePage.style.display = 'flex';
  showButtonBar(['add', 'sync']);
};

homePage.addEventListener('click', (e) => {
  if (e.target.classList.contains('list-loader')) {
    doList(e.target.dataset.id);
  }
});

addButton.addEventListener('click', () => {
  newList.style.display = 'flex';
  homePageContent.style.display = 'none';
  showButtonBar(['home']);
});

function addSyncHighlight() {
  homeButton.classList.add('sync-highlight');
  syncButton.classList.add('sync-highlight');
}

function removeSyncHighlight() {
  homeButton.classList.remove('sync-highlight');
  syncButton.classList.remove('sync-highlight');
}

homeButton.addEventListener('click', () => {
  showHomePage();
});

syncButton.addEventListener('click', async () => {
  await sync();
  removeSyncHighlight();
});

loadButton.addEventListener('click', async () => {
  const name = document.getElementById('list-name').value;
  const file = document.getElementById('list-file').files[0];

  const reader = new FileReader();
  const fileContents = await new Promise((resolve, reject) => {
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });

  await addList(name, fileContents);
  newList.style.display = 'none';
  showHomePage();
});

subscribe('NEED_SYNC', () => {
  addSyncHighlight();
});

export { showHomePage };
