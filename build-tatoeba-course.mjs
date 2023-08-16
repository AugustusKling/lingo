import fs  from 'node:fs';
import yaml from 'js-yaml';
import { open } from 'node:fs/promises';

const [nodeExecutable, scriptName, fromLanguage, toLanguage] = process.argv;
const linksFileName = `${fromLanguage}-${toLanguage}_links.tsv`;

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

function toCourseSentence(translationDetail) {
    return {
        id: translationDetail.ref,
        text: translationDetail.sentence,
        author: translationDetail.author,
        source: 'https://tatoeba.org/en/sentences/show/' + translationDetail.ref,
        licence: 'https://creativecommons.org/licenses/by/2.0/fr/'
    };
}

const detailColumnNames = ['ref', 'lang', 'sentence', 'author', 'added', 'modified'];

console.log(`Building course ${fromLanguage} to ${toLanguage}`);


console.log('Reading sentences for ' + fromLanguage);
const fromTranslations = await readTsv(fromLanguage + '_sentences_detailed.tsv', detailColumnNames);
const fromTranslationsByRef = byRef(fromTranslations);
console.log('Reading sentences for ' + toLanguage);
const toTranslations = await readTsv(toLanguage + '_sentences_detailed.tsv', detailColumnNames);
const toTranslationsByRef = byRef(toTranslations);

console.log('Reading links');
let links = await readTsv(linksFileName, ['fromId', 'toId']);
console.log(links.length + ' sentence links found');


const lessons = [];
const lessonNames = fs.readdirSync('lessons');
for(const lessonName of lessonNames) {
    try {
        const doc = yaml.load(fs.readFileSync(`lessons/${lessonName}`, 'utf8'));
        if (!doc.title[fromLanguage] && !doc.title[toLanguage]) {
            console.log(`Failed to read ${lessonName}. It has no title.`);
        } else {
            lessons.push({...doc, name: lessonName});
        }
    } catch (e) {
        console.log('Failed to read ' + lessonName, e);
    }
}
console.log(`Loaded ${lessons.length} lessons.`);
const expansionFiles = [`eng-${fromLanguage}_links.tsv`, `eng-${toLanguage}_links.tsv`].filter(fileName => !fileName.startsWith('eng-eng'));
console.log(`Loading exercise expansions ${expansionFiles}.`);
const expansions = {};
for(const expansionFileName of expansionFiles) {
    const expansionPairs = await readTsv(expansionFileName, ['engId', 'fromOrToId']);
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
const sentenceAndTag = await readTsv('tags.csv', ['sentenceId', 'tag']);
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

if (links.length > 50_000) {
    console.log(`Restricting to tagged sentences to reduce data amout`);
    links = links.filter(({fromId, toId}) => taggedSentenceIds.has(fromId) || taggedSentenceIds.has(toId));
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
    links: []
};
const addedSentences = new Set();

for(const {fromId, toId} of links) {
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
        addedSentences.add(toId);
    }
}

// Add lessons to courses which are sets of hand-picked sentences.

console.log(`Building lessons`);
for(const lesson of lessons) {
    const supportedExercises = new Set();
    const exercises = lesson.exercises || [];
    for (const exerciseTag of (lesson.exerciseTags || [])) {
        exercises.push(...tagsToSentenceIds[exerciseTag] || []);
    }
    for(const exercise of exercises) {
        const exerciseRef = exercise.replace('tatoeba/', '');
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
