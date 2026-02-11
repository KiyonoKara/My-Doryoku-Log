from flask import Flask, jsonify
from flask_cors import CORS
from finance_ml.forecasting import forecast_next

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/finance/forecast", methods=["GET"])
def forecast():
    res = forecast_next()
    return jsonify(res)

# if __name__ == "__main__":
#     if os.environ.get("APP_ENV") == "production":
#         serve(app, host=" 127.0.0.1", port=5000)
#     else:
#         app.run(debug=True, port=5000)
