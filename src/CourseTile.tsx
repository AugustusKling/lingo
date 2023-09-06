import styles from './CourseTile.module.scss';
import { Progress } from './Progress.js';
import { CourseMeta } from './util.js';
import { MouseEventHandler } from 'react';
import { useTranslation } from "react-i18next";

interface CourseTileProps {
    courseMeta: CourseMeta;
    onClick: MouseEventHandler;
}

export function CourseTile({ courseMeta, onClick }: CourseTileProps) {
    const { t, i18n } = useTranslation();
    const languagesInUILanguage = new Intl.DisplayNames([i18n.resolvedLanguage], { type: 'language' });
    return <div className={ styles.course } onClick={onClick}>
        <h1 className="title">{ languagesInUILanguage.of(courseMeta.to) }</h1>
        <div className="hint">{ t('CourseTile.numLessonsExercises', {numLessons: courseMeta.lessons, numExercises: courseMeta.exercises}) }</div>
    </div>;
}
