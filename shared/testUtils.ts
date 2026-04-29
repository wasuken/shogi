import { describe, it, expect } from 'vitest';
import { Shogi } from 'shogi.js';
import type { AIFunction } from './types';

export function describeAiContract(aiName: string, findBestMove: AIFunction) {
  describe(`AI Contract Test: ${aiName}`, () => {
    it('should return a move and a score from the initial position', () => {
      const shogi = new Shogi();
      const result = findBestMove(shogi);
      expect(result).toHaveProperty('move');
      expect(result).toHaveProperty('score');
    });

    it('should not return a null move from the initial position', () => {
      const shogi = new Shogi();
      const result = findBestMove(shogi);
      expect(result.move).not.toBeNull();
    });

    it('should return a legal move that can be applied', () => {
      const shogi = new Shogi();
      const { move } = findBestMove(shogi);
      expect(move).not.toBeNull();
      if (!move) return;

      const shogiClone = new Shogi();
      shogiClone.initializeFromSFENString(shogi.toSFENString());
      expect(() => {
        if (move.from) {
          shogiClone.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
        } else {
          shogiClone.drop(move.to.x, move.to.y, move.kind!);
        }
      }).not.toThrow();
    });

    it('should return a null move for a mated position', () => {
      const shogi = new Shogi();
      // 後手番で詰んでいる局面
      shogi.initializeFromSFENString('8k/7GG/7G1/9/9/9/9/9/8K w - 1');
      const result = findBestMove(shogi);
      expect(result.move).toBeNull();
    });

    it('should return a score of type number', () => {
      const shogi = new Shogi();
      const result = findBestMove(shogi);
      expect(typeof result.score).toBe('number');
    });
  });
}
