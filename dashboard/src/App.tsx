import WinLossStats from './components/WinLossStats';
import BattleResultsTable from './components/BattleResultsTable';
import './App.css'; // Keep existing CSS if any

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">将棋バトルダッシュボード</h1>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <WinLossStats />
        <BattleResultsTable />
      </main>
    </div>
  );
}

export default App;
