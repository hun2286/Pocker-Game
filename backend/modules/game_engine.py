# 최종 슬패 결정 로직

HAND_RANKING = {
    "로열 스트레이트 플러시 (Royal Flush)": 10,
    "스트레이트 플러시 (Straight Flush)": 9,
    "포카드 (Four of a Kind)": 8,
    "풀하우스 (Full House)": 7,
    "플러시 (Flush)": 6,
    "스트레이트 (Straight)": 5,
    "트리플 (Three of a Kind)": 4,
    "투페어 (Two Pair)": 3,
    "원페어 (One Pair)": 2,
    "하이카드 (High Card)": 1,
}


def determine_winner(player_res, dealer_res):
    # 1단계: 족보 점수 비교 (원페어 vs 트리플 등)
    if player_res["score"] > dealer_res["score"]:
        return "player"
    elif dealer_res["score"] > player_res["score"]:
        return "dealer"

    # 2단계: 족보가 같을 때 세부 점수(power) 비교 (키커 포함)
    else:
        if player_res["power"] > dealer_res["power"]:
            return "player"
        elif dealer_res["power"] > player_res["power"]:
            return "dealer"
        else:
            return "draw"  # 여기까지 같으면 정말 비긴 것
