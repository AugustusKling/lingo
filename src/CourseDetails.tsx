import { Progress, ProgressInfo } from './Progress.js';
import { LessonTile } from './LessonTile.js';
import styles from './CourseDetails.module.scss';
import { Course, ExerciseStatus, ExerciseFilter, StatusForExercise } from './util.js';
import { useTranslation } from "react-i18next";

interface CourseDetailsProps {
    course: Course;
    progress: ProgressInfo;
    onBackToCourseList?: () => void;
    getProgressForExercises: (lang: string, exercises: string[]) => ProgressInfo;
    statusForExercise: StatusForExercise;
    showDynamicLesson: (lang: string, exerciseFilter: ExerciseFilter) => void;
}

export function CourseDetails ({course, progress, onBackToCourseList, getProgressForExercises, statusForExercise, showDynamicLesson}: CourseDetailsProps) {
    const { t, i18n } = useTranslation();
    const languagesInUILanguage = new Intl.DisplayNames([i18n.resolvedLanguage], { type: 'language' });
    
    const renderLessonTiles = () => {
        const sortedLessons = [...course.lessons].sort((a, b) => (a.order || 0) - (b.order || 0));
        return sortedLessons.map((lesson, index) => {
            const title = lesson.title[course.to] ?? lesson.title[course.from] ?? lesson.title.eng;
            return <LessonTile course={course} lesson={lesson} title={title} exerciseCount={lesson.exercises.length} progress={getProgressForExercises(course.to, lesson.exercises)} onExercisesSelected={() => showDynamicLesson(course.to, statusForExercise => lesson.exercises)} key={index} />;
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
            [t('CourseDetails.dynamic.Training')]: statusForExercise => course.sentences[course.to].filter(sentence => ['wrong', 'somewhat'].includes(statusForExercise(course.to, sentence.id))),
            [t('CourseDetails.dynamic.Short')]: statusForExercise => byLength.slice(0, 100).map(wrapper => wrapper.sentence),
            [t('CourseDetails.dynamic.fewWords')]: statusForExercise => byWordCount.slice(0, 100).map(wrapper => wrapper.sentence),
            [t('CourseDetails.dynamic.New')]: statusForExercise => course.sentences[course.to].filter(sentence => 'unseen' === statusForExercise(course.to, sentence.id))
        };
        return Object.entries(dynamic).map(([dynamicTitle, exerciseFilter]) => {
            const exerciseNames = exerciseFilter(statusForExercise).map(sentence => sentence.id);
            return <LessonTile course={course} title={dynamicTitle} exerciseCount={exerciseNames.length} progress={getProgressForExercises(course.to, exerciseNames)} onExercisesSelected={() => showDynamicLesson(course.to, statusForExercise => exerciseFilter(statusForExercise).map(sentence => sentence.id) )} key={dynamicTitle} />;
        });
    };
    return <div className={styles.course}>
        <h1 className="title">{languagesInUILanguage.of(course.to)}</h1>
        <Progress progress={progress} />
        <button className={styles.buttonBack} onClick={ () => onBackToCourseList?.() }>{ t('CourseDetails.backCourseList') }</button>
        <button className={styles.buttonTrain} onClick={ () => showDynamicLesson(course.to, statusForExercise => course.sentences[course.to].map(sentence => sentence.id)) }>{ t('CourseDetails.train') }</button>
        <h2>{ t('CourseDetails.lessons') }</h2>
        <div className={styles.lessons}>{ renderLessonTiles() }</div>
        <h2>{ t('CourseDetails.dynamic') }</h2>
        <div className={styles.dynamicCategories}>{ renderDynamic() }</div>
    </div>;
}
