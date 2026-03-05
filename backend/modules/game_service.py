import random
from modules.cards import create_deck
from modules.evaluator import evaluate_hand
from modules.game_engine import determine_winner

# 초기 게임 설정값
INITIAL_STATE = {
    "player_money": 2000,
    "dealer_money": 2000,
    "ante": 50,
}

# 실시간 게임 상태 관리 객체
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
    """각 페이즈(Flop, Turn 등)가 시작될 때 베팅 기록 초기화"""
    game_state["current_bet"] = 0
    game_state["player_phase_bet"] = 0
    game_state["dealer_phase_bet"] = 0


def decide_dealer_action(current_cards):
    """
    딜러의 패 강도에 따른 확률적 의사결정 함수
    - 트리플 이상(score >= 3): 80% 확률로 RAISE
    - 투페어/원페어(score >= 1): 40% 확률로 RAISE
    - 하이카드: 15% 확률로 블러핑 RAISE
    """
    res = evaluate_hand(current_cards)
    score = res.get("score", 0)

    if score >= 3:
        return "RAISE" if random.random() < 0.8 else "CHECK"
    if score >= 1:
        return "RAISE" if random.random() < 0.4 else "CHECK"
    return "RAISE" if random.random() < 0.15 else "CHECK"


def get_common_response(dealer_action, p_res):
    """프론트엔드로 전달할 공통 응답 객체 생성"""
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


def start_game_logic():
    """새로운 게임 라운드 시작"""
    if (
        game_state["player_money"] < game_state["ante"]
        or game_state["dealer_money"] < game_state["ante"]
    ):
        return {"error": "자금이 부족합니다!", "is_game_over": True}

    # 딜러 버튼 결정 (최초 1회)
    if game_state["dealer_button"] is None:
        game_state["dealer_button"] = random.choice(["player", "dealer"])

    reset_phase_bets()

    # 안티(Ante) 지불 및 팟 생성
    game_state["player_money"] -= game_state["ante"]
    game_state["dealer_money"] -= game_state["ante"]
    game_state["pot"] = game_state["ante"] * 2

    # 카드 분배
    deck = create_deck()
    game_state["deck"] = deck
    game_state["player_hand"] = [deck.pop(), deck.pop()]
    game_state["dealer_hand"] = [deck.pop(), deck.pop()]
    game_state["community_cards"] = []
    game_state["phase"] = "pre-flop"

    # 딜러 선공일 경우 액션 결정
    dealer_action = ""
    if game_state["dealer_button"] == "player":
        dealer_action = decide_dealer_action(game_state["dealer_hand"])
        if dealer_action == "RAISE" and game_state["dealer_money"] >= 50:
            raise_amount = 50
            game_state["dealer_money"] -= raise_amount
            game_state["pot"] += raise_amount
            game_state["dealer_phase_bet"] = raise_amount
            game_state["current_bet"] = raise_amount
        else:
            dealer_action = "CHECK"

    p_res = evaluate_hand(game_state["player_hand"])
    return get_common_response(dealer_action, p_res)


