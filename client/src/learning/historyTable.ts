import type { AIMove } from '../types';

export function createHistoryTable(): number[][][][] {
    return Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () =>
            Array.from({ length: 10 }, () =>
                Array(10).fill(0)
            )
        )
    );
}

export function getHistoryScore(table: number[][][][], move: AIMove): number {
    const fx = move.from?.x ?? 0;
    const fy = move.from?.y ?? 0;
    return table[fx][fy][move.to.x][move.to.y];
}

export function addHistoryScore(
    table: number[][][][],
    move: AIMove,
    depth: number,
    maxScore: number
): void {
    const fx = move.from?.x ?? 0;
    const fy = move.from?.y ?? 0;
    const current = table[fx][fy][move.to.x][move.to.y];
    table[fx][fy][move.to.x][move.to.y] = Math.min(current + depth * depth, maxScore);
}

export function orderByHistory(moves: AIMove[], table: number[][][][]): AIMove[] {
    return [...moves].sort((a, b) => getHistoryScore(table, b) - getHistoryScore(table, a));
}
