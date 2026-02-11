from waitress import serve
import os
from api import app

if __name__ == "__main__":
    if os.getenv("APP_ENV") == "production":
        serve(app, host="127.0.0.1", port=5000, threads=4)
    else:
        app.run(debug=True, port=5000, host="127.0.0.1")
