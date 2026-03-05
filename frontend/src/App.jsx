import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const api = axios.create({ baseURL: "http://localhost:8000" });
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
    setLoading(true);
    setDealerMsg("");
    setIsDealerTurn(true);
    try {
      const res = await api.get("/start");
      const startData = res.data;
      console.log(`%c[SYSTEM] 게임 시작`, "color: #f1c40f; font-weight: bold;");

      setPhase(startData.phase);
      setGameData(startData);
      await sleep(1500);

      if (startData.dealer_button === "player") {
        setDealerMsg("...");
        await sleep(800);
        const action = startData.dealer_action || "CHECK";
        console.log(
          `%c[DEALER] 선공: ${action}`,
          "color: #ff7675; font-weight: bold;",
        );
        setDealerMsg(action);
        if (action === "RAISE") setGameData(startData);
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
    console.log(
      `%c[USER] 선택: ${actionType.toUpperCase()}`,
      "color: #55efc4; font-weight: bold;",
    );

    setDealerMsg("");
    setLoading(true);
    setIsDealerTurn(true);
    setIsBetting(false);

    try {
      const response = await api.get(
        `/next?action=${actionType === "auto" ? "check" : actionType}&bet=${betAmount}`,
      );
      const newData = response.data;

      if (newData.dealer_action === "FOLD") {
        console.log(
          "%c[DEALER] FOLD (유저 승리!)",
          "color: white; background: #c0392b; padding: 2px 5px;",
        );
        setDealerMsg("FOLD");
        await sleep(1000);
        setGameData(newData);
        setPhase("waiting");
        return;
      }

      const isShowdown = newData.phase === "showdown";
      const isPhaseChanged = newData.phase !== phase;

      await sleep(400);
      setGameData((prev) => ({
        ...prev,
        player_money: isShowdown ? prev.player_money : newData.player_money,
        current_bet: newData.current_bet,
      }));

      if (isPhaseChanged) {
        console.log(
          `%c[SYSTEM] 페이즈 전환: ${phase.toUpperCase()} -> ${newData.phase.toUpperCase()}`,
          "color: #f1c40f;",
        );
        if (isShowdown) {
          setIsShowdownPending(true);
          await sleep(600);
          setPhase("showdown");
          await sleep(1500);
          setGameData({ ...newData, pot: 0 });
          setIsShowdownPending(false);
        } else {
          setGameData((prev) => ({ ...prev, pot: newData.pot }));
          await sleep(600);
          setGameData(newData);
          setPhase(newData.phase);
          await sleep(1500); // 카드 딜링 대기

          if (newData.dealer_button === "player") {
            const nextAct =
              newData.dealer_action && newData.dealer_action.includes(" -> ")
                ? newData.dealer_action.split(" -> ")[1]
                : newData.dealer_action || "CHECK";

            setDealerMsg("...");
            await sleep(800);
            console.log(
              `%c[DEALER] 선공: ${nextAct}`,
              "color: #ff7675; font-weight: bold;",
            );
            setDealerMsg(nextAct);
            if (nextAct.includes("RAISE")) setGameData(newData);
          }
        }
      } else {
        // --- [동일 페이즈 딜러 대응] 유저 CHECK 시 딜러가 RAISE 하는 경우 등 ---
        await sleep(600);
        if (newData.dealer_action) {
          // 체이닝된 메시지 중 앞부분만 추출 (예: "RAISE -> CHECK" 인 경우 "RAISE")
          const responseAction = newData.dealer_action.split(" -> ")[0];

          setDealerMsg("...");
          await sleep(600);

          console.log(
            `%c[DEALER] 대응: ${responseAction}`,
            "color: #ff7675; font-weight: bold;",
          );
          setDealerMsg(responseAction);
          setGameData(newData);
          await sleep(1000);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDealerTurn(false);
      setLoading(false);
      // 메시지 초기화를 삭제하거나 시간을 넉넉히 주어 가독성 보장
      setTimeout(() => setDealerMsg(""), 3000);
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
      setIsDealerTurn(false);
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
          className={`section dealer-section ${phase === "showdown" && gameData?.winner === "dealer" ? "winner-border" : ""} ${dealerMsg === "FOLD" ? "folding" : ""}`}
        >
          <h2>Dealer Hand</h2>
          <div className="card-area-wrapper">
            <div className="dealer-action-aside left-aside">
              {gameData?.dealer_button === "dealer" && (
                <span className="d-button-puck">D</span>
              )}
              {dealerMsg && phase !== "showdown" && (
                <div
                  className={`dealer-bubble-side ${dealerMsg.toLowerCase().replace(/\s/g, "-")}`}
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
                  <div className="horizontal action-group">
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
