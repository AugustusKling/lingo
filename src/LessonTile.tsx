import {Progress, ProgressInfo} from './Progress.js';
import styles from './LessonTile.module.scss';
import {Course, Exercise, Lesson} from './util.js';

interface Props {
    course: Course;
    lesson?: Lesson;
    title: string;
    exercises: Exercise[];
    onExercisesSelected: () => void;
    progress: ProgressInfo
}

export function LessonTile({course, lesson, title, exercises, onExercisesSelected, progress}: Props) {
    const description = lesson?.description?.[course.to] || lesson?.description?.[course.from];
    return <div className={styles.lesson} onClick={ () => onExercisesSelected?.() }>
        <h1 className={styles.title}>{ title }</h1>
        <Progress progress={progress} />
        { description && <p>{description}</p>}
        <p>{exercises.length} exercises</p>
    </div>;
}
