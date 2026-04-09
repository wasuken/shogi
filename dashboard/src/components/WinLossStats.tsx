import React, { useEffect, useState } from 'react';

interface WinLossStat {
  clientName: string;
  totalGamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgMovesToLoss?: number;
}

const WinLossStats: React.FC = () => {
  const [stats, setStats] = useState<WinLossStat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use relative path for API call, assuming dashboard and server are on the same host/port or proxied
        // During development, you might need to proxy or use full URL like 'http://localhost:3000/api/stats/win-loss'
        // For production, a relative path or environment variable is better.
        const response = await fetch('/api/stats/win-loss');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: WinLossStat[] = await response.json();
        setStats(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="p-4">統計情報を読み込み中...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">エラー: {error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">勝敗統計</h2>
      {stats.length === 0 ? (
        <p>統計情報を表示するための対戦結果がありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b text-left">クライアント名</th>
                <th className="py-2 px-4 border-b text-left">合計対局数</th>
                <th className="py-2 px-4 border-b text-left">勝利数</th>
                <th className="py-2 px-4 border-b text-left">敗北数</th>
                <th className="py-2 px-4 border-b text-left">引き分け数</th>
                <th className="py-2 px-4 border-b text-left">勝率 (%)</th>
                <th className="py-2 px-4 border-b text-left">敗北までの平均手数</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.clientName} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{stat.clientName}</td>
                  <td className="py-2 px-4 border-b">{stat.totalGamesPlayed}</td>
                  <td className="py-2 px-4 border-b">{stat.wins}</td>
                  <td className="py-2 px-4 border-b">{stat.losses}</td>
                  <td className="py-2 px-4 border-b">{stat.draws}</td>
                  <td className="py-2 px-4 border-b">{stat.winRate.toFixed(2)}%</td>
                  <td className="py-2 px-4 border-b">
                    {stat.avgMovesToLoss !== null && stat.avgMovesToLoss !== undefined
                      ? stat.avgMovesToLoss
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WinLossStats;