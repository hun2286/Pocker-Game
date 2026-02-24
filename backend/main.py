from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from modules.cards import create_deck
from modules.evaluator import evaluate_hand
from modules.game_engine import determine_winner

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

game_state = {
    "deck": [],
    "player_hand": [],
    "dealer_hand": [],
    "community_cards": [],
    "phase": "waiting",
}


@app.get("/start")
def start_game():
    deck = create_deck()
    game_state["deck"] = deck
    game_state["player_hand"] = [deck.pop(), deck.pop()]
    game_state["dealer_hand"] = [deck.pop(), deck.pop()]
    game_state["community_cards"] = []
    game_state["phase"] = "pre-flop"

    p_res = evaluate_hand(game_state["player_hand"])
    return {
        "phase": game_state["phase"],
        "player_hand": game_state["player_hand"],
        "community_cards": game_state["community_cards"],
        "player_best": p_res["name"],
        "player_best_cards": p_res["cards"],
    }


@app.get("/next")
def next_phase():
    phase = game_state["phase"]
    deck = game_state["deck"]

    if phase == "pre-flop":
        game_state["community_cards"] += [deck.pop() for _ in range(3)]
        game_state["phase"] = "flop"
    elif phase == "flop":
        game_state["community_cards"].append(deck.pop())
        game_state["phase"] = "turn"
    elif phase == "turn":
        game_state["community_cards"].append(deck.pop())
        game_state["phase"] = "river"
    elif phase == "river":
        p_res = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
        d_res = evaluate_hand(game_state["dealer_hand"] + game_state["community_cards"])
        winner = determine_winner(p_res, d_res)
        game_state["phase"] = "showdown"
        return {
            "phase": "showdown",
            "community_cards": game_state["community_cards"],
            "player_hand": game_state["player_hand"],
            "dealer_hand": game_state["dealer_hand"],
            "winner": winner,
            "player_best": p_res["name"],
            "dealer_best": d_res["name"],
            "player_best_cards": p_res["cards"],
            "dealer_best_cards": d_res["cards"],
        }

    p_res = evaluate_hand(game_state["player_hand"] + game_state["community_cards"])
    return {
        "phase": game_state["phase"],
        "community_cards": game_state["community_cards"],
        "player_hand": game_state["player_hand"],
        "player_best": p_res["name"],
        "player_best_cards": p_res["cards"],
    }
