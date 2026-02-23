from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from collections import Counter
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_MAP = {r: i for i, r in enumerate(RANKS, 2)}


def create_deck():
    return [{"suit": s, "rank": r} for s in SUITS for r in RANKS]


def evaluate_hand(cards):
    # 1. 기본 데이터 집계
    rank_values = sorted([RANK_MAP[c["rank"]] for c in cards], reverse=True)
    suit_counts = Counter([c["suit"] for c in cards])
    rank_counts = Counter(rank_values)

    # 2. 플러시 체크 (동일 모양 5장 이상)
    flush_suit = next((s for s, count in suit_counts.items() if count >= 5), None)

    # 3. 스트레이트 체크 로직 (함수화하여 재사용)
    def get_straight_high(ranks):
        unique_ranks = sorted(list(set(ranks)), reverse=True)
        # A(14)가 있다면 1로도 취급하여 리스트 끝에 추가
        if 14 in unique_ranks:
            unique_ranks.append(1)

        for i in range(len(unique_ranks) - 4):
            # 5개가 연속되는지 확인 (A-2-3-4-5는 5,4,3,2,1로 판정됨)
            if unique_ranks[i] - unique_ranks[i + 4] == 4:
                return unique_ranks[i]
        return None

    # 스트레이트 플러시 여부 확인
    if flush_suit:
        flush_cards_ranks = [
            RANK_MAP[c["rank"]] for c in cards if c["suit"] == flush_suit
        ]
        sf_high = get_straight_high(flush_cards_ranks)
        if sf_high:
            if sf_high == 14:
                return "로열 스트레이트 플러시 (Royal Flush)"
            return "스트레이트 플러시 (Straight Flush)"

    # 4. 일반 족보 판정 (높은 순서대로)
    counts = sorted(rank_counts.values(), reverse=True)

    # 포카드
    if 4 in counts:
        return "포카드 (Four of a Kind)"

    # 풀하우스 (3장 + 2장 이상)
    if counts[0] == 3 and (len(counts) > 1 and counts[1] >= 2):
        return "풀하우스 (Full House)"

    # 플러시
    if flush_suit:
        return "플러시 (Flush)"

    # 스트레이트
    straight_high = get_straight_high(rank_values)
    if straight_high:
        return "스트레이트 (Straight)"

    # 트리플
    if 3 in counts:
        return "트리플 (Three of a Kind)"

    # 투페어
    if counts.count(2) >= 2:
        return "투페어 (Two Pair)"

    # 원페어
    if 2 in counts:
        return "원페어 (One Pair)"

    # 하이카드
    return "하이카드 (High Card)"


@app.get("/deal")
def deal_cards():
    deck = create_deck()
    random.shuffle(deck)

    player_hand = [deck.pop(), deck.pop()]
    community_cards = [deck.pop() for _ in range(5)]
    best_hand = evaluate_hand(player_hand + community_cards)

    return {
        "player_hand": player_hand,
        "community_cards": community_cards,
        "best_hand": best_hand,
    }
