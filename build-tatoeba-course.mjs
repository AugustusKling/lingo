import fs  from 'node:fs';
import yaml from 'js-yaml';
import { open, mkdir, stat, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { execSync, spawnSync } from 'node:child_process';

const [nodeExecutable, scriptName, fromLanguage, toLanguage] = process.argv;

const uiLanguages = ['eng', 'deu'];

function removeLastConsoleLine() {
    process.stdout.write('\u001B[1A\u001B[2K');
}

/**
 * Fetches and extracts Tatoeba data.
 * @return Local path to extracted file.
 */
async function getTatoebaFile(path) {
    if (!path.startsWith('/')) {
        throw new Error('Invalid path');
    }
    const url = new URL('https://downloads.tatoeba.org/');
    url.pathname = path;
    
    const targetFile = './cache/tatoeba-downloads' + path;
    const targetFileExtracted =  targetFile.replace(/\.tsv\.bz2$/, '.tsv');
    const folderPath = dirname(targetFileExtracted);
    await mkdir(folderPath, { recursive: true });
    const headers = {};
    let cacheLastModified = new Date(0);
    try {
        cacheLastModified = (await stat(targetFileExtracted)).mtime;
        headers['If-Modified-Since'] = cacheLastModified.toGMTString();
    } catch {
        console.log(`${path} was not download before`);
    }
    
    const response = await fetch(url, { headers });
    // Response status is not set properly, but last-modified header is there.
    const serverLastModified = response.headers.get('Last-Modified') && new Date(response.headers.get('Last-Modified'));
    if (response.status === 304 || (serverLastModified && serverLastModified < cacheLastModified)) {
        // Cached version is still current.
        return targetFileExtracted;
    } else if (response.status !== 200) {
        throw new Error(`Download of ${url} failed.`);
    } else {
        console.log(`Updating cached version of ${url}`);
        const writeStream = fs.createWriteStream(targetFile, { flags: 'w' });
        await finished(Readable.fromWeb(response.body).pipe(writeStream));
        
        if (targetFile.endsWith('.tsv.bz2')) {
            if (fs.existsSync(targetFileExtracted)) {
                await rm(targetFileExtracted);
            }
            // Extract and delete compressed file.
            execSync(`bunzip2 --decompress ${targetFile}`);
        }
        
        return targetFileExtracted;
    }
}

async function readTatoebaTsv(tatoebaPath, headers) {
    return readTsv(await getTatoebaFile(tatoebaPath), headers);
}
async function readTsv(localPath, headers) {
    const file = await open(localPath);

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

function toCourseSentence(translationDetail) {
    return {
        id: translationDetail.ref,
        text: translationDetail.sentence,
        author: translationDetail.author,
        source: 'https://tatoeba.org/en/sentences/show/' + translationDetail.ref,
        licence: 'https://creativecommons.org/licenses/by/2.0/fr/'
    };
}

let tatoebaCsrfToken;
async function getTatoebaCsrfToken() {
    if (tatoebaCsrfToken) {
        return tatoebaCsrfToken;
    }
    
    const tatoebaHtmlRequest = await fetch('https://tatoeba.org/en/contact');
    const cookies = tatoebaHtmlRequest.headers.getSetCookie();
    for (const cookie of cookies) {
        if (cookie.startsWith('csrfToken=')) {
            return cookie.replace(/^csrfToken=/, '').split(';')[0];
        }
    }
    
    throw new Error(`Failed to get Tatoeba CSRF token,`);
}
async function downloadList(listId) {
    console.log(`Downloading list ${listId}`);
    const csrfToken = await getTatoebaCsrfToken();
    
    const exportRequest = new FormData();
    exportRequest.append('fields[]', 'id');
    exportRequest.append('format', 'txt');
    exportRequest.append('list_id', listId);
    exportRequest.append('type', 'list');
    const exportJobResponse = await fetch(`https://tatoeba.org/en/exports/add`, {
        method: 'POST',
        body: exportRequest,
        headers: {
            'Cookie': `csrfToken=${csrfToken};`,
            'X-CSRF-Token': csrfToken
        }
    });
    if (!exportJobResponse.ok) {
        try {
            console.error(await exportJobResponse.text());
        } finally {
            throw new Error(`Creation of export job for list ${listId} failed.`);
        }
    }
    const exportJob = (await exportJobResponse.json()).export;
    console.log(` Scheduled download job ${exportJob.id}: ${exportJob.name}`);
    
    // Give server enough time to prepare export and keep load low..
    await new Promise(resolve => setTimeout(() => resolve('awaited'), 10_000));
    
    const exportResultResponse = await fetch(`https://tatoeba.org/en/exports/download/${encodeURI(exportJob.id)}/${encodeURI(exportJob.name)}.txt`, {
        method: 'GET',
        headers: {
            'Cookie': `csrfToken=${csrfToken};`,
            'X-CSRF-Token': csrfToken
        }
    });
     if (!exportResultResponse.ok) {
        try {
            console.error(await exportResultResponse.text());
        } finally {
            throw new Error(`Download of export job for list ${listId} failed.`);
        }
    }
    const exportResult = await exportResultResponse.text();
    return exportResult.split(/\r?\n/).map(id => id.trim());
}
async function getList(listId) {
    const cacheFilePath = `./cache/tatoeba-lists/${listId}.json`;
    let cacheLastModified = new Date(0);
    try {
        cacheLastModified = (await stat(cacheFilePath)).mtime;
    } catch {
        console.log(`${cacheFilePath} was not download before`);
    }
    const maxValidityMilliseconds = 1000 * 60 * 60 * 24;
    if (cacheLastModified.getTime() + maxValidityMilliseconds > Date.now()) {
        return JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    } else {
        const sentenceIds = await downloadList(listId);
        fs.writeFileSync(cacheFilePath, JSON.stringify(sentenceIds));
        return sentenceIds;
    }
}

const espeakLanguages = {
    swe: 'sv',
    spa: 'es',
    rus: 'ru',
    por: 'pt',
    nld: 'nl',
    eng: 'en-gb',
    deu: 'de',
    epo: 'eo',
    ita: 'it',
    fra: 'fr-fr'
};
const openIpaDictionaries = {};
const toLanguageWordSegmenter = new Intl.Segmenter(toLanguage, { granularity: "word" });
let ipaTranscriptionCalls = 0;
function toIPA(ipaDict, language, text) {
    const espeakLanguage = espeakLanguages[language];
    if (!espeakLanguage) {
        return;
    }
    if (!openIpaDictionaries[language]) {
        const dictPath = `./cache/ipa/${language}.json`;
        if(fs.existsSync(dictPath)) {
            openIpaDictionaries[language] = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
        } else {
            openIpaDictionaries[language] = {};
        }
    }
    for(const segment of toLanguageWordSegmenter.segment(text)) {
        if(segment.isWordLike) {
            const word = segment.segment;
            if (ipaDict[word]) {
                continue;
            }
            const cachedTranscription = openIpaDictionaries[language][word];
            if (cachedTranscription) {
                ipaDict[word] = cachedTranscription;
                continue;
            }
            
            ipaTranscriptionCalls = ipaTranscriptionCalls + 1;
            if (ipaTranscriptionCalls % 100 === 0) {
                for(const language in openIpaDictionaries) {
                    const dictPath = `./cache/ipa/${language}.json`;
                    fs.writeFileSync(dictPath, JSON.stringify(openIpaDictionaries[language]));
                }
            }
            
            const result = spawnSync('espeak-ng', [word, '--ipa=2', '-v', espeakLanguage, '-q'], {
                encoding: 'utf-8'
            });
            if (result.error) {
                console.warn(`Failed IPA transcription for ${word}`, result.error);
            } else {
                ipaDict[word] = result.stdout.replaceAll(/\s/g, '')
                    // Remove espeak's markers for foreign language content.
                    .replaceAll(/\(.+?\)/g, '');
                openIpaDictionaries[language][word] = ipaDict[word];
            }
        }
    }
}

const detailColumnNames = ['ref', 'lang', 'sentence', 'author', 'added', 'modified'];

console.log(`Building course ${fromLanguage} to ${toLanguage}`);


console.log('Reading sentences for ' + fromLanguage);
const fromTranslations = await readTatoebaTsv(`/exports/per_language/${fromLanguage}/${fromLanguage}_sentences_detailed.tsv.bz2`, detailColumnNames);
const fromTranslationsByRef = byRef(fromTranslations);
console.log('Reading sentences for ' + toLanguage);
const toTranslations = await readTatoebaTsv(`/exports/per_language/${toLanguage}/${toLanguage}_sentences_detailed.tsv.bz2`, detailColumnNames);
const toTranslationsByRef = byRef(toTranslations);

console.log('Reading links');
let links = await readTatoebaTsv(`/exports/per_language/${fromLanguage}/${fromLanguage}-${toLanguage}_links.tsv.bz2`, ['fromId', 'toId']);
console.log(links.length + ' sentence links found');


const lessons = [];
const lessonNames = fs.readdirSync('lessons');
for(const lessonName of lessonNames) {
    try {
        const doc = yaml.load(fs.readFileSync(`lessons/${lessonName}`, 'utf8'));
        if (!uiLanguages.some(uiLang => doc.title[uiLang])) {
            console.log(`Failed to read ${lessonName}. It has no title.`);
        }
        if(!doc.exercises) {
            doc.exercises = [];
        }
        if (doc.lists) {
            for(const list of doc.lists) {
                for(const sentenceId of await getList(list)) {
                    if(!doc.exercises.includes(sentenceId)) {
                        doc.exercises.push(sentenceId);
                    }
                }
            }
            delete doc.lists;
        }
        lessons.push({...doc, name: lessonName});
    } catch (e) {
        console.log('Failed to read ' + lessonName, e);
    }
}
console.log(`Loaded ${lessons.length} lessons.`);
const expansionFiles = [`/exports/per_language/eng/eng-${fromLanguage}_links.tsv.bz2`, `/exports/per_language/eng/eng-${toLanguage}_links.tsv.bz2`].filter(fileName => !fileName.startsWith('eng-eng'));
console.log(`Loading exercise expansions ${expansionFiles}.`);
const expansions = {};
for(const expansionFileName of expansionFiles) {
    const expansionPairs = await readTatoebaTsv(expansionFileName, ['engId', 'fromOrToId']);
    for(const {engId, fromOrToId} of expansionPairs) {
        if (!expansions[engId]) {
            expansions[engId] = [fromOrToId];
        } else {
            expansions[engId].push(fromOrToId);
        }
    }
}

console.log(`Loading tags`);
const usedTags = lessons.flatMap(lesson => lesson.exerciseTags || []);
const sentenceAndTag = await readTatoebaTsv('/exports/tags.csv', ['sentenceId', 'tag']);
const tagsToSentenceIds = {};
const taggedSentenceIds = new Set();
for(const {sentenceId, tag} of sentenceAndTag) {
    if (!usedTags.includes(tag)) {
        continue;
    }
    taggedSentenceIds.add(sentenceId);
    if (tagsToSentenceIds[tag]) {
        tagsToSentenceIds[tag].push(sentenceId);
    } else {
        tagsToSentenceIds[tag] = [sentenceId];
    }
}
// Add sentences from lessons.
lessons.flatMap(lesson => lesson.exercises ?? []).forEach(sentenceId => taggedSentenceIds.add(sentenceId));

if (links.length > 50_000) {
    const englishSentencesTranslatedToAnyCourseContent = Array.from(taggedSentenceIds)
        .filter(mayBeEnglishSentenceId => expansions[mayBeEnglishSentenceId] !== undefined);
    const indirectCourseSentencesIds = new Set(englishSentencesTranslatedToAnyCourseContent.flatMap(englishSentenceId => expansions[englishSentenceId]));
    console.log(`Restricting to tagged sentences to reduce data amount`);
    links = links.filter(({fromId, toId}) => {
        const courseContentDirectlyReferenceFromAnyLesson = taggedSentenceIds.has(fromId) || taggedSentenceIds.has(toId);
        const courseContentReferencedViaEnglishTranslationFromAnyLesson = indirectCourseSentencesIds.has(fromId) || indirectCourseSentencesIds.has(toId);
        return courseContentDirectlyReferenceFromAnyLesson || courseContentReferencedViaEnglishTranslationFromAnyLesson;
    });
    console.log(`${links.length} links remaining.`);
}

const course = {
    from: fromLanguage,
    to: toLanguage,
    lessons: [],
    sentences: {
        [fromLanguage]: [],
        [toLanguage]: []
    },
    // from -> to
    links: [],
    ipaTranscriptions: {}
};
const addedSentences = new Set();

console.log(`Merging sentences into course.`);
let linksProcessIndex = 0;
for(const {fromId, toId} of links) {
    if (linksProcessIndex > 0) {
        removeLastConsoleLine();
    }
    linksProcessIndex++;
    console.log(' Link %d/%d (%d%%)', linksProcessIndex, links.length, (linksProcessIndex*100/links.length).toFixed(2));
    
    const fromTranslationDetail = fromTranslationsByRef.get(fromId);
    const toTranslationDetail = toTranslationsByRef.get(toId);
    if (!fromTranslationDetail || !toTranslationDetail) {
        continue;
    }
    course.links.push([fromId, toId]);
    
    if (!addedSentences.has(fromId)) {
        course.sentences[fromLanguage].push(toCourseSentence(fromTranslationDetail));
        addedSentences.add(fromId);
    }
    if (!addedSentences.has(toId)) {
        course.sentences[toLanguage].push(toCourseSentence(toTranslationDetail));
        toIPA(course.ipaTranscriptions, toLanguage, toTranslationDetail.sentence);
        addedSentences.add(toId);
    }
}

// Add lessons to courses which are sets of hand-picked sentences.

console.log(`Building lessons`);
for(const lesson of lessons) {
    const supportedExercises = new Set();
    const exercises = (lesson.exercises || []).map(String);
    for (const exerciseTag of (lesson.exerciseTags || [])) {
        exercises.push(...tagsToSentenceIds[exerciseTag] || []);
    }
    for(const exerciseRef of exercises) {
        const sentenceIds = [exerciseRef].concat(expansions[exerciseRef] || []);
        for (const sentenceId of sentenceIds) {
            if (addedSentences.has(sentenceId)) {
                const sentenceIdsIfLessonRefersFrom = course.links.filter(([fromId, toId]) => fromId === sentenceId);
                const toSentenceIds = sentenceIdsIfLessonRefersFrom.length > 0 ? sentenceIdsIfLessonRefersFrom.map(([fromId, toId]) => toId) : [sentenceId];
                for(const id of toSentenceIds) {
                    supportedExercises.add(id);
                }
            }
        }
    }
    const supportedExercisesArray = Array.from(supportedExercises);
    if (supportedExercisesArray.length === 0) {
        console.log(`Omitting lesson ${lesson.name}`);
    } else {
        course.lessons.push({
            ...lesson,
            exercises: supportedExercisesArray
        });
        console.log(`Adding ${lesson.name} with ${supportedExercisesArray.length} exercises.`);
    }
}
console.log(`Constructed ${course.lessons.length} lessons.`);

console.log(`Writing ${course.sentences[fromLanguage].length} ${fromLanguage} sentences, ${course.sentences[toLanguage].length} ${toLanguage} sentences.`);

fs.mkdirSync('public/dist-data/courses/', { recursive: true });
fs.writeFileSync(`public/dist-data/courses/${fromLanguage} to ${toLanguage}.json`, JSON.stringify(course));

const courseIndexFile = `public/dist-data/courses/index.json`;
const courseIndex = JSON.parse(fs.readFileSync(courseIndexFile, 'utf8'));
courseIndex[`${fromLanguage} to ${toLanguage}`] = {
    from: fromLanguage,
    to: toLanguage,
    lessons: course.lessons.length,
    exercises: course.sentences[toLanguage].length,
    buildTime: new Date().toISOString()
};
fs.writeFileSync(courseIndexFile, JSON.stringify(courseIndex));

console.log('');
console.log('From\tTo\tExercises\tBuild Time');
for(const languageStats of Object.values(courseIndex).sort((a, b) => `${a.from} ${a.to}`.localeCompare(`${b.from} ${b.to}`))) {
    console.log(`${languageStats.from}\t${languageStats.to}\t${languageStats.exercises}\t\t${languageStats.buildTime}`); 
}

for(const language in openIpaDictionaries) {
    const dictPath = `./cache/ipa/${language}.json`;
    fs.writeFileSync(dictPath, JSON.stringify(openIpaDictionaries[language]));
}
