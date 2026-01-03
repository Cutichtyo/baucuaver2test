import os, json, random
from collections import Counter
from flask import Flask, render_template, request, session, jsonify
from supabase import create_client
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

sb = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

with open(os.path.join(BASE_DIR, "config.json"), encoding="utf-8") as f:
    config = json.load(f)

animals = config["animals"]
animal_keys = list(animals.keys())
weights = [animals[a]["weight"] for a in animal_keys]

app = Flask(__name__)
app.secret_key = "bau_cua_2026_final"

@app.route("/")
def index():
    lb = sb.table("users").select("name,money").order("money", desc=True).execute().data
    return render_template("index.html", animals=animals, leaderboard=lb)

@app.route("/set-user", methods=["POST"])
def set_user():
    name = request.json.get("name", "").strip()
    if not name:
        return jsonify({"error": "Tên không hợp lệ"})

    res = sb.table("users").select("*").eq("name", name).execute()
    if not res.data:
        sb.table("users").insert({
            "name": name,
            "money": config["game"]["start_money"],
            "turns": config["game"]["max_turns"],
            "lixi_left": 5
        }).execute()
        res = sb.table("users").select("*").eq("name", name).execute()

    session["user"] = name
    return jsonify(res.data[0])

@app.route("/play", methods=["POST"])
def play():
    if "user" not in session:
        return jsonify({"error": "Chưa chọn người chơi"})

    user = sb.table("users").select("*").eq("name", session["user"]).single().execute().data
    bets = request.json
    total = sum(bets.values())

    if total <= 0 or total % config["game"]["bet_unit"] != 0:
        return jsonify({"error": "Cược không hợp lệ"})
    if user["money"] < total:
        return jsonify({"error": "Không đủ tiền"})
    if user["turns"] <= 0:
        return jsonify({"error": "Hết lượt chơi"})

    money = user["money"] - total
    turns = user["turns"] - 1
    lixi = user["lixi_left"]

    result = random.choices(animal_keys, weights=weights, k=3)
    count = Counter(result)
    win = 0

    for a, c in count.items():
        bet = bets.get(a, 0)
        cfg = animals[a]

        if a == "bau" and bet > 0:
            turns += c
        if a == "ca" and bet > 0:
            lixi += c

        if a == "tom" and bet > 0:
            if c == 2:
                win += bet * cfg["double_multiplier"]
            elif c == 3:
                win += bet * cfg["triple_multiplier"]
            else:
                win += bet
            continue

        win += bet * c * cfg.get("multiplier", 1)

    if "ga" in count and bets.get("ga", 0) > 0:
        for a, c in count.items():
            if a != "ga":
                win += bets.get(a, 0) * c

    money += win

    sb.table("users").update({
        "money": money,
        "turns": turns,
        "lixi_left": lixi
    }).eq("name", session["user"]).execute()

    lb = sb.table("users").select("name,money").order("money", desc=True).execute().data

    return jsonify({
        "result": result,
        "money": money,
        "turns": turns,
        "lixi_left": lixi,
        "win": win,
        "leaderboard": lb,
        "animation": config["animation"],
        "big_win_threshold": config["game"]["big_win_threshold"]
    })

@app.route("/lixi", methods=["POST"])
def lixi():
    if "user" not in session:
        return jsonify({"error": "Chưa chọn người chơi"})

    user = sb.table("users").select("*").eq("name", session["user"]).single().execute().data
    if user["lixi_left"] <= 0:
        return jsonify({"error": "Không còn lượt lì xì"})

    amount = random.randint(
        config["game"]["lixi_min"],
        config["game"]["lixi_max"]
    )

    sb.table("users").update({
        "money": user["money"] + amount,
        "lixi_left": user["lixi_left"] - 1
    }).eq("name", session["user"]).execute()

    lb = sb.table("users").select("name,money").order("money", desc=True).execute().data
    return jsonify({"lixi": amount, "leaderboard": lb})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
