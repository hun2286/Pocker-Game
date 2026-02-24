import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);

  // 1. 카드 렌더링 함수 (하이라이트 파라미터 추가)
  const renderCard = (card, index, isCommunity = false, isHighlight = false) => {
    if (!card) return null;
    const isRed = ['♥', '♦'].includes(card.suit);

    let delay = 0;
    if (isCommunity) {
      delay = index < 3 ? index * 0.1 : 0.05;
    } else {
      delay = index * 0.1;
    }

    return (
      <div
        key={`${card.rank}${card.suit}`}
        // isHighlight가 true이면 'highlight' 클래스가 추가됩니다.
        className={`card ${isRed ? 'red' : 'black'} ${isHighlight ? 'highlight' : ''}`}
        style={{ animationDelay: `${delay}s` }}
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
              // 딜러가 이겼을 때만 카드를 하이라이트 처리
              gameData.dealer_hand.map((card, i) => renderCard(card, i, false, gameData?.winner === 'dealer')) :
              <>
                <div className="card-placeholder" style={{ animationDelay: '0s' }}></div>
                <div className="card-placeholder" style={{ animationDelay: '0.1s' }}></div>
              </>
            }
          </div>
          {/* 딜러가 이기면 글자도 번쩍이게 active 클래스 추가 */}
          <div className={`hand-name ${phase === "showdown" && gameData?.winner === 'dealer' ? 'active' : ''}`}>
            {phase === "showdown" && gameData?.dealer_best}
          </div>
        </div>

        <div className="divider">Community Cards</div>

        {/* 2. 공통 카드 섹션 */}
        <div className="section community-section">
          <div className="card-row">
            {/* 공통 카드는 쇼다운 시 모두 하이라이트 효과를 받도록 설정 (혹은 승자 조건에 따라 조절 가능) */}
            {gameData?.community_cards?.map((card, i) => renderCard(card, i, true, phase === "showdown"))}
          </div>
        </div>

        <div className="divider">Your Hand</div>

        {/* 3. 플레이어 섹션 */}
        <div className={`section player-section ${phase === 'showdown' && gameData?.winner === 'player' ? 'winner-border' : ''}`}>
          <h2>Your Hand</h2>
          <div className="card-row">
            {/* 플레이어가 이겼을 때만 카드를 하이라이트 처리 */}
            {gameData?.player_hand?.map((card, i) => renderCard(card, i, false, phase === "showdown" && gameData?.winner === 'player'))}
          </div>
          {/* 플레이어가 이기면 글자도 번쩍이게 active 클래스 추가 */}
          <div className={`hand-name ${phase === "showdown" && gameData?.winner === 'player' ? 'active' : ''}`}>
            {gameData?.player_best && `Your Best: ${gameData.player_best}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;