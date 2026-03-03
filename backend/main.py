from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from modules import game_service

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/start")
def start_game():
    return game_service.start_game_logic()


@app.get("/next")
def next_phase(action: str = "call", bet: int = 0):
    return game_service.next_phase_logic(action, bet)


@app.post("/fold")
def fold_game():
    return game_service.fold_game_logic()


@app.post("/reset")
def reset_game():
    return game_service.reset_game_logic()
