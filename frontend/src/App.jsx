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

  // 1. 게임 시작 시 (Pre-flop 딜러 선공 딜레이 조절)
  const handleStartGame = async () => {
    setLoading(true);
    setDealerMsg("");
    try {
      const response = await api.get("/start");
      if (response.data.error) {
        alert(response.data.error);
        setLoading(false);
      } else {
        // [1단계] 즉시 실행: 카드와 돈, 판돈 정보를 화면에 바로 뿌립니다.
        setGameData(response.data);
        setPhase(response.data.phase);
        setBetAmount(50);
        setIsBetting(false);

        // [2단계] 조건부 딜레이: 유저가 D일 때만 딜러가 고민하는 연출을 줍니다.
        if (response.data.dealer_button === "player") {
          setIsDealerTurn(true); // 버튼 잠금
          setDealerMsg("Thinking..."); // 고민 중 메시지 즉시 표시

          setTimeout(() => {
            // 서버에서 이미 받아온 dealer_action이 있다면 1.5초 뒤에 공개
            if (response.data.dealer_action) {
              setDealerMsg(response.data.dealer_action);
            }
            setIsDealerTurn(false); // 유저 버튼 활성화
            setLoading(false); // 전체 로딩 해제
          }, 1500);
        } else {
          // 딜러가 D라면 딜레이 없이 바로 유저 턴
          setIsDealerTurn(false);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("시작 실패:", error);
      setLoading(false);
    }
  };

  // 2. 게임 도중 (유저 액션 후 딜러 반응 및 페이즈 전환 딜레이)
  const handlePlayerAction = async (actionType) => {
    if (isDealerTurn) return;
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
        // 1. 첫 번째 딜레이 (1.5초): 딜러가 고민하다가 액션을 결정함
        setTimeout(() => {
          // [수정] 자산 데이터와 딜러 메시지만 먼저 업데이트
          setGameData({
            ...gameData,
            player_money: response.data.player_money,
            dealer_money: response.data.dealer_money,
            pot: response.data.pot,
          });

          if (response.data.dealer_action) {
            setDealerMsg(response.data.dealer_action);
          }

          // 만약 쇼다운(결과) 페이즈라면, 메시지 확인을 위해 1초 더 기다림
          if (response.data.phase === "showdown") {
            setTimeout(() => {
              setGameData(response.data); // 여기서 비로소 딜러 패와 승자 정보 업데이트
              setPhase(response.data.phase);

              // 파산 창은 패 공개 후 다시 4초 뒤에 출력
              if (response.data.is_game_over) {
                setTimeout(() => setIsGameOver(true), 2500);
              }
              setLoading(false);
            }, 1000); // [핵심] 딜러 메시지 출력 후 1초 대기
          } else {
            // 쇼다운이 아닌 일반 페이즈 전환은 바로 진행
            setGameData(response.data);
            setPhase(response.data.phase);
            setIsBetting(false);
            setIsDealerTurn(false);
            setLoading(false);
          }
        }, 1000); // 딜러 고민 딜레이
      }
    } catch (error) {
      console.error("액션 실패:", error);
      setDealerMsg("Error");
      setIsDealerTurn(false);
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
            {phase === "showdown" ? "Next Game ($-50)" : "Start Game ($-50)"}
          </button>
        ) : (
          <div className="action-area">
            {/* isDealerTurn이 false가 되어야 disabled-ui가 제거됨 */}
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
