# 포커 족보

from collections import Counter

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_MAP = {r: i for i, r in enumerate(RANKS, 2)}


def evaluate_hand(cards):
    # 계산의 편의를 위해 카드 객체에 숫자 가치(value)를 미리 추가
    for c in cards:
        c["value"] = RANK_MAP[c["rank"]]

    # 숫자 순서대로 정렬
    sorted_cards = sorted(cards, key=lambda x: x["value"], reverse=True)
    rank_values = [c["value"] for c in sorted_cards]
    suit_counts = Counter([c["suit"] for c in cards])
    rank_counts = Counter(rank_values)

    # 1. 플러시 확인
    flush_suit = next((s for s, count in suit_counts.items() if count >= 5), None)

    # 2. 스트레이트 확인용 함수 (해당하는 카드 객체 5장을 반환)
    def get_straight_cards(target_cards):
        unique_cards = []
        seen_ranks = set()
        for c in sorted(target_cards, key=lambda x: x["value"], reverse=True):
            if c["value"] not in seen_ranks:
                unique_cards.append(c)
                seen_ranks.add(c["value"])

        # Ace-Low (A, 2, 3, 4, 5) 처리를 위해 Ace 복사본 추가
        ace_card = next((c for c in unique_cards if c["value"] == 14), None)
        if ace_card:
            low_ace = ace_card.copy()
            low_ace["value"] = 1
            unique_cards.append(low_ace)

        for i in range(len(unique_cards) - 4):
            if unique_cards[i]["value"] - unique_cards[i + 4]["value"] == 4:
                return unique_cards[i : i + 5]
        return None

    # 3. 족보 판정 시작

    # 3-1. 스트레이트 플러시
    if flush_suit:
        f_cards = [c for c in cards if c["suit"] == flush_suit]
        sf_cards = get_straight_cards(f_cards)
        if sf_cards:
            is_royal = any(c["value"] == 14 for c in sf_cards) and any(
                c["value"] == 10 for c in sf_cards
            )
            return {
                "name": "로열 스트레이트 플러시" if is_royal else "스트레이트 플러시",
                "score": 10 if is_royal else 9,
                "cards": sf_cards[:5],
                "power": sf_cards[0]["value"],  # 가장 높은 숫자
            }

    # 3-2. 포카드
    for r, count in rank_counts.items():
        if count == 4:
            four_kind = [c for c in cards if c["value"] == r]
            return {
                "name": "포카드",
                "score": 8,
                "cards": four_kind,
                "power": r,
            }

    # 3-3. 풀하우스
    three_rank = [r for r, count in rank_counts.items() if count == 3]
    pair_rank = [r for r, count in rank_counts.items() if count >= 2]
    if three_rank and len(pair_rank) > 1:
        t_rank = max(three_rank)
        p_rank = max([r for r in pair_rank if r != t_rank])
        best_cards = [c for c in cards if c["value"] == t_rank] + [
            c for c in cards if c["value"] == p_rank
        ][:2]
        return {
            "name": "풀하우스",
            "score": 7,
            "cards": best_cards,
            "power": t_rank,
        }

    # 3-4. 플러시
    if flush_suit:
        f_cards = sorted(
            [c for c in cards if c["suit"] == flush_suit],
            key=lambda x: x["value"],
            reverse=True,
        )
        return {
            "name": "플러시",
            "score": 6,
            "cards": f_cards[:5],
            "power": f_cards[0]["value"],
        }

    # 3-5. 스트레이트
    st_cards = get_straight_cards(cards)
    if st_cards:
        return {
            "name": "스트레이트",
            "score": 5,
            "cards": st_cards,
            "power": st_cards[0]["value"],
        }

    # 3-6. 트리플
    if 3 in rank_counts.values():
        t_rank = max([r for r, count in rank_counts.items() if count == 3])
        return {
            "name": "트리플",
            "score": 4,
            "cards": [c for c in cards if c["value"] == t_rank],
            "power": t_rank,
        }

    # 3-7. 투페어
    pairs = sorted([r for r, count in rank_counts.items() if count == 2], reverse=True)
    if len(pairs) >= 2:
        best_cards = [c for c in cards if c["value"] in pairs[:2]]
        return {
            "name": "투페어",
            "score": 3,
            "cards": best_cards,
            "power": pairs[0],
        }

    # 3-8. 원페어
    if 2 in rank_counts.values():
        p_rank = max([r for r, count in rank_counts.items() if count == 2])
        return {
            "name": "원페어",
            "score": 2,
            "cards": [c for c in cards if c["value"] == p_rank],
            "power": p_rank,
        }

    # 3-9. 하이카드
    return {
        "name": "하이카드",
        "score": 1,
        "cards": [sorted_cards[0]],
        "power": sorted_cards[0]["value"],
    }
