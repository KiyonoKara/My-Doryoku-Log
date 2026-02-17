from waitress import serve
import os
from api import app

if __name__ == "__main__":
    port = 5000
    if os.getenv("APP_ENV") == "production":
        print(f"Running production server of {app.name} on port", port)
        serve(app, host="127.0.0.1", port=port, threads=4)
    else:
        print(f"Running dev server of {app.name} on port", port)
        app.run(debug=True, port=port, host="127.0.0.1")
