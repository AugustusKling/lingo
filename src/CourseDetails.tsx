import { Progress, ProgressInfo } from './Progress.js';
import { LessonTile } from './LessonTile.js';
import styles from './CourseDetails.module.scss';
import { Course, Exercise, ExerciseStatus } from './util.js';

interface CourseDetailsProps {
    course: Course;
    progress: ProgressInfo;
    onBackToCourseList?: () => void;
    getProgressForExercises: (lang: string, exercises: string[]) => ProgressInfo;
    statusForExercise: (lang: string, conceptName: string) => ExerciseStatus;
    showDynamicLesson: (lang: string, exercises: Exercise[]) => void;
}

export function CourseDetails ({course, progress, onBackToCourseList, getProgressForExercises, statusForExercise, showDynamicLesson}: CourseDetailsProps) {
    const renderLessonTiles = () => {
        const sortedLessons = [...course.lessons].sort((a, b) => (a.order || 0) - (b.order || 0));
        return sortedLessons.map((lesson, index) => {
            const title = lesson.title[course.to] || lesson.title[course.from];
            const exercises = course.exercerciseList.filter(exercise => lesson.exercises.includes(exercise.conceptName));
            return <LessonTile course={course} lesson={lesson} title={title} exerciseCount={lesson.exercises.length} progress={getProgressForExercises(course.to, lesson.exercises)} onExercisesSelected={() => showDynamicLesson(course.to, exercises)} key={index} />;
        });
    };
    const renderCategories = () => {
        const categoriesInCourse = new Set<string>();
        course.exercerciseList.flatMap(exercise => exercise.categories).forEach(category => categoriesInCourse.add(category));
        if (categoriesInCourse.size === 0) {
            return <p>No exercises found.</p>;
        }
        const categoriesInCourseArray = Array.from(categoriesInCourse).sort();
        return categoriesInCourseArray.map((category, index) => {
            const exercisesInCategory = course.exercerciseList.filter(exercise => exercise.categories.includes(category));
            const exerciseNames = exercisesInCategory.map(exercise => exercise.conceptName);
            return <LessonTile course={course} title={category} exerciseCount={exercisesInCategory.length} progress={getProgressForExercises(course.to, exerciseNames)} onExercisesSelected={() => showDynamicLesson(course.to, exercisesInCategory)} key={index} />;
        });
    };
    const renderDynamic = () => {
        const byLength = course.exercerciseList.map(exercise => {
            const lengths = exercise.translations[course.to].map(t => t.text.length);
            return {
                exercise,
                length: lengths.reduce((a, b) => a + b) / lengths.length
            };
        }).sort((a, b) => a.length - b.length);
        const byWordCount = course.exercerciseList.map(exercise => {
            const lengths = exercise.translations[course.to].map(t => t.text.split(' ').length);
            return {
                exercise,
                length: lengths.reduce((a, b) => a + b) / lengths.length
            };
        }).sort((a, b) => a.length - b.length);
        const dynamic = {
            Training: course.exercerciseList.filter(exercise => ['wrong', 'somewhat'].includes(statusForExercise(course.to, exercise.conceptName))),
            Short: byLength.slice(0, 100).map(wrapper => wrapper.exercise),
            'Few Words': byWordCount.slice(0, 100).map(wrapper => wrapper.exercise),
            New: course.exercerciseList.filter(exercise => 'unseen' === statusForExercise(course.to, exercise.conceptName)),
            Uncategorized: course.exercerciseList.filter(exercise => exercise.categories.length === 0)
        };
        return Object.entries(dynamic).map(([dynamicTitle, exercises]) => {
            const exerciseNames = exercises.map(exercise => exercise.conceptName);
            return <LessonTile course={course} title={dynamicTitle} exerciseCount={exercises.length} progress={getProgressForExercises(course.to, exerciseNames)} onExercisesSelected={() => showDynamicLesson(course.to, exercises)} key={dynamicTitle} />;
        });
    };
    const languagesInEnglish = new Intl.DisplayNames(['en'], { type: 'language' });
    return <div className="course">
        <h1 className="title">{languagesInEnglish.of(course.to)}</h1>
        <Progress progress={progress} />
        <button className={styles.buttonBack} onClick={ () => onBackToCourseList?.() }>Back to course list</button>
        <h2>Lessons</h2>
        <div className={styles.lessons}>{ renderLessonTiles() }</div>
        <h2>Categories</h2>
        <div className={styles.categories}>{ renderCategories() }</div>
        <h2>Dynamic</h2>
        <div className={styles.dynamicCategories}>{ renderDynamic() }</div>
    </div>;
}
