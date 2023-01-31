import { useMemo, useRef } from 'react';
import { pickRandom, findWrongAnswers } from './util.js';
import styles from './AnswerType.module.scss';

export function AnswerType({course, currentExercise, correctAnswer, currentAnswer, onChange}) {
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
    
    const typeAnswerInputHtmlRef = useRef(null);
    const addSuggestion = (wordSuggestion: string) => {
        if (currentAnswer === '') {
            onChange(wordSuggestion);
        } else if (/^[.¿?,?!;"]$/.test(wordSuggestion)) {
            onChange(currentAnswer + wordSuggestion);
        } else {
            onChange(currentAnswer + ' ' + wordSuggestion);
        }
    };
    
    return <div className={styles.typeAnswer}>
        <p>Type translation</p>
        <div className={styles.textInput}>
            <input type="text" value={currentAnswer} onChange={e => onChange(e.target.value)} /><button onClick={() => onChange('')}>Clear</button>
        </div>
        <div className={styles.wordSuggestions}>{
            wordSuggestions.map(suggestion => {
                return <p className={styles.wordSuggestion} onClick={() => addSuggestion(suggestion)} key={suggestion}>{suggestion}</p>;
            })
        }</div>
    </div>;
}
