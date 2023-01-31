import styles from './CourseTile.module.scss';
import { Progress } from './Progress.js';

export function CourseTile({ langPair, courseMeta, progress, onClick }) {
    const languagesInEnglish = new Intl.DisplayNames(['en'], { type: 'language' });
    return <div className={ styles.course } onClick={onClick}>
        <h1 className="title">{ languagesInEnglish.of(langPair.replace(/^.+ to /, '')) }</h1>
        <Progress progress={progress} />
        <div className="hint">{courseMeta.lessons} lessons, {courseMeta.exercises} exercises</div>
    </div>;
}
