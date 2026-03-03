import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [betAmount, setBetAmount] = useState(50);
  const [isBetting, setIsBetting] = useState(false);
  const [dealerMsg, setDealerMsg] = useState("");
  const [isDealerTurn, setIsDealerTurn] = useState(false);
  const [isFolding, setIsFolding] = useState(false); // [추가] 폴드 애니메이션 상태

  const callAmount =
    (gameData?.current_bet || 0) - (gameData?.player_phase_bet || 0);

  useEffect(() => {
    const initGame = async () => {
      try {
        await api.post("/reset");
        console.log("Game Backend Reset Success (Initial Load)");
      } catch (error) {
        console.error("Backend 리셋 실패:", error);
      }
    };
    initGame();
  }, []);

  const isCardInBestHand = (card, bestCards) => {
    if (!card || !bestCards) return false;
    return bestCards.some(
      (bc) => bc.rank === card.rank && bc.suit === card.suit,
    );
  };

  const renderCard = (
    card,
    index,
    isCommunity = false,
    isHighlight = false,
  ) => {
    if (!card) return null;
    const isRed = ["♥", "♦"].includes(card.suit);
    let delay = isCommunity ? (index < 3 ? index * 0.1 : 0.05) : index * 0.1;

    return (
      <div
        key={`${card.rank}${card.suit}-${index}`}
        className={`card ${isRed ? "red" : "black"} ${isHighlight ? "highlight" : ""}`}
        style={{ animationDelay: `${delay}s` }}
      >
        <span className="rank">{card.rank}</span>
        <span className="suit">{card.suit}</span>
      </div>
    );
  };

  const handleStartGame = async () => {
    setLoading(true);
    setDealerMsg("");
    setIsFolding(false); // 리셋
    try {
      const response = await api.get("/start");
      if (response.data.error) {
        alert(response.data.error);
        setLoading(false);
      } else {
        setGameData(response.data);
        setPhase(response.data.phase);
        setBetAmount(50);
        setIsBetting(false);

        if (response.data.dealer_button === "player") {
          setIsDealerTurn(true);
          setDealerMsg("Thinking...");
          setTimeout(() => {
            if (response.data.dealer_action)
              setDealerMsg(response.data.dealer_action);
            setGameData((prev) => ({ ...prev, ...response.data }));
            setIsDealerTurn(false);
            setLoading(false);
          }, 1500);
        } else {
          setIsDealerTurn(false);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("시작 실패:", error);
      setLoading(false);
    }
  };

  const handlePlayerAction = async (actionType) => {
    if (isDealerTurn) return;
    setIsBetting(false);
    setLoading(true);
    setDealerMsg("Thinking...");
    setIsDealerTurn(true);

    try {
      const response = await api.get(
        `/next?action=${actionType}&bet=${betAmount}`,
      );
      if (response.data.error) {
        alert(response.data.error);
        setDealerMsg("");
        setIsDealerTurn(false);
        setLoading(false);
      } else {
        setTimeout(() => {
          setGameData((prev) => ({
            ...prev,
            player_money: response.data.player_money,
            dealer_money: response.data.dealer_money,
            pot: response.data.pot,
            current_bet: response.data.current_bet,
            player_phase_bet: response.data.player_phase_bet,
          }));

          if (response.data.dealer_action)
            setDealerMsg(response.data.dealer_action);

          if (response.data.phase === "showdown") {
            setTimeout(() => {
              setGameData(response.data);
              setPhase(response.data.phase);
              if (response.data.is_game_over)
                setTimeout(() => setIsGameOver(true), 2500);
              setLoading(false);
            }, 1000);
          } else {
            setTimeout(() => {
              setGameData(response.data);
              setPhase(response.data.phase);
              setIsDealerTurn(false);
              setLoading(false);
            }, 800);
          }
        }, 1500);
      }
    } catch (error) {
      console.error("액션 실패:", error);
      setDealerMsg("Error");
      setIsDealerTurn(false);
      setLoading(false);
    }
  };

  // [수정] Fold 시 애니메이션 효과 추가
  const handleFold = async () => {
    if (isDealerTurn) return;
    setIsFolding(true); // 카드 던지기 애니메이션 시작
    setLoading(true);
    setDealerMsg("");

    try {
      // 애니메이션이 진행될 시간을 줍니다 (0.6초)
      setTimeout(async () => {
        const response = await api.post("/fold");
        setGameData(response.data);
        setPhase(response.data.phase);
        setIsBetting(false);
        setIsFolding(false); // 애니메이션 상태 해제
        if (response.data.is_game_over) {
          setTimeout(() => setIsGameOver(true), 1500);
        }
        setLoading(false);
      }, 600);
    } catch (error) {
      console.error("Fold 실패:", error);
      setIsFolding(false);
      setLoading(false);
    }
  };

  const handleFullReset = async () => {
    try {
      await api.post("/reset");
      setIsGameOver(false);
      setPhase("waiting");
      setGameData(null);
      setIsDealerTurn(false);
      setIsFolding(false);
      window.location.reload();
    } catch (error) {
      console.error("리셋 실패:", error);
    }
  };

  return (
    <div className="poker-app">
      <div className="status-bar">
        <div className="money-item dealer">
          Dealer <span>${gameData?.dealer_money ?? 2000}</span>
        </div>
        <div className="money-item pot">
          Pot <span className="pot-text">${gameData?.pot ?? 0}</span>
        </div>
        <div className="money-item player">
          You <span>${gameData?.player_money ?? 2000}</span>
        </div>
      </div>

      <h1>Texas Hold'em Table</h1>

      <div className="game-board">
        {/* Dealer Section */}
        <div
          className={`section dealer-section ${phase === "showdown" && gameData?.winner === "dealer" ? "winner-border" : ""}`}
        >
          <h2>Dealer Hand</h2>
          <div className="card-area-wrapper">
            <div className="dealer-action-aside left-aside">
              {gameData?.dealer_button === "dealer" && (
                <span className="d-button-puck">D</span>
              )}
              {dealerMsg && phase !== "showdown" && (
                <div
                  className={`dealer-bubble-side ${dealerMsg.toLowerCase()}`}
                >
                  {dealerMsg}
                </div>
              )}
            </div>
            <div className="card-row">
              {phase === "showdown" && gameData?.dealer_hand ? (
                gameData.dealer_hand.map((card, i) =>
                  renderCard(
                    card,
                    i,
                    false,
                    gameData.winner === "dealer" &&
                      isCardInBestHand(card, gameData.dealer_best_cards),
                  ),
                )
              ) : (
                <>
                  <div className="card-placeholder"></div>
                  <div className="card-placeholder"></div>
                </>
              )}
            </div>
          </div>
          <div className="dealer-status-container">
            <div
              className={`hand-name ${phase === "showdown" ? "active" : ""}`}
            >
              {phase === "showdown" ? gameData?.dealer_best : ""}
            </div>
          </div>
        </div>

        <div className="divider"></div>

        {/* Community Cards Section */}
        <div className="section community-section">
          <div className="card-row">
            {gameData?.community_cards?.map((card, i) => {
              const isShowdown = phase === "showdown";
              const bestCards = isShowdown
                ? gameData.winner === "dealer"
                  ? gameData.dealer_best_cards
                  : gameData.player_best_cards
                : [];
              return renderCard(
                card,
                i,
                true,
                isShowdown && isCardInBestHand(card, bestCards),
              );
            })}
          </div>
        </div>

        <div className="divider"></div>

        {/* Player Section */}
        <div
          className={`section player-section ${phase === "showdown" && gameData?.winner === "player" ? "winner-border" : ""}`}
        >
          <h2>Your Hand</h2>
          <div className="card-area-wrapper">
            <div className="dealer-action-aside left-aside">
              {gameData?.dealer_button === "player" && (
                <span className="d-button-puck">D</span>
              )}
            </div>
            {/* [수정] folding-animation 클래스 조건부 추가 */}
            <div className={`card-row ${isFolding ? "folding-animation" : ""}`}>
              {gameData?.player_hand?.map((card, i) =>
                renderCard(
                  card,
                  i,
                  false,
                  phase === "showdown" &&
                    gameData.winner === "player" &&
                    isCardInBestHand(card, gameData.player_best_cards),
                ),
              )}
            </div>
          </div>
          <div className={`hand-name ${phase === "showdown" ? "active" : ""}`}>
            {gameData?.player_best}
          </div>
        </div>
      </div>

      {/* Fold Overlay Effect */}
      {isFolding && (
        <div className="fold-overlay">
          <h2 className="fold-text">FOLD</h2>
        </div>
      )}

      <div className="controls">
        {phase === "waiting" || phase === "showdown" ? (
          <button
            className="btn btn-start luxury"
            onClick={handleStartGame}
            disabled={loading}
          >
            {phase === "showdown" ? "Next Game ($-50)" : "Start Game ($-50)"}
          </button>
        ) : (
          <div className="action-area">
            <div
              className={`action-container ${isDealerTurn ? "disabled-ui" : ""}`}
            >
              {isBetting ? (
                <div className="bet-toggle-container">
                  <div className="bet-slider-box">
                    <div className="bet-label-mini">
                      Raise: <span>${betAmount}</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max={Math.min(
                        gameData?.player_money || 2000,
                        gameData?.dealer_money || 2000,
                      )}
                      step="10"
                      value={betAmount}
                      onChange={(e) => setBetAmount(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="bet-toggle-btns">
                    <button
                      className="btn btn-confirm"
                      onClick={() => handlePlayerAction("raise")}
                    >
                      확정
                    </button>
                    <button
                      className="btn btn-cancel"
                      onClick={() => setIsBetting(false)}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="action-group horizontal">
                  <button
                    className="btn btn-fold"
                    onClick={handleFold}
                    disabled={loading}
                  >
                    Fold
                  </button>
                  <button
                    className="btn btn-check"
                    onClick={() => handlePlayerAction("check")}
                    disabled={loading || callAmount > 0}
                  >
                    Check
                  </button>
                  <button
                    className="btn btn-call"
                    onClick={() => handlePlayerAction("call")}
                    disabled={loading || callAmount <= 0}
                  >
                    Call {callAmount > 0 ? `($${callAmount})` : ""}
                  </button>
                  <button
                    className="btn btn-raise"
                    onClick={() => setIsBetting(true)}
                    disabled={loading}
                  >
                    Raise
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {isGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <div className="game-over-info">
              <h1 className="luxury-text">
                {gameData?.player_money <= 0 ? "GAME OVER" : "CHAMPION!"}
              </h1>
              <p>
                {gameData?.player_money <= 0
                  ? "모든 자산을 잃었습니다."
                  : "딜러를 파산시켰습니다!"}
              </p>
              <div className="final-stats">
                최종 자산: <span>${gameData?.player_money}</span>
              </div>
            </div>
            <div className="game-over-actions">
              <button
                className="btn btn-start luxury"
                onClick={handleFullReset}
              >
                다시 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
