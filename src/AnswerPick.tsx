import { useState, useMemo, MouseEvent } from 'react';
import { pickRandom, findWrongAnswers, speak, Course, Translation, transcribeIPA, cssClasses } from './util.js';
import styles from './AnswerPick.module.scss';
import stylesText from './text.module.scss';
import { useTranslation } from "react-i18next";

interface AnswerPickProps {
    course: Course;
    currentExercise: Translation;
    currentAnswer: string;
    onSelect: (answer: string) => void;
    onConfirm: (answer: string) => void;
    onShowDefinition: (exercise: Translation) => void;
    voices: SpeechSynthesisVoice[];
    acousticPick: boolean;
    hint: string;
}

export function AnswerPick({course, currentExercise, currentAnswer, onSelect, onConfirm, onShowDefinition, voices, acousticPick, hint}: AnswerPickProps) {
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
    
    const speakAndSelect = (answerOption: Translation) => {
        speak(answerOption.text, voices);
        onSelect(answerOption.text);
    };
    const showDefinition = (answerOption: Translation, e: MouseEvent) => {
        e.stopPropagation();
        
        onShowDefinition(answerOption);
    };
    
    const renderAnswerOptions = () => {
        return answerOptions.map((answerOption, index) => {
            const infoButton = <button className={styles.buttonDefinition} onClick={e => showDefinition(answerOption, e)}>{ t('AnswerPick.info') }</button>;
            const answerClasses = cssClasses(styles.answer, currentAnswer===answerOption.text && styles.selected);
            const ipaTranscription = transcribeIPA(course, answerOption.text, course.to);
            if (acousticPick) {
                return <p className={answerClasses} onClick={() => onSelect(answerOption.text)} key={index}>
                    <button onClick={() => speakAndSelect(answerOption) }>{ t('AnswerPick.speak') }</button>
                    { infoButton }
                </p>;
            } else {
                return <p className={answerClasses} onClick={() => onConfirm(answerOption.text)} key={index}>
                    <div className={styles.answerText}>
                        <span>{ answerOption.text }</span>
                        { ipaTranscription && <span className={stylesText.ipa}>{ ipaTranscription }</span> }
                    </div>
                    { infoButton }
                </p>;
            }            
        });
    };
    
    return <div className={styles.pickAnswer}>
        <p>{ hint }</p>
        { renderAnswerOptions() }
    </div>;
}
