import { useState, useMemo, useEffect } from 'react';
import { pickRandom, Course, Exercise, speak } from './util.js';
import { AnswerPick } from './AnswerPick.js';
import { AnswerType } from './AnswerType.js';
import { DefinitionOverlay } from './DefinitionOverlay.js';
import styles from './LessonOngoing.module.scss';
import {diffStringsRaw, DIFF_EQUAL, DIFF_DELETE, DIFF_INSERT} from 'jest-diff';

export interface LessonOngoingProps {
    course: Course;
    exercises: Exercise[];
    onLessonDone?: () => void;
    onExerciseConfirmed: (_: {course: Course, exercise: Exercise, answerCorrect: boolean}) => void;
}

function doAnswersMatch(a: string, b: string): boolean {
    const ignoreChars = /[.¿?,?!;"-]/g;
    return a.replace(ignoreChars, '').toLowerCase() === b.replace(ignoreChars, '').toLowerCase();
}

export function LessonOngoing({course, exercises, onLessonDone, onExerciseConfirmed}: LessonOngoingProps) {
    const [remainingExercises, setRemainingExercises] = useState(() => [...exercises]);
    const currentExercise = remainingExercises[0];
    const questionHint = currentExercise.descriptions?.[course.from];
    const voices = useMemo(
        () => speechSynthesis.getVoices().filter(voice => voice.lang.startsWith(course.to)),
        [course]
    );
    const speakAnswerAsQuestionMode = useMemo(
        () => voices.length > 0 && Math.random() < 0.3,
        [voices, currentExercise]
    );
    const question = useMemo(
        () => pickRandom(currentExercise.translations[speakAnswerAsQuestionMode ? course.to : course.from]),
        [currentExercise, course, speakAnswerAsQuestionMode]
    );
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [correctAnswerHintVisible, setCorrectAnswerHintVisible] = useState(false);
    
    type DefinitionOverlayData = {visible: false; exercise: null; title: null;} | {visible: true; exercise: Exercise; title: string;};
    const [definitionOverlayData, setDefinitionOverlayData] = useState<DefinitionOverlayData>({
        visible: false,
        exercise: null,
        title: null
    });
    useEffect(() => {
        const updateOverlayVisibility = () => {
            if (location.hash !== '#definition') {
                setDefinitionOverlayData({
                    visible: false,
                    exercise: null,
                    title: null
                });
            }
        };
        addEventListener('hashchange', updateOverlayVisibility);
        return () => removeEventListener('hashchange', updateOverlayVisibility);
    }, []);
    
    const correctAnswer = useMemo(
        () => speakAnswerAsQuestionMode ? question : pickRandom(currentExercise.translations[course.to]),
        [currentExercise, course, question, speakAnswerAsQuestionMode]
    );
    const acousticPick = useMemo(
        () => !speakAnswerAsQuestionMode && voices.length > 0 && Math.random() < 0.5,
        [voices, speakAnswerAsQuestionMode]
    );
    
    const typeAnswerMode = useMemo(
        () => Math.random() > 0.5 && question.text.includes(' '),
        [question]
    );
    
    const showNextExcercise = () => {
        setCorrectAnswerHintVisible(false);
        if(remainingExercises.length === 1) {
            onLessonDone?.();
        } else {
            setCurrentAnswer('');
            setRemainingExercises(remainingExercises.filter(e => e!==currentExercise));
        }
    };
    const confirm = (answerText: string) => {
        setCurrentAnswer(answerText);
        if (correctAnswerHintVisible) {
            showNextExcercise();
        } else {
            const answerCorrect = currentExercise.translations[course.to].some(correctOption => doAnswersMatch(correctOption.text, answerText));
            onExerciseConfirmed({
                course,
                exercise: currentExercise,
                answerCorrect
            });
            
            if (answerCorrect) {
                showNextExcercise();
            } else {
                setCorrectAnswerHintVisible(true);
            }
        }
    };
    
    const showDefinitionOverlay = (exercise: Exercise, title: string) => {
        setDefinitionOverlayData({
            exercise,
            title,
            visible: true
        });
        location.hash = '#definition';
    }
    const closeDefinitionOverlay = () => {
        history.back();
    };
    
    const renderAnswerMeans = () => {
        if (typeAnswerMode) {
            return <AnswerType course={course} currentExercise={currentExercise} correctAnswer={correctAnswer} currentAnswer={currentAnswer} onChange={setCurrentAnswer} hint={
                speakAnswerAsQuestionMode ? 'Type what you heard' : 'Type translation'
            } />;
        } else {
            return <AnswerPick course={course} currentExercise={currentExercise} correctAnswer={correctAnswer} currentAnswer={currentAnswer} onSelect={setCurrentAnswer} onConfirm={confirm} onShowDefinition={showDefinitionOverlay} voices={voices} acousticPick={acousticPick} hint={
                speakAnswerAsQuestionMode ? 'Pick what you heard' : 'Pick correct translation'
            } />;
        }
    }
    
    const renderWrongAndCorrectAnswer = () => {
        const diff = diffStringsRaw(currentAnswer, correctAnswer.text, true);
        console.log(diff);
        return <div className={styles.correctAnswerHint} style={ {display: correctAnswerHintVisible ? 'block' : 'none'} }>
            <p>Your answer</p>
            <p className={styles.wrongAnswer}>{diff.map(section => {
                const sectionState = section[0];
                const sectionValue = section[1];
                if (sectionState===DIFF_DELETE) {
                    return <span className={styles.diffWrong}>{sectionValue}</span>
                } else if (sectionState!==DIFF_INSERT) {
                    return sectionValue;
                }
            })}</p>
            <p>Correct answer</p>
            <p className={styles.correctAnswer}>{diff.map(section => {
                const sectionState = section[0];
                const sectionValue = section[1];
                if (sectionState===DIFF_INSERT) {
                    return <span className={styles.diffCorrected}>{sectionValue}</span>
                } else if (sectionState!==DIFF_DELETE) {
                    return sectionValue;
                }
            })}</p>
        </div>
    }
    
    const renderReadQuestion = () => {
        return <>
            <button onClick={() => speak(question.text, voices) }>Speak sentence to match</button>
            <button onClick={() => showDefinitionOverlay(currentExercise, question.text)}>Info</button>
        </>;
    };
    
    const renderShowQuestion = () => {
        return <>
            <div className={styles.question}>{question.text}</div>
            <div className={styles.questionHint}>{questionHint}</div>
            <button className={styles.buttonDefinition} onClick={() => showDefinitionOverlay(currentExercise, question.text)}>Info</button>
        </>;
    };
    
    return <><div className={styles.fullHeight}>
        <progress max={exercises.length} value={1 + exercises.length - remainingExercises.length} className={styles.progress}></progress>
        <div className={styles.head}>{speakAnswerAsQuestionMode ? renderReadQuestion() : renderShowQuestion() }</div>
        { !correctAnswerHintVisible ? renderAnswerMeans() : renderWrongAndCorrectAnswer() }
        <div className={styles.buttons}>
            <button onClick={() => onLessonDone?.() }>Abort</button>
            <button onClick={() => showNextExcercise()}>Skip</button>
            <button onClick={() => confirm(currentAnswer)}>Confirm</button>
        </div>
    </div>
    {definitionOverlayData.visible && <DefinitionOverlay exercise={definitionOverlayData.exercise} title={definitionOverlayData.title} from={course.from} to={course.to} onBackToExercise={() => closeDefinitionOverlay()} />}</>;
}
