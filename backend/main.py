from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from modules.cards import create_deck
from modules.evaluator import evaluate_hand
from modules.game_engine import determine_winner
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 초기 자금 및 설정
INITIAL_STATE = {
    "player_money": 2000,
    "dealer_money": 2000,
    "ante": 50,
}

game_state = {
    "deck": [],
    "player_hand": [],
    "dealer_hand": [],
    "community_cards": [],
    "phase": "waiting",
    "pot": 0,
    "dealer_button": None,  # 누가 딜러 버튼(마지막 차례)을 가졌는가? ('player' or 'dealer')
    **INITIAL_STATE,
}


@app.get("/start")
def start_game():
    if (
        game_state["player_money"] < game_state["ante"]
        or game_state["dealer_money"] < game_state["ante"]
    ):
        return {"error": "자금이 부족합니다!", "is_game_over": True}

    # 첫 판인 경우 랜덤으로 딜러 버튼 결정
    if game_state["dealer_button"] is None:
        game_state["dealer_button"] = random.choice(["player", "dealer"])

    game_state["player_money"] -= game_state["ante"]
    game_state["dealer_money"] -= game_state["ante"]
    game_state["pot"] = game_state["ante"] * 2

    deck = create_deck()
    game_state["deck"] = deck
    game_state["player_hand"] = [deck.pop(), deck.pop()]
    game_state["dealer_hand"] = [deck.pop(), deck.pop()]
    game_state["community_cards"] = []
    game_state["phase"] = "pre-flop"

    p_res = evaluate_hand(game_state["player_hand"])
    return {
        "phase": game_state["phase"],
        "player_hand": game_state["player_hand"],
        "community_cards": game_state["community_cards"],
        "player_best": p_res["name"],
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": game_state["pot"],
        "dealer_button": game_state["dealer_button"],  # 누가 버튼인지 알려줌
    }


@app.get("/next")
def next_phase(action: str = "call", bet: int = 50):
    phase = game_state["phase"]
    deck = game_state["deck"]

    # 1. 딜러 AI 의사결정 로직
    d_res = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
    hand_score = d_res.get("score", 0)

    dealer_action = "CALL"
    if action == "raise":
        if hand_score == 0 and bet >= 100:
            if random.random() < 0.6:
                dealer_action = "FOLD"
        elif hand_score == 1 and bet >= 300:
            if random.random() < 0.3:
                dealer_action = "FOLD"
    elif action == "check":
        dealer_action = "CHECK"

    # 2. 딜러가 기권(FOLD)한 경우 즉시 정산 (승자인 플레이어가 다음 판 버튼 획득)
    if dealer_action == "FOLD":
        game_state["player_money"] += game_state["pot"]
        game_state["pot"] = 0
        game_state["phase"] = "waiting"
        game_state["dealer_button"] = "player"  # 승자가 버튼 획득
        return {
            "phase": "waiting",
            "dealer_action": "FOLD",
            "player_money": game_state["player_money"],
            "dealer_money": game_state["dealer_money"],
            "pot": 0,
            "is_game_over": game_state["dealer_money"] <= 0,
            "dealer_button": "player",
        }

    # 3. 배팅 금액 처리
    actual_bet = bet if action != "check" else 0
    if (
        game_state["player_money"] < actual_bet
        or game_state["dealer_money"] < actual_bet
    ):
        return {"error": "자금이 부족하여 배팅을 완료할 수 없습니다!"}

    game_state["player_money"] -= actual_bet
    game_state["dealer_money"] -= actual_bet
    game_state["pot"] += actual_bet * 2

    # 4. 페이즈 전환 로직
    if phase == "river":
        return finish_and_showdown(dealer_action)

    if phase == "pre-flop":
        game_state["community_cards"] += [deck.pop() for _ in range(3)]
        game_state["phase"] = "flop"
    elif phase == "flop":
        game_state["community_cards"].append(deck.pop())
        game_state["phase"] = "turn"
    elif phase == "turn":
        game_state["community_cards"].append(deck.pop())
        game_state["phase"] = "river"

    p_res = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
    return {
        "phase": game_state["phase"],
        "dealer_action": dealer_action,
        "community_cards": game_state["community_cards"],
        "player_hand": game_state["player_hand"],
        "player_best": p_res["name"],
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": game_state["pot"],
        "dealer_button": game_state["dealer_button"],
    }


def finish_and_showdown(dealer_action):
    p_final = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
    d_final = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
    winner = determine_winner(p_final, d_final)
    game_state["phase"] = "showdown"

    if winner == "player":
        game_state["player_money"] += game_state["pot"]
        game_state["dealer_button"] = "player"  # 플레이어가 이기면 다음 판 딜러 버튼
    elif winner == "dealer":
        game_state["dealer_money"] += game_state["pot"]
        game_state["dealer_button"] = "dealer"  # 딜러가 이기면 다음 판 딜러 버튼
    elif winner == "draw":
        game_state["player_money"] += game_state["pot"] // 2
        game_state["dealer_money"] += game_state["pot"] // 2
        # 무승부 시 기존 딜러 버튼 소유자 유지 (변경 없음)

    current_pot = game_state["pot"]
    game_state["pot"] = 0

    return {
        "phase": "showdown",
        "dealer_action": dealer_action,
        "community_cards": game_state["community_cards"],
        "player_hand": game_state["player_hand"],
        "dealer_hand": game_state["dealer_hand"],
        "winner": winner,
        "player_best": p_final["name"],
        "dealer_best": d_final["name"],
        "player_best_cards": p_final["cards"],
        "dealer_best_cards": d_final["cards"],
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": current_pot,
        "dealer_button": game_state["dealer_button"],
        "is_game_over": game_state["player_money"] <= 0
        or game_state["dealer_money"] <= 0,
    }


@app.post("/fold")
def fold_game():
    game_state["dealer_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    game_state["dealer_button"] = (
        "dealer"  # 폴드하면 상대방(딜러)이 승자이므로 버튼 가져감
    )
    return {
        "phase": "waiting",
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": 0,
        "dealer_button": "dealer",
        "is_game_over": game_state["player_money"] <= 0,
    }


@app.post("/reset")
def reset_game():
    game_state["player_money"] = 2000
    game_state["dealer_money"] = 2000
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    game_state["community_cards"] = []
    game_state["dealer_button"] = None  # 리셋 시 다시 랜덤으로 정하도록 초기화
    return {"message": "Game Reset Success"}
