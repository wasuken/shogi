import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { Shogi, Color } from 'shogi.js';
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
// --- Helper function to get all legal moves (from client/minimax) ---
function getAllLegalMoves(shogi) {
    const moves = [];
    // Board moves
    for (let x = 1; x <= 9; x++) {
        for (let y = 1; y <= 9; y++) {
            const piece = shogi.get(x, y);
            if (piece && piece.color === shogi.turn) {
                // Note: This gets pseudo-legal moves. It doesn't check for checks.
                moves.push(...shogi.getMovesFrom(x, y));
            }
        }
    }
    // Drop moves
    // Note: This gets pseudo-legal moves. It doesn't check for nifu (two pawns in a file).
    moves.push(...shogi.getDropsBy(shogi.turn));
    return moves;
}
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
const startGameSchema = z.object({
    client1Name: z.string(),
    client2Name: z.string(),
});
app.post('/games', zValidator('json', startGameSchema), (c) => {
    const { client1Name, client2Name } = c.req.valid('json');
    const gameId = crypto.randomUUID();
    const shogi = new Shogi();
    const startTime = new Date();
    games.set(gameId, { shogi, moves: [], evaluations: [], client1Name, client2Name, startTime });
    console.log(`Game started: ${gameId} (${client1Name} vs ${client2Name})`);
    return c.json({ gameId });
});
// 2. Make a move
const moveSchema = z.object({
    move: z.string(), // Expected format: e.g., '7g7f' or 'P*5e'
    score: z.number().optional(),
});
app.post('/games/:id/move', zValidator('json', moveSchema), async (c) => {
    const { id } = c.req.param();
    const { move, score } = c.req.valid('json');
    try {
        const gameState = getGame(id);
        const { shogi, moves, evaluations } = gameState;
        const player = shogi.turn; // Player before the move
        // Parse and execute move
        if (move.includes('*')) { // Drop move e.g. P*5e
            const [piece, pos] = move.split('*');
            const toX = parseInt(pos[0], 10);
            const toY = pos[1].charCodeAt(0) - 'a'.charCodeAt(0) + 1;
            const pieceMap = {
                'P': 'FU', 'L': 'KY', 'N': 'KE', 'S': 'GI', 'G': 'KI', 'B': 'KA', 'R': 'HI'
            };
            const kind = pieceMap[piece.toUpperCase()];
            if (!kind)
                throw new Error(`Invalid piece to drop: ${piece}`);
            shogi.drop(toX, toY, kind);
        }
        else { // Board move e.g. 7g7f or 2h7h+
            const fromX = parseInt(move[0], 10);
            const fromY = move[1].charCodeAt(0) - 'a'.charCodeAt(0) + 1;
            const toX = parseInt(move[2], 10);
            const toY = move[3].charCodeAt(0) - 'a'.charCodeAt(0) + 1;
            const promote = move.length === 5 && move[4] === '+';
            shogi.move(fromX, fromY, toX, toY, promote);
        }
        moves.push(move);
        evaluations.push(score ?? null);
        // Check for game over by seeing if the opponent has any legal moves
        const legalMoves = getAllLegalMoves(shogi);
        if (legalMoves.length === 0) {
            const winner = player === Color.Black ? 'b' : 'w';
            const winnerName = winner === 'b' ? gameState.client1Name : gameState.client2Name;
            // Update endTime in GameState
            gameState.endTime = new Date();
            const gameDurationMs = gameState.endTime.getTime() - gameState.startTime.getTime();
            const gameRecordCsa = moves.join('\n');
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                // Insert into 'games' table (no game_record)
                await connection.execute('INSERT INTO games (id, winner, moves, ai_type) VALUES (?, ?, ?, ?)', [id, winner, moves.length, 'unknown']);
                // Insert into 'battle_results' table
                await connection.execute('INSERT INTO battle_results (id, client1_name, client2_name, winner_name, total_moves, game_duration_ms, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, gameState.client1Name, gameState.client2Name, winnerName, moves.length, gameDurationMs, gameState.startTime, gameState.endTime]);
                // Insert into 'game_records' table
                await connection.execute('INSERT INTO game_records (id, battle_result_id, record_text) VALUES (?, ?, ?)', [crypto.randomUUID(), id, gameRecordCsa]);
                // Insert into 'move_evaluations' table
                for (let i = 0; i < evaluations.length; i++) {
                    const currentScore = evaluations[i];
                    if (currentScore !== null) {
                        const moveNumber = i + 1;
                        const turnPlayer = i % 2 === 0 ? 'sente' : 'gote'; // 0-indexed: 0 is sente, 1 is gote
                        const evaluatedBy = turnPlayer === 'sente' ? gameState.client1Name : gameState.client2Name;
                        await connection.execute('INSERT INTO move_evaluations (id, battle_result_id, move_number, player, score, evaluated_by) VALUES (?, ?, ?, ?, ?, ?)', [crypto.randomUUID(), id, moveNumber, turnPlayer, currentScore, evaluatedBy]);
                    }
                }
                await connection.commit();
            }
            catch (dbError) {
                await connection.rollback();
                console.error('Database transaction failed:', dbError);
                throw dbError; // Re-throw to be caught by the outer catch block
            }
            finally {
                connection.release();
            }
            console.log(`Game over: ${id}. Winner: ${winnerName}. Saved to DB.`);
            games.delete(id); // Clean up from memory
            return c.json({ status: 'game_over', winner, gameId: id });
        }
        return c.json({ status: 'ok', board: shogi.toSFENString() });
    }
    catch (error) {
        if (error.message === 'Game not found') {
            return c.json({ error: 'Game not found' }, 404);
        }
        // shogi.js might throw an error for illegal moves
        console.error(`Error on move "${move}" for game ${id}: `, error);
        return c.json({ error: error.message }, 400);
    }
});
// 3. Get game stats (or final record)
app.get('/games/:id/stats', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query('SELECT id, winner, moves, ai_type, created_at FROM games WHERE id = ?', [id]);
        if (rows.length === 0) {
            return c.json({ error: 'Game not found in database' }, 404);
        }
        return c.json(rows[0]);
    }
    catch (error) {
        return c.json({ error: 'Failed to fetch game stats' }, 500);
    }
});
// 4. Get all battle results
app.get('/api/battle-results', async (c) => {
    try {
        const [rows] = await pool.query('SELECT * FROM battle_results ORDER BY start_time DESC');
        return c.json(rows);
    }
    catch (error) {
        console.error("Failed to fetch battle results:", error);
        return c.json({ error: 'Failed to fetch battle results' }, 500);
    }
});
// 5. Get all battle results in a pretty text format
app.get('/api/battle-results-pretty', async (c) => {
    try {
        const [rows] = await pool.query('SELECT * FROM battle_results ORDER BY start_time DESC');
        const results = rows;
        if (results.length === 0) {
            return c.text("No battle results found.");
        }
        let output = "Shogi Battle Results:\n\n";
        results.forEach((result, index) => {
            output += `--- Game ${index + 1} ---\n`;
            output += `ID: ${result.id}\n`;
            output += `Client 1: ${result.client1_name}\n`;
            output += `Client 2: ${result.client2_name}\n`;
            output += `Winner: ${result.winner_name || 'Draw'}\n`;
            output += `Total Moves: ${result.total_moves}\n`;
            output += `Duration: ${result.game_duration_ms} ms\n`;
            output += `Start Time: ${new Date(result.start_time).toLocaleString()}\n`;
            output += `End Time: ${result.end_time ? new Date(result.end_time).toLocaleString() : 'N/A'}\n`;
            // This field is no longer available in battle_results
            // output += `CSA Record (first 100 chars): ${result.game_record_csa ? result.game_record_csa.substring(0, 100) + '...' : 'N/A'}\n`;
            output += "\n";
        });
        return c.text(output);
    }
    catch (error) {
        console.error("Failed to fetch pretty battle results:", error);
        return c.text('Failed to fetch pretty battle results', 500);
    }
});
// 7. Get CSA game record for a specific battle result
app.get('/api/battle-results/:id/csa', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query('SELECT record_text FROM game_records WHERE battle_result_id = ?', [id]);
        if (rows.length === 0) {
            return c.json({ error: 'Game record not found' }, 404);
        }
        const record = rows[0].record_text;
        return c.text(record);
    }
    catch (error) {
        console.error(`Failed to fetch CSA record for game ${id}:`, error);
        return c.json({ error: 'Failed to fetch CSA game record' }, 500);
    }
});
// 8. Get win/loss statistics
app.get('/api/stats/win-loss', async (c) => {
    try {
        const query = `\n            SELECT\n                client_name,\n                COUNT(*) AS total_games_played,\n                SUM(CASE WHEN winner_name = client_name THEN 1 ELSE 0 END) AS wins,\n                SUM(CASE WHEN winner_name != client_name AND winner_name IS NOT NULL THEN 1 ELSE 0 END) AS losses,\n                SUM(CASE WHEN winner_name IS NULL THEN 1 ELSE 0 END) AS draws,\n                AVG(CASE WHEN winner_name != client_name THEN total_moves ELSE NULL END) AS avg_moves_to_loss\n            FROM (\n                SELECT client1_name AS client_name, winner_name, total_moves FROM battle_results\n                UNION ALL\n                SELECT client2_name AS client_name, winner_name, total_moves FROM battle_results\n            ) AS combined_results\n            GROUP BY client_name\n            ORDER BY wins DESC;\n        `;
        const [rows] = await pool.query(query);
        const stats = rows.map(row => ({
            clientName: row.client_name,
            totalGamesPlayed: parseInt(row.total_games_played),
            wins: parseInt(row.wins),
            losses: parseInt(row.losses),
            draws: parseInt(row.draws),
            winRate: row.total_games_played > 0 ? (row.wins / row.total_games_played) * 100 : 0,
            avgMovesToLoss: parseFloat(row.avg_moves_to_loss)
        }));
        return c.json(stats);
    }
    catch (error) {
        console.error("Failed to fetch win/loss statistics:", error);
        return c.json({ error: 'Failed to fetch win/loss statistics' }, 500);
    }
});
app.get('/api/battle-results/:id/evaluations', async (c) => {
    const { id } = c.req.param();
    try {
        const [rows] = await pool.query('SELECT move_number, player, score, evaluated_by FROM move_evaluations WHERE battle_result_id = ? ORDER BY move_number ASC', [id]);
        if (rows.length === 0) {
            // Return empty array if no evaluations found, as it's a valid state
            return c.json([]);
        }
        return c.json(rows);
    }
    catch (error) {
        console.error(`Failed to fetch evaluations for game ${id}:`, error);
        return c.json({ error: 'Failed to fetch evaluations' }, 500);
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
// --- Graceful Shutdown ---
process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await pool.end();
    console.log('Database pool closed.');
    process.exit(0);
});
