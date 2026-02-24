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
    """
    player_res, dealer_res 예시:
    {"name": "원페어", "score": 2, "power": 14}
    """

    # 1. 족보의 등급(score)을 먼저 비교합니다 (예: 트리플 vs 원페어)
    if player_res["score"] > dealer_res["score"]:
        return "player"
    elif dealer_res["score"] > player_res["score"]:
        return "dealer"

    # 2. 만약 족보 등급이 같다면? (예: 둘 다 원페어)
    # 족보를 구성하는 가장 높은 숫자인 'power'를 비교합니다.
    else:
        if player_res["power"] > dealer_res["power"]:
            return "player"
        elif dealer_res["power"] > player_res["power"]:
            return "dealer"
        else:
            # 족보도 같고, 그 숫자의 힘도 같다면 무승부 (이후 '키커' 판정으로 확장 가능)
            return "draw"
