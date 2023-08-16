import { getVoices, speak, Translation, Course } from './util.js';
import styles from './DefinitionOverlay.module.scss';

const licenseNames: Partial<Record<string, string>> = {
    'https://creativecommons.org/licenses/by-sa/3.0/': 'CC BY-SA 3.0',
    'https://creativecommons.org/licenses/by/2.0/fr/': 'Attribution 2.0 France (CC BY 2.0 FR)'
};

interface DefinitionOverlayProps {
    exercise: Translation;
    course: Course;
    onBackToExercise?: () => void;
}

export function DefinitionOverlay({exercise, course, onBackToExercise}: DefinitionOverlayProps) {
    const sentenceIdSourceLanguage = course.sentences[course.from].some(s => s === exercise);
    const translationIds = course.links.filter(link => link.includes(exercise.id)).flatMap(link => link).filter(id => id !== exercise.id);
    const translations = (sentenceIdSourceLanguage ? course.sentences[course.to] : course.sentences[course.from])
        .filter(translation => translationIds.includes(translation.id));
    
    const renderTranslations = () => {
        const lang = sentenceIdSourceLanguage ? course.to : course.from;
        const voices = getVoices(lang);
        const hasVoices = voices.length > 0;

        return [<h2 key={lang+'-header'}>Translations</h2>, ...translations.map(translation =>
            <div key={translation.id}>
                <div className={styles.translation}>
                    <h3>{translation.text}</h3>
                    { hasVoices && <button onClick={() => speak(translation.text, voices)}>Speak</button> }
                    { translation.source && <Source translation={translation} /> }
                    { translation.licence && <Licence translation={translation} /> }
                </div>
            </div>
        )];
    }

    return <div className={styles.definitionOverlay} style={{display:'flex'}}>
        <button className={styles.buttonBack} onClick={() => onBackToExercise?.()}>Back to exercise</button>
        <h1 className={styles.title}>{exercise.text}</h1>
        <Source translation={exercise} />
        <Licence translation={exercise} />
        
        <div className={styles.translations}>
            {renderTranslations()}
        </div>
    </div>;
}

interface SourceProps {
    translation: Translation & { source: string; };
}
function Source({translation}: SourceProps) {
    const sourceHtml = document.createElement('a');
    sourceHtml.href = translation.source;
    
    return <a href={translation.source} className={styles.weblink}>
        { translation.author && `${translation.author}, ` }
        {sourceHtml.hostname}
    </a>;
}

interface LicenceProps {
    translation: Translation & { licence: string; };
}
function Licence({translation}: LicenceProps) {
    return <a href={translation.licence} className={styles.weblink}>
        Licence: {licenseNames[translation.licence] || translation.licence}
    </a>;
}
