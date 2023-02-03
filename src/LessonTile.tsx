import {Progress, ProgressInfo} from './Progress.js';
import styles from './LessonTile.module.scss';
import {Course, Lesson} from './util.js';

interface LessonTileProps {
    course: Course;
    lesson?: Lesson;
    title: string;
    exerciseCount: number;
    onExercisesSelected: () => void;
    progress: ProgressInfo
}

export function LessonTile({course, lesson, title, exerciseCount, onExercisesSelected, progress}: LessonTileProps) {
    const description = lesson?.description?.[course.to] || lesson?.description?.[course.from];
    return <div className={styles.lesson} onClick={ () => onExercisesSelected?.() }>
        <h1 className={styles.title}>{ title }</h1>
        <Progress progress={progress} />
        { description && <p>{description}</p>}
        <p>{exerciseCount} exercises</p>
    </div>;
}
