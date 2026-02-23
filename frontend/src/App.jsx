import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);

  const dealCards = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/deal');
      setGameData(response.data);
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
      alert("백엔드 서버 상태를 확인하세요!");
    } finally {
      setLoading(false);
    }
  };

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
          {/* 1. 승패 메시지 (가장 상단에 배치) */}
          <div className={`winner-banner ${gameData.winner}`}>
            {gameData.winner === 'player' && "🏆 YOU WIN! 🏆"}
            {gameData.winner === 'dealer' && "💀 DEALER WIN! 💀"}
            {gameData.winner === 'draw' && "🤝 DRAW 🤝"}
          </div>

          {/* 2. 딜러 섹션 (승자일 때 강조 효과) */}
          <div className={`section dealer-section ${gameData.winner === 'dealer' ? 'winner-border' : ''}`}>
            <h2>Dealer Hand</h2>
            <div className="card-row">
              {gameData.dealer_hand.map((card, i) => renderCard(card, i))}
            </div>
            <p className="hand-name">Dealer's Best: <strong>{gameData.dealer_best}</strong></p>
          </div>

          <div className="divider">Community Cards</div>

          {/* 3. 공통 카드 섹션 */}
          <div className="section community-section">
            <div className="card-row">
              {gameData.community_cards.map((card, i) => renderCard(card, i))}
            </div>
          </div>

          <div className="divider">Your Hand</div>

          {/* 4. 플레이어 섹션 (승자일 때 강조 효과) */}
          <div className={`section player-section ${gameData.winner === 'player' ? 'winner-border' : ''}`}>
            <h2>Your Hand</h2>
            <div className="card-row">
              {gameData.player_hand.map((card, i) => renderCard(card, i))}
            </div>
            <p className="hand-name">Your Best: <strong>{gameData.player_best}</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;