import styles from './CourseTile.module.scss';
import { Progress } from './Progress.js';
import { CourseMeta } from './util.js';
import { MouseEventHandler } from 'react';

interface CourseTileProps {
    courseMeta: CourseMeta;
    onClick: MouseEventHandler;
}

export function CourseTile({ courseMeta, onClick }: CourseTileProps) {
    const languagesInEnglish = new Intl.DisplayNames(['en'], { type: 'language' });
    return <div className={ styles.course } onClick={onClick}>
        <h1 className="title">{ languagesInEnglish.of(courseMeta.to) }</h1>
        <div className="hint">{courseMeta.lessons} lessons, {courseMeta.exercises} exercises</div>
    </div>;
}
