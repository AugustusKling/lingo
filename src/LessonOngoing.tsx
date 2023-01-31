import { useState, useMemo, useEffect } from 'react';
import { pickRandom } from './util.js';
import { AnswerPick } from './AnswerPick.js';
import { AnswerType } from './AnswerType.js';
import { DefinitionOverlay } from './DefinitionOverlay.js';
import styles from './LessonOngoing.module.scss';

function doAnswersMatch(a: string, b: string): boolean {
    const ignoreChars = /[.¿?,?!;"-]/g;
    return a.replace(ignoreChars, '').toLowerCase() === b.replace(ignoreChars, '').toLowerCase();
}

export function LessonOngoing({course, exercises, onLessonDone, onExerciseConfirmed}) {
    const [remainingExercises, setRemainingExercises] = useState(() => [...exercises]);
    const currentExercise = remainingExercises[0];
    const questionHint = currentExercise.descriptions?.[course.from];
    const question = useMemo(
        () => pickRandom(currentExercise.translations[course.from]),
        [currentExercise, course]
    );
    const correctAnswer = useMemo(
        () => pickRandom(currentExercise.translations[course.to]),
        [currentExercise, course]
    );
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [correctAnswerHintVisible, setCorrectAnswerHintVisible] = useState(false);
    
    const [definitionOverlayData, setDefinitionOverlayData] = useState({
        visible: false,
        exercise: null,
        title: null
    });
    useEffect(() => {
        const updateOverlayVisibility = () => setDefinitionOverlayData(old => ({
            ...old,
            visible: location.hash==='#definition'
        }));
        addEventListener('hashchange', updateOverlayVisibility);
        return () => removeEventListener('hashchange', updateOverlayVisibility);
    }, []);
    
    const typeAnswerMode = useMemo(
        () => Math.random() > 0.5 && question.text.includes(' '),
        [question]
    );
    
    const showNextExcercise = () => {
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
            setCorrectAnswerHintVisible(false);
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
    
    const showDefinitionOverlay = (exercise, title) => {
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
            return <AnswerType course={course} currentExercise={currentExercise} correctAnswer={correctAnswer} currentAnswer={currentAnswer} onChange={setCurrentAnswer} />;
        } else {
            return <AnswerPick course={course} currentExercise={currentExercise} correctAnswer={correctAnswer} currentAnswer={currentAnswer} onSelect={setCurrentAnswer} onConfirm={confirm} onShowDefinition={showDefinitionOverlay} />;
        }
    }
    
    return <><div>
        <progress max={exercises.length} value={1 + exercises.length - remainingExercises.length} className={styles.progress}></progress>
        <div className={styles.head}>
            <div className={styles.question}>{question.text}</div>
            <div className={styles.questionHint}>{questionHint}</div>
            <button className={styles.buttonDefinition} onClick={() => showDefinitionOverlay(currentExercise, question.text)}>Info</button>
        </div>
        { !correctAnswerHintVisible ? renderAnswerMeans() :
            <div className={styles.correctAnswerHint} style={ {display: correctAnswerHintVisible ? 'block' : 'none'} }>
                <p>Your answer</p>
                <p className={styles.wrongAnswer}>{currentAnswer}</p>
                <p>Correct answer</p>
                <p className={styles.correctAnswer}>{correctAnswer.text}</p>
            </div>
        }
        <div className={styles.buttons}>
            <button onClick={() => onLessonDone?.() }>Abort</button>
            <button onClick={() => showNextExcercise()}>Skip</button>
            <button onClick={() => confirm(currentAnswer)}>Confirm</button>
        </div>
    </div>
    {definitionOverlayData.visible && <DefinitionOverlay exercise={definitionOverlayData.exercise} title={definitionOverlayData.title} from={course.from} to={course.to} onBackToExercise={() => closeDefinitionOverlay()} />}</>;
}
