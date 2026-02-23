from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from modules.cards import create_deck, deal_initial_cards
from modules.evaluator import evaluate_hand
from modules.game_engine import determine_winner

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/deal")
def deal_cards():
    deck = create_deck()
    # 카드 배분 (modules/cards.py 활용)
    player_hand, dealer_hand, community_cards = deal_initial_cards(deck)

    # 족보 판정 (modules/evaluator.py 활용)
    player_best = evaluate_hand(player_hand + community_cards)
    dealer_best = evaluate_hand(dealer_hand + community_cards)

    # 승패 판정 (modules/game_engine.py 활용)
    winner = determine_winner(player_best, dealer_best)

    return {
        "player_hand": player_hand,
        "dealer_hand": dealer_hand,
        "community_cards": community_cards,
        "player_best": player_best,
        "dealer_best": dealer_best,
        "winner": winner,
    }
