import path from 'path';

import Papa from 'papaparse'; 
import stripBomStream from 'strip-bom-stream';
import { getResourcesPath, getUserDataPath } from '../util/appPaths';
import { loadYomichanZip, indexYomichanEntries } from './yomichan';
export { importEpwing } from './epwing';

const fs = window.require('fs-extra'); // use window to avoid webpack

const loadAndIndexYomichanZip = async (zipfn, builtin, reportProgress) => {
  const { name, termEntries } = await loadYomichanZip(zipfn, reportProgress);

  if (reportProgress) {
    reportProgress('Indexing ' + name + '...');
  }
  return {
    name,
    index: indexYomichanEntries(termEntries),
    builtin,
    filename: zipfn,
  };
};

const scanDirForYomichanZips = async (dir, builtin, reportProgress) => {
  const result = [];
  const dirents = await fs.readdir(dir);
  for (const dirent of dirents) {
    if (path.extname(dirent) === '.zip') {
      // Assume any zips are Yomichan dicts
      const info = await loadAndIndexYomichanZip(path.join(dir, dirent), builtin, reportProgress);
      result.push(info);
    }
  }
  return result;
};

export const loadKanjiDictionary = (reportProgress, kanjiDictionary) => {
  if (reportProgress) {
    reportProgress('Opening Kanji dictionary...');
  }

  const fn = path.join(getResourcesPath(), 'kanji-dictionaries\\kanji.csv');

  Papa.parse(fs.createReadStream(fn).pipe(stripBomStream()), {
    header: true,
    dynamicTyping: true,
    encoding: "UTF-8",
    delimiter: ";",
    step: row => {
      console.log(row)
      const rowData = row.data;
      kanjiDictionary[rowData.Kanji] = {
        Kanji: rowData.Kanji,
        OnReading: rowData.OnReading,
        KunReading: rowData.KunReading,
        Constituents: rowData.Constituents,
        Keyword: rowData.Keyword,
        Koohii1: rowData.Koohii1,
        Koohii2: rowData.Koohii2,
      }
    },
    error: error => {
      console.log(error);
    },
    complete: results => {
      console.log('done', results);
    }
  });
}

export const loadDictionaries = async (reportProgress) => {
  const result = [];

  // Scan for built-in dictionaries
  result.push(...await scanDirForYomichanZips(path.join(getResourcesPath(), 'dictionaries'), true, reportProgress));

  // Scan for imported dictionaries
  const importedPath = path.join(getUserDataPath(), 'dictionaries');
  if (await fs.exists(importedPath)) {
    result.push(...await scanDirForYomichanZips(path.join(getUserDataPath(), 'dictionaries'), false, reportProgress));
  }

  return result;
};

export const searchIndex = (index, word) => {
  const result = [];
  const sequences = index.wordOrReadingToSequences.get(word);
  if (sequences) {
    for (const seq of sequences) {
      const entry = index.sequenceToEntry.get(seq);
      result.push(Array.from(entry.glosses).join('\n'));
    }
  }

  return result;
};
