import React, { useState, useEffect, useMemo } from 'react';

// Define types for Shogi pieces, squares, and moves
type PieceType = 'FU' | 'KY' | 'KE' | 'GI' | 'KI' | 'KA' | 'HI' | 'OU' |
                 'TO' | 'NY' | 'NK' | 'NG' | 'UM' | 'RY'; // Promoted pieces
type Player = '+' | '-'; // Sente (first player) or Gote (second player)

interface Piece {
  type: PieceType;
  player: Player;
}

interface Square {
  row: number; // 1-9
  col: number; // 1-9
}

interface Move {
  player: Player;
  from?: Square; // Optional, for drops
  to: Square;
  piece: PieceType;
  time?: number; // Time taken for the move in seconds
}

interface BoardState {
  board: (Piece | null)[][]; // 9x9 board
  senteHand: PieceType[];
  goteHand: PieceType[];
  turn: Player;
}

interface ParsedCsa {
  player1Name: string;
  player2Name: string;
  initialBoardState: BoardState;
  moves: Move[];
  boardStates: BoardState[]; // All board states throughout the game
}

// Helper to get piece from CSA string (e.g., "+FU")
const getPieceFromCsa = (csaPiece: string): Piece => {
  const player = csaPiece[0] as Player;
  const type = csaPiece.substring(1) as PieceType;
  return { player, type };
};

const getKanjiPiece = (pieceType: PieceType): string => {
  switch (pieceType) {
    case 'FU': return '歩';
    case 'KY': return '香';
    case 'KE': return '桂';
    case 'GI': return '銀';
    case 'KI': return '金';
    case 'KA': return '角';
    case 'HI': return '飛';
    case 'OU': return '王';
    case 'TO': return 'と'; // Promoted Pawn
    case 'NY': return '成香'; // Promoted Lance
    case 'NK': return '成桂'; // Promoted Knight
    case 'NG': return '成銀'; // Promoted Silver
    case 'UM': return '馬'; // Promoted Bishop
    case 'RY': return '龍'; // Promoted Rook
    default: return '';
  }
};

// Function to get the standard initial Shogi board setup
const getStandardInitialBoard = (): (Piece | null)[][] => {
  const board: (Piece | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));

  // Gote (Player -) pieces
  board[0][0] = getPieceFromCsa('-KY'); board[1][0] = getPieceFromCsa('-KE'); board[2][0] = getPieceFromCsa('-GI');
  board[3][0] = getPieceFromCsa('-KI'); board[4][0] = getPieceFromCsa('-OU'); board[5][0] = getPieceFromCsa('-KI');
  board[6][0] = getPieceFromCsa('-GI'); board[7][0] = getPieceFromCsa('-KE'); board[8][0] = getPieceFromCsa('-KY');
  board[1][1] = getPieceFromCsa('-HI');
  board[7][1] = getPieceFromCsa('-KA');
  for (let i = 0; i < 9; i++) {
    board[i][2] = getPieceFromCsa('-FU');
  }

  // Sente (Player +) pieces
  board[0][8] = getPieceFromCsa('+KY'); board[1][8] = getPieceFromCsa('+KE'); board[2][8] = getPieceFromCsa('+GI');
  board[3][8] = getPieceFromCsa('+KI'); board[4][8] = getPieceFromCsa('+OU'); board[5][8] = getPieceFromCsa('+KI');
  board[6][8] = getPieceFromCsa('+GI'); board[7][8] = getPieceFromCsa('+KE'); board[8][8] = getPieceFromCsa('+KY');
  board[1][7] = getPieceFromCsa('+KA');
  board[7][7] = getPieceFromCsa('+HI');
  for (let i = 0; i < 9; i++) {
    board[i][6] = getPieceFromCsa('+FU');
  }

  return board;
};

