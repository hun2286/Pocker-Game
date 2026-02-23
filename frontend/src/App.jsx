import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 백엔드(8000포트)에서 데이터를 가져오는 함수
  const dealCards = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/deal');
      setGameData(response.data);
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
      alert("백엔드 서버가 켜져 있는지 확인해 보세요!");
    } finally {
      setLoading(false);
    }
  };

  // 카드 1장을 그리는 공통 함수
  const renderCard = (card, index) => {
    const isRed = ['♥', '♦'].includes(card.suit);
    return (
      <div key={index} className={`card ${isRed ? 'red' : 'black'}`}>
        <span className="rank">{card.rank}</span>
        <span className="suit">{card.suit}</span>
      </div>
    );
  };

  return (
    <div className="poker-app">
      <h1>Texas Hold'em Table</h1>

      <button className="deal-button" onClick={dealCards} disabled={loading}>
        {loading ? "Dealing..." : "Deal New Hand"}
      </button>

      {gameData && (
        <div className="game-board">
          {/* 딜러 구역 */}
          <div className="section dealer-section">
            <h2>Dealer Hand</h2>
            <div className="card-row">
              {gameData.dealer_hand.map((card, i) => renderCard(card, i))}
            </div>
            <p className="hand-result">Dealer: <strong>{gameData.dealer_best}</strong></p>
          </div>

          <div className="divider"></div>

          {/* 공통 카드 구역 */}
          <div className="section community-section">
            <h2>Community Cards</h2>
            <div className="card-row">
              {gameData.community_cards.map((card, i) => renderCard(card, i))}
            </div>
          </div>

          <div className="divider"></div>

          {/* 플레이어 구역 */}
          <div className="section player-section">
            <h2>Your Hand</h2>
            <div className="card-row">
              {gameData.player_hand.map((card, i) => renderCard(card, i))}
            </div>
            <p className="hand-result">You: <strong>{gameData.player_best}</strong></p>
          </div>

          {/* 승패 결과 안내 */}
          <div className="final-result">
            {/* 백엔드에서 winner 데이터를 추가했다면 아래처럼 표시 가능합니다 */}
            {gameData.winner && <h2 className="winner-announcement">{gameData.winner === 'player' ? '🏆 YOU WIN!' : '💀 DEALER WINS'}</h2>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;