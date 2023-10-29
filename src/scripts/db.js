import { openDB } from 'idb';
import { getDriveTimestamp, pushAllToDrive, getDriveStuff } from './drive';
import { publish } from './pubsub';
import { getDefinition } from './dictionary.js';

let db;
const WORD_STORE_NAME = 'words';
const LIST_STORE_NAME = 'lists';
const PROP_STORE_NAME = 'props';
const LIST_INDEX = 'list';

const EXISTING_WORD_PROB = 0.8;
const GOT_NEW_PROB = 0.3;

const SM_FIRST_INTERVAL = 1;
const SM_SECOND_INTERVAL = 3;
const INITIAL_EF = 2.5;
const MINIMUM_EF = 1.3;
const MAXIMUM_EF = 3;
const TIME_CUT_OFF_FOR_5 = 2;
const TIME_CUT_OFF_FOR_4 = 5;

const initializeDb = async () => {
  if (db) return db;
  db = await openDB('Cribdown', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 2) {
        // Initial install or possibly upgrade 1 to 2
        if (db.objectStoreNames.contains(WORD_STORE_NAME)) {
          db.deleteObjectStore(WORD_STORE_NAME);
        }
        const wordStore = db.createObjectStore(WORD_STORE_NAME, {
          keyPath: ['id', 'l'],
        });
        wordStore.createIndex(LIST_INDEX, ['l', 'n']);

        if (db.objectStoreNames.contains(LIST_STORE_NAME)) {
          db.deleteObjectStore(LIST_STORE_NAME);
        }
        db.createObjectStore(LIST_STORE_NAME, { keyPath: 'id' });

        if (db.objectStoreNames.contains(PROP_STORE_NAME)) {
          db.deleteObjectStore(PROP_STORE_NAME);
        }
        db.createObjectStore(PROP_STORE_NAME, { keyPath: 'id' });
      }
    },
  });
  window.ddb = db;

  return db;
};

const updateTimestamp = async (needSync, value = new Date()) => {
  if (needSync) publish('NEED_SYNC');
  await db.put(PROP_STORE_NAME, { id: 'last_updated', value });
};

const getTimestamp = async () => {
  await initializeDb();
  const lastUpdated = await db.get(PROP_STORE_NAME, 'last_updated');
  return lastUpdated ? lastUpdated.value : false;
};

const getOverview = async (list) => {
  const today = new Date();
  today.setHours(23);
  today.setMinutes(59);
  const existingWordCount = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .count(IDBKeyRange.bound([list, new Date(2021, 1, 1)], [list, today]));
  const newWordCount = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .count(IDBKeyRange.bound([list], [list, new Date(2020, 1, 1)]));
  const gotWrongWordCount = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .count(
      IDBKeyRange.bound(
        [list, new Date(2021, 0, 1)],
        [list, new Date(2021, 0, 10)]
      )
    );
  return { existingWordCount, newWordCount, gotWrongWordCount };
};

const getDatesDue = async (list) => {
  const words = await getList(list);
  const dateDueObject = {};
  words.forEach((word) => {
    const dt = word.n.toISOString().substr(0, 10);
    if (!dateDueObject[dt]) {
      dateDueObject[dt] = 1;
    } else {
      dateDueObject[dt] += 1;
    }
  });

  const datesDue = Object.keys(dateDueObject).map((dateDue) => ({
    dateDue: dateDue === '2020-01-01' ? 'New' : dateDue,
    frequency: dateDueObject[dateDue],
  }));

  return datesDue;
};

const getStats = async (list) => {
  const words = await getList(list);

  const intervalObject = {};

  words.forEach((word) => {
    if (!intervalObject[word.i]) {
      intervalObject[word.i] = 1;
    } else {
      intervalObject[word.i] += 1;
    }
  });

  const intervals = Object.keys(intervalObject).map((interval) => ({
    interval,
    frequency: intervalObject[interval],
  }));

  const datesDue = await getDatesDue(list);

  return { intervals, datesDue };
};

