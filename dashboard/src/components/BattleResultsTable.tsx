import React, { useEffect, useState } from 'react';
import ReplayModal from './ReplayModal'; // Import the modal component

interface BattleResult {
  id: string;
  client1_name: string;
  client2_name: string;
  winner_name: string | null;
  total_moves: number;
  game_duration_ms: number;
  start_time: string;
  end_time: string | null;
}

const BattleResultsTable: React.FC = () => {
  const [results, setResults] = useState<BattleResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const handleReplayClick = (gameId: string) => {
    setSelectedGameId(gameId);
  };

  const handleCloseModal = () => {
    setSelectedGameId(null);
  };

  useEffect(() => {
    const fetchBattleResults = async () => {
      try {
        const response = await fetch('/api/battle-results');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: BattleResult[] = await response.json();
        setResults(data);
      } catch (e: any) {
        setError(e.message);
        console.error("Failed to fetch battle results:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchBattleResults();
  }, []);

  if (loading) {
    return <div className="text-center p-4">対戦結果を読み込み中...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">エラー: {error}</div>;
  }

  return (
    <>
      <div className="bg-white shadow-md rounded-lg p-4 mt-6">
        <h2 className="text-2xl font-semibold mb-4">最近の対戦</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  クライアント1
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  クライアント2
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  勝者
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  手数
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  対局時間 (ms)
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  開始時刻
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  終了時刻
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result) => (
                <tr key={result.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.id.substring(0, 8)}...</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.client1_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.client2_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{result.winner_name || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.total_moves}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.game_duration_ms}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(result.start_time).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.end_time ? new Date(result.end_time).toLocaleString() : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleReplayClick(result.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      リプレイ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedGameId && <ReplayModal gameId={selectedGameId} onClose={handleCloseModal} />}
    </>
  );
};

export default BattleResultsTable;
