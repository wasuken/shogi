declare module 'shogi.js' {
  export class Shogi {
    constructor(setup?: any);
    move(from: number | string | object, to?: number, promote?: boolean): boolean;
    isGameOver(): boolean;
    toSFEN(): string;
    turn: 'b' | 'w';
  }
}
