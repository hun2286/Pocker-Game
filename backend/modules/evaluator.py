# 포커 족보

from collections import Counter

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_MAP = {r: i for i, r in enumerate(RANKS, 2)}


def evaluate_hand(cards):
    rank_values = sorted([RANK_MAP[c["rank"]] for c in cards], reverse=True)
    suit_counts = Counter([c["suit"] for c in cards])
    rank_counts = Counter(rank_values)

    # 1. 플러시 확인
    flush_suit = next((s for s, count in suit_counts.items() if count >= 5), None)

    # 2. 스트레이트 확인용 함수
    def get_straight_high(ranks):
        unique_ranks = sorted(list(set(ranks)), reverse=True)
        if 14 in unique_ranks:
            unique_ranks.append(1)
        for i in range(len(unique_ranks) - 4):
            if unique_ranks[i] - unique_ranks[i + 4] == 4:
                return unique_ranks[i]
        return None

    # 3. 족보 판정 (높은 순서대로)

    # 3-1. 스트레이트 플러시 계열
    if flush_suit:
        flush_cards_ranks = [
            RANK_MAP[c["rank"]] for c in cards if c["suit"] == flush_suit
        ]
        sf_high = get_straight_high(flush_cards_ranks)
        if sf_high:
            if sf_high == 14:
                return {
                    "name": "로열 스트레이트 플러시 (Royal Flush)",
                    "score": 10,
                    "power": 14,
                }
            return {
                "name": "스트레이트 플러시 (Straight Flush)",
                "score": 9,
                "power": sf_high,
            }

    # 3-2. 포카드 (Four of a Kind)
    if 4 in rank_counts.values():
        four_rank = max([r for r, c in rank_counts.items() if c == 4])
        return {"name": "포카드 (Four of a Kind)", "score": 8, "power": four_rank}

    # 3-3. 풀하우스 (Full House)
    counts = sorted(rank_counts.values(), reverse=True)
    if counts[0] == 3 and (len(counts) > 1 and counts[1] >= 2):
        three_rank = max([r for r, c in rank_counts.items() if c == 3])
        return {"name": "풀하우스 (Full House)", "score": 7, "power": three_rank}

    # 3-4. 플러시 (Flush)
    if flush_suit:
        flush_high = max(
            [RANK_MAP[c["rank"]] for c in cards if c["suit"] == flush_suit]
        )
        return {"name": "플러시 (Flush)", "score": 6, "power": flush_high}

    # 3-5. 스트레이트 (Straight)
    straight_high = get_straight_high(rank_values)
    if straight_high:
        return {"name": "스트레이트 (Straight)", "score": 5, "power": straight_high}

    # 3-6. 트리플 (Three of a Kind)
    if 3 in rank_counts.values():
        three_rank = max([r for r, c in rank_counts.items() if c == 3])
        return {"name": "트리플 (Three of a Kind)", "score": 4, "power": three_rank}

    # 3-7. 투페어 (Two Pair)
    if list(rank_counts.values()).count(2) >= 2:
        pairs = sorted([r for r, c in rank_counts.items() if c == 2], reverse=True)
        return {
            "name": "투페어 (Two Pair)",
            "score": 3,
            "power": pairs[0],
        }  # 더 높은 페어의 숫자

    # 3-8. 원페어 (One Pair)
    if 2 in rank_counts.values():
        pair_rank = max([r for r, c in rank_counts.items() if c == 2])
        return {"name": "원페어 (One Pair)", "score": 2, "power": pair_rank}

    # 3-9. 하이카드 (High Card)
    return {"name": "하이카드 (High Card)", "score": 1, "power": rank_values[0]}
