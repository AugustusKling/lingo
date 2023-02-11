import { CourseTile } from './CourseTile.js';
import useLocalStorageState from 'use-local-storage-state';
import styles from './CourseList.module.scss';
import { CourseMeta, Knowledge } from './util.js';

interface CourseListProps {
    courseIndex: Record<string, CourseMeta>;
    knowledge: Knowledge;
    onCourseSelected?: (langPair: string) => void;
}

export function CourseList({ courseIndex, knowledge, onCourseSelected }: CourseListProps) {
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
            return <div className={styles.courseTile} key={langPair}><CourseTile courseMeta={ courseMeta } onClick={() => onCourseSelected?.(langPair) } /></div>;
            })
        }
        <a href="licenses-disclaimer.txt" className={styles.disclaimer}>Software components and license info</a>
    </div>;
}
