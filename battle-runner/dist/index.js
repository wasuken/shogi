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
async function startGame(client1Name, client2Name) {
    const response = await (0, node_fetch_1.default)(`${SERVER_URL}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client1Name, client2Name }),
    });
    if (!response.ok) {
        throw new Error(`Failed to start game: ${response.statusText}`);
    }
    const data = await response.json();
    return data.gameId;
}
async function makeMove(gameId, move, score) {
    const response = await (0, node_fetch_1.default)(`${SERVER_URL}/games/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move, score }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to make move: ${errorData.error || response.statusText}`);
    }
    return response.json();
}
// --- Game Logic ---
function toCSA(move) {
    const yToChar = (y) => String.fromCharCode('a'.charCodeAt(0) + y - 1);
    const kindToCharMap = {
        'FU': 'P', 'KY': 'L', 'KE': 'N', 'GI': 'S', 'KI': 'G', 'KA': 'B', 'HI': 'R'
    };
    if (move.from === undefined) { // It's a drop move
        if (!move.kind) {
            throw new Error("Drop move is missing 'kind' property.");
        }
        const pieceChar = kindToCharMap[move.kind];
        if (!pieceChar) {
            throw new Error(`Unknown piece kind for drop: ${move.kind}`);
        }
        // Drop moves are like 'P*5e'
        return `${pieceChar}*${move.to.x}${yToChar(move.to.y)}`;
    }
    const promote = move.promote ? '+' : '';
    // Board moves are like '7g7f' or '2h7h+'
    return `${move.from.x}${yToChar(move.from.y)}${move.to.x}${yToChar(move.to.y)}${promote}`;
}
async function runGame(gameId, player1, player2) {
    const shogi = new shogi_js_1.Shogi();
    const players = { 'b': player1, 'w': player2 };
    console.log(`New game started: ${gameId}. ${player1.name} (black) vs ${player2.name} (white)`);
    let currentTurn = shogi_js_1.Color.Black;
    let winnerName = null;
    while (winnerName === null) {
        const currentPlayer = currentTurn === shogi_js_1.Color.Black ? players['b'] : players['w'];
        const { move, score } = currentPlayer.findBestMove(shogi);
        if (!move) {
            winnerName = currentTurn === shogi_js_1.Color.Black ? player2.name : player1.name;
            console.log(`AI (${currentPlayer.name}) returned no move. Winner: ${winnerName}`);
            break;
        }
        try {
            if (move.from) {
                shogi.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
            }
            else {
                if (!move.kind) {
                    throw new Error("Drop move is missing 'kind' property from AI.");
                }
                shogi.drop(move.to.x, move.to.y, move.kind);
            }
        }
        catch (e) {
            winnerName = currentTurn === shogi_js_1.Color.Black ? player2.name : player1.name;
            console.error(`Illegal move attempted by ${currentPlayer.name}. Move: ${JSON.stringify(move)}. Error: ${e.message}. Winner: ${winnerName}`);
            break;
        }
        const moveStr = toCSA(move);
        const result = await makeMove(gameId, moveStr, score);
        if (result.status === 'game_over') {
            winnerName = result.winner === 'b' ? player1.name : player2.name;
            console.log(`Game over. Winner: ${winnerName}`);
            break;
        }
        currentTurn = currentTurn === shogi_js_1.Color.Black ? shogi_js_1.Color.White : shogi_js_1.Color.Black;
    }
    return winnerName || "draw";
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
            const gameId = await startGame(blackPlayer.name, whitePlayer.name);
            const winnerName = await runGame(gameId, blackPlayer, whitePlayer);
            if (winnerName === "draw") {
                scoreboard.draws++;
            }
            else {
                scoreboard[winnerName]++;
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
