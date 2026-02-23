import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 백엔드(8000포트)에서 카드 데이터를 가져오는 함수
  const dealCards = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/deal');
      setGameData(response.data);
    } catch (error) {
      console.error("데이터를 가져오는데 실패했습니다:", error);
      alert("백엔드 서버가 실행 중인지 확인하세요!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="poker-app">
      <h1>Texas Hold'em Dealer</h1>

      <button className="deal-button" onClick={dealCards} disabled={loading}>
        {loading ? "Dealing..." : "Deal New Hand"}
      </button>

      {gameData && (
        <div className="game-board">
          <div className="section">
            <h2>Community Cards</h2>
            <div className="card-row">
              {gameData.community_cards.map((card, i) => (
                <div key={i} className={`card ${['♥', '♦'].includes(card.suit) ? 'red' : 'black'}`}>
                  <span className="rank">{card.rank}</span>
                  <span className="suit">{card.suit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <h2>Player Hand</h2>
            <div className="card-row">
              {gameData.player_hand.map((card, i) => (
                <div key={i} className={`card ${['♥', '♦'].includes(card.suit) ? 'red' : 'black'}`}>
                  <span className="rank">{card.rank}</span>
                  <span className="suit">{card.suit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="result-area">
            <h3>Result: <span className="highlight">{gameData.best_hand}</span></h3>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;