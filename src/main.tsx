import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import useLocalStorageState from 'use-local-storage-state'
import { CourseDetails } from './CourseDetails.js';
import { LessonOngoing, LessonOngoingProps } from './LessonOngoing.js';
import { pickRandom, speak, getProgressForCourse, getProgressForExercises, statusForExerciseReact, CourseMeta, Course, byStatus, Knowledge } from './util.js';
import { CourseList} from './CourseList.js';
import { AudioExercisesEnabledContext } from './contexts.js';

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
    const [ongoingLessionExercises, setOngoingLessionExercises] = useState<string[]>([]);
    
    const [audioExercisesEnabled, setAudioExercisesEnabled] = useLocalStorageState('audioExercisesEnabled', {
        defaultValue: true
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
    
    const onCourseSelected = async (langPair:string) => {
        const course: Course = stateActiveCourse===langPair && activeCourseData ? activeCourseData : await (await fetch('dist-data/courses/'+encodeURI(langPair+'.json'))).json();
        
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
        return getProgressForExercises(knowledge, lang, exerciseNames);
    }
    
    const showDynamicLesson = (lang: string, exercisePicklist: string[]) => {
        const exercisesByStatus = byStatus(knowledge[lang] || {}, exercisePicklist);
        const amountToShow = Math.min(10, exercisePicklist.length);
        const picklistCopy = [...(exercisesByStatus.wrong || []), ...(exercisesByStatus.somewhat || [])];
        const picked: string[] = [];
        while(picked.length < Math.min(amountToShow*0.7, picklistCopy.length)) {
            const pickedIndex = Math.floor(Math.random() * picklistCopy.length);
            picked.push(...picklistCopy.splice(pickedIndex, 1));
        }
        while(picked.length < amountToShow && exercisesByStatus.unseen?.length > 0) {
            const pickedIndex = Math.floor(Math.random() * exercisesByStatus.unseen.length);
            picked.push(...exercisesByStatus.unseen.splice(pickedIndex, 1));
        }
        const unpickedSoFar = exercisePicklist.filter(e => !picked.includes(e));
        while(picked.length < amountToShow) {
            const pickedIndex = Math.floor(Math.random() * unpickedSoFar.length);
            picked.push(...unpickedSoFar.splice(pickedIndex, 1));
        }
        picked.sort(() => Math.random() - 0.5);
        setOngoingLessionExercises(picked);
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
            const multiplier = knowledgeExercise.lastAnswersCorrect.reduce((accu, current) => current ? accu + 1 : accu - 1, 0);
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
    const showActiveCourseDetails = () => {
        setHash('course');
    };
    const statusForExercise = (to: string, conceptName: string) => {
        const langKnowledge = knowledge[to] || {};
        return statusForExerciseReact(langKnowledge, conceptName);
    }
    
    if (loading) {
        return 'Loading…';
    } else if(hash==='course' && stateActiveCourse && activeCourseData) {
        const progress = getProgressForCourse(knowledge, activeCourseData);
        return <CourseDetails course={activeCourseData} progress={progress} onBackToCourseList={onBackToCourseList} getProgressForExercises={progressForExercises} statusForExercise={statusForExercise} showDynamicLesson={showDynamicLesson}/>
    } else if((hash==='lesson' || hash==='definition') && activeCourseData) {
        return <LessonOngoing course={activeCourseData} exercises={ongoingLessionExercises} onExerciseConfirmed={onExerciseConfirmed} onLessonDone={showActiveCourseDetails} />
    } else {
        return <AudioExercisesEnabledContext.Provider value={audioExercisesEnabled}>
            <CourseList courseIndex={ courseIndex } knowledge={knowledge} onCourseSelected={onCourseSelected} setAudioExercisesEnabled={setAudioExercisesEnabled} />
        </AudioExercisesEnabledContext.Provider>;
    }
}


const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App/>);
