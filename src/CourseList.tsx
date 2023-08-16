import { CourseTile } from './CourseTile.js';
import useLocalStorageState from 'use-local-storage-state';
import styles from './CourseList.module.scss';
import { CourseMeta, Knowledge } from './util.js';
import { AudioExercisesEnabledContext } from './contexts.js';
import { useContext } from 'react';

interface CourseListProps {
    courseIndex: Record<string, CourseMeta>;
    knowledge: Knowledge;
    onCourseSelected?: (langPair: string) => void;
    setAudioExercisesEnabled: (audioExercisesEnabled: boolean) => void;
}

export function CourseList({ courseIndex, knowledge, onCourseSelected, setAudioExercisesEnabled }: CourseListProps) {
    const sourceLanguages = Array.from(new Set(
        Object.keys(courseIndex).map(langPair => langPair.replace(/ to.*$/, ''))
    )).sort();
    const [sourceLanguage, setSourceLanguage] = useLocalStorageState('sourceLanguage', {
        defaultValue: sourceLanguages[0]
    });
    const pairs = Object.keys(courseIndex).filter(langPair => langPair.startsWith(sourceLanguage)).sort();
    const languagesInEnglish = new Intl.DisplayNames(['en'], { type: 'language' });
    
    const audioExercisesEnabled = useContext(AudioExercisesEnabledContext);
    
    return <div>
        <div className={styles.sourceLanguage}>
            Your language:
            <select onChange={e => setSourceLanguage(e.currentTarget.value)} defaultValue={sourceLanguage}>{
                sourceLanguages.map(lang => {
                    return <option value={lang} key={lang}>{languagesInEnglish.of(lang)}</option>;
                })
            }</select>
        </div>
        <div className={styles.audioControls} onClick={() => setAudioExercisesEnabled(!audioExercisesEnabled) }>{ audioExercisesEnabled ? '🔊 Audio exercises are on' : '🔇 Audio exercises are off' }</div>
        {
            pairs.map(langPair => {
            const courseMeta = courseIndex[langPair];
            return <div className={styles.courseTile} key={langPair}><CourseTile courseMeta={ courseMeta } onClick={() => onCourseSelected?.(langPair) } /></div>;
            })
        }
        <a href="licenses-disclaimer.txt" className={styles.disclaimer}>Software components and license info</a>
    </div>;
}
