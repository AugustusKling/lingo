import { useState, useMemo, MouseEvent } from 'react';
import { pickRandom, findWrongAnswers, speak, Course, Exercise, Translation } from './util.js';
import styles from './AnswerPick.module.scss';

interface AnswerPickProps {
    course: Course;
    currentExercise: Exercise;
    correctAnswer: Translation;
    currentAnswer: string;
    onSelect: (answer: string) => void;
    onConfirm: (answer: string) => void;
    onShowDefinition: (exercise: Exercise, title: string) => void;
}

export function AnswerPick({course, currentExercise, correctAnswer, currentAnswer, onSelect, onConfirm, onShowDefinition}: AnswerPickProps) {
    const wrongAnswers = useMemo(
        () => findWrongAnswers(currentExercise, 2, course.exercerciseList, course.to),
        [course, currentExercise]
    );
    const answerOptions = useMemo(
        () => {
            const answerOptions = [
                correctAnswer,
                ...wrongAnswers.map(wrongAnswer => pickRandom(wrongAnswer.translations[course.to]))
            ];
            answerOptions.sort(() => Math.random() - 0.5);
            return answerOptions;
        },
        [course, currentExercise, correctAnswer, wrongAnswers]
    );
    
    const voices = useMemo(
        () => speechSynthesis.getVoices().filter(voice => voice.lang.startsWith(course.to)),
        [course]
    );
    const acousticPick = useMemo(
        () => voices.length > 0 && Math.random() < 0.5,
        [voices]
    );
    
    const speakAndSelect = (answerOption: Translation) => {
        speak(answerOption.text, voices);
        onSelect(answerOption.text);
    };
    const showDefinition = (answerOption: Translation, e: MouseEvent) => {
        e.stopPropagation();
        
        const exerciseForOption = wrongAnswers.find(wrongAnswer => Object.values(wrongAnswer.translations[course.to]).some(t => t === answerOption)) || currentExercise;
        onShowDefinition(exerciseForOption, answerOption.text);
    };
    
    const renderAnswerOptions = () => {
        return answerOptions.map((answerOption, index) => {
            const infoButton = <button className={styles.buttonDefinition} onClick={e => showDefinition(answerOption, e)}>Info</button>;
            const answerClasses = currentAnswer===answerOption.text ? `${styles.answer} ${styles.selected}` : styles.answer;
            if (acousticPick) {
                return <p className={answerClasses} onClick={() => onSelect(answerOption.text)} key={index}>
                    <button onClick={() => speakAndSelect(answerOption) }>Speak</button>
                    { infoButton }
                </p>;
            } else {
                return <p className={answerClasses} onClick={() => onConfirm(answerOption.text)} key={index}>
                    { answerOption.text }
                    { infoButton }
                </p>;
            }            
        });
    };
    
    return <div className={styles.pickAnswer}>
        <p>Pick correct translation</p>
        { renderAnswerOptions() }
    </div>;
}
