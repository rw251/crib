import { hideAllPages, showButtonBar } from '../scripts/utils';
import { removeList, getList, updateWord } from '../scripts/db';

const editPage = document.getElementById('editPage');
const editList = document.getElementById('editList');
const deleteButton = document.getElementById('deleteList');

let currentList;

const showEditPage = async (list) => {
  currentList = list;
  const words = await getList(list);
  editList.innerHTML = words
    .sort((a, b) => {
      if (a.id === b.id) return 0;
      return a.id > b.id ? 1 : -1;
    })
    .map(
      (x) =>
        `<div><input type="text" value="${x.id}" /><input type="button" data-id="${x.id}" value="Save" /></div>`
    )
    .join('');
  hideAllPages();
  showButtonBar(['home']);
  editPage.style.display = 'block';
};

deleteButton.addEventListener('click', async () => {
  await removeList(currentList);
  window.location.reload();
});

editList.addEventListener('click', async (e) => {
  if (e.target.dataset && e.target.dataset.id) {
    const oldWord = e.target.dataset.id;
    const newWord = e.target.parentNode.firstChild.value;

    if (newWord !== oldWord) {
      await updateWord(currentList, oldWord, newWord);
      await showEditPage(currentList);
    }
  }
});

export { showEditPage };
