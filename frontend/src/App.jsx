import { useState } from 'react';
import axios from 'axios';
import './App.css';

// axios 인스턴스 생성 (API 주소 통합 관리)
const api = axios.create({
  baseURL: 'http://localhost:8000',
});

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);

  // 카드 비교 함수 (승리 족보 하이라이트용)
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

  // 게임 진행 (Start / Next)
  const handleGameAction = async () => {
    setLoading(true);
    const endpoint = (phase === "waiting" || phase === "showdown") ? '/start' : '/next';

    try {
      const response = await api.get(endpoint);
      if (response.data.error) {
        alert(response.data.error);
      } else {
        setGameData(response.data);
        setPhase(response.data.phase);
        if (response.data.is_game_over) setIsGameOver(true);
      }
    } catch (error) {
      console.error("연결 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 기권 (Fold)
  const handleFold = async () => {
    setLoading(true);
    try {
      const response = await api.post('/fold');
      setGameData(response.data);
      setPhase(response.data.phase);
      if (response.data.is_game_over) setIsGameOver(true);
    } catch (error) {
      console.error("Fold 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 게임 전체 리셋 (파산 후 다시 시작)
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

  // 🧪 테스트용: 강제 파산 트리거 함수
  const triggerBankruptTest = async (target = 'player') => {
    setLoading(true);
    try {
      const response = await api.post(`/test/bankrupt?target=${target}`);
      setGameData(prev => ({ ...prev, ...response.data }));
      if (response.data.is_game_over) setIsGameOver(true);
    } catch (error) {
      console.error("테스트 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="poker-app">
      {/* 상단 자산 표시 바 */}
      <div className="status-bar">
        <div className="money-item dealer">Dealer: <span>${gameData?.dealer_money ?? 1000}</span></div>
        <div className="money-item pot">Pot: <span className="pot-text">${gameData?.pot ?? 0}</span></div>
        <div className="money-item player">You: <span>${gameData?.player_money ?? 1000}</span></div>
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
          <div className={`hand-name ${phase === "showdown" ? 'active' : ''}`}>{gameData?.player_best}</div>
        </div>
      </div>

      {/* 하단 컨트롤 버튼 */}
      <div className="controls">
        {phase === "waiting" || phase === "showdown" ? (
          <button className="btn btn-start" onClick={handleGameAction} disabled={loading}>
            {phase === "showdown" ? "New Game ($-50)" : "Start Game ($-50)"}
          </button>
        ) : (
          <div className="action-group">
            <button className="btn btn-fold" onClick={handleFold} disabled={loading}>Fold (기권)</button>
            <button className="btn btn-call" onClick={handleGameAction} disabled={loading}>
              {phase === "river" ? "Check Result" : "Call ($-50)"}
            </button>
          </div>
        )}
      </div>

      {/* 파산 엔딩 오버레이 (중앙 정렬 구조) */}
      {isGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <div className="game-over-info">
              <h1>{gameData?.player_money <= 0 ? "GAME OVER" : "CHAMPION!"}</h1>
              <p>{gameData?.player_money <= 0 ? "모든 자산을 잃었습니다." : "딜러를 파산시켰습니다!"}</p>
              <div className="final-stats">최종 자산: <span>${gameData?.player_money}</span></div>
            </div>
            <div className="game-over-actions">
              <button className="btn btn-start" onClick={handleFullReset}>
                다시 도전하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🧪 개발용 테스트 버튼 그룹 (확인 후 이 <div> 전체를 삭제하세요)
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', gap: '10px', zIndex: 9999 }}>
        <button onClick={() => triggerBankruptTest('player')} style={{ padding: '8px', fontSize: '11px', opacity: 0.5, cursor: 'pointer' }}>플레이어 파산</button>
        <button onClick={() => triggerBankruptTest('dealer')} style={{ padding: '8px', fontSize: '11px', opacity: 0.5, cursor: 'pointer' }}>딜러 파산</button>
      </div> */}

    </div>
  );
}

export default App;