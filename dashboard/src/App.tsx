import WinLossStats from './components/WinLossStats';
import './App.css'; // Keep existing CSS if any

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold">Shogi Battle Dashboard</h1>
        </div>
      </header>
      <main className="container mx-auto p-4">
        <WinLossStats />
      </main>
    </div>
  );
}

export default App;
