from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from collections import Counter
import random

app = FastAPI()

# 1. 보안 설정 (CORS): 프론트엔드와 통신 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 카드 기본 데이터 정의
SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
RANK_MAP = {r: i for i, r in enumerate(RANKS, 2)}  # 숫자로 변환 (2=2, ..., A=14)


def create_deck():
    return [{"suit": s, "rank": r} for s in SUITS for r in RANKS]


# 3. 족보 판정 로직
def evaluate_hand(cards):
    # 1. 데이터 준비
    rank_values = sorted([RANK_MAP[c["rank"]] for c in cards], reverse=True)
    suits = [c["suit"] for c in cards]
    rank_counts = Counter(rank_values)
    suit_counts = Counter(suits)

    # 2. 플러시 체크 (같은 모양이 5개 이상)
    is_flush = any(count >= 5 for count in suit_counts.values())

    # 3. 스트레이트 체크 (연속된 숫자 5개 이상)
    unique_ranks = sorted(list(set(rank_values)), reverse=True)
    is_straight = False
    straight_high_card = 0

    # 일반적인 스트레이트 체크
    for i in range(len(unique_ranks) - 4):
        if unique_ranks[i] - unique_ranks[i + 4] == 4:
            is_straight = True
            straight_high_card = unique_ranks[i]
            break

    # 특수 케이스: Wheel (A, 2, 3, 4, 5) - A는 14이므로 별도 체크
    if {14, 2, 3, 4, 5}.issubset(set(unique_ranks)):
        is_straight = True
        straight_high_card = 5

    # 4. 족보 판정 (높은 순서대로)
    counts = sorted(rank_counts.values(), reverse=True)

    # 스트레이트 플러시 (로티플 포함)
    if is_straight and is_flush:
        # 사실 더 정밀하게는 '같은 모양으로 스트레이트인가'를 따져야 하지만
        # 구현의 편의상 일단 결합으로 표시합니다.
        if straight_high_card == 14:
            return "로열 스트레이트 플러시 (Royal Flush)"
        return "스트레이트 플러시 (Straight Flush)"

    if 4 in counts:
        return "포카드 (Four of a Kind)"

    if counts[0] == 3 and (len(counts) > 1 and counts[1] >= 2):
        return "풀하우스 (Full House)"

    if is_flush:
        return "플러시 (Flush)"

    if is_straight:
        return "스트레이트 (Straight)"

    if 3 in counts:
        return "트리플 (Three of a Kind)"

    if counts.count(2) >= 2:
        return "투페어 (Two Pair)"

    if 2 in counts:
        return "원페어 (One Pair)"

    return "하이카드 (High Card)"


# 4. API 엔드포인트 (게임 실행)
@app.get("/deal")
def deal_cards():
    deck = create_deck()
    random.shuffle(deck)

    # 플레이어 2장, 공통 카드 5장
    player_hand = [deck.pop(), deck.pop()]
    community_cards = [deck.pop() for _ in range(5)]

    # 전체 7장 합쳐서 족보 계산
    best_hand = evaluate_hand(player_hand + community_cards)

    return {
        "player_hand": player_hand,
        "community_cards": community_cards,
        "best_hand": best_hand,
    }
