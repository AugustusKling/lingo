import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import useLocalStorageState from 'use-local-storage-state'
import { CourseDetails } from './CourseDetails.js';
import { LessonOngoing} from './LessonOngoing.js';
import { pickRandom, findWrongAnswers, speak, getProgressForCourse, getProgressForExercises, statusForExerciseReact, CourseMeta, Course, Exercise, byStatus } from './util.js';
import { CourseList} from './CourseList.js';

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
    const [courseIndex, setCourseIndex] = useState<Record<string, CourseMeta>>(undefined);
    const [knowledge, setKnowledge] = useLocalStorageState('knowledge', {
        defaultValue: {}
    });
    const [stateActiveCourse, setStateActiveCourse] = useState<string | null>(null);
    const [activeCourseData, setActiveCourseData] = useState<Course | null>(null);
    const [ongoingLessionExercises, setOngoingLessionExercises] = useState<Exercise[]>([]);
    
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
        setStateActiveCourse(langPair);
        setActiveCourseData(course);
        setHash('course');
    };
    const onBackToCourseList = () => {
        setHash('');
    };
    const progressForExercises = (exerciseNames: string[]) => {
        return getProgressForExercises(knowledge, stateActiveCourse, exerciseNames, exerciseNames.length);
    }
    
    const showDynamicLesson = (exercisePicklist) => {
        const exercisesByStatus = byStatus(knowledge[stateActiveCourse] || {}, exercisePicklist);
        const amountToShow = Math.min(10, exercisePicklist.length);
        const picklistCopy = [...(exercisesByStatus.wrong || []), ...(exercisesByStatus.somewhat || [])];
        const picked: Exercise[] = [];
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
    
    const onExerciseConfirmed = ({course, exercise, answerCorrect}) => {
        const langPair = `${course.from} to ${course.to}`;
        const knowledgeExercise = knowledge?.[langPair]?.[exercise.conceptName] || {
            lastAnswersCorrect: [],
            hiddenUntil: 0
        };
        if(!knowledge[langPair]) {
            knowledge[langPair] = {};
        }
        knowledge[langPair][exercise.conceptName] = knowledgeExercise;
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
    const statusForExercise = (langPair, conceptName) => {
        const langKnowledge = knowledge[langPair] || {};
        return statusForExerciseReact(langKnowledge, conceptName);
    }
    
    if (loading) {
        return 'Loading…';
    } else if(hash==='course') {
        const courseMeta = courseIndex[stateActiveCourse];
        const progress = getProgressForCourse(knowledge, stateActiveCourse, courseMeta);
        return <CourseDetails course={activeCourseData} progress={progress} onBackToCourseList={onBackToCourseList} getProgressForExercises={progressForExercises} statusForExercise={statusForExercise} showDynamicLesson={showDynamicLesson}/>
    } else if(hash==='lesson' || hash==='definition') {
        return <LessonOngoing course={activeCourseData} exercises={ongoingLessionExercises} onExerciseConfirmed={onExerciseConfirmed} onLessonDone={showActiveCourseDetails} />
    } else {
        return <CourseList courseIndex={ courseIndex } knowledge={knowledge} onCourseSelected={onCourseSelected} />;
    }
}


const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App/>);
