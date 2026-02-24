# 카드 족보

from collections import Counter

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_MAP = {r: i for i, r in enumerate(RANKS, 2)}


def evaluate_hand(cards):
    for c in cards:
        c["value"] = RANK_MAP[c["rank"]]

    sorted_cards = sorted(cards, key=lambda x: x["value"], reverse=True)
    rank_values = [c["value"] for c in sorted_cards]
    rank_counts = Counter(rank_values)
    suit_counts = Counter([c["suit"] for c in cards])
    flush_suit = next((s for s, count in suit_counts.items() if count >= 5), None)

    def get_kickers(main_cards, count):
        main_keys = [(c["rank"], c["suit"]) for c in main_cards]
        kickers = []
        for c in sorted_cards:
            if (c["rank"], c["suit"]) not in main_keys:
                kickers.append(c)
            if len(kickers) == count:
                break
        return kickers

    def get_straight_cards(target_cards):
        unique_cards = []
        seen_ranks = set()
        for c in sorted(target_cards, key=lambda x: x["value"], reverse=True):
            if c["value"] not in seen_ranks:
                unique_cards.append(c)
                seen_ranks.add(c["value"])
        ace_card = next((c for c in unique_cards if c["value"] == 14), None)
        if ace_card:
            low_ace = ace_card.copy()
            low_ace["value"] = 1
            unique_cards.append(low_ace)
        for i in range(len(unique_cards) - 4):
            if unique_cards[i]["value"] - unique_cards[i + 4]["value"] == 4:
                return unique_cards[i : i + 5]
        return None

    # --- 족보 판정 시작 ---

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
                "main_cards": sf_cards[:5],
                "kickers": [],
                "power": sf_cards[0]["value"],
            }

    # 3-2. 포카드
    for r, count in rank_counts.items():
        if count == 4:
            main_cards = [c for c in cards if c["value"] == r]
            kickers = get_kickers(main_cards, 1)
            return {
                "name": "포카드",
                "score": 8,
                "main_cards": main_cards,
                "kickers": kickers,
                "power": r * 100 + (kickers[0]["value"] if kickers else 0),
            }

    # 3-3. 풀하우스
    three_rank = [r for r, count in rank_counts.items() if count == 3]
    pair_rank = [r for r, count in rank_counts.items() if count >= 2]
    if three_rank and len(pair_rank) > 1:
        t_rank = max(three_rank)
        p_rank = max([r for r in pair_rank if r != t_rank])
        main_cards = [c for c in cards if c["value"] == t_rank] + [
            c for c in cards if c["value"] == p_rank
        ][:2]
        return {
            "name": "풀하우스",
            "score": 7,
            "main_cards": main_cards,
            "kickers": [],
            "power": t_rank * 100 + p_rank,
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
            "main_cards": f_cards[:5],
            "kickers": [],
            "power": sum(c["value"] for c in f_cards[:5]),
        }

    # 3-5. 스트레이트
    st_cards = get_straight_cards(cards)
    if st_cards:
        return {
            "name": "스트레이트",
            "score": 5,
            "main_cards": st_cards,
            "kickers": [],
            "power": st_cards[0]["value"],
        }

    # 3-6. 트리플
    if 3 in rank_counts.values():
        t_rank = max([r for r, count in rank_counts.items() if count == 3])
        main_cards = [c for c in cards if c["value"] == t_rank]
        kickers = get_kickers(main_cards, 2)
        return {
            "name": "트리플",
            "score": 4,
            "main_cards": main_cards,
            "kickers": kickers,
            "power": t_rank * 10000 + (kickers[0]["value"] * 100) + kickers[1]["value"],
        }

    # 3-7. 투페어
    pairs = sorted([r for r, count in rank_counts.items() if count == 2], reverse=True)
    if len(pairs) >= 2:
        main_cards = [c for c in cards if c["value"] in pairs[:2]]
        kickers = get_kickers(main_cards, 1)
        return {
            "name": "투페어",
            "score": 3,
            "main_cards": main_cards,
            "kickers": kickers,
            "power": pairs[0] * 10000 + pairs[1] * 100 + kickers[0]["value"],
        }

    # 3-8. 원페어
    if 2 in rank_counts.values():
        p_rank = max([r for r, count in rank_counts.items() if count == 2])
        main_cards = [c for c in cards if c["value"] == p_rank]
        kickers = get_kickers(main_cards, 3)
        return {
            "name": "원페어",
            "score": 2,
            "main_cards": main_cards,
            "kickers": kickers,
            "power": p_rank * 1000000
            + (kickers[0]["value"] * 10000)
            + (kickers[1]["value"] * 100)
            + kickers[2]["value"],
        }

    # 3-9. 하이카드
    return {
        "name": "하이카드",
        "score": 1,
        "main_cards": [sorted_cards[0]],  # 하이카드는 가장 높은 1장만 메인
        "kickers": sorted_cards[1:5],  # 나머지는 키커
        "power": sum(c["value"] for c in sorted_cards[:5]),
    }
