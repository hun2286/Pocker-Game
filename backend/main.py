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
    # [핵심] 베팅 추적을 위한 변수 추가
    "current_bet": 0,  # 이번 라운드(페이즈)에서 맞춰야 할 목표 금액
    "player_phase_bet": 0,  # 이번 라운드에 플레이어가 이미 지불한 금액
    "dealer_phase_bet": 0,  # 이번 라운드에 딜러가 이미 지불한 금액
    **INITIAL_STATE,
}


def reset_phase_bets():
    """페이즈 전환 시 베팅 기록 초기화"""
    game_state["current_bet"] = 0
    game_state["player_phase_bet"] = 0
    game_state["dealer_phase_bet"] = 0


def get_common_response(dealer_action, p_res):
    """프론트엔드 응답 공통 포맷 (카드 유지를 위해 항상 데이터 포함)"""
    return {
        "phase": game_state["phase"],
        "dealer_action": dealer_action,
        "community_cards": game_state["community_cards"],
        "player_hand": game_state["player_hand"],  # 카드 정보 누락 방지
        "player_best": p_res["name"],
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": game_state["pot"],
        "dealer_button": game_state["dealer_button"],
        "current_bet": game_state["current_bet"],  # 버튼 비활성화 제어용
        "player_phase_bet": game_state["player_phase_bet"],  # 버튼 비활성화 제어용
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

    # 1. 플레이어 베팅 정산 (상대 베팅액과의 차액 계산)
    player_needed = game_state["current_bet"] - game_state["player_phase_bet"]
    actual_player_bet = 0

    if action == "call":
        actual_player_bet = player_needed
    elif action == "raise":
        # 리레이즈 시: 콜 금액(player_needed) + 추가 베팅액(bet)
        actual_player_bet = player_needed + bet
        game_state["current_bet"] += bet
    elif action == "check":
        actual_player_bet = 0

    if game_state["player_money"] < actual_player_bet:
        return {"error": "자금이 부족합니다!"}

    game_state["player_money"] -= actual_player_bet
    game_state["player_phase_bet"] += actual_player_bet
    game_state["pot"] += actual_player_bet

    # 2. 딜러 AI 의사결정
    d_res = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
    hand_score = d_res.get("score", 0)
    dealer_action = "CALL"

    if action == "raise":
        # 폴드 조건
        if (hand_score == 0 and bet >= 100 and random.random() < 0.6) or (
            hand_score == 1 and bet >= 300 and random.random() < 0.3
        ):
            return handle_dealer_fold()

        # 콜 처리: 딜러도 유저가 올린 기준선(current_bet)을 맞춤
        dealer_needed = game_state["current_bet"] - game_state["dealer_phase_bet"]
        game_state["dealer_money"] -= dealer_needed
        game_state["dealer_phase_bet"] += dealer_needed
        game_state["pot"] += dealer_needed
        dealer_action = "CALL"
    elif action == "check":
        dealer_action = "CHECK"

    # 3. 페이즈 전환 로직
    if phase == "river":
        return finish_and_showdown(dealer_action)

    reset_phase_bets()  # 라운드 종료 시 초기화

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
