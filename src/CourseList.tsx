import { CourseTile } from './CourseTile.js';
import { Setting } from './Setting.js';
import useLocalStorageState from 'use-local-storage-state';
import styles from './CourseList.module.scss';
import { CourseMeta, Knowledge } from './util.js';
import { AudioExercisesEnabledContext, CorrectAnswerConfirmationsEnabledContext, IpaEnabledContext } from './contexts.js';
import { useContext, useState } from 'react';
import { useTranslation } from "react-i18next";

interface CourseListProps {
    courseIndex: Record<string, CourseMeta>;
    knowledge: Knowledge;
    onCourseSelected?: (langPair: string) => void;
    setAudioExercisesEnabled: (audioExercisesEnabled: boolean) => void;
    setCorrectAnswerConfirmationsEnabled: (correctAnswerConfirmationsEnabled: boolean) => void;
    setIpaEnabled: (ipaEnabled: boolean) => void;
}

export function CourseList({ courseIndex, knowledge, onCourseSelected, setAudioExercisesEnabled, setCorrectAnswerConfirmationsEnabled, setIpaEnabled }: CourseListProps) {
    const { t, i18n } = useTranslation();
    
    const sourceLanguages = Array.from(new Set(
        Object.keys(courseIndex).map(langPair => langPair.replace(/ to.*$/, ''))
    )).sort();
    
    const [sourceLanguage, setSourceLanguage] = useLocalStorageState('sourceLanguage', {
        defaultValue: () => {
            const browserDesiredLanguages = navigator.languages.map(lang => new Intl.Locale(lang).language);
            for (const browserLang of browserDesiredLanguages) {
                const match = sourceLanguages.find(lang => new Intl.Locale(lang).language === browserLang);
                if (match) {
                    return match;
                }
            }
            return sourceLanguages[0];
        }
    });
    const pairs = Object.keys(courseIndex).filter(langPair => langPair.startsWith(sourceLanguage)).sort();
    const languagesInUILanguage = new Intl.DisplayNames([i18n.resolvedLanguage], { type: 'language' });
    
    const audioExercisesEnabled = useContext(AudioExercisesEnabledContext);
    const correctAnswerConfirmationsEnabled = useContext(CorrectAnswerConfirmationsEnabledContext);
    const ipaEnabled = useContext(IpaEnabledContext);
    
    const [settingsOpen, setSettingsOpen] = useState(false);
    
    return <div>
        <a className={styles.toggleSettings} onClick={() => setSettingsOpen(!settingsOpen)}>{t('CourseList.toggleSettings')}</a>
        { settingsOpen && <div className={styles.settingsContainer}>
            <Setting title={t('CourseList.setting.audio.title')} enabled={audioExercisesEnabled} onChange={() => setAudioExercisesEnabled(!audioExercisesEnabled) }>{ t('CourseList.setting.audio.explanation') }</Setting>
            <Setting title={t('CourseList.setting.correctAnswerConfirmations.title')} enabled={correctAnswerConfirmationsEnabled} onChange={() => setCorrectAnswerConfirmationsEnabled(!correctAnswerConfirmationsEnabled) }>{ t('CourseList.setting.correctAnswerConfirmations.explanation') }</Setting>
            <Setting title={t('CourseList.settting.ipa.title')} enabled={ipaEnabled} onChange={enabled => setIpaEnabled(enabled)}>{t('CourseList.settting.ipa.explanation')}</Setting>
            
            <div className={styles.sourceLanguage}>
                { t('CourseList.sourceLanguage') }
                <select onChange={e => setSourceLanguage(e.currentTarget.value)} defaultValue={sourceLanguage}>{
                    sourceLanguages.map(lang => {
                        return <option value={lang} key={lang}>{languagesInUILanguage.of(lang)}</option>;
                    })
                }</select>
            </div>
        </div> }
        
        {
            pairs.map(langPair => {
            const courseMeta = courseIndex[langPair];
            return <div className={styles.courseTile} key={langPair}><CourseTile courseMeta={ courseMeta } onClick={() => onCourseSelected?.(langPair) } /></div>;
            })
        }
        <a href="licenses-disclaimer.txt" className={styles.disclaimer}>{ t('CourseList.softwareLicenseInfo') }</a>
    </div>;
}
