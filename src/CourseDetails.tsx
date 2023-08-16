import { Progress, ProgressInfo } from './Progress.js';
import { LessonTile } from './LessonTile.js';
import styles from './CourseDetails.module.scss';
import { Course, ExerciseStatus } from './util.js';

interface CourseDetailsProps {
    course: Course;
    progress: ProgressInfo;
    onBackToCourseList?: () => void;
    getProgressForExercises: (lang: string, exercises: string[]) => ProgressInfo;
    statusForExercise: (lang: string, conceptName: string) => ExerciseStatus;
    showDynamicLesson: (lang: string, exercises: string[]) => void;
}

export function CourseDetails ({course, progress, onBackToCourseList, getProgressForExercises, statusForExercise, showDynamicLesson}: CourseDetailsProps) {
    const renderLessonTiles = () => {
        const sortedLessons = [...course.lessons].sort((a, b) => (a.order || 0) - (b.order || 0));
        return sortedLessons.map((lesson, index) => {
            const title = lesson.title[course.to] || lesson.title[course.from];
            return <LessonTile course={course} lesson={lesson} title={title} exerciseCount={lesson.exercises.length} progress={getProgressForExercises(course.to, lesson.exercises)} onExercisesSelected={() => showDynamicLesson(course.to, lesson.exercises)} key={index} />;
        });
    };
    const renderDynamic = () => {
        const byLength = course.sentences[course.to].map(sentence => {
            return {
                sentence,
                length: sentence.text.length
            };
        }).sort((a, b) => a.length - b.length);
        const byWordCount = course.sentences[course.to].map(sentence => {
            return {
                sentence,
                length: sentence.text.split(' ').length
            };
        }).sort((a, b) => a.length - b.length);
        const dynamic = {
            Training: course.sentences[course.to].filter(sentence => ['wrong', 'somewhat'].includes(statusForExercise(course.to, sentence.id))),
            Short: byLength.slice(0, 100).map(wrapper => wrapper.sentence),
            'Few Words': byWordCount.slice(0, 100).map(wrapper => wrapper.sentence),
            New: course.sentences[course.to].filter(sentence => 'unseen' === statusForExercise(course.to, sentence.id))
        };
        return Object.entries(dynamic).map(([dynamicTitle, sentences]) => {
            const exerciseNames = sentences.map(sentence => sentence.id);
            return <LessonTile course={course} title={dynamicTitle} exerciseCount={sentences.length} progress={getProgressForExercises(course.to, exerciseNames)} onExercisesSelected={() => showDynamicLesson(course.to, exerciseNames)} key={dynamicTitle} />;
        });
    };
    const languagesInEnglish = new Intl.DisplayNames(['en'], { type: 'language' });
    return <div className={styles.course}>
        <h1 className="title">{languagesInEnglish.of(course.to)}</h1>
        <Progress progress={progress} />
        <button className={styles.buttonBack} onClick={ () => onBackToCourseList?.() }>Back to course list</button>
        <button className={styles.buttonTrain} onClick={ () => showDynamicLesson(course.to, course.sentences[course.to].map(sentence => sentence.id)) }>Train</button>
        <h2>Lessons</h2>
        <div className={styles.lessons}>{ renderLessonTiles() }</div>
        <h2>Dynamic</h2>
        <div className={styles.dynamicCategories}>{ renderDynamic() }</div>
    </div>;
}