const selectWord = async (list) => {
  // Find one existing word where the next date is less than now.
  // await ddb.transaction('words').store.index('list').count(IDBKeyRange.bound([list, new Date(2020, 1, 1)], [list, new Date()]));
  const today = new Date();
  today.setHours(23);
  today.setMinutes(59);
  const existingWordCount = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .count(IDBKeyRange.bound([list, new Date(2021, 1, 1)], [list, today]));
  const newWordCount = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .count(IDBKeyRange.bound([list], [list, new Date(2020, 1, 1)]));
  const gotWrongWordCount = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .count(
      IDBKeyRange.bound(
        [list, new Date(2021, 0, 1)],
        [list, new Date(2021, 0, 10)]
      )
    );

  let randomJump = Math.floor(Math.random() * existingWordCount);
  let existingWord = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .openCursor(IDBKeyRange.bound([list, new Date(2021, 1, 1)], [list, today]));
  if (randomJump > 0) await existingWord.advance(randomJump);

  // Do existing word x% of the time
  if (existingWord && Math.random() < EXISTING_WORD_PROB) {
    console.log('doing existing word');
    return {
      word: existingWord.value,
      existingWordCount,
      newWordCount,
      gotWrongWordCount,
    };
  }

  // Find one new word
  // await ddb.transaction('words').store.index('list').count(IDBKeyRange.bound(['Top 10'], ['Top 10', new Date(2020, 1, 1)]));
  randomJump = Math.floor(Math.random() * newWordCount);
  let newWord = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .openCursor(IDBKeyRange.bound([list], [list, new Date(2020, 1, 1)]));
  if (randomJump > 0) await newWord.advance(randomJump);

  // ..and one where i most recently got it wrong
  // await ddb.transaction('words').store.index('list').count(IDBKeyRange.bound([list, new Date(2021, 0, 1)], [list, new Date(2021, 0, 10)]));

  randomJump = Math.floor(Math.random() * gotWrongWordCount);
  let gotWrongWord = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .openCursor(
      IDBKeyRange.bound(
        [list, new Date(2021, 0, 1)],
        [list, new Date(2021, 0, 10)]
      )
    );
  if (randomJump > 0) await gotWrongWord.advance(randomJump);

  // If more than 8 wrong pick a wrong un
  if (gotWrongWordCount >= 8) {
    console.log("Too many wrong let's do one of them...");
    return {
      word: gotWrongWord.value,
      existingWordCount,
      newWordCount,
      gotWrongWordCount,
    };
  }

  if (newWord) {
    if (gotWrongWord) {
      console.log('Got both new and wrong');
      if (Math.random() < GOT_NEW_PROB) {
        console.log('Doing new');
        return {
          word: newWord.value,
          existingWordCount,
          newWordCount,
          gotWrongWordCount,
        };
      }
      console.log('Doing wrong');
      return {
        word: gotWrongWord.value,
        existingWordCount,
        newWordCount,
        gotWrongWordCount,
      };
    } else {
      console.log('Only got new');
      return {
        word: newWord.value,
        existingWordCount,
        newWordCount,
        gotWrongWordCount,
      };
    }
  } else if (gotWrongWord) {
    console.log('Only got wrong');
    return {
      word: gotWrongWord.value,
      existingWordCount,
      newWordCount,
      gotWrongWordCount,
    };
  }
  // we're all caught up so just get the earliest
  let cursor = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .openCursor(IDBKeyRange.bound([list], [list, []]));

  console.log('all caught up doing next word');
  return {
    word: cursor.value,
    existingWordCount,
    newWordCount,
    gotWrongWordCount,
  };
};

const requestStorage = async () => {
  // Request persistent storage for site
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) document.body.classList.add('persisted');
  }
};

const markYes = async (word, time) => {
  console.log('marking YES');
  console.log(word, time);
  let q = 5;
  if (time > TIME_CUT_OFF_FOR_5) q = 4;
  if (time > TIME_CUT_OFF_FOR_4) q = 3;

  if (word.i === 0) {
    word.i = SM_FIRST_INTERVAL;
  } else if (word.i === SM_FIRST_INTERVAL) {
    word.i = SM_SECOND_INTERVAL;
  } else {
    word.e = word.e - 0.8 + 0.28 * q - 0.02 * q * q;
    word.e = Math.max(Math.min(word.e, MAXIMUM_EF), MINIMUM_EF);
    word.i = Math.floor(word.i * word.e);
  }

  const nextTime = new Date();
  nextTime.setDate(nextTime.getDate() + word.i);
  word.n = nextTime;
  if (!word.d) {
    const { definition, phonetic, partsOfSpeech } = await getDefinition(word);
    if (definition) {
      word.d = definition;
      word.p = phonetic;
      word.s = partsOfSpeech;
    }
  }
  console.log(word);
  await db.put(WORD_STORE_NAME, word);
  await updateTimestamp(true);
};

const markNo = async (word) => {
  console.log('Marking NO');
  console.log(word);
  word.i = 0;
  word.n = new Date(2021, 0, 2);
  word.e = word.e - 0.8;
  word.e = Math.max(Math.min(word.e, MAXIMUM_EF), MINIMUM_EF);
  if (!word.d) {
    const { definition, phonetic, partsOfSpeech } = await getDefinition(word);
    if (definition) {
      word.d = definition;
      word.p = phonetic;
      word.s = partsOfSpeech;
    }
  }
  console.log(word);
  await db.put(WORD_STORE_NAME, word);
  await updateTimestamp(true);
};

const getLists = async () => {
  await initializeDb();

  const lists = await db.getAllKeys(LIST_STORE_NAME);
  return lists;
};

const getListsWithProgress = async () => {
  const lists = await getLists();
  const rtn = [];
  for (let list of lists) {
    const overview = await getOverview(list);
    const datesDue = await getDatesDue(list);
    rtn.push({ list, overview, datesDue });
  }
  return rtn;
};

const addListToDb = async (name) => {
  const tx = db.transaction(LIST_STORE_NAME, 'readwrite');
  await tx.store.add({ id: name });
  await updateTimestamp(true);
};

