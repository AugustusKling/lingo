import { useState, useMemo, useEffect, useContext } from 'react';
import { pickRandom, Course, Translation, useVoices, speak, segmentToWords, RankableExercise } from './util.js';
import { AnswerPick } from './AnswerPick.js';
import { AnswerType } from './AnswerType.js';
import { DefinitionOverlay } from './DefinitionOverlay.js';
import styles from './LessonOngoing.module.scss';
import {diffStringsRaw, DIFF_EQUAL, DIFF_DELETE, DIFF_INSERT} from 'jest-diff';
import { AudioExercisesEnabledContext, CorrectAnswerConfirmationsEnabledContext } from './contexts.js';
import { useTranslation } from "react-i18next";
import { Progress } from './Progress.js';

export interface LessonOngoingProps {
    course: Course;
    exercises: string[];
    onLessonDone?: () => void;
    onAbort?: () => void;
    onExerciseConfirmed: (_: {course: Course, exercise: Translation, answerCorrect: boolean}) => void;
    ongoingLessonProgress: RankableExercise[];
}

function doAnswersMatch(a: string, b: string, language: string): boolean {
    const aNormalized = segmentToWords(a, language).filter(s => s.isWordLike).map(s => s.segment).join(' ').toLowerCase();
    const bNormalized = segmentToWords(b, language).filter(s => s.isWordLike).map(s => s.segment).join(' ').toLowerCase();
    return aNormalized === bNormalized;
}

export function LessonOngoing({course, exercises, onLessonDone, onAbort, onExerciseConfirmed, ongoingLessonProgress}: LessonOngoingProps) {
    const { t } = useTranslation();
    const [remainingExercises, setRemainingExercises] = useState(exercises);
    const currentExercise = course.sentences[course.to].find(sentence => sentence.id === remainingExercises[0]);
    const questionHint = '';
    const voices = useVoices(course.to);
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
    const [answerConfirmed, setAnswerConfirmed] = useState(false);
    
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
        setAnswerConfirmed(false);
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
        } else if(!answerConfirmed) {
            const answerCorrect = acceptedAnswers.some(correctOption => doAnswersMatch(correctOption.text, answerText, course.to));
            setAnswerConfirmed(true);
            onExerciseConfirmed({
                course,
                exercise: currentExercise,
                answerCorrect
            });
            
            const canSpeak = audioExercisesEnabled && voices.length>0;
            if (!answerCorrect) {
                setCorrectAnswerHintVisible(true);
                if (canSpeak) {
                    speak(currentExercise.text, voices);
                }
            } else if (correctAnswerConfirmationsEnabled || canSpeak) {
                setCorrectAnswerConfirmationVisible(true);
                if (correctAnswerConfirmationsEnabled) {
                    speak(currentExercise.text, voices);
                } else if (canSpeak) {
                    speak(currentExercise.text, voices).then(playedToEnd => {
                        if (playedToEnd) {
                            showNextExcercise()
                        }
                    });
                }
            } else {
                showNextExcercise();
            }
        } else {
            showNextExcercise();
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
            return <AnswerType course={course} currentExercise={currentExercise} currentAnswer={currentAnswer} onChange={setCurrentAnswer} onConfirm={confirm} hint={
                speakAnswerAsQuestionMode ? t('LessonOngoing.typeHeard') : t('LessonOngoing.typeTranslation')
            } />;
        } else {
            return <AnswerPick course={course} currentExercise={currentExercise} currentAnswer={currentAnswer} onSelect={setCurrentAnswer} onConfirm={confirm} onShowDefinition={showDefinitionOverlay} acousticPick={acousticPick} hint={
                speakAnswerAsQuestionMode ? t('LessonOngoing.pickHeard') : t('LessonOngoing.pickTranslation')
            } />;
        }
    }
    
    const renderWrongAndCorrectAnswer = () => {
        const diff = diffStringsRaw(currentAnswer, currentExercise.text, true);
        return <div className={styles.correctAnswerHint}>
            <p>{ t('LessonOngoing.answeredWrongly') }</p>
            <p className={styles.wrongAnswer}>{diff.map((section, index) => {
                const sectionState = section[0];
                const sectionValue = section[1];
                if (sectionState===DIFF_DELETE) {
                    return <span className={styles.diffWrong} key={index}>{sectionValue}</span>
                } else if (sectionState!==DIFF_INSERT) {
                    return sectionValue;
                }
            })}</p>
            <p>{ t('LessonOngoing.correctAnswer') }</p>
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
            <h2>{ t('LessonOngoing.answeredCorrectly') }</h2>
            <p>{ correctAnswer.text }</p>
            { alsoCorrectAnswers.length === 0 ? <></> : <>
                <h2>{ t('LessonOngoing.alsoCorrect') }</h2>
                { alsoCorrectAnswers.map(sentence => <p key={sentence.id}>{sentence.text}</p>) }
            </> }
        </div>
    };
    
    const renderReadQuestion = () => {
        return <>
            <button onClick={() => speak(question.text, voices) }>{ t('LessonOngoing.speakToMatch') }</button>
            <button onClick={() => showDefinitionOverlay(question)}>{ t('LessonOngoing.info') }</button>
        </>;
    };
    
    const renderShowQuestion = () => {
        return <>
            <div className={styles.question}>{question.text}</div>
            <div className={styles.questionHint}>{questionHint}</div>
            <button className={styles.buttonDefinition} onClick={() => showDefinitionOverlay(question)}>{ t('LessonOngoing.info') }</button>
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
        <Progress progress={ongoingLessonProgress} />
        <div className={styles.head}>{speakAnswerAsQuestionMode ? renderReadQuestion() : renderShowQuestion() }</div>
        { renderMain() }
        <div className={styles.buttons}>
            <button onClick={() => onAbort?.() }>{ t('LessonOngoing.abort') }</button>
            <button onClick={() => showNextExcercise()}>{ t('LessonOngoing.skip') }</button>
            <button onClick={() => confirm(currentAnswer)}>{ t('LessonOngoing.confirm') }</button>
        </div>
    </div>
    {definitionOverlayData.visible && <DefinitionOverlay exercise={definitionOverlayData.exercise} course={course} onBackToExercise={() => closeDefinitionOverlay()} />}</>;
}
