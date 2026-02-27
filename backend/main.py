from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from modules.cards import create_deck
from modules.evaluator import evaluate_hand
from modules.game_engine import determine_winner

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. 게임의 '태초 상태'를 상수로 보관 (리셋 시 사용)
INITIAL_STATE = {
    "player_money": 1000,
    "dealer_money": 1000,
    "ante": 50,
    "call_bet": 50,
}

# 2. 실시간 게임 상태
game_state = {
    "deck": [],
    "player_hand": [],
    "dealer_hand": [],
    "community_cards": [],
    "phase": "waiting",
    "pot": 0,
    **INITIAL_STATE,  # 초기값 언패킹
}


@app.get("/start")
def start_game():
    # 시작 전 자금 체크 (파산 상태면 시작 불가)
    if (
        game_state["player_money"] < game_state["ante"]
        or game_state["dealer_money"] < game_state["ante"]
    ):
        return {
            "error": "자금이 부족하여 게임을 시작할 수 없습니다!",
            "is_game_over": True,
        }

    # 참가비 차감
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
        "player_best_cards": p_res["cards"],
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": game_state["pot"],
    }


@app.get("/next")
def next_phase(action: str = "call", bet: int = 50):
    phase = game_state["phase"]
    deck = game_state["deck"]

    # 1. 액션별 배팅 처리 로직
    if action == "fold":
        # 폴드는 현재까지의 판돈을 모두 상대(딜러)에게 줍니다.
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

    elif action == "check":
        # 체크는 판돈 변화 없이 다음 카드로 넘어갑니다.
        pass

    elif action in ["call", "raise"]:
        # 유저가 배팅한 금액(bet)만큼 플레이어와 딜러 자금을 차감하고 판돈에 넣습니다.
        # (현재는 딜러 AI가 없으므로 유저의 배팅을 딜러가 무조건 따라오는 'Call' 구조입니다.)
        if game_state["player_money"] < bet or game_state["dealer_money"] < bet:
            return {"error": "자금이 부족하여 배팅을 완료할 수 없습니다!"}

        game_state["player_money"] -= bet
        game_state["dealer_money"] -= bet
        game_state["pot"] += bet * 2

    # 2. 페이즈 전환 및 카드 오픈 로직 (기존과 동일)
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
        # 결과 정산 (Showdown)
        p_res = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
        d_res = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
        winner = determine_winner(p_res, d_res)
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
        is_game_over = (
            game_state["player_money"] <= 0 or game_state["dealer_money"] <= 0
        )

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
            "dealer_money": game_state["dealer_money"],
            "pot": current_pot,
            "is_game_over": is_game_over,
        }

    # 현재 페이즈 정보 반환
    p_res = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
    return {
        "phase": game_state["phase"],
        "community_cards": game_state["community_cards"],
        "player_hand": game_state["player_hand"],
        "player_best": p_res["name"],
        "player_best_cards": p_res["cards"],
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": game_state["pot"],
    }


@app.post("/fold")
def fold_game():
    game_state["dealer_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"

    # 폴드 직후에도 파산 여부 체크 (플레이어 돈이 0일 수 있음)
    is_game_over = game_state["player_money"] <= 0 or game_state["dealer_money"] <= 0

    return {
        "phase": "waiting",
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": 0,
        "is_game_over": is_game_over,
    }


# 파산 시 모든 자금을 1000으로 리셋하는 API
@app.post("/reset")
def reset_game():
    game_state["player_money"] = 1000
    game_state["dealer_money"] = 1000
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    game_state["community_cards"] = []
    return {"message": "Game Reset Success", "player_money": 1000, "dealer_money": 1000}


# 테스트용: 자금을 강제로 0원으로 만드는 API (확인 후 삭제 권장)
# @app.post("/test/bankrupt")
# def test_bankrupt(target: str = "player"):
#     """
#     target이 'player'면 플레이어 파산, 'dealer'면 딜러 파산
#     """
#     if target == "player":
#         game_state["player_money"] = 0
#     else:
#         game_state["dealer_money"] = 0

#     return {
#         "message": f"Test: {target} is now bankrupt",
#         "player_money": game_state["player_money"],
#         "dealer_money": game_state["dealer_money"],
#         "is_game_over": True,
#     }