const addList = async (name, content) => {
  await initializeDb();

  const newWords = content
    .replace(/\r/g, '')
    .split('\n')
    .filter((x) => x.length > 2);

  await addListToDb(name);

  // first add the new words
  {
    const tx = db.transaction(WORD_STORE_NAME, 'readwrite');
    await Promise.all(
      newWords
        .map((word) =>
          tx.store.add({
            id: word,
            e: INITIAL_EF,
            i: 1,
            n: new Date(2020, 0, 1),
            l: name,
          })
        )
        .concat(tx.done)
    );
  }
};

const overwriteLocal = async (store, data) => {
  await db.clear(store);
  const tx = db.transaction(store, 'readwrite');
  await Promise.all(data.map((datum) => tx.store.add(datum)).concat(tx.done));
};

const getList = async (list) => {
  const words = await db
    .transaction('words')
    .store.index('list')
    .getAll(IDBKeyRange.bound([list], [list, []]));
  return words;
};

const removeList = async (list) => {
  await db.delete(LIST_STORE_NAME, list);
  const wordsToDelete = await db
    .transaction(WORD_STORE_NAME)
    .store.index(LIST_INDEX)
    .getAllKeys(IDBKeyRange.bound([list], [list, []]));
  for (let wordToDelete of wordsToDelete) {
    await db.delete(WORD_STORE_NAME, wordToDelete);
  }
  await updateTimestamp(true);
};

const sync = async () => {
  publish('SHOW_SYNC_MESSAGE');
  publish(
    'DISPLAY_MESSAGE',
    'Checking to see if we need to sync...<div class="lds-loader"><div></div><div></div><div></div></div>'
  );
  const [localTimestamp, driveTimestamp] = await Promise.all([
    getTimestamp(),
    getDriveTimestamp(),
  ]);
  if (!localTimestamp) {
    if (!driveTimestamp) {
      console.log(
        'No local and no drive timestamp - nothing will happen on close'
      );
      // do nothing
    } else {
      console.log('No local timestamp - will pull from drive on close');
      publish(
        'DISPLAY_MESSAGE',
        'Nothing stored locally so pulling from gDrive...<div class="lds-loader"><div></div><div></div><div></div></div>'
      );
      const { words, lists } = await getDriveStuff();
      await Promise.all([
        overwriteLocal(WORD_STORE_NAME, words),
        overwriteLocal(LIST_STORE_NAME, lists),
      ]);
      await updateTimestamp(false, new Date(driveTimestamp));
      // pull down from drive
    }
  } else if (!driveTimestamp) {
    console.log('No drive timestamp - will push to drive on close');
    publish(
      'DISPLAY_MESSAGE',
      'Nothing in gDrive so pushing from local...<div class="lds-loader"><div></div><div></div><div></div></div>'
    );
    const [words, lists] = await Promise.all([
      db.getAll(WORD_STORE_NAME),
      db.getAll(LIST_STORE_NAME),
    ]);
    await pushAllToDrive(words, lists, localTimestamp.toISOString());
    // push to drive
  } else {
    const localDate = new Date(localTimestamp);
    const driveDate = new Date(driveTimestamp);
    if (localDate.getTime() === driveDate.getTime()) {
      console.log('Timestamps are the same - nothing will happen on close');
    } else if (localDate.getTime() > driveDate.getTime()) {
      console.log('local timestamp ahead of drive - will push drive on close');
      publish(
        'DISPLAY_MESSAGE',
        'Local ahead of gDRive. Pushing...<div class="lds-loader"><div></div><div></div><div></div></div>'
      );
      const [words, lists] = await Promise.all([
        db.getAll(WORD_STORE_NAME),
        db.getAll(LIST_STORE_NAME),
      ]);
      await pushAllToDrive(words, lists, localTimestamp.toISOString());
    } else {
      console.log(
        'drive timestamp ahead of local - will pull from drive on close'
      );
      publish(
        'DISPLAY_MESSAGE',
        'gDrive ahead of local. Pulling...<div class="lds-loader"><div></div><div></div><div></div></div>'
      );
      const { words, lists } = await getDriveStuff();
      await Promise.all([
        overwriteLocal(WORD_STORE_NAME, words),
        overwriteLocal(LIST_STORE_NAME, lists),
        await updateTimestamp(false, new Date(driveTimestamp)),
      ]);
    }
  }
  publish('HIDE_SYNC_MESSAGE');
};

const updateWord = async (list, oldWord, newWord) => {
  // get old word
  const word = await db.get(WORD_STORE_NAME, IDBKeyRange.only([oldWord, list]));

  if (word) {
    // delete old word
    await db.delete(WORD_STORE_NAME, IDBKeyRange.only([oldWord, list]));

    word.id = newWord;
    // insert new word
    await db.put(WORD_STORE_NAME, word);
    await updateTimestamp(true);
  }
};

export {
  selectWord,
  updateWord,
  requestStorage,
  markYes,
  markNo,
  getLists,
  getListsWithProgress,
  addList,
  sync,
  getList,
  removeList,
  getStats,
};
