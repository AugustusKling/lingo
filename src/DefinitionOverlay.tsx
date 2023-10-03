import { useVoices, speak, Translation, Course, transcribeIPA } from './util.js';
import styles from './DefinitionOverlay.module.scss';
import stylesText from './text.module.scss';
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
    const sentenceIdSourceLanguage = course.sentences[course.from].some(s => s === exercise);
    
    const lang = sentenceIdSourceLanguage ? course.to : course.from;
    const voices = useVoices(lang);
    
    const translationIds = course.links.filter(link => link.includes(exercise.id)).flatMap(link => link).filter(id => id !== exercise.id);
    const translations = (sentenceIdSourceLanguage ? course.sentences[course.to] : course.sentences[course.from])
        .filter(translation => translationIds.includes(translation.id));
    
    const renderTranslations = () => {
        const hasVoices = voices.length > 0;

        return [<h2 key={lang+'-header'}>Translations</h2>, ...translations.map(translation => {
            const ipaTranscription = lang===course.to && transcribeIPA(course, translation.text, course.to);
            return <div key={translation.id}>
                <div className={styles.translation}>
                    <h3>{translation.text}</h3>
                    { ipaTranscription && <p className={stylesText.ipa}>{ ipaTranscription }</p> }
                    { translation.source && <Source translation={translation} /> }
                    { translation.licence && <Licence translation={translation} /> }
                    <div className={styles.buttonContainer}>
                        <button onClick={() => open(translation.source, '_blank')}>{ t('DefinitionOverlay.openTatoeba') }</button>
                        { hasVoices && <button onClick={() => speak(translation.text, voices)}>{ t('DefinitionOverlay.speak') }</button> }
                    </div>
                </div>
            </div>;
        })];
    }

    const langExercise = sentenceIdSourceLanguage ? course.from : course.to;
    const voicesExercise = useVoices(langExercise);
    const ipaTranscription = langExercise===course.to && transcribeIPA(course, exercise.text, course.to);
    return <div className={styles.definitionOverlay} style={{display:'flex'}}>
        <button className={styles.buttonBack} onClick={() => onBackToExercise?.()}>{ t('DefinitionOverlay.backToExercise') }</button>
        <h1 className={styles.title}>{exercise.text}</h1>
        { ipaTranscription && <p className={stylesText.ipa}>{ ipaTranscription }</p> }
        <Source translation={exercise} />
        <Licence translation={exercise} />
        <div className={styles.buttonContainer}>
            <button onClick={() => open(exercise.source, '_blank')}>{ t('DefinitionOverlay.openTatoeba') }</button>
            { voicesExercise.length > 0 && <button onClick={() => speak(exercise.text, voicesExercise)}>{ t('DefinitionOverlay.speak') }</button> }
        </div>
        
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
    const { t } = useTranslation();
    return <a href={translation.licence} className={styles.weblink}>{
        t('Licence.name', {licenseName: licenseNames[translation.licence] || translation.licence})
    }</a>;
}
