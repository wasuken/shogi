import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toCSA, runGame } from './index';
import { Color, Kind } from 'shogi.js';
import type { AIMove } from '../../shared/types';
import fetch from 'node-fetch';

const { Response } = await vi.importActual('node-fetch');

// Mock node-fetch
vi.mock('node-fetch');

describe('battle-runner', () => {
  describe('toCSA', () => {
    it('should convert a standard black move to CSA', () => {
      const move: AIMove = { from: { x: 7, y: 7 }, to: { x: 7, y: 6 } };
      const csa = toCSA(Color.Black, move, 'FU');
      expect(csa).toBe('+7776FU');
    });

    it('should convert a standard white move to CSA', () => {
      const move: AIMove = { from: { x: 3, y: 3 }, to: { x: 3, y: 4 } };
      const csa = toCSA(Color.White, move, 'FU');
      expect(csa).toBe('-3334FU');
    });

    it('should convert a black drop move to CSA', () => {
      const move: AIMove = { to: { x: 5, y: 5 }, kind: 'KI' };
      const csa = toCSA(Color.Black, move, 'KI');
      expect(csa).toBe('+0055KI');
    });

    it('should convert a black promotion move to CSA', () => {
      const move: AIMove = { from: { x: 2, y: 7 }, to: { x: 2, y: 8 }, promote: true };
      const csa = toCSA(Color.Black, move, 'FU');
      expect(csa).toBe('+2728TO');
    });
  });

  describe('runGame', () => {
    let moveCounter: number;

    beforeEach(() => {
      moveCounter = 0;
      (fetch as any).mockClear();
      (fetch as any).mockImplementation(async (url: string, options: any) => {
        if (url.endsWith('/move')) {
          moveCounter++;
          if (moveCounter > 100) {
            return new Response(JSON.stringify({ status: 'game_over', winner: 'b' }));
          }
          return new Response(JSON.stringify({ status: 'ok' }));
        }
        return new Response(JSON.stringify({ error: 'Unhandled fetch mock' }), { status: 500 });
      });
    });

    it('should run a full game between minimax and alphazero', async () => {
      // Dynamically load the actual AI functions
      const minimaxModule = await import('../../client/minimax/src/index');
      const alphazeroModule = await import('../../client/alphazero/src/index');

      const player1 = { name: 'minimax', findBestMove: minimaxModule.findBestMove };
      const player2 = { name: 'alphazero', findBestMove: alphazeroModule.findBestMove };

      const winnerName = await runGame('test-game-1', player1, player2);

      // The game should end because of the 100 move limit in the mock
      expect(winnerName).toBe('minimax'); // winner is 'b', and player1 (minimax) is black
      expect(moveCounter).toBeGreaterThan(100);
    }, 60000); // Increase timeout for this integration test
  });
});
