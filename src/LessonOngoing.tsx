import { useState, useMemo, useEffect, useContext } from 'react';
import { pickRandom, Course, Translation, getVoices, speak, segmentToWords } from './util.js';
import { AnswerPick } from './AnswerPick.js';
import { AnswerType } from './AnswerType.js';
import { DefinitionOverlay } from './DefinitionOverlay.js';
import styles from './LessonOngoing.module.scss';
import {diffStringsRaw, DIFF_EQUAL, DIFF_DELETE, DIFF_INSERT} from 'jest-diff';
import { AudioExercisesEnabledContext, CorrectAnswerConfirmationsEnabledContext } from './contexts.js';

export interface LessonOngoingProps {
    course: Course;
    exercises: string[];
    onLessonDone?: () => void;
    onExerciseConfirmed: (_: {course: Course, exercise: Translation, answerCorrect: boolean}) => void;
}

function doAnswersMatch(a: string, b: string, language: string): boolean {
    const aNormalized = segmentToWords(a, language).filter(s => s.isWordLike).map(s => s.segment).join(' ').toLowerCase();
    const bNormalized = segmentToWords(b, language).filter(s => s.isWordLike).map(s => s.segment).join(' ').toLowerCase();
    return aNormalized === bNormalized;
}

export function LessonOngoing({course, exercises, onLessonDone, onExerciseConfirmed}: LessonOngoingProps) {
    const [remainingExercises, setRemainingExercises] = useState(() => [...exercises]);
    const currentExercise = course.sentences[course.to].find(sentence => sentence.id === remainingExercises[0]);
    const questionHint = '';
    const voices = useMemo(
        () => getVoices(course.to),
        [course]
    );
    const audioExercisesEnabled = useContext(AudioExercisesEnabledContext);
    const speakAnswerAsQuestionMode = useMemo(
        () => audioExercisesEnabled && voices.length > 0 && Math.random() < 0.3,
        [voices, currentExercise, audioExercisesEnabled]
    );
    const question = useMemo(
        () => speakAnswerAsQuestionMode ? currentExercise : pickRandom(
            course.links.filter(([fromId, toId]) => toId === currentExercise.id)
                .map(([fromId, toId]) => course.sentences[course.from].find(sentence => sentence.id === fromId))
        ),
        [currentExercise, course, speakAnswerAsQuestionMode]
    );
    const acceptedAnswers = useMemo(() => {
        if (speakAnswerAsQuestionMode) {
            return [currentExercise];
        } else {
            return course.links.filter(([fromId, toId]) => fromId === question.id)
                .map(([fromId, toId]) => course.sentences[course.to].find(sentence => sentence.id === toId));
        }
    }, [speakAnswerAsQuestionMode, currentExercise]);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [correctAnswerHintVisible, setCorrectAnswerHintVisible] = useState(false);
    const correctAnswerConfirmationsEnabled = useContext(CorrectAnswerConfirmationsEnabledContext);
    const [correctAnswerConfirmationVisible, setCorrectAnswerConfirmationVisible] = useState(false);
    
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
    
    const acousticPick = useMemo(
        () => audioExercisesEnabled && !speakAnswerAsQuestionMode && voices.length > 0 && Math.random() < 0.5,
        [voices, speakAnswerAsQuestionMode, audioExercisesEnabled]
    );
    
    const typeAnswerMode = useMemo(
        () => Math.random() > 0.5 && question.text.includes(' '),
        [question]
    );
    
    useEffect(() => {
        if (speakAnswerAsQuestionMode) {
            speak(question.text, voices);
        }
    }, [speakAnswerAsQuestionMode, question]);
    
    const showNextExcercise = () => {
        setCorrectAnswerHintVisible(false);
        setCorrectAnswerConfirmationVisible(false);
        speechSynthesis.cancel();
        if(remainingExercises.length === 1) {
            onLessonDone?.();
        } else {
            setCurrentAnswer('');
            setRemainingExercises(remainingExercises.filter(e => e!==currentExercise.id));
        }
    };
    const confirm = (answerText: string) => {
        // Ignore accidental confirmations.
        if (answerText === '') {
            return;
        }
        
        setCurrentAnswer(answerText);
        if (correctAnswerHintVisible || correctAnswerConfirmationVisible) {
            showNextExcercise();
        } else {
            const answerCorrect = acceptedAnswers.some(correctOption => doAnswersMatch(correctOption.text, answerText, course.to));
            onExerciseConfirmed({
                course,
                exercise: currentExercise,
                answerCorrect
            });
            
            if (!answerCorrect) {
                setCorrectAnswerHintVisible(true);
            } else if (correctAnswerConfirmationsEnabled) {
                setCorrectAnswerConfirmationVisible(true);
            } else {
                showNextExcercise();
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
            return <AnswerType course={course} currentExercise={currentExercise} currentAnswer={currentAnswer} onChange={setCurrentAnswer} hint={
                speakAnswerAsQuestionMode ? 'Type what you heard' : 'Type translation'
            } />;
        } else {
            return <AnswerPick course={course} currentExercise={currentExercise} currentAnswer={currentAnswer} onSelect={setCurrentAnswer} onConfirm={confirm} onShowDefinition={showDefinitionOverlay} voices={voices} acousticPick={acousticPick} hint={
                speakAnswerAsQuestionMode ? 'Pick what you heard' : 'Pick correct translation'
            } />;
        }
    }
    
    const renderWrongAndCorrectAnswer = () => {
        const diff = diffStringsRaw(currentAnswer, currentExercise.text, true);
        return <div className={styles.correctAnswerHint}>
            <p>You answered wrongly</p>
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
    };
    
    const renderCorrectAnswerConfirmation = () => {
        const correctAnswer = acceptedAnswers.find(correctOption => doAnswersMatch(correctOption.text, currentAnswer, course.to));
        const alsoCorrectAnswers = acceptedAnswers.filter(sentence => sentence.id !== correctAnswer.id);
        return <div className={styles.correctAnswerConfirmation}>
            <h2>You answered correctly</h2>
            <p>{ correctAnswer.text }</p>
            { alsoCorrectAnswers.length === 0 ? <></> : <>
                <h2>Also correct</h2>
                { alsoCorrectAnswers.map(sentence => <p key={sentence.id}>{sentence.text}</p>) }
            </> }
        </div>
    };
    
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
    
    const renderMain = () => {
        if (correctAnswerHintVisible) {
            return renderWrongAndCorrectAnswer();
        } else if (correctAnswerConfirmationVisible) {
            return renderCorrectAnswerConfirmation();
        } else {
            return renderAnswerMeans();
        }
    };
    return <><div className={styles.fullHeight}>
        <progress max={exercises.length} value={1 + exercises.length - remainingExercises.length} className={styles.progress}></progress>
        <div className={styles.head}>{speakAnswerAsQuestionMode ? renderReadQuestion() : renderShowQuestion() }</div>
        { renderMain() }
        <div className={styles.buttons}>
            <button onClick={() => onLessonDone?.() }>Abort</button>
            <button onClick={() => showNextExcercise()}>Skip</button>
            <button onClick={() => confirm(currentAnswer)}>Confirm</button>
        </div>
    </div>
    {definitionOverlayData.visible && <DefinitionOverlay exercise={definitionOverlayData.exercise} course={course} onBackToExercise={() => closeDefinitionOverlay()} />}</>;
}
