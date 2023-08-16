interface ExerciseKnowledge {
    lastAnswersCorrect: boolean[];
    hiddenUntil: number;
}
export type ExerciseStatus = 'unseen' | 'learned' | 'wrong' | 'somewhat';
type LangKnowledge = Record<string, ExerciseKnowledge>;
export type Knowledge = Record<string, LangKnowledge>;

export interface Course {
    from: string;
    to: string;
    lessons: Lesson[];
    /** lang to sentences */
    sentences: Record<string, Translation[]>;
    /** Sentence id (from lang) to sentence ids (to lang) */
    links: [string, string][];
}
export interface Lesson {
    title: Record<string, string>;
    description?: Record<string, string>;
    order?: number;
    exercises: string[];
}
export interface Translation {
    id: string;
    text: string;
    source?: string;
    licence?: string;
    author?: string;
}

export interface CourseMeta {
    from: string;
    to: string;
    lessons: number;
    exercises: number;
}

export function pickRandom<X>(array: Array<X>): X {
    return array[Math.floor(Math.random() * array.length)];
}

function group<X, Key extends string>(array: X[], mapper: (x: X) => Key): Partial<Record<Key, X[]>> {
    const result: Partial<Record<Key, X[]>> = {};
    for(const value of array) {
        const key = mapper(value);
        const maybeList = result[key];
        if (maybeList === undefined) {
            result[key] = [value];
        } else {
            maybeList.push(value);
        }
    }
    return result;
}

function findWrongAnswer(exercise: Translation, course: Course, answerLanguage: string, except: Translation[]): Translation {
    const correctAnswers = course.links.filter(link => link.includes(exercise.id));
    const others = course.sentences[answerLanguage].filter(o => !correctAnswers.some(cLink => cLink.includes(o.id)) && !except.includes(o));
    if(Math.random() > 0.5 && answerLanguage === course.to) {
        const lessons = course.lessons.filter(lesson => lesson.exercises.some(eId => correctAnswers.some(cLink => cLink.includes(eId))));
        const lessonsSentenceIds = lessons.flatMap(lesson => lesson.exercises);
        const othersInLessons = others.filter(o => lessonsSentenceIds.includes(o.id));
        return pickRandom(othersInLessons);
    }
    if(Math.random() > 0.5) {
        const othersSimilar = others.filter(o => {
            const lengthRatio = o.text.length / exercise.text.length;
            return lengthRatio > 0.5 && lengthRatio < 1.5;
        });
        if (othersSimilar.length > 0) {
            return pickRandom(othersSimilar);
        }
    }
    return pickRandom(others);
}
export function findWrongAnswers(exercise: Translation, amount: number, course: Course, answerLanguage: string): Translation[] {
    const wrong: Translation[] = [];
    while(wrong.length < amount) {
        wrong.push(findWrongAnswer(exercise, course, answerLanguage, wrong));
    }
    return wrong;
}

export function getVoices(language: string): SpeechSynthesisVoice[] {
    const prefix = Intl.getCanonicalLocales(language)[0];
    return speechSynthesis.getVoices().filter(voice => voice.lang.startsWith(prefix));
}

export function speak(text: string, voices: SpeechSynthesisVoice[]): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = pickRandom(voices);
    // Workaround for Chrome bug not respecting voice's language.
    utterance.lang = utterance.voice.lang;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

export function getProgressForCourse(knowledge: Knowledge, course: Course) {
    const exerciseNames = course.sentences[course.to].map(translation => translation.id);
    return getProgressForExercises(knowledge, course.to, exerciseNames);
}
export function getProgressForExercises(knowledge: Knowledge, to: string, exerciseNames: string[]) {
    const langKnowledge = knowledge[to] || {};
    const exerciseStatus = exerciseNames.map(exerciseName => statusForExerciseReact(langKnowledge, exerciseName));
    const statusWrong = exerciseStatus.filter(status => status === 'wrong').length;
    const statusSomewhat = exerciseStatus.filter(status => status === 'somewhat').length;
    const statusLearned = exerciseStatus.filter(status => status === 'learned').length;
    return {
        wrong: statusWrong,
        somewhat: statusSomewhat,
        learned: statusLearned,
        unseen: exerciseNames.length - statusWrong - statusSomewhat - statusLearned
    };
}
export function statusForExerciseReact(langKnowledge: LangKnowledge, exerciseName: string): ExerciseStatus {
    const knowledge: ExerciseKnowledge = langKnowledge[exerciseName];
    if(!knowledge) {
        return "unseen";
    }
    const now = new Date().getTime();
    if(knowledge.lastAnswersCorrect.length>2 && knowledge.lastAnswersCorrect.every(answer => answer) && now < knowledge.hiddenUntil) {
        return "learned";
    }
    if(knowledge.lastAnswersCorrect.find((answer, index) => !answer && (knowledge.lastAnswersCorrect.length - index) <= 3) === false) {
        return "wrong";
    }
    return "somewhat";
}

export function byStatus(langKnowledge: LangKnowledge, exercises: string[]): Record<ExerciseStatus, string[]> {
    const grouped = group(exercises, e => statusForExerciseReact(langKnowledge, e));
    return Object.assign({
        unseen: [],
        wrong: [],
        somewhat: [],
        learned: [],
    }, grouped);
}
