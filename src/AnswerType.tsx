import { useMemo, useState } from 'react';
import { pickRandom, findWrongAnswers, Course, Exercise, Translation } from './util.js';
import styles from './AnswerType.module.scss';

interface AnswerTypeProps {
    course: Course;
    currentExercise: Exercise;
    correctAnswer: Translation;
    currentAnswer: string;
    onChange: (answer: string) => void;
}

export function AnswerType({course, currentExercise, correctAnswer, currentAnswer, onChange}: AnswerTypeProps) {
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
    
    const wordSuggestions = useMemo(
        () => Array.from(new Set([
            ...answerOptions.flatMap(answerOption => answerOption.text.split(/\s+|[.¿?,?!;"]/)).filter(wordSuggestion => wordSuggestion !== ''),
            ...answerOptions.flatMap(answerOption => Array.from(new Set(answerOption.text.replace(/[^.¿?,?!;"]/g, ''))))
        ])).sort(() => Math.random() - 0.5),
        [answerOptions]
    );
    
    const [dummyTextareaVisible, setDummyTextareaVisible] = useState(true);
    
    const addSuggestion = (e: MouseEvent, wordSuggestion: string) => {
        e.target.classList.add(styles.clicked);
        if (currentAnswer === '') {
            onChange(wordSuggestion);
        } else if (/^[.¿?,?!;"]$/.test(wordSuggestion)) {
            onChange(currentAnswer + wordSuggestion);
        } else {
            onChange(currentAnswer + ' ' + wordSuggestion);
        }
    };
    const removeAnimation = (e) => {
        e.target.classList.remove(styles.clicked);
    }
    
    return <div className={styles.typeAnswer}>
        <p>Type translation</p>
        <div className={styles.textInput}>
            { dummyTextareaVisible ? <div className={styles.textarea} onClick={() => setDummyTextareaVisible(false)}>&#8203;{currentAnswer}</div>
            : <textarea type="text" value={currentAnswer} onChange={e => onChange(e.target.value)} />}<button onClick={() => onChange('')}>Clear</button>
        </div>
        <div className={styles.wordSuggestions} onAnimationEnd={removeAnimation}>{
            wordSuggestions.map(suggestion => {
                return <p className={styles.wordSuggestion} onClick={e => addSuggestion(e, suggestion)} key={suggestion}>{suggestion}</p>;
            })
        }</div>
    </div>;
}
