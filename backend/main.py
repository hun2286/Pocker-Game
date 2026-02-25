from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from modules.cards import create_deck
from modules.evaluator import evaluate_hand
from modules.game_engine import determine_winner

app = FastAPI()

# 1. CORS 설정: 프론트엔드와 통신 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 게임 상태 관리 (변수명 고정)
# player_money: 자산, pot: 판돈, bet_unit: 참가비
game_state = {
    "deck": [],
    "player_hand": [],
    "dealer_hand": [],
    "community_cards": [],
    "phase": "waiting",
    "player_money": 1000,
    "pot": 0,
    "bet_unit": 100,
}


@app.get("/start")
def start_game():
    # 자산 체크 및 참가비 차감
    if game_state["player_money"] < game_state["bet_unit"]:
        return {"error": "잔액이 부족합니다!"}

    game_state["player_money"] -= game_state["bet_unit"]
    game_state["pot"] = game_state["bet_unit"] * 2  # 딜러와 동일 베팅 가정

    # 덱 생성 및 카드 분배
    deck = create_deck()
    game_state["deck"] = deck
    game_state["player_hand"] = [deck.pop(), deck.pop()]
    game_state["dealer_hand"] = [deck.pop(), deck.pop()]
    game_state["community_cards"] = []
    game_state["phase"] = "pre-flop"

    # 현재 족보 계산
    p_res = evaluate_hand(game_state["player_hand"])

    # 응답 키값 통일: player_best_cards
    return {
        "phase": game_state["phase"],
        "player_hand": game_state["player_hand"],
        "community_cards": game_state["community_cards"],
        "player_best": p_res["name"],
        "player_best_cards": p_res["cards"],
        "player_money": game_state["player_money"],
        "pot": game_state["pot"],
    }


@app.get("/next")
def next_phase():
    phase = game_state["phase"]
    deck = game_state["deck"]

    # 단계별 카드 추가
    if phase == "pre-flop":
        game_state["community_cards"] += [deck.pop() for _ in range(3)]
        game_state["phase"] = "flop"
    elif phase == "flop":
        game_state["community_cards"].append(deck.pop())
        game_state["phase"] = "turn"
    elif phase == "turn":
        game_state["community_cards"].append(deck.pop())
        game_state["phase"] = "river"
    elif phase == "river":
        # 최종 쇼다운 판정
        p_res = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
        d_res = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
        winner = determine_winner(p_res, d_res)
        game_state["phase"] = "showdown"

        # 승패 정산
        if winner == "player":
            game_state["player_money"] += game_state["pot"]
        elif winner == "draw":
            game_state["player_money"] += game_state["pot"] // 2

        current_pot = game_state["pot"]
        game_state["pot"] = 0  # 정산 후 판돈 초기화

        return {
            "phase": "showdown",
            "community_cards": game_state["community_cards"],
            "player_hand": game_state["player_hand"],
            "dealer_hand": game_state["dealer_hand"],
            "winner": winner,
            "player_best": p_res["name"],
            "dealer_best": d_res["name"],
            "player_best_cards": p_res["cards"],
            "dealer_best_cards": d_res["cards"],
            "player_money": game_state["player_money"],
            "pot": current_pot,
        }

    # 중간 단계 응답
    p_res = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
    return {
        "phase": game_state["phase"],
        "community_cards": game_state["community_cards"],
        "player_hand": game_state["player_hand"],
        "player_best": p_res["name"],
        "player_best_cards": p_res["cards"],
        "player_money": game_state["player_money"],
        "pot": game_state["pot"],
    }


@app.post("/fold")
def fold_game():
    # 기권 시 즉시 대기 상태로 전환
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    return {
        "phase": "waiting",
        "player_money": game_state["player_money"],
        "pot": 0,
        "message": "기권하셨습니다.",
    }
