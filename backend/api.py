from flask import Flask, jsonify
from flask_cors import CORS
from finance_ml.forecasting import forecast_next

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


@app.route("/api/finance/forecast", methods=["GET"])
def forecast():
    res = forecast_next()
    return jsonify(res)

# if __name__ == "__main__":
#     if os.environ.get("APP_ENV") == "production":
#         serve(app, host=" 127.0.0.1", port=5000)
#     else:
#         app.run(debug=True, port=5000)
