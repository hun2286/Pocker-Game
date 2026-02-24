import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);

  const isCardInBestHand = (card, bestCards) => {
    if (!card || !bestCards) return false;
    return bestCards.some(bc => bc.rank === card.rank && bc.suit === card.suit);
  };

  const renderCard = (card, index, isCommunity = false, isHighlight = false) => {
    if (!card) return null;
    const isRed = ['♥', '♦'].includes(card.suit);
    let delay = isCommunity ? (index < 3 ? index * 0.1 : 0.05) : index * 0.1;

    return (
      <div
        key={`${card.rank}${card.suit}`}
        className={`card ${isRed ? 'red' : 'black'} ${isHighlight ? 'highlight' : ''}`}
        style={{ animationDelay: `${delay}s` }}
      >
        <span className="rank">{card.rank}</span>
        <span className="suit">{card.suit}</span>
      </div>
    );
  };

  const handleGameAction = async () => {
    setLoading(true);
    const url = phase === "waiting" || phase === "showdown"
      ? 'http://localhost:8000/start'
      : 'http://localhost:8000/next';

    try {
      const response = await axios.get(url);
      setGameData(response.data);
      setPhase(response.data.phase);
    } catch (error) {
      console.error("연결 실패:", error);
      alert("서버 연결에 실패했습니다!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="poker-app">
      <h1>Texas Hold'em Table</h1>
      <button className="deal-button" onClick={handleGameAction} disabled={loading}>
        {loading ? "..." : phase === "waiting" || phase === "showdown" ? "New Game" : "Next Card"}
      </button>

      <div className="game-board">
        {/* 1. 딜러 섹션 */}
        <div className={`section dealer-section ${phase === "showdown" && gameData?.winner === 'dealer' ? 'winner-border' : ''}`}>
          <h2>Dealer Hand</h2>
          <div className="card-row">
            {phase === "showdown" && gameData?.dealer_hand ?
              gameData.dealer_hand.map((card, i) =>
                renderCard(card, i, false, isCardInBestHand(card, gameData?.dealer_best_cards))
              ) : (
                <>
                  <div className="card-placeholder" style={{ animationDelay: '0s' }}></div>
                  <div className="card-placeholder" style={{ animationDelay: '0.1s' }}></div>
                </>
              )}
          </div>
          <div className={`hand-name ${phase === "showdown" && gameData?.winner === 'dealer' ? 'active' : ''}`}>
            {phase === "showdown" && gameData?.dealer_best}
          </div>
        </div>

        <div className="divider">Community Cards</div>

        {/* 2. 공통 카드 섹션 */}
        <div className="section community-section">
          <div className="card-row">
            {gameData?.community_cards?.map((card, i) => {
              const bestCards = gameData.winner === 'player' ? gameData.player_best_cards : gameData.dealer_best_cards;
              // 이미 showdown 조건이 잘 붙어있습니다.
              return renderCard(card, i, true, phase === "showdown" && isCardInBestHand(card, bestCards));
            })}
          </div>
        </div>

        <div className="divider">Your Hand</div>

        {/* 3. 플레이어 섹션 */}
        <div className={`section player-section ${phase === 'showdown' && gameData?.winner === 'player' ? 'winner-border' : ''}`}>
          <h2>Your Hand</h2>
          <div className="card-row">
            {gameData?.player_hand?.map((card, i) =>
              // [중요 수정]: phase === "showdown" 조건을 추가하여 마지막에만 빛나도록 설정
              renderCard(card, i, false, phase === "showdown" && isCardInBestHand(card, gameData?.player_best_cards))
            )}
          </div>
          <div className={`hand-name ${phase === "showdown" && gameData?.winner === 'player' ? 'active' : ''}`}>
            {gameData?.player_best && `Your Best: ${gameData.player_best}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;