// Function to apply a move to a board state
const applyMove = (currentBoardState: BoardState, move: Move): BoardState => {
  const newBoard = currentBoardState.board.map(row => [...row]);
  const newSenteHand = [...currentBoardState.senteHand];
  const newGoteHand = [...currentBoardState.goteHand];

  const movingPiece: Piece = { player: move.player, type: move.piece };

  if (move.from) {
    // Regular move
    const fromCol = 9 - move.from.col; // Adjust to 0-indexed (9-1=8, 9-9=0)
    const fromRow = move.from.row - 1; // Adjust to 0-indexed
    const toCol = 9 - move.to.col;
    const toRow = move.to.row - 1;

    const pieceOnFromSquare = newBoard[fromCol][fromRow];
    if (!pieceOnFromSquare || pieceOnFromSquare.player !== move.player) {
      console.warn('Invalid move: No piece or wrong player piece at from square', move);
      // This should ideally not happen with valid CSA, but good for debugging
      return currentBoardState;
    }

    // Capture logic
    const capturedPiece = newBoard[toCol][toRow];
    if (capturedPiece) {
      // Demote captured piece and add to hand
      const demoteMap: Partial<Record<PieceType, PieceType>> = {
        'TO': 'FU',
        'NY': 'KY',
        'NK': 'KE',
        'NG': 'GI',
        'UM': 'KA',
        'RY': 'HI',
      };
      const demotedType = demoteMap[capturedPiece.type] ?? capturedPiece.type;
      if (move.player === '+') {
        newSenteHand.push(demotedType);
      } else {
        newGoteHand.push(demotedType);
      }
    }

    newBoard[toCol][toRow] = movingPiece;
    newBoard[fromCol][fromRow] = null;

  } else {
    // Drop move
    const toCol = 9 - move.to.col;
    const toRow = move.to.row - 1;

    if (newBoard[toCol][toRow] !== null) {
      console.warn('Invalid drop: Target square is not empty', move);
      return currentBoardState;
    }

    // Remove piece from hand
    if (move.player === '+') {
      const index = newSenteHand.indexOf(move.piece);
      if (index > -1) {
        newSenteHand.splice(index, 1);
      } else {
        console.warn('Invalid drop: Piece not in sente hand', move);
        return currentBoardState;
      }
    } else {
      const index = newGoteHand.indexOf(move.piece);
      if (index > -1) {
        newGoteHand.splice(index, 1);
      } else {
        console.warn('Invalid drop: Piece not in gote hand', move);
        return currentBoardState;
      }
    }
    newBoard[toCol][toRow] = movingPiece;
  }

  return {
    board: newBoard,
    senteHand: newSenteHand,
    goteHand: newGoteHand,
    turn: move.player === '+' ? '-' : '+', // Toggle turn
  };
};


// Function to parse CSA string
const parseCsa = (csaString: string): ParsedCsa => {
  const lines = csaString.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let player1Name = 'Player 1';
  let player2Name = 'Player 2';
  const moves: Move[] = [];
  let currentBoard: (Piece | null)[][] = getStandardInitialBoard();
  let senteHand: PieceType[] = [];
  let goteHand: PieceType[] = [];
  const turn: Player = '+';

  // Process initial position if specified by PI
  let inInitialPositionBlock = false;
  for (const line of lines) {
    if (line === 'PI') {
      inInitialPositionBlock = true;
      currentBoard = Array(9).fill(null).map(() => Array(9).fill(null)); // Clear board for PI setup
      senteHand = [];
      goteHand = [];
      continue;
    } else if (inInitialPositionBlock && (line.startsWith('+') || line.startsWith('-'))) {
      // Example: +P27FU
      const player = line[0] as Player;
      const col = parseInt(line[2]);
      const row = parseInt(line[3]);
      const type = line.substring(4) as PieceType;
      currentBoard[9 - col][row - 1] = { player, type }; // Corrected column indexing
      continue;
    } else if (inInitialPositionBlock && line.startsWith('P')) {
      // Example: P1-KY-KE-GI-KI-OU-KI-GI-KE-KY
      const row = parseInt(line[1]);
      const pieces = line.substring(2).split(''); // Split by character
      let col = 0;
      for (let i = 0; i < pieces.length; i += 3) {
        const pieceStr = pieces.slice(i, i + 3).join('');
        if (pieceStr === ' * ') {
          currentBoard[col][row - 1] = null;
        } else {
          currentBoard[col][row - 1] = getPieceFromCsa(pieceStr.trim());
        }
        col++;
      }
      continue;
    } else if (inInitialPositionBlock && (line.startsWith('N+') || line.startsWith('N-'))) {
      // End of PI block, or other metadata
      inInitialPositionBlock = false;
    }

    if (!inInitialPositionBlock) {
      if (line.startsWith('N+')) {
        player1Name = line.substring(2);
      } else if (line.startsWith('N-')) {
        player2Name = line.substring(2);
      } else if (line.startsWith('+') || line.startsWith('-')) {
        // This is a move line
        const player = line[0] as Player;
        const csaFromCol = parseInt(line[1]);
        const csaFromRow = parseInt(line[2]);
        const csaToCol = parseInt(line[3]);
        const csaToRow = parseInt(line[4]);
        const pieceType = line.substring(5, 7) as PieceType; // Assuming 2-char piece type

        const move: Move = {
          player,
          to: { row: csaToRow, col: csaToCol },
          piece: pieceType,
        };

        if (csaFromCol !== 0 || csaFromRow !== 0) { // 00 indicates a drop
          move.from = { row: csaFromRow, col: csaFromCol };
        }
        moves.push(move);
      } else if (line.startsWith('T')) {
        // Time expended, not currently used in applyMove
      }
    }
  }

  const initialBoardState: BoardState = {
    board: currentBoard,
    senteHand: senteHand,
    goteHand: goteHand,
    turn: turn,
  };

  const boardStates: BoardState[] = [initialBoardState];
  let currentCalculatedBoardState = initialBoardState;

  for (const move of moves) {
    currentCalculatedBoardState = applyMove(currentCalculatedBoardState, move);
    boardStates.push(currentCalculatedBoardState);
  }

  return { player1Name, player2Name, initialBoardState, moves, boardStates };
};


