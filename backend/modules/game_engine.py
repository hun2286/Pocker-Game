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


def determine_winner(player_best, dealer_best):
    p_score = HAND_RANKING.get(player_best, 0)
    d_score = HAND_RANKING.get(dealer_best, 0)

    if p_score > d_score:
        return "player"
    elif d_score > p_score:
        return "dealer"
    else:
        return "draw"
