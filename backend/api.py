from flask import Flask, jsonify
from flask_cors import CORS
from finance_ml.forecasting import forecast_next_expense, forecast_next_income

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins":
            ["http://localhost:5173",
             "http://127.0.0.1:5173",
             "http://localhost:4173",
             "http://127.0.0.1:4173",
             "*"]
    }
})


@app.route("/api/finance/forecast-expense", methods=["GET"])
def forecast_expense():
    res = forecast_next_expense()
    return jsonify(res)

@app.route("/api/finance/forecast-income", methods=["GET"])
def forecast_income():
    res = forecast_next_income()
    return jsonify(res)
