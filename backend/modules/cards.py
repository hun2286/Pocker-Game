# 카드

import random

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]


def create_deck():
    deck = [{"suit": s, "rank": r} for s in SUITS for r in RANKS]

    random.shuffle(deck)

    return deck


def deal_initial_cards(deck):
    random.shuffle(deck)
    # 각각 2장씩 배분 및 커뮤니티 카드 5장
    player_hand = [deck.pop(), deck.pop()]
    dealer_hand = [deck.pop(), deck.pop()]
    community_cards = [deck.pop() for _ in range(5)]
    return player_hand, dealer_hand, community_cards
