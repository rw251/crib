const definitions = {};

async function getDefinition(wordObject) {
  // Might already have one
  if (wordObject.d) {
    return { phonetic: wordObject.p, definition: wordObject.d, partsOfSpeech: wordObject.s };
  }

  // Or might have already looked it up
  if (definitions[wordObject.id]) return definitions[wordObject.id];

  // Otherwise let's look it up
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${wordObject.id.toLowerCase()}`;
  definitions[wordObject.id] = { definition: false };
  try {
    const urlResp = await fetch(url).then((resp) => resp.json());
    if (urlResp[0].phonetic) {
      definitions[wordObject.id].phonetic = urlResp[0].phonetic;
    }
    if (urlResp[0].meanings && urlResp[0].meanings.length > 0) {
      definitions[wordObject.id].definition = urlResp[0].meanings[0].definitions[0].definition;
      definitions[wordObject.id].partsOfSpeech = urlResp[0].meanings
        .map((x) => x.partOfSpeech)
        .join(', ');
    }
  } catch (e) {
    console.log(`error when looking up definition for ${wordObject.id}`);
    await getAltDefinition(wordObject.id);
  }

  return definitions[wordObject.id];
}

async function getAltDefinition(rootWord, nextWord = rootWord) {
  const url = `https://en.wiktionary.org/w/api.php?action=parse&page=${nextWord.toLowerCase()}&section=1&prop=wikitext&format=json&origin=*`;

  try {
    const urlResp = await fetch(url).then((resp) => resp.json());
    if (urlResp.parse && urlResp.parse.wikitext && urlResp.parse.wikitext['*']) {
      const isPlural = urlResp.parse.wikitext['*'].match(/\{\{plural of\|en\|([^}]+)\}\}/);
      if (isPlural) {
        return await getAltDefinition(rootWord, isPlural[1]);
      }

      let isAlt = urlResp.parse.wikitext['*'].match(
        /-(noun|verb|adj)[^#]+# ?\{\{alt form\|en\|([^|]+)\|\|([^}]+)\}\}/
      );
      if (isAlt) {
        definitions[rootWord].definition = `${nextWord}: alt spelling of ${isAlt[2]} - ${isAlt[3]}`;
        definitions[rootWord].partsOfSpeech = isAlt[1];
        return;
      }
      let isAltSpelling = urlResp.parse.wikitext['*'].match(
        /\{\{alternative spelling of\|en\|([^}]+)\}\}/
      );
      if (isAltSpelling) {
        return await getAltDefinition(rootWord, isAltSpelling[1]);
      }

      const match = urlResp.parse.wikitext['*'].match(
        /==(?:English|Scots)(?:[^#]*-(noun|verb|adj)[^#]+# ?(?:\{\{[^}]*\}\})?([^\\]+))(?:[^#]*-(noun|verb|adj)[^#]+# ?(?:\{\{[^}]*\}\})?([^\\]+))?(?:[^#]*-(noun|verb|adj)[^#]+# ?(?:\{\{[^}]*\}\})?([^\\]+))?(?:[^#]*-(noun|verb|adj)[^#]+# ?(?:\{\{[^}]*\}\})?([^\\]+))?(?:[^#]*-(noun|verb|adj)[^#]+# ?(?:\{\{[^}]*\}\})?([^\\]+))?/
      );
      definitions[rootWord].definition = match.filter((x, i) => i % 2 === 1).join('; ');
      definitions[rootWord].partsOfSpeech = match
        .slice(1)
        .filter((x, i) => i % 2 === 1)
        .join(', ');
    }
  } catch (e) {
    console.log(`error when looking up definition for ${nextWord}`);
  }
}

export { getDefinition };
