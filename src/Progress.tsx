import styles from './Progress.module.scss';

export interface ProgressInfo {
    wrong: number;
    somewhat: number;
    learned: number;
    unseen: number;
}

interface Props {
    progress: ProgressInfo;
}

export function Progress({ progress }: Props) {
    return <div className={ styles.progress }>
        <div className={ styles.wrong } style={ {flex: progress.wrong} }></div>
        <div className={ styles.somewhat } style={ {flex: progress.somewhat} }></div>
        <div className={ styles.learned } style={ {flex: progress.learned} }></div>
        <div className={ styles.unseen } style={ {flex: progress.unseen} }></div>
    </div>;
}
