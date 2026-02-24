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
    {"name": "원페어", "score": 2, "cards": [...]}
    """

    # 1. evaluator.py에서 계산해준 score(족보 등급)를 비교합니다.
    if player_res["score"] > dealer_res["score"]:
        return "player"
    elif dealer_res["score"] > player_res["score"]:
        return "dealer"

    # 2. 만약 족보 등급이 같다면? (예: 둘 다 원페어)
    else:
        # 현재는 족보가 같으면 비김(draw) 처리합니다.
        # (더 정교하게 하려면 여기서 하이카드를 비교해야 하지만, 우선 에러 해결이 먼저!)
        return "draw"
