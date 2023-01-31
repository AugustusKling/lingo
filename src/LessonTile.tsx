import {Progress, ProgressInfo} from './Progress.js';
import styles from './LessonTile.module.scss';
import {Course, Exercise} from './util.js';

interface Props {
    course: Course;
    title: string;
    exercises: Exercise[];
    onExercisesSelected: () => void;
    progress: ProgressInfo
}

export function LessonTile({course, title, exercises, onExercisesSelected, progress}: Props) {
    return <div className={styles.lesson} onClick={ () => onExercisesSelected?.() }>
        <h1 className={styles.title}>{ title }</h1>
        <Progress progress={progress} />
        <div className="hint">{exercises.length} exercises</div>
    </div>;
}
