import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);

  // 카드 비교 함수 (통일된 cards 리스트 사용)
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
        key={`${card.rank}${card.suit}-${index}`}
        className={`card ${isRed ? 'red' : 'black'} ${isHighlight ? 'highlight' : ''}`}
        style={{ animationDelay: `${delay}s` }}
      >
        <span className="rank">{card.rank}</span>
        <span className="suit">{card.suit}</span>
      </div>
    );
  };

  // 게임 진행 및 Call 버튼 역할
  const handleGameAction = async () => {
    setLoading(true);
    const url = (phase === "waiting" || phase === "showdown")
      ? 'http://localhost:8000/start'
      : 'http://localhost:8000/next';

    try {
      const response = await axios.get(url);
      if (response.data.error) {
        alert(response.data.error);
      } else {
        setGameData(response.data);
        setPhase(response.data.phase);
      }
    } catch (error) {
      console.error("연결 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 기권 (Fold) 함수
  const handleFold = async () => {
    // if (!window.confirm("...")) 로직을 삭제하여 즉시 실행되게 합니다.
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/fold');
      setGameData(response.data);
      setPhase(response.data.phase);
      // alert("기권하셨습니다."); // 알림창 제거
    } catch (error) {
      console.error("Fold 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="poker-app">
      {/* 상단 자산 표시 바 */}
      <div className="status-bar">
        <div className="money-item dealer">
          Dealer: <span>${gameData?.dealer_money ?? 1000}</span>
        </div>
        <div className="money-item pot">
          Pot: <span className="pot-text">${gameData?.pot ?? 0}</span>
        </div>
        <div className="money-item player">
          You: <span>${gameData?.player_money ?? 1000}</span>
        </div>
      </div>
      <h1>Texas Hold'em Table</h1>

      <div className="game-board">
        {/* 딜러 섹션 */}
        <div className={`section dealer-section ${phase === "showdown" && gameData?.winner === 'dealer' ? 'winner-border' : ''}`}>
          <h2>Dealer Hand</h2>
          <div className="card-row">
            {phase === "showdown" && gameData?.dealer_hand ?
              gameData.dealer_hand.map((card, i) => renderCard(
                card, i, false,
                gameData.winner === 'dealer' && isCardInBestHand(card, gameData.dealer_best_cards)
              ))
              : <><div className="card-placeholder"></div><div className="card-placeholder"></div></>}
          </div>
          <div className="hand-name">{phase === "showdown" && gameData?.dealer_best}</div>
        </div>

        <div className="divider"></div>

        {/* 공통 카드 섹션 */}
        <div className="section community-section">
          <div className="card-row">
            {gameData?.community_cards?.map((card, i) => {
              const isShowdown = phase === "showdown";
              const bestCards = isShowdown
                ? (gameData.winner === 'dealer' ? gameData.dealer_best_cards : gameData.player_best_cards)
                : [];
              return renderCard(card, i, true, isShowdown && isCardInBestHand(card, bestCards));
            })}
          </div>
        </div>

        <div className="divider"></div>

        {/* 플레이어 섹션 */}
        <div className={`section player-section ${phase === 'showdown' && gameData?.winner === 'player' ? 'winner-border' : ''}`}>
          <h2>Your Hand</h2>
          <div className="card-row">
            {gameData?.player_hand?.map((card, i) => renderCard(
              card, i, false,
              phase === "showdown" && gameData.winner === 'player' && isCardInBestHand(card, gameData.player_best_cards)
            ))}
          </div>
          <div className={`hand-name ${phase === "showdown" ? 'active' : ''}`}>
            {gameData?.player_best}
          </div>
        </div>
      </div>

      {/* 2. 하단 컨트롤 버튼 */}
      <div className="controls">
        {phase === "waiting" || phase === "showdown" ? (
          <button className="btn btn-start" onClick={handleGameAction} disabled={loading}>
            {phase === "showdown" ? "New Game ($-50)" : "Start Game ($-50)"}
          </button>
        ) : (
          <div className="action-group">
            <button className="btn btn-fold" onClick={handleFold} disabled={loading}>
              Fold (기권)
            </button>
            <button className="btn btn-call" onClick={handleGameAction} disabled={loading}>
              {/* 리버 단계 이후에는 돈을 더 내지 않고 결과만 확인 */}
              {phase === "river" ? "Check Result" : "Call ($-50)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;