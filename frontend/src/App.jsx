import { useState } from 'react';
import axios from 'axios';
import './App.css';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [betAmount, setBetAmount] = useState(50);
  
  // 1. Raise 모드 활성화 상태 추가
  const [isBetting, setIsBetting] = useState(false);

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

  const handleStartGame = async () => {
    setLoading(true);
    try {
      const response = await api.get('/start');
      if (response.data.error) {
        alert(response.data.error);
      } else {
        setGameData(response.data);
        setPhase(response.data.phase);
        setBetAmount(50);
        setIsBetting(false); // 시작 시 베팅창 닫기
      }
    } catch (error) {
      console.error("시작 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerAction = async (actionType) => {
    setLoading(true);
    try {
      const response = await api.get(`/next?action=${actionType}&bet=${betAmount}`);
      if (response.data.error) {
        alert(response.data.error);
      } else {
        setGameData(response.data);
        setPhase(response.data.phase);
        setIsBetting(false); // 액션 성공 시 베팅창 닫기
        if (response.data.is_game_over) setIsGameOver(true);
      }
    } catch (error) {
      console.error("액션 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFold = async () => {
    setLoading(true);
    try {
      const response = await api.post('/fold');
      setGameData(response.data);
      setPhase(response.data.phase);
      setIsBetting(false);
      if (response.data.is_game_over) setIsGameOver(true);
    } catch (error) {
      console.error("Fold 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFullReset = async () => {
    try {
      await api.post('/reset');
      setIsGameOver(false);
      setPhase("waiting");
      setGameData(null);
      window.location.reload(); 
    } catch (error) {
      console.error("리셋 실패:", error);
    }
  };

  return (
    <div className="poker-app">
      <div className="status-bar">
        <div className="money-item dealer">Dealer: <span>${gameData?.dealer_money ?? 1000}</span></div>
        <div className="money-item pot">Pot: <span className="pot-text">${gameData?.pot ?? 0}</span></div>
        <div className="money-item player">You: <span>${gameData?.player_money ?? 1000}</span></div>
      </div>

      <h1>Texas Hold'em Table</h1>

      <div className="game-board">
        <div className={`section dealer-section ${phase === "showdown" && gameData?.winner === 'dealer' ? 'winner-border' : ''}`}>
          <h2>Dealer Hand</h2>
          <div className="card-row">
            {phase === "showdown" && gameData?.dealer_hand ? 
              gameData.dealer_hand.map((card, i) => renderCard(card, i, false, gameData.winner === 'dealer' && isCardInBestHand(card, gameData.dealer_best_cards))) 
              : <><div className="card-placeholder"></div><div className="card-placeholder"></div></>}
          </div>
          <div className="hand-name">{phase === "showdown" && gameData?.dealer_best}</div>
        </div>

        <div className="divider"></div>

        <div className="section community-section">
          <div className="card-row">
            {gameData?.community_cards?.map((card, i) => {
              const isShowdown = phase === "showdown";
              const bestCards = isShowdown ? (gameData.winner === 'dealer' ? gameData.dealer_best_cards : gameData.player_best_cards) : [];
              return renderCard(card, i, true, isShowdown && isCardInBestHand(card, bestCards));
            })}
          </div>
        </div>

        <div className="divider"></div>

        <div className={`section player-section ${phase === 'showdown' && gameData?.winner === 'player' ? 'winner-border' : ''}`}>
          <h2>Your Hand</h2>
          <div className="card-row">
            {gameData?.player_hand?.map((card, i) => renderCard(card, i, false, phase === "showdown" && gameData.winner === 'player' && isCardInBestHand(card, gameData.player_best_cards)))}
          </div>
          <div className={`hand-name ${phase === "showdown" ? 'active' : ''}`}>{gameData?.player_best}</div>
        </div>
      </div>

      <div className="controls">
        {phase === "waiting" || phase === "showdown" ? (
          <button className="btn btn-start luxury" onClick={handleStartGame} disabled={loading}>
            {phase === "showdown" ? "New Game ($-50)" : "Start Game ($-50)"}
          </button>
        ) : (
          <div className="action-area">
            {/* 2. Raise 버튼 클릭 시 나타나는 콤팩트 슬라이더 영역 */}
            {isBetting ? (
              <div className="bet-toggle-container">
                <div className="bet-slider-box">
                  <div className="bet-label-mini">Raise: <span>${betAmount}</span></div>
                  <input 
                    type="range" 
                    min="10" 
                    max={Math.min(gameData?.player_money || 1000, gameData?.dealer_money || 1000)} 
                    step="10"
                    value={betAmount}
                    onChange={(e) => setBetAmount(parseInt(e.target.value))}
                  />
                </div>
                <div className="bet-toggle-btns">
                  <button className="btn btn-confirm" onClick={() => handlePlayerAction('raise')}>확정</button>
                  <button className="btn btn-cancel" onClick={() => setIsBetting(false)}>취소</button>
                </div>
              </div>
            ) : (
              <div className="action-group horizontal">
                <button className="btn btn-fold" onClick={handleFold} disabled={loading}>Fold</button>
                <button className="btn btn-check" onClick={() => handlePlayerAction('check')} disabled={loading}>Check</button>
                <button className="btn btn-call" onClick={() => handlePlayerAction('call')} disabled={loading}>Call</button>
                <button className="btn btn-raise" onClick={() => setIsBetting(true)} disabled={loading}>Raise</button>
              </div>
            )}
          </div>
        )}
      </div>

      {isGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <div className="game-over-info">
              <h1 className="luxury-text">{gameData?.player_money <= 0 ? "GAME OVER" : "CHAMPION!"}</h1>
              <p>{gameData?.player_money <= 0 ? "모든 자산을 잃었습니다." : "딜러를 파산시켰습니다!"}</p>
              <div className="final-stats">최종 자산: <span>${gameData?.player_money}</span></div>
            </div>
            <div className="game-over-actions">
              <button className="btn btn-start luxury" onClick={handleFullReset}>다시 시작하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;