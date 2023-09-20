import {Progress} from './Progress.js';
import styles from './LessonTile.module.scss';
import {Course, Lesson, RankableExercise} from './util.js';
import { useTranslation } from "react-i18next";

interface LessonTileProps {
    course: Course;
    lesson?: Lesson;
    title: string;
    exerciseCount: number;
    onExercisesSelected: () => void;
    progress: RankableExercise[];
}

export function LessonTile({course, lesson, title, exerciseCount, onExercisesSelected, progress}: LessonTileProps) {
    const { t } = useTranslation();
    const description = lesson?.description?.[course.to] || lesson?.description?.[course.from];
    return <div className={styles.lesson} onClick={ () => onExercisesSelected?.() }>
        <h1 className={styles.title}>{ title }</h1>
        <Progress progress={progress} />
        { description && <p>{description}</p>}
        <p>{ t('LessonTile.exerciseCount', {exerciseCount}) }</p>
    </div>;
}
