interface ExerciseKnowledge {
    lastAnswersCorrect: boolean[];
    hiddenUntil: number;
}
export type ExerciseStatus = 'unseen' | 'learned' | 'wrong' | 'somewhat';
type LangKnowledge = Record<Exercise['conceptName'], ExerciseKnowledge>;
export type Knowledge = Record<string, LangKnowledge>;

export interface Course {
    from: string;
    to: string;
    lessons: Lesson[];
    exercerciseList: Exercise[];
}
export interface Lesson {
    title: Record<string, string>;
    description?: Record<string, string>;
    order?: number;
    exercises: string[];
}
export interface Exercise {
    conceptName: string;
    descriptions: Record<string, string>;
    categories: string[];
    translations: Record<string, Translation[]>;
}
export interface Translation {
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

function findWrongAnswer(exercise: Exercise, exercerciseListOfCourse: Course["exercerciseList"], answerLanguage: string, except: Exercise[]): Exercise {
    const others = exercerciseListOfCourse.filter(o => o !== exercise && !except.includes(o));
    if(Math.random() > 0.5) {
        const othersSimilar = others.filter(o => o.categories.some(c => exercise.categories.includes(c)));
        if (othersSimilar.length > 0) {
            return pickRandom(othersSimilar);
        }
    }
    if(Math.random() > 0.5) {
        const othersSimilar = others.filter(o => {
            const lengthRatio = o.translations[answerLanguage][0].text.length / exercise.translations[answerLanguage][0].text.length;
            return lengthRatio > 0.5 && lengthRatio < 1.5;
        });
        if (othersSimilar.length > 0) {
            return pickRandom(othersSimilar);
        }
    }
    return pickRandom(others);
}
export function findWrongAnswers(exercise: Exercise, amount: number, exercerciseListOfCourse: Course["exercerciseList"], answerLanguage: string): Exercise[] {
    const wrong: Exercise[] = [];
    while(wrong.length < amount) {
        wrong.push(findWrongAnswer(exercise, exercerciseListOfCourse, answerLanguage, wrong));
    }
    return wrong;
}

export function speak(text: string, voices: SpeechSynthesisVoice[]): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = pickRandom(voices);
    // Workaround for Chrome bug not respecting voice's language.
    utterance.lang = utterance.voice.lang;
    speechSynthesis.speak(utterance);
}

export function getProgressForCourse(knowledge: Knowledge, course: Course, courseMeta: CourseMeta) {
    const exerciseNames = course.exercerciseList.map(exercise => exercise.conceptName);
    return getProgressForExercises(knowledge, course.to, exerciseNames, courseMeta.exercises);
}
export function getProgressForExercises(knowledge: Knowledge, to: string, exerciseNames: string[], totalExercises: number) {
    const langKnowledge = knowledge[to] || {};
    const exerciseStatus = exerciseNames.map(exerciseName => statusForExerciseReact(langKnowledge, exerciseName));
    const statusWrong = exerciseStatus.filter(status => status === 'wrong').length;
    const statusSomewhat = exerciseStatus.filter(status => status === 'somewhat').length;
    const statusLearned = exerciseStatus.filter(status => status === 'learned').length;
    return {
        wrong: statusWrong,
        somewhat: statusSomewhat,
        learned: statusLearned,
        unseen: totalExercises - statusWrong - statusSomewhat - statusLearned
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

export function byStatus(langKnowledge: LangKnowledge, exercises: Exercise[]): Record<ExerciseStatus, Exercise[]> {
    const grouped = group(exercises, e => statusForExerciseReact(langKnowledge, e.conceptName));
    return Object.assign({
        unseen: [],
        wrong: [],
        somewhat: [],
        learned: [],
    }, grouped);
}
