import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import useLocalStorageState from 'use-local-storage-state'
import { CourseDetails } from './CourseDetails.js';
import { LessonOngoing, LessonOngoingProps } from './LessonOngoing.js';
import { pickRandom, speak, getProgressForCourse, statusForExerciseReact, CourseMeta, Course, Knowledge, rankableExercises, rankableExerciseComparator, RankableExercise, StatusForExercise, ExerciseFilter } from './util.js';
import { CourseList} from './CourseList.js';
import { AudioExercisesEnabledContext, CorrectAnswerConfirmationsEnabledContext } from './contexts.js';
import i18n from "i18next";
import { useTranslation, initReactI18next } from "react-i18next";
import LanguageDetector from 'i18next-browser-languagedetector';
import ICU from "i18next-icu";
import en from './locales/en/translation.json';
import de from './locales/de/translation.json';

interface OngoingLesson {
    exerciseFilter: ExerciseFilter;
    progress: RankableExercise[];
    batchId: number;
    batchExercises: string[];
}

function App() {
    const [loading, setLoading] = useState(true);
    const [hash, setHashInternal] = useState(() => {
        if (location.hash.startsWith('#')) {
            return location.hash.substr(1);
        } else {
            return location.hash;
        }
    });
    useEffect(() => {
        const updateInternalHash = () => {
            if (location.hash.startsWith('#')) {
                setHashInternal(location.hash.substr(1));
            } else {
                setHashInternal(location.hash);
            }
        };
        addEventListener('hashchange', updateInternalHash);
        return () => removeEventListener('hashchange', updateInternalHash);
    }, []);
    const setHash = (hash: string) => {
        location.hash = '#' + hash;
        if (hash === '') {
            history.replaceState(null, '', location.pathname);
        }
        setHashInternal(hash);
    }
    const [courseIndex, setCourseIndex] = useState<Record<string, CourseMeta>>({});
    const [knowledge, setKnowledge] = useLocalStorageState<Knowledge>('knowledge', {
        defaultValue: {},
        serializer: {
            stringify: JSON.stringify,
            parse: (raw: string | undefined): Knowledge => {
                if (raw === undefined) {
                    return {};
                } else {
                    const parsed = JSON.parse(raw);
                    
                    // Convert former progress by langPair.
                    const toConvert = Object.keys(parsed).filter(key => key.includes(' to '));
                    for (const oldKey of toConvert) {
                        const targetKey = oldKey.replace(/^.+ to /, '');
                        const target = parsed[targetKey] || {};
                        parsed[targetKey] = target;
                        
                        for (const [conceptName, knowledgeExercise] of Object.entries(parsed[oldKey])) {
                            target[conceptName] = knowledgeExercise;
                        }
                        
                        delete parsed[oldKey];
                    }
                    
                    return parsed;
                }
            }
        }
    });
    const [stateActiveCourse, setStateActiveCourse] = useState<string | null>(null);
    const [activeCourseData, setActiveCourseData] = useState<Course | null>(null);
    
    const [audioExercisesEnabled, setAudioExercisesEnabled] = useLocalStorageState('audioExercisesEnabled', {
        defaultValue: true
    });
    const [correctAnswerConfirmationsEnabled, setCorrectAnswerConfirmationsEnabled] = useLocalStorageState('correctAnswerConfirmationsEnabled', {
        defaultValue: false
    });
    
    useEffect(() => {
        if (hash !== '' && activeCourseData===null) {
            setHash('');
        }
    }, [hash, activeCourseData]);
    
    useEffect(() => {
        void (async () => {
            const courseIndex: Record<string, CourseMeta> = await (await fetch('dist-data/courses/index.json')).json();
            setCourseIndex(courseIndex);
            setLoading(false);
        })();
    }, []);
    
    const downloadCourseIfOutdated = async (langPair: string) => {
        const request = new Request('dist-data/courses/'+encodeURI(langPair+'.json'));
        if (!window.caches) {
            return (await fetch(request)).json();
        }
        const cache = await caches.open('lingo');
        let cachedResponse = await cache.match(request);
        if (cachedResponse) {
            const downloadTime = Date.parse(cachedResponse.headers.get('x-date'));
            // Use cached value unless outdated.
            if (downloadTime > Date.parse(courseIndex[langPair].buildTime)) {
                return cachedResponse.json();
            }
        }
        
        const freshResponse = await fetch(request);
        if (freshResponse.status !== 200) {
            return freshResponse;
        }
        await cache.put(request, new Response(await freshResponse.arrayBuffer(), {
            status: freshResponse.status,
            headers: {
                'content-type': 'application/json',
                'x-date': new Date().toISOString()
            }
        }));
        const newlyCachedResponse = await cache.match(request);
        return newlyCachedResponse.json();
    };
    
    const onCourseSelected = async (langPair:string) => {
        const course: Course = stateActiveCourse===langPair && activeCourseData ? activeCourseData : await downloadCourseIfOutdated(langPair);
        
        // Migrate old knowledge state.
        if (course.from === 'eng') {
            const oldLanguage = Intl.getCanonicalLocales(course.to)[0];
            if (knowledge[oldLanguage] && oldLanguage.length === 2) {
                if (!knowledge[course.to]) {
                    knowledge[course.to] = {};
                }
                const mapping = course.links.map(([fromId, toId]) => [`tatoeba/${fromId}`, toId]);
                for(const [old, migrated] of mapping) {
                    if (knowledge[oldLanguage][old] && !knowledge[course.to][migrated]) {
                        knowledge[course.to][migrated] = knowledge[oldLanguage][old];
                    }
                }
                delete knowledge[oldLanguage];
                setKnowledge(knowledge)
            }
        }
        
        setStateActiveCourse(langPair);
        setActiveCourseData(course);
        setHash('course');
    };
    const onBackToCourseList = () => {
        setHash('');
    };
    const progressForExercises = (lang: string, exerciseNames: string[]) => {
        return rankableExercises(knowledge[lang] ?? {}, exerciseNames);
    }
    const statusForExercise: StatusForExercise = (to: string, conceptName: string) => {
        const langKnowledge = knowledge[to] || {};
        return statusForExerciseReact(langKnowledge, conceptName);
    }
    
    const [ongoingLesson, setOngoingLesson] = useState<OngoingLesson | undefined>();
    useEffect(() => {
        if((hash==='lesson' || hash==='definition') && activeCourseData && ongoingLesson) {
            const exercisePicklist = ongoingLesson.exerciseFilter(statusForExercise);
            setOngoingLesson({
                ...ongoingLesson,
                progress: progressForExercises(activeCourseData.to, exercisePicklist)
            });
        }
    }, [hash, knowledge]);
    
    const showDynamicLesson = (lang: string, exerciseFilter: ExerciseFilter) => {
        const exercisePicklist = exerciseFilter(statusForExercise);
        if (exercisePicklist.length === 0) {
            setHash('course');
            return;
        }
        const amountToShow = Math.min(10, exercisePicklist.length);
        const rankable = rankableExercises(knowledge[lang] ?? {}, exercisePicklist);
        const comparator = rankableExerciseComparator();
        const rankedUnshuffled = rankable.sort(comparator);
        
        // Shuffle exercises of equal sort order,
        const rankedGroups: RankableExercise[][] = [rankedUnshuffled.splice(0, 1)];
        for(const exercise of rankedUnshuffled) {
            const lastGroup = rankedGroups[rankedGroups.length - 1];
            const lastExercise = lastGroup[lastGroup.length - 1];
            const sameRankGroup = comparator(lastExercise, exercise) === 0;
            if (sameRankGroup) {
                lastGroup.push(exercise);
            } else {
                rankedGroups.push([exercise]);
            }
        }
        const ranked = rankedGroups.flatMap(group => group.sort(() => Math.random() - 0.5));
        
        const picked: string[] = ranked.splice(0, Math.min(amountToShow*0.7, ranked.length)).map(r => r.id);
        while(picked.length < amountToShow) {
            const pickedIndex = ranked.findIndex(r => r.unseen);
            if (pickedIndex === -1) {
                break;
            }
            picked.push(...ranked.splice(pickedIndex, 1).map(r => r.id));
        }
        const fillers = ranked.splice(0, Math.min(amountToShow - picked.length, ranked.length)).map(r => r.id);
        picked.push(...fillers);
        picked.sort(() => Math.random() - 0.5);
        setOngoingLesson({
            exerciseFilter,
            progress: progressForExercises(lang, exercisePicklist),
            batchId: new Date().getTime(),
            batchExercises: picked
        });
        setHash('lesson');
    };
    
    const onExerciseConfirmed: LessonOngoingProps['onExerciseConfirmed'] = ({course, exercise, answerCorrect}) => {
        const knowledgeExercise = knowledge[course.to]?.[exercise.id] || {
            lastAnswersCorrect: [],
            hiddenUntil: 0
        };
        if(!knowledge[course.to]) {
            knowledge[course.to] = {};
        }
        knowledge[course.to][exercise.id] = knowledgeExercise;
        if(knowledgeExercise.lastAnswersCorrect.length > 9) {
            knowledgeExercise.lastAnswersCorrect.splice(0, 1);
        }
        knowledgeExercise.lastAnswersCorrect.push(answerCorrect);
        if (!answerCorrect) {
            knowledgeExercise.hiddenUntil = 0;
        } else {
            const multiplier = knowledgeExercise.lastAnswersCorrect.reduce((accu, current) => current ? accu + 1 : accu, 0);
            if (knowledgeExercise.lastAnswersCorrect.length < 10) {
                const tenMinutes = 10*60*1000;
                knowledgeExercise.hiddenUntil = new Date().getTime() + multiplier * tenMinutes;
            } else {
                const oneDay = 24*60*60*1000;
                knowledgeExercise.hiddenUntil = new Date().getTime() + multiplier * oneDay;
            }
        }
        setKnowledge(knowledge);
    };
    const onLessonDone = () => {
        showDynamicLesson(activeCourseData.to, ongoingLesson.exerciseFilter);
    };
    const onAbort = () => {
        setHash('course');
    };
    
    if (loading) {
        return 'Loading…';
    } else if(hash==='course' && stateActiveCourse && activeCourseData) {
        const progress = getProgressForCourse(knowledge, activeCourseData);
        return <CourseDetails course={activeCourseData} progress={progress} onBackToCourseList={onBackToCourseList} getProgressForExercises={progressForExercises} statusForExercise={statusForExercise} showDynamicLesson={showDynamicLesson}/>
    } else if((hash==='lesson' || hash==='definition') && activeCourseData && ongoingLesson) {
        return <AudioExercisesEnabledContext.Provider value={audioExercisesEnabled}>
            <CorrectAnswerConfirmationsEnabledContext.Provider value={correctAnswerConfirmationsEnabled}>
                <LessonOngoing key={ongoingLesson.batchId} course={activeCourseData} exercises={ongoingLesson.batchExercises} onExerciseConfirmed={onExerciseConfirmed} onLessonDone={onLessonDone} onAbort={onAbort} ongoingLessonProgress={ongoingLesson.progress} />
            </CorrectAnswerConfirmationsEnabledContext.Provider>
        </AudioExercisesEnabledContext.Provider>;
    } else {
        return <AudioExercisesEnabledContext.Provider value={audioExercisesEnabled}>
            <CorrectAnswerConfirmationsEnabledContext.Provider value={correctAnswerConfirmationsEnabled}>
                <CourseList courseIndex={ courseIndex } knowledge={knowledge} onCourseSelected={onCourseSelected} setAudioExercisesEnabled={setAudioExercisesEnabled} setCorrectAnswerConfirmationsEnabled={setCorrectAnswerConfirmationsEnabled} />
            </CorrectAnswerConfirmationsEnabledContext.Provider>
        </AudioExercisesEnabledContext.Provider>;
    }
}

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(ICU)
  .init({
    supportedLngs: ['en', 'de'],
    fallbackLng: "en",
    returnEmptyString: false,
    resources: { en: {translation: en}, de: {translation: de} },
    detection: {
        order: ['navigator', 'htmlTag'],
        caches: []
    },
    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
  });

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App/>);
