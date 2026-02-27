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
    try {
      const response = await api.get("/start");
      if (response.data.error) {
        alert(response.data.error);
      } else {
        setGameData(response.data);
        setPhase(response.data.phase);
        setBetAmount(50);
        setIsBetting(false);

        if (response.data.dealer_button === "player") {
          setIsDealerTurn(true);
          setDealerMsg("Dealer's Turn...");
        } else {
          setIsDealerTurn(false);
        }
      }
    } catch (error) {
      console.error("시작 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerAction = async (actionType) => {
    if (isDealerTurn) return;
    setLoading(true);
    setDealerMsg("Thinking...");
    try {
      const response = await api.get(
        `/next?action=${actionType}&bet=${betAmount}`,
      );
      if (response.data.error) {
        alert(response.data.error);
        setDealerMsg("");
      } else {
        setGameData(response.data);
        setPhase(response.data.phase);
        setIsBetting(false);
        if (response.data.dealer_action) {
          setDealerMsg(response.data.dealer_action);
        }
        if (response.data.is_game_over) setIsGameOver(true);
        setIsDealerTurn(false);
      }
    } catch (error) {
      console.error("액션 실패:", error);
      setDealerMsg("Error");
    } finally {
      setLoading(false);
    }
  };

  const handleFold = async () => {
    if (isDealerTurn) return;
    setLoading(true);
    setDealerMsg("");
    try {
      const response = await api.post("/fold");
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
      await api.post("/reset");
      setIsGameOver(false);
      setPhase("waiting");
      setGameData(null);
      setIsDealerTurn(false);
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
        {/* 딜러 섹션 */}
        <div
          className={`section dealer-section ${phase === "showdown" && gameData?.winner === "dealer" ? "winner-border" : ""}`}
        >
          <h2>Dealer Hand</h2>
          <div className="card-area-wrapper">
            {/* 왼쪽 사이드: 딜러 버튼 및 말풍선 */}
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
            {/* 우측 사이드: 대칭을 위한 빈 공간 */}
            <div className="dealer-action-aside"></div>
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

        {/* 플레이어 섹션 */}
        <div
          className={`section player-section ${phase === "showdown" && gameData?.winner === "player" ? "winner-border" : ""}`}
        >
          <h2>Your Hand</h2>
          <div className="card-area-wrapper">
            {/* 왼쪽 사이드: 딜러 버튼 위치 */}
            <div className="dealer-action-aside left-aside">
              {gameData?.dealer_button === "player" && (
                <span className="d-button-puck">D</span>
              )}
            </div>

            <div className="card-row">
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
            <div className="dealer-action-aside"></div>
          </div>
          <div className={`hand-name ${phase === "showdown" ? "active" : ""}`}>
            {gameData?.player_best}
          </div>
        </div>
      </div>

      <div className="controls">
        {phase === "waiting" || phase === "showdown" ? (
          <button
            className="btn btn-start luxury"
            onClick={handleStartGame}
            disabled={loading}
          >
            {phase === "showdown" ? "New Game ($-50)" : "Start Game ($-50)"}
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
                      min="10"
                      max={Math.min(
                        gameData?.player_money || 2000,
                        gameData?.dealer_money || 2000,
                      )}
                      step="10"
                      value={betAmount}
                      onChange={(e) => setBetAmount(parseInt(e.target.value))}
                      disabled={isDealerTurn}
                    />
                  </div>
                  <div className="bet-toggle-btns">
                    <button
                      className="btn btn-confirm"
                      onClick={() => handlePlayerAction("raise")}
                      disabled={isDealerTurn}
                    >
                      확정
                    </button>
                    <button
                      className="btn btn-cancel"
                      onClick={() => setIsBetting(false)}
                      disabled={isDealerTurn}
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
                    disabled={loading || isDealerTurn}
                  >
                    Fold
                  </button>
                  <button
                    className="btn btn-check"
                    onClick={() => handlePlayerAction("check")}
                    disabled={loading || isDealerTurn}
                  >
                    Check
                  </button>
                  <button
                    className="btn btn-call"
                    onClick={() => handlePlayerAction("call")}
                    disabled={loading || isDealerTurn}
                  >
                    Call
                  </button>
                  <button
                    className="btn btn-raise"
                    onClick={() => setIsBetting(true)}
                    disabled={loading || isDealerTurn}
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
