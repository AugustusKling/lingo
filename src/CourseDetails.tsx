import { Progress } from './Progress.js';
import { LessonTile } from './LessonTile.js';
import styles from './CourseDetails.module.scss';
import { Course, ExerciseStatus, ExerciseFilter, StatusForExercise, RankableExercise, Translation } from './util.js';
import { useTranslation } from "react-i18next";
import { useMemo, useState } from 'react';

interface CourseDetailsProps {
    course: Course;
    progress: RankableExercise[];
    onBackToCourseList?: () => void;
    getProgressForExercises: (lang: string, exercises: Translation[]) => RankableExercise[];
    statusForExercise: StatusForExercise;
    showDynamicLesson: (lang: string, exerciseFilter: ExerciseFilter) => void;
}

export function CourseDetails ({course, progress, onBackToCourseList, getProgressForExercises, statusForExercise, showDynamicLesson}: CourseDetailsProps) {
    const { t, i18n } = useTranslation();
    const languagesInUILanguage = new Intl.DisplayNames([i18n.resolvedLanguage], { type: 'language' });
    const translationsById = new Map<string, Translation>(course.sentences[course.to].map(translation => [translation.id, translation]));
    
    const contributors = useMemo(() => {
        const contributors = {};
        for (const lang of [course.from, course.to]) {
            for (const translation of course.sentences[lang]) {
                if (!translation.author) {
                    continue;
                }
                
                const sentenceCount = contributors[translation.author] ?? 0;
                contributors[translation.author] = sentenceCount + 1;
            }
        }
        return Object.entries(contributors).sort((a, b) => b[1] - a[1]);
    }, [course]);
    const [topContributorLimit, setTopContributorLimit] = useState(10);
    const topContributors = useMemo(
        () => contributors.slice(0, topContributorLimit),
        [ contributors, topContributorLimit ]
    );
    const contributorsRemaining = contributors.length - topContributorLimit;
    
    const renderLessonTiles = () => {
        const sortedLessons = [...course.lessons].sort((a, b) => (a.order || 0) - (b.order || 0));
        return sortedLessons.map((lesson, index) => {
            const title = lesson.title[course.to] ?? lesson.title[course.from] ?? lesson.title.eng;
            const translations = lesson.exercises.map(id => translationsById.get(id));
            return <LessonTile course={course} lesson={lesson} title={title} exerciseCount={lesson.exercises.length} progress={getProgressForExercises(course.to, translations)} onExercisesSelected={() => showDynamicLesson(course.to, statusForExercise => translations)} key={index} />;
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
        const dynamic: Record<string, (s: StatusForExercise) => Translation[]> = {
            [t('CourseDetails.dynamic.Training')]: statusForExercise => course.sentences[course.to].filter(sentence => ['wrong', 'somewhat'].includes(statusForExercise(course.to, sentence.id))),
            [t('CourseDetails.dynamic.Short')]: statusForExercise => byLength.slice(0, 100).map(wrapper => wrapper.sentence),
            [t('CourseDetails.dynamic.fewWords')]: statusForExercise => byWordCount.slice(0, 100).map(wrapper => wrapper.sentence),
            [t('CourseDetails.dynamic.New')]: statusForExercise => course.sentences[course.to].filter(sentence => 'unseen' === statusForExercise(course.to, sentence.id))
        };
        return Object.entries(dynamic).map(([dynamicTitle, exerciseFilter]) => {
            const translations = exerciseFilter(statusForExercise);
            return <LessonTile course={course} title={dynamicTitle} exerciseCount={translations.length} progress={getProgressForExercises(course.to, translations)} onExercisesSelected={() => showDynamicLesson(course.to, statusForExercise => exerciseFilter(statusForExercise) )} key={dynamicTitle} />;
        });
    };
    return <div className={styles.course}>
        <h1 className="title">{languagesInUILanguage.of(course.to)}</h1>
        <Progress progress={progress} />
        <button className={styles.buttonBack} onClick={ () => onBackToCourseList?.() }>{ t('CourseDetails.backCourseList') }</button>
        <button className={styles.buttonTrain} onClick={ () => showDynamicLesson(course.to, statusForExercise => course.sentences[course.to]) }>{ t('CourseDetails.train') }</button>
        
        <h2>{ t('CourseDetails.lessons') }</h2>
        <div className={styles.lessons}>{ renderLessonTiles() }</div>
        
        <h2>{ t('CourseDetails.dynamic') }</h2>
        <div className={styles.dynamicCategories}>{ renderDynamic() }</div>
        
        <h2>{ t('CourseDetails.contributors') }</h2>
        <p>{ t('CourseDetails.contributors.praise') }</p>
        <table className={styles.contributorTable}>
            <thead><tr><th>{ t('CourseDetails.contributors.columnAuthor') }</th><th>{ t('CourseDetails.contributors.columnSentenceCount') }</th></tr></thead>
            <tbody>{ topContributors.map(([author, sentenceCount]) => {
                return <tr key={author}><td><a href={`https://tatoeba.org/en/user/profile/${encodeURI(author)}`}>{ author }</a></td><td>{ t('CourseDetails.contributors.sentenceCount', { sentenceCount }) }</td></tr>;
            }) }</tbody>
        </table>
        { contributorsRemaining > 0 && <>
            <p>{ t('CourseDetails.contributors.andOthers', { others: contributorsRemaining }) }</p>
            <button onClick={ () => setTopContributorLimit(topContributorLimit + 10) }>{ t('CourseDetails.contributors.showMore') }</button>
        </> }
    </div>;
}
