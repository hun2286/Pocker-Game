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

# 초기 자금 2000 설정
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
    **INITIAL_STATE,
}


@app.get("/start")
def start_game():
    if (
        game_state["player_money"] < game_state["ante"]
        or game_state["dealer_money"] < game_state["ante"]
    ):
        return {"error": "자금이 부족합니다!", "is_game_over": True}

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

    # 2. 딜러가 기권(FOLD)한 경우 즉시 정산
    if dealer_action == "FOLD":
        game_state["player_money"] += game_state["pot"]
        game_state["pot"] = 0
        game_state["phase"] = "waiting"
        return {
            "phase": "waiting",
            "dealer_action": "FOLD",
            "player_money": game_state["player_money"],
            "dealer_money": game_state["dealer_money"],
            "pot": 0,
            "is_game_over": game_state["dealer_money"] <= 0,
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

    # 4. 페이즈 전환 로직 (유저님의 룰 반영)
    if phase == "river":
        # 리버에서 배팅이 끝났으므로 결과 정산으로 진입
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

    # 현재 상태 반환
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
    }


def finish_and_showdown(dealer_action):
    p_final = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
    d_final = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
    winner = determine_winner(p_final, d_final)
    game_state["phase"] = "showdown"

    if winner == "player":
        game_state["player_money"] += game_state["pot"]
    elif winner == "dealer":
        game_state["dealer_money"] += game_state["pot"]
    elif winner == "draw":
        game_state["player_money"] += game_state["pot"] // 2
        game_state["dealer_money"] += game_state["pot"] // 2

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
        "is_game_over": game_state["player_money"] <= 0
        or game_state["dealer_money"] <= 0,
    }


@app.post("/fold")
def fold_game():
    game_state["dealer_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    return {
        "phase": "waiting",
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": 0,
        "is_game_over": game_state["player_money"] <= 0,
    }


@app.post("/reset")
def reset_game():
    game_state["player_money"] = 2000
    game_state["dealer_money"] = 2000
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    game_state["community_cards"] = []
    return {"message": "Game Reset Success"}
