import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testClient } from 'hono/testing';
import { Shogi, Color } from 'shogi.js';
import { app, parseCsaMoveToIMove, getAllLegalMoves, games } from './index';

vi.mock('mysql2/promise', () => {
  const mConnection = {
    execute: vi.fn().mockResolvedValue([[], []]),
    query: vi.fn().mockResolvedValue([[], []]),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const mPool = {
    getConnection: vi.fn().mockResolvedValue(mConnection),
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([[], []]),
  };
  return {
    default: {
      createPool: vi.fn(() => mPool),
    },
  };
});

describe('Shogi Game Server', () => {
  beforeEach(() => {
    games.clear();
  });

  describe('parseCsaMoveToIMove', () => {
    it('通常の指し手をパースできる', () => {
      expect(parseCsaMoveToIMove('+7776FU')).toEqual({
        from: { x: 7, y: 7 },
        to: { x: 7, y: 6 },
        promote: false,
      });
    });

    it('打ち手をパースできる', () => {
      const result = parseCsaMoveToIMove('+0077FU');
      expect(result.to).toEqual({ x: 7, y: 7 });
      expect(result.kind).toBe('FU');
      expect(result).not.toHaveProperty('from');
    });

    it('成りをパースできる (TO → FU promote)', () => {
      expect(parseCsaMoveToIMove('+2728TO')).toEqual({
        from: { x: 2, y: 7 },
        to: { x: 2, y: 8 },
        promote: true,
      });
    });

    it('成りをパースできる (UM → KA promote)', () => {
      expect(parseCsaMoveToIMove('+3342UM')).toEqual({
        from: { x: 3, y: 3 },
        to: { x: 4, y: 2 },
        promote: true,
      });
    });

    it('成りをパースできる (RY → HI promote)', () => {
      expect(parseCsaMoveToIMove('+2828RY')).toEqual({
        from: { x: 2, y: 8 },
        to: { x: 2, y: 8 },
        promote: true,
      });
    });

    it('不正な駒種でエラーをthrowする', () => {
      expect(() => parseCsaMoveToIMove('+1122XX')).toThrow(
        'Unknown piece kind in CSA move: XX'
      );
    });
  });

  describe('getAllLegalMoves', () => {
    it('初期局面で合法手が1手以上ある', () => {
      const shogi = new Shogi();
      expect(getAllLegalMoves(shogi).length).toBeGreaterThan(0);
    });

    it('詰み局面で合法手が0になる', () => {
      // 後手玉: x=1,y=1 (CSA9一)
      // 先手金: x=1,y=2 (CSA9二) と x=2,y=2 (CSA8二) で完全に詰み
      // SFEN: 8k/7GG/9/9/9/9/9/9/8K w - 1
      const shogi = new Shogi();
      shogi.initializeFromSFENString('8k/7GG/9/9/9/9/9/9/8K w - 1');
      expect(getAllLegalMoves(shogi).length).toBe(0);
    });
  });

  describe('API Endpoints', () => {
    const client = testClient(app);

    it('POST /games → gameIdが返る', async () => {
      const res = await client.games.$post({
        json: { client1Name: 'ai-1', client2Name: 'ai-2' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.gameId).toBe('string');
      expect(games.has(data.gameId)).toBe(true);
    });

    it('POST /games/:id/move → 合法手でokが返る', async () => {
      const gameId = 'test-legal';
      games.set(gameId, {
        shogi: new Shogi(),
        moves: [],
        evaluations: [],
        client1Name: 'p1',
        client2Name: 'p2',
        startTime: new Date(),
      });

      const res = await client.games[':id'].move.$post({
        param: { id: gameId },
        json: { move: '+7776FU' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(typeof data.board).toBe('string');
    });

    it('POST /games/:id/move → 不正な手で400が返る', async () => {
      const gameId = 'test-illegal';
      games.set(gameId, {
        shogi: new Shogi(),
        moves: [],
        evaluations: [],
        client1Name: 'p1',
        client2Name: 'p2',
        startTime: new Date(),
      });

      const res = await client.games[':id'].move.$post({
        param: { id: gameId },
        json: { move: '-3334FU' },
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
    });

    it('POST /games/:id/move → 存在しないgameIdで404が返る', async () => {
      const res = await client.games[':id'].move.$post({
        param: { id: 'non-existent' },
        json: { move: '+7776FU' },
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Game not found');
    });

    it('POST /games/:id/move → 詰みでgame_overが返りgamesから削除される', async () => {
      const gameId = 'test-checkmate';
      const shogi = new Shogi();

      // 後手玉: x=1,y=1 (CSA9一)
      // 先手金: x=1,y=2 (CSA9二)
      // 先手持ち駒: 金1枚
      // 先手が x=2,y=2 (CSA8二) に金打ち (+0083KI) → 詰み
      // SFEN: 8k/7GG/9/9/9/9/9/9/8K b G 1
      shogi.initializeFromSFENString('8k/7GG/9/9/9/9/9/9/8K b G 1');

      games.set(gameId, {
        shogi,
        moves: [],
        evaluations: [],
        client1Name: 'p1',
        client2Name: 'p2',
        startTime: new Date(),
      });

      const res = await client.games[':id'].move.$post({
        param: { id: gameId },
        json: { move: '+0083KI' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('game_over');
      expect(data.winner).toBe('b');
      expect(games.has(gameId)).toBe(false);
    });

    it('POST /games/:id/move → scoreを渡すとevaluationsに記録される', async () => {
      const gameId = 'test-score';
      games.set(gameId, {
        shogi: new Shogi(),
        moves: [],
        evaluations: [],
        client1Name: 'p1',
        client2Name: 'p2',
        startTime: new Date(),
      });

      await client.games[':id'].move.$post({
        param: { id: gameId },
        json: { move: '+7776FU', score: 150 },
      });

      expect(games.get(gameId)?.evaluations[0]).toBe(150);
    });
  });
});
