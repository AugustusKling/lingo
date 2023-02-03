import { speak, Exercise, Translation } from './util.js';
import styles from './DefinitionOverlay.module.scss';

const licenseNames: Partial<Record<string, string>> = {
    'https://creativecommons.org/licenses/by-sa/3.0/': 'CC BY-SA 3.0',
    'https://creativecommons.org/licenses/by/2.0/fr/': 'Attribution 2.0 France (CC BY 2.0 FR)'
};

interface DefinitionOverlayProps {
    exercise: Exercise;
    title: string;
    from: string;
    to: string;
    onBackToExercise?: () => void;
}

export function DefinitionOverlay({exercise, title, from, to, onBackToExercise}: DefinitionOverlayProps) {
    const renderTranslations = (lang: string) => {
        const voices = speechSynthesis.getVoices().filter(voice => voice.lang.startsWith(lang));
        const hasVoices = voices.length > 0;

        return [<h2 key={lang+'-header'}>Translations: {lang}</h2>, ...exercise.translations[lang].map((translation, index) =>
            <div key={lang + '-' + index}>
                <div className={styles.translation}>
                    <h3>{translation.text}</h3>
                    { hasVoices && <button onClick={() => speak(translation.text, voices)}>Speak</button> }
                    { translation.source && <Source translation={translation} /> }
                    { translation.licence && <Licence translation={translation} /> }
                </div>
            </div>
        )];
    }

    const hint = exercise.descriptions?.[from];
    return <div className={styles.definitionOverlay} style={{display:'flex'}}>
        <button className={styles.buttonBack} onClick={() => onBackToExercise?.()}>Back to exercise</button>
        <h1 className={styles.title}>{title}</h1>
        { hint && <p className={styles.hint}>{hint}</p> }
        <div className={styles.translations}>
            {renderTranslations(from)}
            {renderTranslations(to)}
        </div>
    </div>;
}

interface SourceProps {
    translation: Translation & { source: string; };
}
function Source({translation}: SourceProps) {
    const sourceHtml = document.createElement('a');
    sourceHtml.href = translation.source;
    
    return <a href={translation.source}>
        { translation.author && `${translation.author}, ` }
        {sourceHtml.hostname}
    </a>;
}

interface LicenceProps {
    translation: Translation & { licence: string; };
}
function Licence({translation}: LicenceProps) {
    return <a href={translation.licence}>
        Licence: {licenseNames[translation.licence] || translation.licence}
    </a>;
}
