import json, time
from flask import Flask, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://localhost:5173"}})

@app.route("/finance/forecast", methods=["GET"])
def forecast():
    return {}

if __name__ == "__main__":
    app.run(debug=True, port=5000)