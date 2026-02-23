# 포커 족보

from collections import Counter

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_MAP = {r: i for i, r in enumerate(RANKS, 2)}


def evaluate_hand(cards):
    rank_values = sorted([RANK_MAP[c["rank"]] for c in cards], reverse=True)
    suit_counts = Counter([c["suit"] for c in cards])
    rank_counts = Counter(rank_values)

    flush_suit = next((s for s, count in suit_counts.items() if count >= 5), None)

    def get_straight_high(ranks):
        unique_ranks = sorted(list(set(ranks)), reverse=True)
        if 14 in unique_ranks:
            unique_ranks.append(1)
        for i in range(len(unique_ranks) - 4):
            if unique_ranks[i] - unique_ranks[i + 4] == 4:
                return unique_ranks[i]
        return None

    if flush_suit:
        flush_cards_ranks = [
            RANK_MAP[c["rank"]] for c in cards if c["suit"] == flush_suit
        ]
        sf_high = get_straight_high(flush_cards_ranks)
        if sf_high:
            if sf_high == 14:
                return "로열 스트레이트 플러시 (Royal Flush)"
            return "스트레이트 플러시 (Straight Flush)"

    counts = sorted(rank_counts.values(), reverse=True)
    if 4 in counts:
        return "포카드 (Four of a Kind)"
    if counts[0] == 3 and (len(counts) > 1 and counts[1] >= 2):
        return "풀하우스 (Full House)"
    if flush_suit:
        return "플러시 (Flush)"

    straight_high = get_straight_high(rank_values)
    if straight_high:
        return "스트레이트 (Straight)"
    if 3 in counts:
        return "트리플 (Three of a Kind)"
    if counts.count(2) >= 2:
        return "투페어 (Two Pair)"
    if 2 in counts:
        return "원페어 (One Pair)"

    return "하이카드 (High Card)"
