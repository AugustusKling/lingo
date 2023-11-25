import {Progress} from './Progress.js';
import styles from './LessonTile.module.scss';
import {Course, Lesson, RankableExercise, getTranslationUILanguage} from './util.js';
import { useTranslation } from "react-i18next";

interface LessonTileProps {
    course: Course;
    lesson?: Lesson;
    title: string;
    description?: string;
    exerciseCount: number;
    onExercisesSelected: () => void;
    progress: RankableExercise[];
}

export function LessonTile({course, lesson, title, description, exerciseCount, onExercisesSelected, progress}: LessonTileProps) {
    const { t } = useTranslation();
    const resultingDescription = description ?? (lesson?.description && getTranslationUILanguage(lesson.description));
    return <div className={styles.lesson} onClick={ () => onExercisesSelected?.() }>
        <h1 className={styles.title}>{ title }</h1>
        <Progress progress={progress} />
        { resultingDescription && <p>{resultingDescription}</p>}
        <p>{ t('LessonTile.exerciseCount', {exerciseCount}) }</p>
    </div>;
}
