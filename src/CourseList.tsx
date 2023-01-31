import { CourseTile } from './CourseTile.js';
import useLocalStorageState from 'use-local-storage-state';
import { getProgressForCourse } from './util.js';
import styles from './CourseList.module.scss';

export function CourseList({ courseIndex, knowledge, onCourseSelected }) {
    const sourceLanguages = Array.from(new Set(
        Object.keys(courseIndex).map(langPair => langPair.replace(/ to.*$/, ''))
    )).sort();
    const [sourceLanguage, setSourceLanguage] = useLocalStorageState('sourceLanguage', {
        defaultValue: sourceLanguages[0]
    });
    const pairs = Object.keys(courseIndex).filter(langPair => langPair.startsWith(sourceLanguage)).sort();
    const languagesInEnglish = new Intl.DisplayNames(['en'], { type: 'language' });
    return <div>
        <div className={styles.sourceLanguage}>
            Your language:
            <select onChange={e => setSourceLanguage(e.currentTarget.value)} defaultValue={sourceLanguage}>{
                sourceLanguages.map(lang => {
                    return <option value={lang} key={lang}>{languagesInEnglish.of(lang)}</option>;
                })
            }</select>
        </div>
        {
            pairs.map(langPair => {
            const courseMeta = courseIndex[langPair];
            const progress = getProgressForCourse(knowledge, langPair, courseMeta);
            return <div className={styles.courseTile} key={langPair}><CourseTile langPair={langPair} courseMeta={ courseMeta } progress={progress} onClick={() => onCourseSelected?.(langPair) } /></div>;
            })
        }
    </div>;
}