def next_phase_logic(action, bet):
    """플레이어 액션에 따른 게임 진행 및 페이즈 전환"""
    curr_phase = game_state["phase"]
    deck = game_state["deck"]

    # 1. 플레이어 베팅 정산
    p_needed = game_state["current_bet"] - game_state["player_phase_bet"]
    actual_p_bet = (
        p_needed if action == "call" else (p_needed + bet if action == "raise" else 0)
    )

    if action == "raise":
        game_state["current_bet"] += bet

    if game_state["player_money"] < actual_p_bet:
        return {"error": "자금이 부족합니다!"}

    game_state["player_money"] -= actual_p_bet
    game_state["player_phase_bet"] += actual_p_bet
    game_state["pot"] += actual_p_bet

    # 2. 딜러 반응 및 폴드 로직
    dealer_msg = ""
    should_proceed = False

    if action == "call":
        dealer_msg = "CALL"
        should_proceed = True
    elif action == "check":
        if game_state["dealer_button"] == "player":  # 유저가 버튼이면 딜러가 후공
            should_proceed = True
        else:  # 딜러가 버튼이면 유저 체크 시 딜러가 대응
            dealer_msg = decide_dealer_action(
                game_state["dealer_hand"] + game_state["community_cards"]
            )
            if dealer_msg == "RAISE":
                r_amt = 50
                game_state["dealer_money"] -= r_amt
                game_state["dealer_phase_bet"] = r_amt
                game_state["current_bet"] = r_amt
                game_state["pot"] += r_amt
                should_proceed = False
            else:
                dealer_msg = "CHECK"
                should_proceed = True
    elif action == "raise":
        d_res = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
        score = d_res.get("score", 0)

        # 고도화된 폴드 로직 (딜러가 불리할 때 폴드 확률)
        if score == 0 and bet >= 100 and random.random() < 0.6:
            return handle_dealer_fold()

        # 딜러가 따라갈 경우
        d_needed = game_state["current_bet"] - game_state["dealer_phase_bet"]
        actual_d_call = min(d_needed, game_state["dealer_money"])
        game_state["dealer_money"] -= actual_d_call
        game_state["dealer_phase_bet"] += actual_d_call
        game_state["pot"] += actual_d_call
        dealer_msg = "CALL"
        should_proceed = True

    # 3. 페이즈 전환 로직
    if should_proceed:
        if curr_phase == "river":
            return finish_and_showdown(dealer_msg)

        reset_phase_bets()

        # 커뮤니티 카드 오픈
        if curr_phase == "pre-flop":
            game_state["community_cards"] += [deck.pop() for _ in range(3)]
            game_state["phase"] = "flop"
        elif curr_phase in ["flop", "turn"]:
            game_state["community_cards"].append(deck.pop())
            game_state["phase"] = "turn" if curr_phase == "flop" else "river"

        # 다음 페이즈 선공 결정 (딜러가 선공일 경우)
        if game_state["dealer_button"] == "player":
            next_action = decide_dealer_action(
                game_state["dealer_hand"] + game_state["community_cards"]
            )
            if next_action == "RAISE":
                r_amt = min(50, game_state["dealer_money"])
                game_state["dealer_money"] -= r_amt
                game_state["dealer_phase_bet"] = r_amt
                game_state["current_bet"] = r_amt
                game_state["pot"] += r_amt
            else:
                next_action = "CHECK"
            # 메시지 체이닝 (예: "CALL -> CHECK")
            dealer_msg = f"{dealer_msg} -> {next_action}" if dealer_msg else next_action

    p_final_res = evaluate_hand(
        game_state["player_hand"] + game_state["community_cards"]
    )
    return get_common_response(dealer_msg, p_final_res)


def handle_dealer_fold():
    """딜러가 기권했을 때 정산 로직"""
    game_state["player_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    reset_phase_bets()
    return {
        "phase": "waiting",
        "dealer_action": "FOLD",
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": 0,
        "is_game_over": game_state["dealer_money"] <= 0,
    }


def finish_and_showdown(dealer_action):
    """리버 종료 후 승자 판정 및 칩 정산"""
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
        "is_game_over": game_state["player_money"] <= 0
        or game_state["dealer_money"] <= 0,
    }


def fold_game_logic():
    """플레이어가 기권했을 때 정산 로직"""
    game_state["dealer_money"] += game_state["pot"]
    game_state["pot"] = 0
    game_state["phase"] = "waiting"
    reset_phase_bets()
    return {
        "phase": "waiting",
        "player_money": game_state["player_money"],
        "dealer_money": game_state["dealer_money"],
        "pot": 0,
        "is_game_over": game_state["player_money"] <= 0,
    }


def reset_game_logic():
    """게임을 초기 자본금 상태로 리셋"""
    global game_state
    game_state.update(
        {
            "player_money": 2000,
            "dealer_money": 2000,
            "pot": 0,
            "phase": "waiting",
            "community_cards": [],
            "dealer_button": None,
        }
    )
    reset_phase_bets()
    return {"message": "Game Reset Success"}
