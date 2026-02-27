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
    "dealer_button": None,
    **INITIAL_STATE,
}


@app.get("/start")
def start_game():
    if (
        game_state["player_money"] < game_state["ante"]
        or game_state["dealer_money"] < game_state["ante"]
    ):
        return {"error": "자금이 부족합니다!", "is_game_over": True}

    if game_state["dealer_button"] is None:
        game_state["dealer_button"] = random.choice(["player", "dealer"])

    # 안테 지불
    game_state["player_money"] -= game_state["ante"]
    game_state["dealer_money"] -= game_state["ante"]
    game_state["pot"] = game_state["ante"] * 2

    deck = create_deck()
    game_state["deck"] = deck
    game_state["player_hand"] = [deck.pop(), deck.pop()]
    game_state["dealer_hand"] = [deck.pop(), deck.pop()]
    game_state["community_cards"] = []
    game_state["phase"] = "pre-flop"

    dealer_action = None

    # [추가] 유저가 버튼(Ⓓ)이면 딜러가 선공(First Actor)
    if game_state["dealer_button"] == "player":
        d_res = evaluate_hand(game_state["dealer_hand"])
        # 프리플랍 점수 기반 간단한 AI (예: 높은 카드나 페어면 Raise)
        if d_res.get("score", 0) > 0 or random.random() < 0.3:
            dealer_action = "RAISE"
            raise_amount = 50  # 딜러의 선제 공격 금액
            game_state["dealer_money"] -= raise_amount
            game_state["pot"] += raise_amount
            # 참고: 이 시점엔 플레이어가 대응(Call/Fold)해야 하므로 플레이어 돈은 아직 안 뺌
        else:
            dealer_action = "CHECK"

    p_res = evaluate_hand(game_state["player_hand"])
    return {
        "phase": game_state["phase"],
        "player_hand": game_state["player_hand"],
        "community_cards": game_state["community_cards"],
        "player_best": p_res["name"],
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": game_state["pot"],
        "dealer_button": game_state["dealer_button"],
        "dealer_action": dealer_action,  # 프론트엔드에 딜러의 첫 수 전달
    }


@app.get("/next")
def next_phase(action: str = "call", bet: int = 50):
    phase = game_state["phase"]
    deck = game_state["deck"]

    # 1. 딜러 AI 의사결정 로직 (유저의 액션에 대한 반응)
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

    if dealer_action == "FOLD":
        game_state["player_money"] += game_state["pot"]
        game_state["pot"] = 0
        game_state["phase"] = "waiting"
        game_state["dealer_button"] = "player"
        return {
            "phase": "waiting",
            "dealer_action": "FOLD",
            "player_money": game_state["player_money"],
            "dealer_money": game_state["dealer_money"],
            "pot": 0,
            "is_game_over": game_state["dealer_money"] <= 0,
            "dealer_button": "player",
        }

    # 2. 배팅 금액 정산
    # 유저가 Call/Raise 하면 그만큼 돈을 빼고 팟에 추가
    actual_bet = bet if action != "check" else 0

    # 딜러가 먼저 Raise 한 상태에서 유저가 Call 하면 차액만큼만 처리하는 등
    # 여기서는 단순화를 위해 입력받은 bet만큼 처리하도록 유지합니다.
    if game_state["player_money"] < actual_bet:
        return {"error": "자금이 부족합니다!"}

    game_state["player_money"] -= actual_bet
    # 딜러는 AI 로직에서 이미 돈을 뺏거나 CALL 상황에서 맞춰줌
    if dealer_action != "CHECK":
        game_state["dealer_money"] -= actual_bet
        game_state["pot"] += actual_bet * 2
    elif action == "check" and dealer_action == "CHECK":
        pass  # 둘 다 체크면 팟 변동 없음

    # 3. 페이즈 전환
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
        game_state["dealer_button"] = "player"
    elif winner == "dealer":
        game_state["dealer_money"] += game_state["pot"]
        game_state["dealer_button"] = "dealer"
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
        "dealer_button": game_state["dealer_button"],
        "is_game_over": game_state["player_money"] <= 0
        or game_state["dealer_money"] <= 0,
    }


@app.post("/fold")
def fold_game():
    game_state["dealer_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    game_state["dealer_button"] = "dealer"
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
    game_state["dealer_button"] = None
    return {"message": "Game Reset Success"}
