const yaml = require('js-yaml');
const fs   = require('fs');

const courseTemplate = {
    from: '',
    to: '',
    lessons: [],
    exercerciseList: []
};

const coursesByLanguagePair = {};

const exercises = readdirSyncRecursive('exercises');
for(const conceptName of exercises) {
    try {
        const doc = yaml.load(fs.readFileSync(`exercises/${conceptName}`, 'utf8'));
        // Expand the different notations in the yml files to a common form.
        if(!doc.descriptions) {
            doc.descriptions = {};
        }
        for(const [lang, translations] of Object.entries(doc.translations)) {
            if(typeof(translations)==='string') {
                doc.translations[lang] = [translations];
            }
            doc.translations[lang] = doc.translations[lang].map(translation => {
                if (typeof(translation)==='string') {
                    return { text: translation };
                } else {
                    return translation;
                }
            });
        }
        if(!doc.categories) {
            doc.categories = [];
        }
        if(typeof(doc.categories)==='string') {
            doc.categories = [doc.categories];
        }
        
        const languages = Object.keys(doc.translations);
        const languagePairs = [];
        for(const langOne of languages) {
            for(const langTwo of languages) {
                if (langOne !== langTwo) {
                    languagePairs.push(`${langOne} to ${langTwo}`);
                }
            }
        }
        
        // Build up courses from exercises.
        for(const langPair of languagePairs) {
            const course = coursesByLanguagePair[langPair] || JSON.parse(JSON.stringify(courseTemplate));
            course.from = langPair.substr(0, langPair.indexOf(' '));
            course.to = langPair.substr(langPair.lastIndexOf(' ') + 1);
            coursesByLanguagePair[langPair] = course;
            
            if (doc.translations[course.from].length > 0 && doc.translations[course.to].length > 0) {
                course.exercerciseList.push({...doc, conceptName: conceptName.replace(/\.yml/, '')});
            }
        }
    } catch (e) {
        console.log('Failed to read ' + conceptName, e);
    }
}

// Add lessons to courses which are sets of hand-picked sentences.
const lessons = [];
const lessonNames = fs.readdirSync('lessons');
for(const lessonName of lessonNames) {
    try {
        const doc = yaml.load(fs.readFileSync(`lessons/${lessonName}`, 'utf8'));
        lessons.push({...doc, name: lessonName});
    } catch (e) {
        console.log('Failed to read ' + lessonName, e);
    }
}
for(const lesson of lessons) {
    for(const exercise of lesson.exercises) {
        if (!exercises.includes(exercise+'.yml')) {
            console.log(`Lesson ${lesson.name} references missing exercise ${exercise}`);
        }
    }
    for(const [langPair, course] of Object.entries(coursesByLanguagePair)) {
        const supportedExercises = lesson.exercises.filter(exerciseConceptName => course.exercerciseList.some(exercise => exercise.conceptName === exerciseConceptName));
        if (supportedExercises.length > 0) {
            course.lessons.push({
                ...lesson,
                exercises: supportedExercises
            });
        }
    }
}

fs.mkdirSync('public/dist-data/courses/', { recursive: true });
const courseIndex = {};
for(const [langPair, course] of Object.entries(coursesByLanguagePair)) {
    const [from, to] = langPair.split(' to ');
    courseIndex[langPair] = {from, to, lessons: course.lessons.length, exercises: course.exercerciseList.length};
    
    const courseCopy = JSON.parse(JSON.stringify(course));
    for(const exercise of courseCopy.exercerciseList) {
        exercise.descriptions = filterObject(exercise.descriptions, [course.from, course.to]);
        exercise.translations = filterObject(exercise.translations, [course.from, course.to]);
    }
    fs.writeFileSync(`public/dist-data/courses/${langPair}.json`, JSON.stringify(courseCopy));
}
fs.writeFileSync(`public/dist-data/courses/index.json`, JSON.stringify(courseIndex));

function filterObject(object, retainLanguages) {
    const result = {};
    for(const language of retainLanguages) {
        if(object.hasOwnProperty(language)){
            result[language] = object[language];
        }
    }
    return result;
}

function readdirSyncRecursive(path) {
    return fs.readdirSync(path)
        .flatMap(name => {
            const stats = fs.lstatSync(path + '/' + name);
            if(stats.isDirectory()) {
                return readdirSyncRecursive(path + '/' + name).map(sub => name + '/' + sub);
            } else {
                return [name];
            }
        });
}
