import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);

  // 카드 비교 함수 (rank와 suit가 모두 같아야 함)
  const isCardInList = (card, cardList) => {
    if (!card || !cardList) return false;
    return cardList.some(bc => bc.rank === card.rank && bc.suit === card.suit);
  };

  // 하이라이트 타입 결정 함수
  const getHighlightClass = (card, isWinnerSide) => {
    if (phase !== "showdown" || !isWinnerSide || !gameData) return "";

    // 승리한 쪽의 데이터를 사용 (player_best_... 또는 dealer_best_...)
    const bestMain = gameData.winner === 'player' ? gameData.player_best_main_cards : gameData.dealer_best_main_cards;
    const bestKickers = gameData.winner === 'player' ? gameData.player_best_kickers : gameData.dealer_best_kickers;

    if (isCardInList(card, bestMain)) return "main-highlight";
    if (isCardInList(card, bestKickers)) return "kicker-highlight";
    return "";
  };

  const renderCard = (card, index, isCommunity = false, highlightClass = "") => {
    if (!card) return null;
    const isRed = ['♥', '♦'].includes(card.suit);
    let delay = isCommunity ? (index < 3 ? index * 0.1 : 0.05) : index * 0.1;

    return (
      <div
        key={`${card.rank}${card.suit}`}
        className={`card ${isRed ? 'red' : 'black'} ${highlightClass}`}
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
                renderCard(card, i, false, getHighlightClass(card, gameData.winner === 'dealer'))
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
            {gameData?.community_cards?.map((card, i) =>
              renderCard(card, i, true, getHighlightClass(card, !!gameData.winner))
            )}
          </div>
        </div>

        <div className="divider">Your Hand</div>

        {/* 3. 플레이어 섹션 */}
        <div className={`section player-section ${phase === 'showdown' && gameData?.winner === 'player' ? 'winner-border' : ''}`}>
          <h2>Your Hand</h2>
          <div className="card-row">
            {gameData?.player_hand?.map((card, i) =>
              renderCard(card, i, false, getHighlightClass(card, gameData.winner === 'player'))
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