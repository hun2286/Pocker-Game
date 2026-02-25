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

# 게임 상태 관리 (딜러 자산 및 배팅 단위 설정)
game_state = {
    "deck": [],
    "player_hand": [],
    "dealer_hand": [],
    "community_cards": [],
    "phase": "waiting",
    "player_money": 1000,
    "dealer_money": 1000,
    "pot": 0,
    "ante": 50,  # 시작 참가비
    "call_bet": 50,  # 단계별 추가 배팅액
}


@app.get("/start")
def start_game():
    # 양쪽 모두 참가비(Ante)가 있는지 확인
    if (
        game_state["player_money"] < game_state["ante"]
        or game_state["dealer_money"] < game_state["ante"]
    ):
        return {"error": "자금이 부족하여 게임을 시작할 수 없습니다!"}

    # 참가비 차감 (각 50원씩 총 100원 팟 형성)
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
def next_phase():
    phase = game_state["phase"]
    deck = game_state["deck"]

    # 쇼다운 이전 단계(flop, turn, river로 넘어갈 때)라면 추가 배팅 발생
    if phase in ["pre-flop", "flop", "turn"]:
        if (
            game_state["player_money"] < game_state["call_bet"]
            or game_state["dealer_money"] < game_state["call_bet"]
        ):
            # 돈이 모자라면 배팅 없이 카드만 오픈 (올인 상황 처리로 확장 가능)
            pass
        else:
            game_state["player_money"] -= game_state["call_bet"]
            game_state["dealer_money"] -= game_state["call_bet"]
            game_state["pot"] += game_state["call_bet"] * 2

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
        # 최종 결과 판정 및 정산
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
        }

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
    # 기권 시 현재까지 쌓인 판돈은 모두 딜러가 가져감
    game_state["dealer_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"

    return {
        "phase": "waiting",
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": 0,
    }
