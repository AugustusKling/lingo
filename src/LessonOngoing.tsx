import { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { pickRandom, Course, Translation, useVoices, speak, segmentToWords, RankableExercise, transcribeIPA } from './util.js';
import { AnswerPick } from './AnswerPick.js';
import { AnswerType } from './AnswerType.js';
import { DefinitionOverlay } from './DefinitionOverlay.js';
import styles from './LessonOngoing.module.scss';
import stylesText from './text.module.scss';
import {diffStringsRaw, DIFF_EQUAL, DIFF_DELETE, DIFF_INSERT} from 'jest-diff';
import { AudioExercisesEnabledContext, CorrectAnswerConfirmationsEnabledContext, IpaEnabledContext } from './contexts.js';
import { useTranslation } from "react-i18next";
import { Progress } from './Progress.js';

export interface LessonOngoingProps {
    course: Course;
    exercises: Translation[];
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

const autoConfirmDelaySecondsInitial = 2;

export function LessonOngoing({course, exercises, onLessonDone, onAbort, onExerciseConfirmed, ongoingLessonProgress}: LessonOngoingProps) {
    const { t } = useTranslation();
    const ipaEnabled = useContext(IpaEnabledContext);
    
    const [remainingExercises, setRemainingExercises] = useState(exercises);
    const currentExercise = remainingExercises[0];
    const currentExerciseRankable = ongoingLessonProgress.find(re => re.id === currentExercise.id);
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
    const [autoConfirmDelaySeconds, setAutoConfirmDelaySeconds] = useState(autoConfirmDelaySecondsInitial);
    const autoConfirmIntervalJob = useRef<null | number>(null);
    const [autoConfirmIntervalJobActive, setAutoConfirmIntervalJobActive] = useState(false);
    const clearAutoConfirmIntervalJob = () => {
        if (autoConfirmIntervalJob.current!==null) {
            clearInterval(autoConfirmIntervalJob.current);
            autoConfirmIntervalJob.current = null;
            setAutoConfirmIntervalJobActive(false);
        }
    };
    useEffect(() => clearAutoConfirmIntervalJob, []);
    
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
        setAutoConfirmDelaySeconds(autoConfirmDelaySecondsInitial);
        clearAutoConfirmIntervalJob();
        speechSynthesis.cancel();
        if(remainingExercises.length === 1) {
            onLessonDone?.();
        } else {
            setCurrentAnswer('');
            setRemainingExercises(remainingExercises.filter(e => e!==currentExercise));
        }
    };
    let autoConfirmIntervalStepCalls = 0;
    /**
     * Job executed on interval of 1s.
     */
    const autoConfirmIntervalStep = () => {
        const secondsRemaining = autoConfirmDelaySecondsInitial - autoConfirmIntervalStepCalls;
        if (secondsRemaining <= 0) {
            showNextExcercise();
        } else {
            autoConfirmIntervalStepCalls = autoConfirmIntervalStepCalls + 1;
            setAutoConfirmDelaySeconds(secondsRemaining);
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
            const correctAnswer = acceptedAnswers.find(correctOption => doAnswersMatch(correctOption.text, answerText, course.to));
            const answerCorrect = correctAnswer!==undefined;
            onExerciseConfirmed({
                course,
                exercise: answerCorrect ? correctAnswer : currentExercise,
                answerCorrect
            });
            
            const canSpeak = audioExercisesEnabled && voices.length>0;
            if (!answerCorrect) {
                setCorrectAnswerHintVisible(true);
                if (canSpeak) {
                    speak(currentExercise.text, voices);
                }
            } else {
                setCorrectAnswerConfirmationVisible(true);
                if (correctAnswerConfirmationsEnabled && canSpeak) {
                    speak(correctAnswer.text, voices);
                } else if (canSpeak) {
                    speak(correctAnswer.text, voices).then(playedToEnd => {
                        if (playedToEnd) {
                            autoConfirmIntervalJob.current = setInterval(autoConfirmIntervalStep, 1000);
                            setAutoConfirmIntervalJobActive(true);
                        }
                    });
                } else if(!correctAnswerConfirmationsEnabled) {
                    autoConfirmIntervalJob.current = setInterval(autoConfirmIntervalStep, 1000);
                    setAutoConfirmIntervalJobActive(true);
                }
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
            const rank = currentExerciseRankable.rank;
            return <AnswerType course={course} currentExercise={currentExercise} currentAnswer={currentAnswer} onChange={setCurrentAnswer} onConfirm={confirm} hint={
                speakAnswerAsQuestionMode ? t('LessonOngoing.typeHeard') : t('LessonOngoing.typeTranslation')
            } rank={rank} />;
        } else {
            return <AnswerPick course={course} currentExercise={currentExercise} currentAnswer={currentAnswer} onSelect={setCurrentAnswer} onConfirm={confirm} onShowDefinition={showDefinitionOverlay} acousticPick={acousticPick} hint={
                speakAnswerAsQuestionMode ? t('LessonOngoing.pickHeard') : t('LessonOngoing.pickTranslation')
            } />;
        }
    }
    
    const renderTranslations = () => {
        const translationIds = course.links.filter(link => link.includes(currentExercise.id)).flatMap(link => link).filter(id => id !== currentExercise.id);
        const translations = course.sentences[course.from].filter(translation => translationIds.includes(translation.id));
        return <>
            <h2>{ t('LessonOngoing.translations') }</h2>
            { translations.map(sentence => {
                const ipaTranscription = ipaEnabled && transcribeIPA(course, sentence.text, course.from);
                return <p key={sentence.id} className={styles.sentenceWithIpa}>
                    <span>{sentence.text}</span>
                    { ipaTranscription && <span className={stylesText.ipa}>{ ipaTranscription }</span> }
                </p>;
            }) }
        </>;
    };
    
    const renderWrongAndCorrectAnswer = () => {
        const diff = diffStringsRaw(currentAnswer, currentExercise.text, true);
        const ipaTranscription = ipaEnabled && transcribeIPA(course, currentExercise.text, course.to);
        return <div className={styles.correctAnswerHint}>
            <h2>{ t('LessonOngoing.answeredWrongly') }</h2>
            <p className={styles.wrongAnswer}>{diff.map((section, index) => {
                const sectionState = section[0];
                const sectionValue = section[1];
                if (sectionState===DIFF_DELETE) {
                    return <span className={styles.diffWrong} key={index}>{sectionValue}</span>
                } else if (sectionState!==DIFF_INSERT) {
                    return sectionValue;
                }
            })}</p>
            <h2>{ t('LessonOngoing.correctAnswer') }</h2>
            <p className={styles.correctAnswer}>
                <div>{diff.map((section, index) => {
                    const sectionState = section[0];
                    const sectionValue = section[1];
                    if (sectionState===DIFF_INSERT) {
                        return <span className={styles.diffCorrected} key={index}>{sectionValue}</span>
                    } else if (sectionState!==DIFF_DELETE) {
                        return sectionValue;
                    }
                })}</div>
                { ipaTranscription && <span className={stylesText.ipa}>{ ipaTranscription }</span> }
            </p>
            { renderTranslations() }
        </div>
    };
    
    const renderCorrectAnswerConfirmation = () => {
        const correctAnswer = acceptedAnswers.find(correctOption => doAnswersMatch(correctOption.text, currentAnswer, course.to));
        const ipaTranscription = ipaEnabled && transcribeIPA(course, correctAnswer.text, course.to);
        const alsoCorrectAnswers = acceptedAnswers.filter(sentence => sentence.id !== correctAnswer.id);
        return <div className={styles.correctAnswerConfirmation} onClick={() => clearAutoConfirmIntervalJob()}>
            <h2>{ t('LessonOngoing.answeredCorrectly') }</h2>
            <p className={styles.sentenceWithIpa}>
                <span>{ correctAnswer.text }</span>
                { ipaTranscription && <span className={stylesText.ipa}>{ ipaTranscription }</span> }
            </p>
            { alsoCorrectAnswers.length === 0 ? <></> : <>
                <h2>{ t('LessonOngoing.alsoCorrect') }</h2>
                { alsoCorrectAnswers.map(sentence => {
                    const ipaTranscription = ipaEnabled && transcribeIPA(course, sentence.text, course.to);
                    return <p key={sentence.id} className={styles.sentenceWithIpa}>
                        <span>{sentence.text}</span>
                        { ipaTranscription && <span className={stylesText.ipa}>{ ipaTranscription }</span> }
                    </p>;
                }) }
            </> }
            { renderTranslations() }
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
        <Progress progress={ongoingLessonProgress} mark={currentExerciseRankable} />
        <div className={styles.head}>{speakAnswerAsQuestionMode ? renderReadQuestion() : renderShowQuestion() }</div>
        { renderMain() }
        <div className={styles.buttons}>
            <button onClick={() => onAbort?.() }>{ t('LessonOngoing.abort') }</button>
            <button onClick={() => showNextExcercise()}>{ t('LessonOngoing.skip') }</button>
            <button onClick={() => confirm(currentAnswer)}>{ !autoConfirmIntervalJobActive ? t('LessonOngoing.confirm') : t('LessonOngoing.confirmCounter', {secondsRemaining: autoConfirmDelaySeconds}) }</button>
        </div>
    </div>
    {definitionOverlayData.visible && <DefinitionOverlay exercise={definitionOverlayData.exercise} course={course} onBackToExercise={() => closeDefinitionOverlay()} />}</>;
}
