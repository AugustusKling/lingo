import { useState, useMemo, useEffect } from 'react';
import { pickRandom, Course, Translation, getVoices, speak } from './util.js';
import { AnswerPick } from './AnswerPick.js';
import { AnswerType } from './AnswerType.js';
import { DefinitionOverlay } from './DefinitionOverlay.js';
import styles from './LessonOngoing.module.scss';
import {diffStringsRaw, DIFF_EQUAL, DIFF_DELETE, DIFF_INSERT} from 'jest-diff';

export interface LessonOngoingProps {
    course: Course;
    exercises: string[];
    onLessonDone?: () => void;
    onExerciseConfirmed: (_: {course: Course, exercise: Translation, answerCorrect: boolean}) => void;
}

function doAnswersMatch(a: string, b: string): boolean {
    const ignoreChars = /[.¿?,?!;"-]/g;
    return a.replace(ignoreChars, '').toLowerCase() === b.replace(ignoreChars, '').toLowerCase();
}

export function LessonOngoing({course, exercises, onLessonDone, onExerciseConfirmed}: LessonOngoingProps) {
    const [remainingExercises, setRemainingExercises] = useState(() => [...exercises]);
    const currentExercise = course.sentences[course.to].find(sentence => sentence.id === remainingExercises[0]);
    const questionHint = '';
    const voices = useMemo(
        () => getVoices(course.to),
        [course]
    );
    const speakAnswerAsQuestionMode = useMemo(
        () => voices.length > 0 && Math.random() < 0.3,
        [voices, currentExercise]
    );
    const question = useMemo(
        () => speakAnswerAsQuestionMode ? currentExercise : pickRandom(
            course.links.filter(([fromId, toId]) => toId === currentExercise.id)
                .map(([fromId, toId]) => course.sentences[course.from].find(sentence => sentence.id === fromId))
        ),
        [currentExercise, course, speakAnswerAsQuestionMode]
    );
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [correctAnswerHintVisible, setCorrectAnswerHintVisible] = useState(false);
    
    type DefinitionOverlayData = {visible: false; exercise: null; course: null;} | {visible: true; exercise: Translation; course: Course;};
    const [definitionOverlayData, setDefinitionOverlayData] = useState<DefinitionOverlayData>({
        visible: false,
        exercise: null,
        course: null
    });
    useEffect(() => {
        const updateOverlayVisibility = () => {
            if (location.hash !== '#definition') {
                setDefinitionOverlayData({
                    visible: false,
                    exercise: null,
                    course: null
                });
            }
        };
        addEventListener('hashchange', updateOverlayVisibility);
        return () => removeEventListener('hashchange', updateOverlayVisibility);
    }, []);
    
    const correctAnswer = useMemo(
        () => speakAnswerAsQuestionMode ? question : pickRandom(
            course.links.filter(([fromId, toId]) => toId === currentExercise.id)
                .map(([fromId, toId]) => course.sentences[course.to].find(sentence => sentence.id === toId))
        ),
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
            setRemainingExercises(remainingExercises.filter(e => e!==currentExercise.id));
        }
    };
    const confirm = (answerText: string) => {
        setCurrentAnswer(answerText);
        if (correctAnswerHintVisible) {
            showNextExcercise();
        } else {
            const acceptedAnswers = speakAnswerAsQuestionMode ? [currentExercise] : course.links.filter(([fromId, toId]) => toId === currentExercise.id)
                .map(([fromId, toId]) => course.sentences[course.to].find(sentence => sentence.id === toId));
            const answerCorrect = acceptedAnswers.some(correctOption => doAnswersMatch(correctOption.text, answerText));
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
    
    const showDefinitionOverlay = (exercise: Translation) => {
        setDefinitionOverlayData({
            exercise,
            course,
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
        return <div className={styles.correctAnswerHint} style={ {display: correctAnswerHintVisible ? 'block' : 'none'} }>
            <p>Your answer</p>
            <p className={styles.wrongAnswer}>{diff.map((section, index) => {
                const sectionState = section[0];
                const sectionValue = section[1];
                if (sectionState===DIFF_DELETE) {
                    return <span className={styles.diffWrong} key={index}>{sectionValue}</span>
                } else if (sectionState!==DIFF_INSERT) {
                    return sectionValue;
                }
            })}</p>
            <p>Correct answer</p>
            <p className={styles.correctAnswer}>{diff.map((section, index) => {
                const sectionState = section[0];
                const sectionValue = section[1];
                if (sectionState===DIFF_INSERT) {
                    return <span className={styles.diffCorrected} key={index}>{sectionValue}</span>
                } else if (sectionState!==DIFF_DELETE) {
                    return sectionValue;
                }
            })}</p>
        </div>
    }
    
    const renderReadQuestion = () => {
        return <>
            <button onClick={() => speak(question.text, voices) }>Speak sentence to match</button>
            <button onClick={() => showDefinitionOverlay(question)}>Info</button>
        </>;
    };
    
    const renderShowQuestion = () => {
        return <>
            <div className={styles.question}>{question.text}</div>
            <div className={styles.questionHint}>{questionHint}</div>
            <button className={styles.buttonDefinition} onClick={() => showDefinitionOverlay(question)}>Info</button>
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
    {definitionOverlayData.visible && <DefinitionOverlay exercise={definitionOverlayData.exercise} course={course} onBackToExercise={() => closeDefinitionOverlay()} />}</>;
}
