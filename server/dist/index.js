import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Shogi } from 'shogi.js';
import mysql from 'mysql2/promise';
// import { upgradeWebSocket } from 'hono/ws'
const app = new Hono();
// --- Database Connection ---
const pool = mysql.createPool({
    host: 'db',
    user: 'user',
    password: 'password',
    database: 'shogi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
const games = new Map();
// --- Shogi Logic ---
const getGame = (gameId) => {
    const game = games.get(gameId);
    if (!game) {
        throw new Error('Game not found');
    }
    return game;
};
// --- Endpoints ---
// 1. Start a new game
app.post('/games', (c) => {
    const gameId = crypto.randomUUID();
    const shogi = new Shogi();
    games.set(gameId, { shogi, moves: [] });
    console.log(`Game started: ${gameId}`);
    return c.json({ gameId });
});
// 2. Make a move
const moveSchema = z.object({
    move: z.string(), // Expected format: e.g., '7g7f'
});
app.post('/games/:id/move', zValidator('json', moveSchema), async (c) => {
    const { id } = c.req.param();
    const { move } = c.req.valid('json');
    try {
        const gameState = getGame(id);
        const { shogi, moves } = gameState;
        shogi.move(move);
        moves.push(move);
        if (shogi.isGameOver()) {
            const winner = shogi.turn === 'b' ? 'w' : 'b'; // The player whose turn it is lost
            const gameRecord = {
                moves: moves,
                winner: winner,
                finalSfen: shogi.toSFEN(),
            };
            const [result] = await pool.execute('INSERT INTO games (id, winner, moves, ai_type, game_record) VALUES (?, ?, ?, ?, ?)', [id, winner, moves.length, 'unknown', JSON.stringify(gameRecord)]);
            console.log(`Game over: ${id}. Winner: ${winner}. Saved to DB.`);
            games.delete(id); // Clean up from memory
            return c.json({ status: 'game_over', winner, gameId: id });
        }
        return c.json({ status: 'ok', board: shogi.toSFEN() });
    }
    catch (error) {
        if (error.message === 'Game not found') {
            return c.json({ error: 'Game not found' }, 404);
        }
        // shogi.js might throw an error for illegal moves
        return c.json({ error: error.message }, 400);
    }
});
// 3. Get game stats (or final record)
app.get('/games/:id/stats', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query('SELECT * FROM games WHERE id = ?', [id]);
        if (rows.length === 0) {
            return c.json({ error: 'Game not found in database' }, 404);
        }
        return c.json(rows[0]);
    }
    catch (error) {
        return c.json({ error: 'Failed to fetch game stats' }, 500);
    }
});
// --- WebSocket (for potential real-time updates) ---
/*
app.get('/ws/:gameId', upgradeWebSocket((c: Context) => {
    const gameId = c.req.param('gameId');
    console.log(`WebSocket connection opened for game: ${gameId}`);
    
    return {
        onMessage: (evt: MessageEvent, ws: WebSocket) => {
            console.log(`[ws:${gameId}] Message: ${evt.data}`);
            // Here you could broadcast moves to other clients, etc.
            ws.send(`Message received: ${evt.data}`);
        },
        onClose: () => {
            console.log(`WebSocket connection closed for game: ${gameId}`);
        },
    };
}));
*/
// --- Server ---
app.get('/', (c) => c.text('Shogi Server is running!'));
serve({
    fetch: app.fetch,
    port: 3000
}, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
});
