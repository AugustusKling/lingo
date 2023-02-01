import fs  from 'node:fs';
import yaml from 'js-yaml';
import { open } from 'node:fs/promises';

const languages = {'swe': 'sv', 'rus': 'ru', 'deu': 'de', 'epo': 'eo'};

async function readTsv(filename, headers) {
    const file = await open(filename);

    const lines = [];
    for await (const line of file.readLines()) {
        const lineSplit = line.split('\t');
        const lineParsed = {};
        headers.forEach((key, index) => {
            lineParsed[key] = lineSplit[index];
        });
        lines.push(lineParsed);
    }
    return lines;
}
function byRef(translations) {
    const map = new Map();
    for (const trans of translations) {
        map.set(trans.ref, trans);
    }
    return map;
}

const detailColumnNames = ['ref', 'lang', 'sentence', 'author', 'added', 'modified'];
console.log('Reading references (eng) and filters according to swe');
const englishReference = await readTsv('eng_sentences_detailed.tsv', detailColumnNames);
const swedishFilter = new Set((await readTsv('swe-eng_links.tsv', ['transId', 'eng'])).map(l => parseInt(l.eng)));
const refCache = {};
englishReference.forEach(ref => refCache[ref.ref] = ref);
const exercises = {};
for(const lang of Object.keys(languages)) {
    console.log('Importing ' + lang);
    const translations = await readTsv(lang + '_sentences_detailed.tsv', detailColumnNames);
    const translationsByRef = byRef(translations);
    const links = await readTsv(lang + '-eng_links.tsv', ['transId', 'eng']);
    console.log(links.length + ' sentence links for ' + lang);
    for(const {transId, eng} of links) {
        if (!swedishFilter.has(parseInt(eng))) {
            continue;
        }
        
        let exercise = exercises[eng];
        if (exercise === undefined) {
            const ref = refCache[eng];
            if (!ref) {
                //console.log(`Skipping missing translation of eng: ${eng}`);
                continue;
            }
            exercise = {
                translations: {
                    en: [{
                        text: ref.sentence,
                        author: ref.author,
                        source: 'https://tatoeba.org/en/sentences/show/' + eng,
                        licence: 'https://creativecommons.org/licenses/by/2.0/fr/'
                    }]
                }
            };
            exercises[eng] = exercise;
        }
        const langExport = languages[lang];
        if (!exercise.translations[langExport]) {
            exercise.translations[langExport] = [];
        }
        const trans = translationsByRef.get(transId);
        if (!trans) {
            //console.log(`Skipping missing translation of ${lang}: ${transId}`);
            continue;
        }
        exercise.translations[langExport].push({
            text: trans.sentence,
            author: trans.author,
            source: 'https://tatoeba.org/en/sentences/show/' + transId,
            licence: 'https://creativecommons.org/licenses/by/2.0/fr/'
        });
    }
}

for(const [id, exercise] of Object.entries(exercises)) {
    fs.writeFileSync(`exercises/tatoeba/${id}.yml`, yaml.dump(exercise));
}
