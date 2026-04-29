import type { AIMove } from '../types';

export function recordVisit(map: Map<string, number>, sfen: string): void {
    map.set(sfen, (map.get(sfen) ?? 0) + 1);
}

export function removeVisit(map: Map<string, number>, sfen: string): void {
    const count = (map.get(sfen) ?? 0) - 1;
    if (count <= 0) {
        map.delete(sfen);
    } else {
        map.set(sfen, count);
    }
}

export function calcPenalty(
    map: Map<string, number>,
    sfen: string,
    isBlackTurn: boolean,
    weight: number
): number {
    const count = map.get(sfen) ?? 0;
    if (count === 0) return 0;
    const penalty = count * weight;
    return isBlackTurn ? -penalty : penalty;
}
