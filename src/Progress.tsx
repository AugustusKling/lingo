import styles from './Progress.module.scss';
import { RankableExercise } from './util.js';

function blend(start: number, end: number, ratio: number): number {
    const gamma = 2.2;
    return Math.pow((1 - ratio) * Math.pow(start, gamma) + ratio * Math.pow(end, gamma), 1/gamma);
}

function makeColorBank(): string[] {
    const start = [220, 0, 0];
    const end = [34, 200, 0];
    const steps = 11;
    const stepSize = 1 / steps;
    const colors: string[] = [];
    for(let step = 0; step<steps; step++) {
        const ratio = step * stepSize;
        colors.push(`rgb(${blend(start[0], end[0], ratio)}, ${blend(start[1], end[1], ratio)}, ${blend(start[2], end[2], ratio)})`);
    }
    return colors;
}
const colorBank = makeColorBank();

interface Props {
    progress: RankableExercise[];
    mark?: RankableExercise;
}

export function Progress({ progress, mark }: Props) {
    const buckets = colorBank.map(() => 0);
    for(const exercise of progress) {
        const bucketIndex = Math.max(0, exercise.rank);
        buckets[bucketIndex] = buckets[bucketIndex] + 1;
    }
    const maxAmount = buckets.reduce((a, b) => Math.max(a, b));
    
    return <div>
        <div className={ styles.progress }>{
            buckets.map((amount, bucketIndex) => {
                const opacity = maxAmount === 0 ? 0 : Math.log(1+amount)/Math.log(1+maxAmount);
                return <div key={bucketIndex} style={ {flex: 1, backgroundColor: colorBank[bucketIndex], opacity } }></div>;
            })
        }</div>
        { mark && <div className={ styles.marks }>{
            buckets.map((amount, bucketIndex) => {
                const markThis = Math.max(0, mark.rank) === bucketIndex;
                return <div key={bucketIndex} style={ {flex: 1 } }>{
                    markThis && <div className={styles.mark}></div>
                }</div>;
            })
        }</div>}
    </div>;
}
