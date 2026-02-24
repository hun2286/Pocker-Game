import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);

  // 카드 비교 함수 (rank와 suit가 모두 같아야 함)
  const isCardInBestHand = (card, bestCards) => {
    if (!card || !bestCards) return false;
    return bestCards.some(bc => bc.rank === card.rank && bc.suit === card.suit);
  };

  /**
   * 카드 렌더링 함수
   * @param {Object} card - 카드 정보
   * @param {number} index - 애니메이션 딜레이용 인덱스
   * @param {boolean} isCommunity - 공통 카드 여부
   * @param {boolean} isHighlight - 족보 하이라이트 여부
   */
  const renderCard = (card, index, isCommunity = false, isHighlight = false) => {
    if (!card) return null;
    const isRed = ['♥', '♦'].includes(card.suit);
    let delay = isCommunity ? (index < 3 ? index * 0.1 : 0.05) : index * 0.1;

    return (
      <div
        key={`${card.rank}${card.suit}-${index}`}
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
    // 쇼다운이거나 대기 중이면 새 게임 시작, 아니면 다음 단계로
    const url = (phase === "waiting" || phase === "showdown")
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
        {loading ? "..." : (phase === "waiting" || phase === "showdown" ? "New Game" : "Next Card")}
      </button>

      <div className="game-board">
        {/* 1. 딜러 섹션 */}
        <div className={`section dealer-section ${phase === "showdown" && gameData?.winner === 'dealer' ? 'winner-border' : ''}`}>
          <h2>Dealer Hand</h2>
          <div className="card-row">
            {phase === "showdown" && gameData?.dealer_hand ?
              gameData.dealer_hand.map((card, i) => renderCard(
                card, i, false,
                // 조건: 쇼다운 단계에서 + 딜러가 승자일 때만 하이라이트
                phase === "showdown" && gameData.winner === 'dealer' && isCardInBestHand(card, gameData.dealer_best_cards)
              ))
              : <><div className="card-placeholder"></div><div className="card-placeholder"></div></>}
          </div>
          <div className={`hand-name ${phase === "showdown" ? 'active' : ''}`}>
            {phase === "showdown" && gameData?.dealer_best}
          </div>
        </div>

        <div className="divider">Community Cards</div>

        {/* 2. 공통 카드 섹션 */}
        <div className="section community-section">
          <div className="card-row">
            {gameData?.community_cards?.map((card, i) => {
              // 쇼다운일 때만 현재 승자의 족보 카드를 가져와서 비교
              const isShowdown = phase === "showdown";
              const bestCards = isShowdown
                ? (gameData.winner === 'dealer' ? gameData.dealer_best_cards : gameData.player_best_cards)
                : [];

              return renderCard(
                card, i, true,
                isShowdown && isCardInBestHand(card, bestCards)
              );
            })}
          </div>
        </div>

        <div className="divider">Your Hand</div>

        {/* 3. 플레이어 섹션 */}
        <div className={`section player-section ${phase === 'showdown' && gameData?.winner === 'player' ? 'winner-border' : ''}`}>
          <h2>Your Hand</h2>
          <div className="card-row">
            {gameData?.player_hand?.map((card, i) => renderCard(
              card, i, false,
              // 조건: 쇼다운 단계에서 + 플레이어가 승자일 때만 하이라이트
              phase === "showdown" && gameData.winner === 'player' && isCardInBestHand(card, gameData.player_best_cards)
            ))}
          </div>
          <div className={`hand-name ${phase === "showdown" ? 'active' : ''}`}>
            {/* 플레이어 족보 이름은 진행 중에도 볼 수 있게 하거나, 쇼다운 때만 보이게 조절 가능 */}
            {gameData?.player_best && (phase === "showdown" ? `Result: ${gameData.player_best}` : `Current: ${gameData.player_best}`)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;