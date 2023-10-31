const fs = require('fs');
const { join } = require('path');

const DEFINITIONS = join(__dirname, 'data', 'definitions.json');
let exitCount = 0;

const words = fs
  .readFileSync(join(__dirname, '..', 'words-top-100.txt'), 'utf8')
  .split('\n')
  .concat(
    fs
      .readFileSync(join(__dirname, '..', 'words-next-200.txt'), 'utf8')
      .replace(/\r/g, '')
      .split('\n')
  )
  .concat(
    fs
      .readFileSync(join(__dirname, '..', 'words-next-400.txt'), 'utf8')
      .replace(/\r/g, '')
      .split('\n')
  )
  .concat(
    fs
      .readFileSync(join(__dirname, '..', 'words-next-800.txt'), 'utf8')
      .replace(/\r/g, '')
      .split('\n')
  );
const definitions = JSON.parse(fs.readFileSync(DEFINITIONS, 'utf8'));

async function processNextTenWords() {
  return Promise.all(
    words
      .filter((word) => !definitions[word])
      .slice(0, 10)
      .map((word) => {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`;
        return fetch(url)
          .then((resp) => resp.json())
          .then((urlResp) => {
            definitions[word] = {
              definition: urlResp[0].meanings[0].definitions[0].definition,
              partsOfSpeech: urlResp[0].meanings.map((x) => x.partOfSpeech).join(', '),
              phonetic: urlResp[0].phonetic,
            };
          })
          .catch(() => {
            definitions[word] = {};
          });
      })
  ).then(() => {
    fs.writeFileSync(DEFINITIONS, JSON.stringify(definitions, null, 2));
  });
}

async function getWiktionaryDefinition(rootWord, nextWord = rootWord) {
  const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${nextWord.toLowerCase()}&section=1&prop=wikitext&format=json&origin=*`;
  const urlResp = await fetch(url).then((resp) => resp.json());

  if (urlResp.parse && urlResp.parse.wikitext && urlResp.parse.wikitext['*']) {
    const isPlural = urlResp.parse.wikitext['*'].match(/\{\{plural of\|en\|([^}]+)\}\}/);
    if (isPlural) {
      await getWiktionaryDefinition(rootWord, isPlural[1]);
      if (definitions[rootWord] && definitions[rootWord].definition) {
        definitions[rootWord].definition = `Plural. ${definitions[rootWord].definition}`;
      }
      return;
    }

    const isComparative = urlResp.parse.wikitext['*'].match(/comparative of\|([^}]+)\}\}/);
    if (isComparative) {
      await getWiktionaryDefinition(rootWord, isComparative[1]);
      if (definitions[rootWord] && definitions[rootWord].definition) {
        definitions[rootWord].definition = `Comparative. ${definitions[rootWord].definition}`;
      }
      return;
    }

    //simple past of|swim}}
    //past participle of|en|outsee|nocat=1}}
    //{{en-past of|defend}}
    const isPast = urlResp.parse.wikitext['*'].match(
      /(?:past of|past participle of)\|(?:en\|)?([^}|]+)[}|]/
    );
    if (isPast) {
      await getWiktionaryDefinition(rootWord, isPast[1]);
      if (definitions[rootWord] && definitions[rootWord].definition) {
        definitions[rootWord].definition = `Past tense. ${definitions[rootWord].definition}`;
      }
      return;
    }

    //{{en-third-person singular of|outdo}}

    let isAlt = urlResp.parse.wikitext['*'].match(/\{\{alt form\|en\|([^|]+)\|\|([^}]+)\}\}/);
    if (isAlt) {
      definitions[rootWord].definition = `${nextWord}: alt spelling of ${isAlt[2]} - ${isAlt[3]}`;
      definitions[rootWord].partsOfSpeech = isAlt[1];
      return;
    }
    isAlt = urlResp.parse.wikitext['*'].match(
      /\{\{(?:alternative form of|alt form)\|en\|([^}]+)\}\}/
    );
    if (isAlt) {
      await getWiktionaryDefinition(rootWord, isAlt[1]);
      if (definitions[rootWord] && definitions[rootWord].definition) {
        definitions[
          rootWord
        ].definition = `alt spelling of ${isAlt[1]} - ${definitions[rootWord].definition}`;
      }
      return;
    }

    //{{archaic form of|en|aneurine}}
    const isArchaic = urlResp.parse.wikitext['*'].match(/archaic form of\|(?:en\|)?([^}|]+)[}|]/);
    if (isArchaic) {
      await getWiktionaryDefinition(rootWord, isArchaic[1]);
      if (definitions[rootWord] && definitions[rootWord].definition) {
        definitions[
          rootWord
        ].definition = `Archaic form of ${isArchaic[1]}: ${definitions[rootWord].definition}`;
      }
      return;
    }

    let isAltSpelling = urlResp.parse.wikitext['*'].match(
      /\{\{alternative spelling of\|en\|([^}]+)\}\}/
    );
    if (isAltSpelling) {
      return await getWiktionaryDefinition(rootWord, isAltSpelling[1]);
    }

    isAltSpelling = urlResp.parse.wikitext['*'].match(/\{\{alt sp\|en\|([^}]+)\}\}/);
    if (isAltSpelling) {
      return await getWiktionaryDefinition(rootWord, isAltSpelling[1]);
    }

    const regex = /(?:-(noun|verb|adj|adv)[^#]+#([^\n#]+))+/g;

    const partsOfSpeech = [];
    let matches;
    while ((matches = regex.exec(urlResp.parse.wikitext['*']))) {
      partsOfSpeech.push(matches[1]);
      if (!definitions[rootWord].definition) {
        const def = matches[2]
          .replace(/\[[^\]]+\|([^|]+)\]/g, '$1')
          .replace(/[[\]]/g, '')
          .replace('\n', '')
          .replace(/\{\{[^}]*\}\}/g, '')
          .trim();
        definitions[rootWord].definition = def;
      }
    }
    if (partsOfSpeech.length > 0) definitions[rootWord].partsOfSpeech = partsOfSpeech.join(', ');
  }

  if (!definitions[rootWord] || !definitions[rootWord].definition) {
    if (nextWord.slice(-3).toLowerCase() === 'ies') {
      await getWiktionaryDefinition(rootWord, nextWord.slice(0, -3) + 'y');
      if (definitions[rootWord] && definitions[rootWord].partsOfSpeech.indexOf('noun') > -1) {
        // probably safe to assume a plural.
        definitions[rootWord].definition = `Plural. ${definitions[rootWord].definition}`;
      }
      return;
    } else if (nextWord.slice(-1).toLowerCase() === 's') {
      await getWiktionaryDefinition(rootWord, nextWord.slice(0, -1));
      if (definitions[rootWord] && definitions[rootWord].partsOfSpeech.indexOf('noun') > -1) {
        // probably safe to assume a plural.
        definitions[rootWord].definition = `Plural. ${definitions[rootWord].definition}`;
      }
      return;
    } else {
      console.log(`Nothing found for: ${rootWord}`);
      definitions[rootWord].definition = 'TODO';
      definitions[rootWord].partsOfSpeech = 'TODO';
      definitions[rootWord].phonetic = 'TODO';
      exitCount++;
    }
  }
}

async function processNextTenWordsPass2() {
  const undefinedWords = Object.entries(definitions).filter(([, def]) => !def.definition);
  const words = undefinedWords.slice(0, 10);
  console.log(undefinedWords.length);

  try {
    await Promise.all(words.map(([word]) => getWiktionaryDefinition(word)));
    fs.writeFileSync(DEFINITIONS, JSON.stringify(definitions, null, 2));
  } catch (e) {
    console.log(`error when looking up definition for ${words}`);
  }
}

async function loop() {
  if (exitCount >= 40) process.exit();
  const delay = Math.floor(Math.random() * 30 * 1000);
  console.log(`Waiting ${Math.floor(delay / 1000)}s...`);
  setTimeout(() => {
    processNextTenWords()
      .then(processNextTenWordsPass2)
      .then(() => {
        loop();
      });
  }, delay);
}

loop();