export interface EvaluationEntry {
  move_number: number;
  player: string;
  score: number;
  evaluated_by: string;
}

interface ShogiBoardProps {
  csa: string;
  evaluations: EvaluationEntry[] | null;
}

const ShogiBoard: React.FC<ShogiBoardProps> = ({ csa, evaluations }) => {
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);

  const parsedCsa = useMemo(() => {
    if (csa) {
      return parseCsa(csa);
    }
    return null;
  }, [csa]);

  // This effect will run when csa changes, resetting the move index
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setCurrentMoveIndex(0);
  }, [csa]);

  if (!parsedCsa) {
    return <p>Loading Shogi board...</p>;
  }

  const currentBoardState = parsedCsa.boardStates[currentMoveIndex];

  const handleNextMove = () => {
    if (currentMoveIndex < parsedCsa.boardStates.length - 1) {
      setCurrentMoveIndex(prev => prev + 1);
    }
  };

  const handlePreviousMove = () => {
    if (currentMoveIndex > 0) {
      setCurrentMoveIndex(prev => prev - 1);
    }
  };

  return (
    <div className="shogi-board-container">
      <h3>将棋盤</h3>
      <p>先手: {parsedCsa.player1Name}</p>
      <p>後手: {parsedCsa.player2Name}</p>

      <div className="hand-display gote-hand">
        {currentBoardState.goteHand.map((pieceType, index) => (
          <div key={`gote-hand-${index}`} className="hand-piece gote-piece">
            {getKanjiPiece(pieceType)}
          </div>
        ))}
      </div>

      <div className="board-display">
        {/* Render columns (files) from 9 to 1 (left to right) */}
        {Array.from({ length: 9 }, (_, colIndex) => colIndex).map(colIndex => ( // Iterate from 0 up to 8 for columns
          <div key={colIndex} className="board-col">
            {/* Render rows (ranks) from 1 to 9 */}
            {Array.from({ length: 9 }, (_, rowIdx) => rowIdx).map(rowIndex => { // Iterate from 0 up to 8 for rows
              const piece = currentBoardState.board[colIndex][rowIndex];
              return (
                <div key={`${colIndex}-${rowIndex}`} className="board-square">
                  {piece && (
                    <div className={piece.player === '-' ? 'gote-piece' : ''}>
                      {getKanjiPiece(piece.type)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="hand-display sente-hand">
        {currentBoardState.senteHand.map((pieceType, index) => (
          <div key={`sente-hand-${index}`} className="hand-piece">
            {getKanjiPiece(pieceType)}
          </div>
        ))}
      </div>

      <div className="controls">
        <button onClick={handlePreviousMove} disabled={currentMoveIndex === 0}>前へ</button>
        <span>手番 {currentMoveIndex} / {parsedCsa.boardStates.length - 1}</span>
        <button onClick={handleNextMove} disabled={currentMoveIndex === parsedCsa.boardStates.length - 1}>次へ</button>
      </div>

      {evaluations && evaluations[currentMoveIndex] !== undefined && (
        <p>評価値: {evaluations[currentMoveIndex]?.score}</p>
      )}

      <h4>先手持ち駒: {currentBoardState.senteHand.map(getKanjiPiece).join(', ')}</h4>
      <h4>後手持ち駒: {currentBoardState.goteHand.map(getKanjiPiece).join(', ')}</h4>

      <h4>棋譜:</h4>
      <ul>
        {parsedCsa.moves.map((move, index) => (
          <li key={index} style={{ fontWeight: index + 1 === currentMoveIndex ? 'bold' : 'normal' }}>
            {move.player === '+' ? '先手' : '後手'}: {getKanjiPiece(move.piece)} {move.from ? `${move.from.col}${move.from.row}` : '打'} to {move.to.col}{move.to.row}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ShogiBoard;
