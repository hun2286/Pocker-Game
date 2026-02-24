import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);

  // 1. 카드 렌더링 함수 (isCommunity 파라미터 추가)
  const renderCard = (card, index, isCommunity = false) => {
    if (!card) return null;
    const isRed = ['♥', '♦'].includes(card.suit);

    // 공통 카드는 여러 장이 동시에 나타나므로 순차적인 느낌을 위해 0.15초씩 딜레이 부여
    // 내 카드나 딜러 카드는 기본적으로 2장이므로 0.1초 정도의 짧은 간격 부여
    const delay = isCommunity ? index * 0.15 : index * 0.1;

    return (
      <div
        key={`${card.rank}${card.suit}-${index}`}
        className={`card ${isRed ? 'red' : 'black'}`}
        style={{ animationDelay: `${delay}s` }} // CSS 애니메이션 딜레이를 인라인 스타일로 주입
      >
        <span className="rank">{card.rank}</span>
        <span className="suit">{card.suit}</span>
      </div>
    );
  };

  // 2. 게임 진행 함수
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
        {loading ? "..." :
          phase === "waiting" || phase === "showdown" ? "New Game" : "Next Card"}
      </button>

      <div className="game-board">
        {/* 1. 딜러 섹션 */}
        <div className={`section dealer-section ${phase === "showdown" && gameData?.winner === 'dealer' ? 'winner-border' : ''}`}>
          <h2>Dealer Hand</h2>
          <div className="card-row">
            {phase === "showdown" && gameData?.dealer_hand ?
              gameData.dealer_hand.map((card, i) => renderCard(card, i)) :
              <>
                {/* 딜러 뒷면 카드도 순차적으로 등장하도록 딜레이 부여 */}
                <div className="card-placeholder" style={{ animationDelay: '0s' }}></div>
                <div className="card-placeholder" style={{ animationDelay: '0.1s' }}></div>
              </>
            }
          </div>
          <div className="hand-name">
            {phase === "showdown" && gameData?.dealer_best}
          </div>
        </div>

        <div className="divider">Community Cards</div>

        {/* 2. 공통 카드 섹션 (세 번째 인자에 true 전달) */}
        <div className="section community-section">
          <div className="card-row">
            {gameData?.community_cards?.map((card, i) => renderCard(card, i, true))}
          </div>
        </div>

        <div className="divider">Your Hand</div>

        {/* 3. 플레이어 섹션 */}
        <div className={`section player-section ${phase === 'showdown' && gameData?.winner === 'player' ? 'winner-border' : ''}`}>
          <h2>Your Hand</h2>
          <div className="card-row">
            {gameData?.player_hand?.map((card, i) => renderCard(card, i))}
          </div>
          <div className="hand-name">
            {gameData?.player_best && `Your Best: ${gameData.player_best}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;