import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const api = axios.create({
  baseURL: "http://localhost:8000",
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("waiting");
  const [loading, setLoading] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [betAmount, setBetAmount] = useState(50);
  const [isBetting, setIsBetting] = useState(false);
  const [dealerMsg, setDealerMsg] = useState("");
  const [isDealerTurn, setIsDealerTurn] = useState(false);
  const [isFolding, setIsFolding] = useState(false);
  const [isShowdownPending, setIsShowdownPending] = useState(false);

  const callAmount = isDealerTurn
    ? 0
    : (gameData?.current_bet || 0) - (gameData?.player_phase_bet || 0);

  useEffect(() => {
    const initGame = async () => {
      try {
        await api.post("/reset");
      } catch (e) {
        console.error(e);
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
    console.log("[START] 게임 시작");
    setLoading(true);
    setDealerMsg("");
    setIsFolding(false);
    setIsShowdownPending(false);
    setIsGameOver(false);
    try {
      const res = await api.get("/start");
      setGameData(res.data);
      setPhase(res.data.phase);
      setBetAmount(50);
      setIsBetting(false);

      if (res.data.dealer_button === "player") {
        console.log("[TURN] 딜러 선공 결정");
        setIsDealerTurn(true);
        await sleep(1000);
        if (res.data.dealer_action) {
          setDealerMsg(res.data.dealer_action);
          await sleep(1500);
          setDealerMsg("");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDealerTurn(false);
      setLoading(false);
    }
  };

  const handlePlayerAction = async (actionType) => {
    if (isDealerTurn && actionType !== "auto") return;

    setDealerMsg("");
    setLoading(true);
    setIsDealerTurn(true);
    setIsBetting(false);

    try {
      const response = await api.get(
        `/next?action=${actionType === "auto" ? "check" : actionType}&bet=${betAmount}`,
      );
      const newData = response.data;

      if (newData.error) {
        alert(newData.error);
        setIsDealerTurn(false);
        setLoading(false);
        return;
      }

      const isShowdown = newData.phase === "showdown";
      const isPhaseChanged = newData.phase !== phase;

      // 1. 유저 액션 연출 (시간 단축: 600ms -> 400ms)
      if (actionType !== "auto") {
        await sleep(400);
        setGameData((prev) => ({
          ...prev,
          player_money: isShowdown ? prev.player_money : newData.player_money,
          player_phase_bet: newData.player_phase_bet,
          current_bet: newData.current_bet,
        }));
      }

      if (isPhaseChanged) {
        if (isShowdown) {
          // --- 쇼다운 연출 (긴장감 유지하되 소폭 단축) ---
          setIsShowdownPending(true);
          await sleep(400);
          if (newData.dealer_action) setDealerMsg(newData.dealer_action);
          setGameData((prev) => ({
            ...prev,
            dealer_money: newData.dealer_money,
            pot: newData.pot,
          }));
          await sleep(600);
          setPhase("showdown");
          await sleep(1200);
          setGameData({ ...newData, pot: 0 });
          setIsShowdownPending(false);
          setLoading(false);
          if (
            newData.is_game_over ||
            newData.dealer_money <= 0 ||
            newData.player_money <= 0
          ) {
            setTimeout(() => setIsGameOver(true), 1000);
          }
          return;
        } else {
          // --- 일반 페이즈 전환 (타이밍 대폭 최적화) ---
          let firstMsg = "";
          let secondMsg = "";
          if (newData.dealer_action && newData.dealer_action.includes(" -> ")) {
            const parts = newData.dealer_action.split(" -> ");
            firstMsg = parts[0];
            secondMsg = parts[1];
          } else {
            newData.dealer_button === "player"
              ? (secondMsg = newData.dealer_action)
              : (firstMsg = newData.dealer_action);
          }

          // 딜러 CALL 대응 (800ms -> 500ms)
          if (firstMsg && firstMsg.includes("CALL")) {
            setDealerMsg(firstMsg);
            await sleep(500);
          }

          // 칩 정산 및 카드 깔기 (600ms -> 400ms)
          setGameData((prev) => ({
            ...prev,
            dealer_money: newData.dealer_money,
            pot: newData.pot,
          }));
          await sleep(400);
          setPhase(newData.phase);
          setGameData(newData);

          // 카드 깔리는 애니메이션 확인 시간 (1200ms -> 800ms)
          await sleep(800);

          if (newData.player_money === 0 || newData.dealer_money === 0) {
            return handlePlayerAction("auto");
          }

          const isDealerFirst = newData.dealer_button === "player";
          if (isDealerFirst && secondMsg) {
            setDealerMsg(secondMsg);
            // 레이즈 시 칩 이동 연출 (600ms -> 400ms)
            if (secondMsg.includes("RAISE")) {
              setGameData((prev) => ({
                ...prev,
                pot: newData.pot,
                dealer_money: newData.dealer_money,
                current_bet: newData.current_bet,
                dealer_phase_bet: newData.dealer_phase_bet,
              }));
              await sleep(400);
            }
            // 메시지 가독 시간 (1500ms -> 1000ms)
            await sleep(1000);
          } else {
            // 유저 선공 시 불필요한 대기 제거
            await sleep(200);
          }
        }
      } else {
        // --- 동일 페이즈 내 공방 (1000ms -> 600ms) ---
        await sleep(600);
        if (newData.dealer_action) {
          setDealerMsg(newData.dealer_action);
          if (newData.dealer_action.includes("RAISE")) {
            setGameData((prev) => ({
              ...prev,
              pot: newData.pot,
              dealer_money: newData.dealer_money,
              current_bet: newData.current_bet,
              dealer_phase_bet: newData.dealer_phase_bet,
            }));
            await sleep(500);
          }
        }
        setGameData(newData);
        await sleep(600);
      }

      // 최종 활성화
      setIsDealerTurn(false);
      setLoading(false);
      setTimeout(() => setDealerMsg(""), 1500); // 메시지 삭제 시간도 단축
    } catch (e) {
      console.error("[ERROR] ", e);
      setIsDealerTurn(false);
      setLoading(false);
    }
  };

  const handleFold = async () => {
    if (isDealerTurn) return;
    setIsFolding(true);
    setLoading(true);
    setDealerMsg("");
    try {
      await sleep(600);
      const res = await api.post("/fold");
      setGameData(res.data);
      setPhase(res.data.phase);
      setIsBetting(false);
      setIsFolding(false);
      if (res.data.is_game_over) setTimeout(() => setIsGameOver(true), 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFullReset = async () => {
    try {
      await api.post("/reset");
      window.location.reload();
    } catch (e) {
      console.error(e);
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

      <div className="controls">
        {!isGameOver &&
        (phase === "waiting" ||
          (phase === "showdown" && !isShowdownPending)) ? (
          <button
            className="btn btn-start luxury"
            onClick={handleStartGame}
            disabled={loading}
          >
            {phase === "showdown" ? "Next Game ($-50)" : "Start Game ($-50)"}
          </button>
        ) : (
          !isGameOver &&
          !isShowdownPending && (
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
                          gameData?.player_money || 0,
                          gameData?.dealer_money || 0,
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
          )
        )}
      </div>

      {isGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-content">
            <h1 className="luxury-text">
              {gameData?.player_money <= 0 ? "GAME OVER" : "CHAMPION!"}
            </h1>
            <div className="final-stats">
              최종 자산: <span>${gameData?.player_money}</span>
            </div>
            <button className="btn btn-start luxury" onClick={handleFullReset}>
              다시 시작하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
