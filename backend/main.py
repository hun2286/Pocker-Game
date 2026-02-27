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
    "current_bet": 0,
    "player_phase_bet": 0,
    "dealer_phase_bet": 0,
    **INITIAL_STATE,
}


def reset_phase_bets():
    """페이즈 전환 시 베팅 기록 초기화"""
    game_state["current_bet"] = 0
    game_state["player_phase_bet"] = 0
    game_state["dealer_phase_bet"] = 0


def get_common_response(dealer_action, p_res):
    """프론트엔드 응답 공통 포맷"""
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
        "current_bet": game_state["current_bet"],
        "player_phase_bet": game_state["player_phase_bet"],
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

    reset_phase_bets()

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
    if game_state["dealer_button"] == "player":
        d_res = evaluate_hand(game_state["dealer_hand"])
        if d_res.get("score", 0) > 0 or random.random() < 0.3:
            dealer_action = "RAISE"
            raise_amount = 50
            game_state["dealer_money"] -= raise_amount
            game_state["pot"] += raise_amount
            game_state["dealer_phase_bet"] = raise_amount
            game_state["current_bet"] = raise_amount
        else:
            dealer_action = "CHECK"

    p_res = evaluate_hand(game_state["player_hand"])
    return get_common_response(dealer_action, p_res)


@app.get("/next")
def next_phase(action: str = "call", bet: int = 0):
    phase = game_state["phase"]
    deck = game_state["deck"]

    # 1. 플레이어 베팅 정산
    player_needed = game_state["current_bet"] - game_state["player_phase_bet"]
    actual_player_bet = 0

    if action == "call":
        actual_player_bet = player_needed
    elif action == "raise":
        actual_player_bet = player_needed + bet
        game_state["current_bet"] += bet
    elif action == "check":
        actual_player_bet = 0

    if game_state["player_money"] < actual_player_bet:
        return {"error": "자금이 부족합니다!"}

    game_state["player_money"] -= actual_player_bet
    game_state["player_phase_bet"] += actual_player_bet
    game_state["pot"] += actual_player_bet

    # 2. 딜러 AI 의사결정 (핵심 로직 수정)
    dealer_action = "CHECK"

    if action == "call":
        # 유저가 Call을 하면 즉시 금액이 맞춰지므로 딜러는 반응 없이 라운드 종료
        dealer_action = "CALL"

    elif action == "raise":
        # 유저가 Raise를 했을 때만 딜러가 패를 보고 판단
        d_res = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
        hand_score = d_res.get("score", 0)

        # 폴드 조건 체크
        if (hand_score == 0 and bet >= 100 and random.random() < 0.6) or (
            hand_score == 1 and bet >= 300 and random.random() < 0.3
        ):
            return handle_dealer_fold()

        # 폴드 안 하면 유저 베팅에 맞춰서 CALL
        dealer_needed = game_state["current_bet"] - game_state["dealer_phase_bet"]
        game_state["dealer_money"] -= dealer_needed
        game_state["dealer_phase_bet"] += dealer_needed
        game_state["pot"] += dealer_needed
        dealer_action = "CALL"

    elif action == "check":
        # 유저가 체크를 한 경우 딜러도 체크 (이미 선공이 체크했거나 딜러가 선공인 상황)
        dealer_action = "CHECK"

    # 3. 페이즈 전환 로직
    # 베팅 금액이 맞춰진 상태이므로 다음 페이즈로 이동
    if phase == "river":
        return finish_and_showdown(dealer_action)

    reset_phase_bets()  # 라운드 데이터 초기화

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
    return get_common_response(dealer_action, p_res)


def handle_dealer_fold():
    game_state["player_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    game_state["dealer_button"] = "player"
    reset_phase_bets()
    return {
        "phase": "waiting",
        "dealer_action": "FOLD",
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": 0,
        "is_game_over": game_state["dealer_money"] <= 0,
        "dealer_button": "player",
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
    reset_phase_bets()

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
    reset_phase_bets()
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
    reset_phase_bets()
    return {"message": "Game Reset Success"}
