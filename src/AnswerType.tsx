import { useMemo, useState, useCallback } from 'react';
import { pickRandom, findWrongAnswers, Course, Translation, segmentToWords } from './util.js';
import styles from './AnswerType.module.scss';
import stylesText from './text.module.scss';
import { useTranslation } from "react-i18next";

interface AnswerTypeProps {
    course: Course;
    currentExercise: Translation;
    currentAnswer: string;
    onChange: (answer: string) => void;
    onConfirm: (answer: string) => void;
    hint: string;
}

export function AnswerType({course, currentExercise, currentAnswer, onChange, onConfirm, hint}: AnswerTypeProps) {
    const { t } = useTranslation();
    const wrongAnswers = useMemo(
        () => findWrongAnswers(currentExercise, 2, course, course.to),
        [course, currentExercise]
    );
    const answerOptions = useMemo(
        () => {
            const answerOptions = [
                currentExercise,
                ...wrongAnswers
            ];
            answerOptions.sort(() => Math.random() - 0.5);
            return answerOptions;
        },
        [course, currentExercise, wrongAnswers]
    );
    
    const wordSuggestions = useMemo(
        () => Array.from(new Set([
            ...answerOptions.flatMap(answerOption => segmentToWords(answerOption.text, course.to).filter(s => s.isWordLike || !/^\s+$/g.test(s.segment) ).map(s => s.segment))
        ])).sort(() => Math.random() - 0.5),
        [answerOptions]
    );
    
    const textareaRef = useCallback(textareaNode => {
        textareaNode?.focus();
    }, []);
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
    const removeLastWord = () => {
        onChange(currentAnswer.replace(/\s*\S*$/, ''));
    };
    const removeAnimation = (e) => {
        e.target.classList.remove(styles.clicked);
    };
    const confirmOnEnter = (e) => {
        if (e.key === "Enter" && e.shiftKey == false) {
            onConfirm(e.target.value);
            e.preventDefault();
        }
    };
    
    return <div className={styles.typeAnswer}>
        <p>{ hint }</p>
        <div className={styles.textInput}>
            { dummyTextareaVisible ? <div className={styles.textarea} onClick={() => setDummyTextareaVisible(false)}>&#8203;{currentAnswer}</div>
            : <textarea ref={textareaRef} type="text" value={currentAnswer} onChange={e => onChange(e.target.value)} onKeyPress={confirmOnEnter} />}<button onClick={() => removeLastWord() }>{ t('AnswerType.clear') }</button>
        </div>
        <div className={styles.wordSuggestions} onAnimationEnd={removeAnimation}>{
            wordSuggestions.map(suggestion => {
                return <p className={styles.wordSuggestion} onClick={e => addSuggestion(e, suggestion)} key={suggestion}>
                    <span>{suggestion}</span>
                    { course.ipaTranscriptions && course.ipaTranscriptions[suggestion] && <span className={stylesText.ipa}>{course.ipaTranscriptions[suggestion]}</span> }
                </p>;
            })
        }</div>
    </div>;
}
