import type { AIMove } from '../types';

export function createKillerTable(
    maxDepth: number
): ([AIMove, AIMove] | [null, null])[] {
    return Array.from({ length: maxDepth + 1 }, () => [null, null] as [null, null]);
}

export function updateKiller(
    table: ([AIMove, AIMove] | [null, null])[],
    depth: number,
    move: AIMove
): void {
    if (move.from === undefined) return;
    if (depth >= table.length) return;

    const entry = table[depth] as [AIMove | null, AIMove | null];
    const [k1] = entry;

    if (
        k1 &&
        k1.from &&
        k1.from.x === move.from.x &&
        k1.from.y === move.from.y &&
        k1.to.x === move.to.x &&
        k1.to.y === move.to.y
    ) {
        return;
    }

    (table[depth] as unknown as (AIMove | null)[]) = [move, k1];
}

export function isKillerMove(
    table: ([AIMove, AIMove] | [null, null])[],
    depth: number,
    move: AIMove
): boolean {
    if (move.from === undefined) return false;
    if (depth >= table.length) return false;

    const entry = table[depth] as [AIMove | null, AIMove | null];
    const check = (k: AIMove | null): boolean => {
        if (!k || !k.from) return false;
        return (
            k.from.x === move.from!.x &&
            k.from.y === move.from!.y &&
            k.to.x === move.to.x &&
            k.to.y === move.to.y
        );
    };
    return check(entry[0]) || check(entry[1]);
}
