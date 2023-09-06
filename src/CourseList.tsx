import { CourseTile } from './CourseTile.js';
import useLocalStorageState from 'use-local-storage-state';
import styles from './CourseList.module.scss';
import { CourseMeta, Knowledge } from './util.js';
import { AudioExercisesEnabledContext, CorrectAnswerConfirmationsEnabledContext } from './contexts.js';
import { useContext } from 'react';
import { useTranslation } from "react-i18next";

interface CourseListProps {
    courseIndex: Record<string, CourseMeta>;
    knowledge: Knowledge;
    onCourseSelected?: (langPair: string) => void;
    setAudioExercisesEnabled: (audioExercisesEnabled: boolean) => void;
    setCorrectAnswerConfirmationsEnabled: (correctAnswerConfirmationsEnabled: boolean) => void;
}

export function CourseList({ courseIndex, knowledge, onCourseSelected, setAudioExercisesEnabled, setCorrectAnswerConfirmationsEnabled }: CourseListProps) {
    const { t, i18n } = useTranslation();
    
    const sourceLanguages = Array.from(new Set(
        Object.keys(courseIndex).map(langPair => langPair.replace(/ to.*$/, ''))
    )).sort();
    const [sourceLanguage, setSourceLanguage] = useLocalStorageState('sourceLanguage', {
        defaultValue: sourceLanguages[0]
    });
    const pairs = Object.keys(courseIndex).filter(langPair => langPair.startsWith(sourceLanguage)).sort();
    const languagesInUILanguage = new Intl.DisplayNames([i18n.resolvedLanguage], { type: 'language' });
    
    const audioExercisesEnabled = useContext(AudioExercisesEnabledContext);
    const correctAnswerConfirmationsEnabled = useContext(CorrectAnswerConfirmationsEnabledContext);
    
    return <div>
        <div className={styles.sourceLanguage}>
            { t('CourseList.sourceLanguage') }
            <select onChange={e => setSourceLanguage(e.currentTarget.value)} defaultValue={sourceLanguage}>{
                sourceLanguages.map(lang => {
                    return <option value={lang} key={lang}>{languagesInUILanguage.of(lang)}</option>;
                })
            }</select>
        </div>
        <div className={styles.option} onClick={() => setAudioExercisesEnabled(!audioExercisesEnabled) }>{ audioExercisesEnabled ? t('CourseList.setting.audioOn') : t('CourseList.setting.audioOff') }</div>
        <div className={styles.option} onClick={() => setCorrectAnswerConfirmationsEnabled(!correctAnswerConfirmationsEnabled) }>{ correctAnswerConfirmationsEnabled ? t('CourseList.setting.correctAnswerConfirmationsOn') : t('CourseList.setting.correctAnswerConfirmationsOff') }</div>
        {
            pairs.map(langPair => {
            const courseMeta = courseIndex[langPair];
            return <div className={styles.courseTile} key={langPair}><CourseTile courseMeta={ courseMeta } onClick={() => onCourseSelected?.(langPair) } /></div>;
            })
        }
        <a href="licenses-disclaimer.txt" className={styles.disclaimer}>{ t('CourseList.softwareLicenseInfo') }</a>
    </div>;
}
