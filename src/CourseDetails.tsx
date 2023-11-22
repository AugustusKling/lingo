import { Progress } from './Progress.js';
import { LessonTile } from './LessonTile.js';
import styles from './CourseDetails.module.scss';
import { Course, ExerciseStatus, ExerciseFilter, StatusForExercise, RankableExercise, Translation, segmentToWords } from './util.js';
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
    
    const commonWords = useMemo(() => {
        const learedWords = new Set();
        for (const rankable of progress) {
            if(rankable.rank > 5) {
                for (const segment of segmentToWords(rankable.translation.text, course.to)) {
                    if (segment.isWordLike) {
                        learedWords.add(segment.segment.toLowerCase());
                    }
                }
            }
        }
        
        const words = {};
        for (const translation of course.sentences[course.to]) {
            const sentenceSegments = segmentToWords(translation.text, course.to);
            for (const segment of sentenceSegments) {
                if (!segment.isWordLike) {
                    continue;
                }
                
                const word = segment.segment.toLowerCase();
                if (!learedWords.has(word)) {
                    const wordCount = words[word] ?? 0;
                    words[word] = wordCount + 1;
                }
            }
        }
        return Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 10).map(wordAndCount => wordAndCount[0]);
    }, [course, progress]);
    
    const renderLessonTiles = () => {
        const sortedLessons = [...course.lessons].sort((a, b) => (a.order || 0) - (b.order || 0));
        return sortedLessons.map((lesson, index) => {
            const title = lesson.title[course.to] ?? lesson.title[course.from] ?? lesson.title.eng;
            const translations = lesson.exercises.map(id => translationsById.get(id));
            return <LessonTile course={course} lesson={lesson} title={title} exerciseCount={lesson.exercises.length} progress={getProgressForExercises(course.to, translations)} onExercisesSelected={() => showDynamicLesson(course.to, statusForExercise => translations)} key={index} />;
        });
    };
    const renderDynamic = () => {
        const dynamic: { title: string; description: string; exerciseFilter: (s: StatusForExercise) => Translation[]}[] = [
            {
                title: t('CourseDetails.dynamic.lessons'),
                description: t('CourseDetails.dynamic.lessons.description'),
                exerciseFilter: statusForExercise => {
                    const lessonSentences = new Set(course.lessons.flatMap(lesson => lesson.exercises));
                    return course.sentences[course.to].filter(sentence => lessonSentences.has(sentence.id));
                },
            },
            {
                title: t('CourseDetails.dynamic.repeat'),
                description: t('CourseDetails.dynamic.repeat.description'),
                exerciseFilter: statusForExercise => course.sentences[course.to].filter(sentence => ['wrong', 'somewhat'].includes(statusForExercise(course.to, sentence.id)))
            },
            {
                title: t('CourseDetails.dynamic.moreCommonWords'),
                description: t('CourseDetails.dynamic.moreCommonWords.description'),
                exerciseFilter: statusForExercise => course.sentences[course.to].filter(sentence => {
                    const sentenceWords = segmentToWords(sentence.text, course.to).filter(segment => segment.isWordLike).map(segment => segment.segment.toLowerCase());
                    return commonWords.some(word => sentenceWords.includes(word));
                })
            },
            {
                title: t('CourseDetails.dynamic.new'),
                description: t('CourseDetails.dynamic.new.description'),
                exerciseFilter: statusForExercise => course.sentences[course.to].filter(sentence => 'unseen' === statusForExercise(course.to, sentence.id))
            }
        ];
        return dynamic.map(dynamicCategory => {
            const translations = dynamicCategory.exerciseFilter(statusForExercise);
            return <LessonTile course={course} title={dynamicCategory.title} description={dynamicCategory.description} exerciseCount={translations.length} progress={getProgressForExercises(course.to, translations)} onExercisesSelected={() => showDynamicLesson(course.to, statusForExercise => exerciseFilter(statusForExercise) )} key={dynamicCategory.title} />;
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
