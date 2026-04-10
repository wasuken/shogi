import React, { useEffect, useState } from 'react';
import ShogiBoard, { type EvaluationEntry } from './ShogiBoard';

interface ReplayModalProps {
  gameId: string;
  onClose: () => void;
}

const ReplayModal: React.FC<ReplayModalProps> = ({ gameId, onClose }) => {
  const [csa, setCsa] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [csaResponse, evalsResponse] = await Promise.all([
          fetch(`/api/battle-results/${gameId}/csa`),
          fetch(`/api/battle-results/${gameId}/evaluations`),
        ]);

        if (!csaResponse.ok) {
          throw new Error(`HTTP error! status: ${csaResponse.status}`);
        }
        if (!evalsResponse.ok) {
          // Evaluations might not exist for older games, so don't throw an error
          console.warn(`Could not fetch evaluations: ${evalsResponse.status}`);
        }

        const csaData = await csaResponse.text();
        setCsa(csaData);

        if (evalsResponse.ok) {
          const evalsData = await evalsResponse.json();
          setEvaluations(evalsData);
        }

      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("An unknown error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gameId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-4xl w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Replay Game: {gameId.substring(0, 8)}...</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">&times;</button>
        </div>
        {loading && <p>Loading replay...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}
        {csa && (
          <div id="shogi-player-container">
            <ShogiBoard
              csa={csa}
              evaluations={evaluations}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReplayModal;