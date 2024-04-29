import { useSyncExternalStore } from 'react';
import i18next from 'i18next';

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
    ipaTranscriptions?: Record<string, string>;
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
    /** ISO 8601 timestamp. */
    buildTime: string;
}

export interface RankableExercise {
    id: string;
    translation: Translation;
    rank: number;
    hiddenUntil: number;
    unseen: boolean;
}

export type StatusForExercise = (to: string, conceptName: string) => ExerciseStatus;
export type ExerciseFilter = (statusForExercise: StatusForExercise) => Translation[];

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
    const correctAnswerIds = new Set();
    for(const link of course.links) {
        if (link[0] === exercise.id) {
            correctAnswerIds.add(link[1]);
        }
        if (link[1] === exercise.id) {
            correctAnswerIds.add(link[0]);
        }
    }
    const neitherCorrectNorExcluded = new Set(correctAnswerIds);
    for(const e of except) {
        neitherCorrectNorExcluded.add(e.id);
    }
    const others = course.sentences[answerLanguage].filter(o => !neitherCorrectNorExcluded.has(o.id));
    if(Math.random() > 0.5 && answerLanguage === course.to) {
        const lessons = course.lessons.filter(lesson => lesson.exercises.some(eId => correctAnswerIds.has(eId)));
        const lessonsSentenceIds = new Set(lessons.flatMap(lesson => lesson.exercises));
        const othersInLessons = others.filter(o => lessonsSentenceIds.has(o.id));
        if (othersInLessons.length > 0) {
            return pickRandom(othersInLessons);
        }
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

const voicesForLang: Record<string, SpeechSynthesisVoice[]> = {};
// Trigger initialization of voices.
speechSynthesis.getVoices();
export function useVoices(language: string): SpeechSynthesisVoice[] {
    const prefix = Intl.getCanonicalLocales(language)[0];
 
    return useSyncExternalStore(updateVoices => {
        const updateFilteredVoices = () => {
            delete voicesForLang[prefix];
            updateVoices();
        };
        speechSynthesis.addEventListener('voiceschanged', updateFilteredVoices);
        return () => {
            speechSynthesis.removeEventListener('voiceschanged', updateFilteredVoices);
        };
    }, () => {
        if (!voicesForLang[prefix]) {
            voicesForLang[prefix] = getFilteredVoices(prefix);
        }
        return voicesForLang[prefix];
    });
}

function getFilteredVoices(prefix: string): SpeechSynthesisVoice[] {
    return speechSynthesis.getVoices().filter(voice => voice.lang.startsWith(prefix));
}

export function speak(text: string, voices: SpeechSynthesisVoice[]): Promise<boolean> {
    speechSynthesis.cancel();
    return speakContinue(text, pickRandom(voices));
}
export function speakContinue(text: string, voice: SpeechSynthesisVoice): Promise<boolean> {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    // Workaround for Chrome bug not respecting voice's language.
    utterance.lang = utterance.voice.lang;
    return new Promise((resolve, reject) => {
        utterance.addEventListener('end', () => resolve(true), {
            once: true
        });
        utterance.addEventListener('error', () => resolve(false), {
            once: true
        });
        speechSynthesis.speak(utterance);
    });
}

export function getProgressForCourse(knowledge: Knowledge, course: Course) {
    return rankableExercises(knowledge[course.to] ?? {}, course.sentences[course.to]);
}
export function statusForExerciseReact(langKnowledge: LangKnowledge, exerciseName: string): ExerciseStatus {
    const knowledge: ExerciseKnowledge = langKnowledge[exerciseName];
    if(!knowledge) {
        return "unseen";
    }
    if(knowledge.lastAnswersCorrect.length>2 && knowledge.lastAnswersCorrect.every(answer => answer)) {
        return "learned";
    }
    if(knowledge.lastAnswersCorrect.find((answer, index) => !answer && (knowledge.lastAnswersCorrect.length - index) <= 3) === false) {
        return "wrong";
    }
    return "somewhat";
}

export function rankableExercises(langKnowledge: LangKnowledge, exercises: Translation[]): RankableExercise[] {
    return exercises.map(translation => {
        const exerciseKnowledge = langKnowledge[translation.id];
        if (!exerciseKnowledge) {
            return {
                id: translation.id,
                translation,
                rank: 0,
                hiddenUntil: 0,
                unseen: true
            };
        }
        const rank = exerciseKnowledge.lastAnswersCorrect.reduce((accu, current) => current ? accu + 1 : accu - 1, 0);
        return {
            id: translation.id,
            translation,
            rank,
            hiddenUntil: exerciseKnowledge.hiddenUntil,
            unseen: false
        };
    });
}

export const rankableExerciseComparator =() => {
    const now = new Date().getTime();
    return (a: RankableExercise, b: RankableExercise) => {
        const aHidden = a.hiddenUntil > now;
        const bHidden = b.hiddenUntil > now;
        if (aHidden && !bHidden) {
            return 1;
        } else if(!aHidden && bHidden) {
            return -1;
        }
        
        const rankDiff = a.rank - b.rank;
        if (rankDiff!==0) {
            return rankDiff;
        }
        
        return a.translation.text.length - b.translation.text.length;
    };
};

const wordSegmenters = {};
export function segmentToWords(text: string, language: string): { segment: string; isWordLike: boolean; }[] {
    try {
        if (Intl.Segmenter) {
            // Hope browser handles language somewhat correctly.
            const cachedSegmenter = wordSegmenters[language];
            const segmenter = cachedSegmenter ?? new Intl.Segmenter(language, { granularity: "word" });
            if (cachedSegmenter === undefined) {
                wordSegmenters[language] = segmenter;
            }
            return Array.from(segmenter.segment(text));
        }
    } finally {}
    
    // Fallback to character based approach which fails for many cases, especially languages that don't separate words.
    const segments = [];
    const matches = text.matchAll(/\s+|[.¿?,?!;"””«»]|:(?=\s)|\-/g);
    let consumed = 0;
    for(const match of matches) {
        const before = text.slice(consumed, match.index);
        if(before.length > 0) {
            segments.push({
                segment: before,
                isWordLike: true
            });
        }
        consumed = match.index + match[0].length;
        segments.push({
            segment: text.slice(match.index, consumed),
            isWordLike: false
        });
    }
    if(consumed < text.length) {
        segments.push({
            segment: text.slice(consumed, text.length),
            isWordLike: true
        });
    }
    return segments;
}

export function transcribeIPA(course: Course, text: string, language: string): string | undefined {
    if (!course.ipaTranscriptions || course.to !== language) {
        return undefined;
    }
    
    let result = ' ';
    for(const segment of segmentToWords(text, language)) {
        if (segment.isWordLike) {
            const transcription = course.ipaTranscriptions[segment.segment];
            if (!transcription) {
                return undefined;
            }
            result = result + ' ' + transcription;
        }
    }
    return result.trim();
}

export function cssClasses(...maybeClassNames: (string | false | Record<string, boolean>)[]): string {
    return maybeClassNames.reduce<string>((prev, current) => {
        let toAdd: string;
        if (current==false){
            return prev;
        } else if(typeof current === 'string') {
            toAdd = current;
        } else {
            const maybeClassNamesArray = Object.entries(current).map(([className, enabled]) => enabled && className);
            toAdd = cssClasses(...maybeClassNamesArray);
        }
        return prev==='' ? toAdd : `${prev} ${toAdd}`;
    }, '');
}

export function getTranslationUILanguage(translations: Record<string, string>): string | undefined {
    const desiredLocale = i18next.resolvedLanguage;
    if (translations[desiredLocale]) {
        return translations[desiredLocale];
    }
    
    const languageSeparatorIndex = desiredLocale.indexOf('-');
    if (languageSeparatorIndex > 0) {
        const desiredLanguage = desiredLocale.substring(0, languageSeparatorIndex);
        if (translations[desiredLanguage]) {
            return translations[desiredLanguage];
        }
    }
    
    const fallback = { en: 'eng', de: 'deu'}[desiredLocale];
    if (translations[fallback]) {
        return translations[fallback];
    }
}
