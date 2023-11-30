import { useId } from 'react';
import styles from './Setting.module.scss';

interface SettingProps {
    title: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    children;
}

export function Setting({ enabled, title, children, onChange }: SettingProps) {
    const id = useId();
    return <div className={styles.grid}>
        <input type="checkbox" id={id} checked={enabled} onChange={ e => onChange(e.target.checked) }/><label htmlFor={id} className={styles.title}>{ title }</label>
        <p className={styles.explanation}>{ children} </p>
    </div>;
}
