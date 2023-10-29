import { requestStorage, selectWord, markYes, markNo } from '../scripts/db';
import { hideAllPages, showButtonBar } from '../scripts/utils';
import { showEditPage } from './edit';
import { showStatsPage } from './stats';
import { subscribe } from '../scripts/pubsub';
import { showHomePage } from './home';
import { getDefinition } from '../scripts/dictionary';

const $cribPage = document.getElementById('cribPage');
const $buttonBar = document.getElementById('button-bar');
const $buttonNo = document.getElementById('button-no');
const $buttonYes = document.getElementById('button-yes');
const $buttonRevealBar = document.getElementById('button-reveal-wrapper');
const $status = document.getElementById('status');
const $time = document.getElementById('time');
const $definition = document.getElementById('definition');
const $buttonReveal = document.getElementById('button-reveal');
const $word = document.getElementById('word');
const $editButton = document.getElementById('edit');
const $statsButton = document.getElementById('stats');

let currentWord;
let currentList;
let startTime;
let timeElapsed;
let wordsTodo;

$statsButton.addEventListener('click', () => {
  showStatsPage(currentList);
});

$editButton.addEventListener('click', () => {
  showEditPage(currentList);
});

$buttonNo.addEventListener('click', async (e) => {
  e.stopPropagation();
  await markNo(currentWord);
  display();
});

$buttonYes.addEventListener('click', async (e) => {
  e.stopPropagation();
  await markYes(currentWord, timeElapsed);
  if (wordsTodo === 1) {
    // We're done! So let's go back home
    showHomePage();
  } else {
    display();
  }
});

$buttonReveal.addEventListener('click', () => {
  reveal();
});

const showYesNoButtonBar = () => {
  $buttonBar.style.display = 'grid';
};

const showRevealBar = () => {
  $buttonRevealBar.style.display = 'grid';
};
const hideRevealBar = () => {
  $buttonRevealBar.style.display = 'none';
};

const reveal = async () => {
  timeElapsed = (new Date() - startTime) / 1000;
  $time.innerHTML = `Time: ${timeElapsed}`;
  let { definition, partsOfSpeech } = await getDefinition(currentWord);
  if (definition) {
    $definition.innerHTML = `${definition} (${partsOfSpeech})`;
  }
  showYesNoButtonBar();
  hideRevealBar();
  $word.innerText = currentWord.id;
};

const getAnagram = (word) => {
  const array = word.split('');
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join('');
};

const hideButtonBar = () => {
  $buttonBar.style.display = 'none';
};

const display = async () => {
  hideButtonBar();
  $definition.innerHTML = '';
  showRevealBar();
  let rtn = await selectWord(currentList);
  currentWord = rtn.word;
  wordsTodo = rtn.newWordCount + rtn.gotWrongWordCount + rtn.existingWordCount;
  $status.innerHTML = `NEW: ${rtn.newWordCount} | WRONG: ${rtn.gotWrongWordCount} | DUE:${rtn.existingWordCount}`;
  const anagram = getAnagram(currentWord.id);
  startTime = new Date();
  $word.innerText = anagram;
  getDefinition(currentWord);
};

const doList = (list) => {
  currentList = list;
  hideAllPages();
  showButtonBar(['home', 'edit', 'stats']);
  $cribPage.style.display = 'block';
  display();
};

export { doList };

requestStorage();

subscribe('DO_LIST', doList);
