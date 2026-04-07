"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const shogi_js_1 = require("shogi.js");
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const node_fetch_1 = __importDefault(require("node-fetch"));
const path = require('path');
const SERVER_URL = 'http://localhost:3000';
// --- Dynamic AI Loader ---
async function loadAI(aiName) {
    const validClients = ['alphazero', 'mcts', 'minimax'];
    if (!validClients.includes(aiName)) {
        throw new Error(`Invalid AI client name: ${aiName}. Valid options are: ${validClients.join(', ')}`);
    }
    // Navigate from battle-runner/src/index.js to client/...
    const modulePath = path.join(process.cwd(), '..', 'client', aiName, 'src', 'index.ts');
    try {
        const aiModule = await Promise.resolve(`${modulePath}`).then(s => __importStar(require(s)));
        if (typeof aiModule.findBestMove !== 'function') {
            throw new Error(`'findBestMove' not found or not a function in ${aiName}`);
        }
        return aiModule.findBestMove;
    }
    catch (error) {
        console.error(`Failed to load AI module from path: ${modulePath}`);
        throw error;
    }
}
// --- API Client ---
async function startGame() {
    const response = await (0, node_fetch_1.default)(`${SERVER_URL}/games`, { method: 'POST' });
    if (!response.ok) {
        throw new Error(`Failed to start game: ${response.statusText}`);
    }
    const data = await response.json();
    return data.gameId;
}
async function makeMove(gameId, move) {
    const response = await (0, node_fetch_1.default)(`${SERVER_URL}/games/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to make move: ${errorData.error || response.statusText}`);
    }
    return response.json();
}
// --- Game Logic ---
function toCSA(move) {
    if (move.isDrop) {
        return `00${move.to.x}${move.to.y}${move.piece}`;
    }
    const promote = move.promote ? '+' : '';
    return `${move.from.x}${move.from.y}${move.to.x}${move.to.y}${promote}`;
}
async function runGame(gameId, player1, player2) {
    const shogi = new shogi_js_1.Shogi();
    const players = { 'b': player1, 'w': player2 };
    console.log(`New game started: ${gameId}. ${player1.name} (black) vs ${player2.name} (white)`);
    while (!shogi.game_over) {
        const currentPlayer = shogi.turn === shogi_js_1.Color.BLACK ? players['b'] : players['w'];
        const move = currentPlayer.findBestMove(shogi);
        if (!move) {
            const winner = shogi.turn === shogi_js_1.Color.BLACK ? player2.name : player1.name;
            console.log(`No legal moves for ${currentPlayer.name}. Winner: ${winner}`);
            return winner;
        }
        try {
            // Apply move locally to check for errors and update state
            if (move.from) {
                shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
            }
            else {
                shogi.drop(move.to.x, move.to.y, move.piece);
            }
        }
        catch (e) {
            const winner = shogi.turn === shogi_js_1.Color.BLACK ? player2.name : player1.name;
            console.error(`Illegal move attempted by ${currentPlayer.name}. Move: ${JSON.stringify(move)}. Winner: ${winner}`);
            return winner;
        }
        const moveStr = toCSA(move);
        const result = await makeMove(gameId, moveStr);
        if (result.status === 'game_over') {
            const winnerName = result.winner === 'b' ? player1.name : player2.name;
            console.log(`Game over. Winner: ${winnerName}`);
            return winnerName;
        }
    }
    // This part should ideally not be reached if the server correctly reports game over
    const finalWinner = shogi.turn === shogi_js_1.Color.BLACK ? player2.name : player1.name;
    console.log(`Game ended by local check. Winner: ${finalWinner}`);
    return finalWinner;
}
// --- Main Execution ---
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .option('client1', { type: 'string', demandOption: true, description: 'Name of the first AI client' })
        .option('client2', { type: 'string', demandOption: true, description: 'Name of the second AI client' })
        .option('rounds', { type: 'number', default: 1, description: 'Number of games to play' })
        .argv;
    console.log(`Starting battle: ${argv.client1} vs ${argv.client2} for ${argv.rounds} rounds.`);
    const ai1FindBestMove = await loadAI(argv.client1);
    const ai2FindBestMove = await loadAI(argv.client2);
    const scoreboard = { [argv.client1]: 0, [argv.client2]: 0, draws: 0 };
    for (let i = 0; i < argv.rounds; i++) {
        // Alternate who goes first
        const player1 = { name: argv.client1, findBestMove: ai1FindBestMove };
        const player2 = { name: argv.client2, findBestMove: ai2FindBestMove };
        const isRoundEven = i % 2 === 0;
        const blackPlayer = isRoundEven ? player1 : player2;
        const whitePlayer = isRoundEven ? player2 : player1;
        try {
            const gameId = await startGame();
            const winnerName = await runGame(gameId, blackPlayer, whitePlayer);
            if (scoreboard[winnerName]) {
                scoreboard[winnerName]++;
            }
            else {
                scoreboard.draws++;
            }
            console.log(`Round ${i + 1} finished. Current Score: ${argv.client1}: ${scoreboard[argv.client1]}, ${argv.client2}: ${scoreboard[argv.client2]}`);
        }
        catch (error) {
            console.error(`\n--- ERROR IN ROUND ${i + 1} ---`);
            console.error(error);
            console.error("Skipping round.\n");
        }
    }
    console.log("\n--- FINAL SCORE ---");
    console.log(`${argv.client1}: ${scoreboard[argv.client1]}`);
    console.log(`${argv.client2}: ${scoreboard[argv.client2]}`);
    console.log(`Draws: ${scoreboard.draws}`);
}
main().catch(error => {
    console.error("A critical error occurred in the battle runner:", error);
    process.exit(1);
});
