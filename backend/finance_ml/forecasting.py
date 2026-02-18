from collections import Counter
from datetime import datetime

from .db import get_transactions, convert_transactions_to_dict
from .random_forest import (
    build_datasets,
    RandomForestClassifier,
    RandomForestRegressor,
    ID_TO_COARSE,
    CATEGORY_TO_ID
)

EXPENSE_CATEGORIES = [
    'Groceries', 'Dining', 'Entertainment', 'Travel',
    'Merchandise', 'Other', 'Other Services', 'Rent'
]

INCOME_CATEGORIES = [
    'Salary', 'Allowance', 'Stocks', 'Interest & Dividends',
    'Reimbursements', 'Gifts', 'Sales'
]

ID_TO_CATEGORY = {i: category for category, i in CATEGORY_TO_ID.items()}
# minimum required rows to train models
MIN_REQ_TRANSACTIONS = 10

def load_rows() -> list[dict]:
    rows_tuples = get_transactions()
    return convert_transactions_to_dict(rows_tuples)

def row_by_type_tuple(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    separated_rows = {
        "expense": [],
        "income": []
    }
    for r in rows:
        separated_rows[r['type']].append(r)
    return separated_rows["expense"], separated_rows["income"]


# train separate model for expense classification and regression
def train_expense_models(rows: list[dict]) -> dict:
    (X_exp_clf, y_exp_clf, X_exp_reg, y_exp_reg,
    _, _, _, _) = build_datasets(rows)

    models: dict = {
        "exp_clf": train_rf_finance_model(RandomForestClassifier, X_exp_clf, y_exp_clf),
        "exp_reg": train_rf_finance_model(RandomForestRegressor, X_exp_reg, y_exp_reg),
    }
    return models

# train separate model for income classification and regression
def train_income_models(rows: list[dict]) -> dict:
    (_, _, _, _,
     X_inc_clf, y_inc_clf, X_inc_reg, y_inc_reg) = build_datasets(rows)

    models: dict = {
        "inc_clf": train_rf_finance_model(RandomForestClassifier, X_inc_clf, y_inc_clf),
        "inc_reg": train_rf_finance_model(RandomForestRegressor, X_inc_reg, y_inc_reg),
    }
    return models

def train_rf_finance_model(model, X, y):
    if len(X) >= MIN_REQ_TRANSACTIONS:
        m = model()
        m.fit(X, y)
        return m
    return None

def _default_future_features_for_type(tr_type: str, rows: list[dict]) -> dict:
    # feature vector for the next transaction of a given type
    # uses current date and typical amount for that type.
    today = datetime.today()
    dow = today.weekday()
    dom = today.day
    month = today.month
    is_weekend = int(dow >= 5)
    is_month_start = int(dom <= 3)
    is_month_end = int(dom >= 28)

    # calculate median amount per type from history
    amounts = [float(r["amount"]) for r in rows if r["type"] == tr_type]
    if amounts:
        sorted_amounts = sorted(amounts)
        mid = len(sorted_amounts) // 2
        if len(sorted_amounts) % 2 == 1:
            typical_amount = sorted_amounts[mid]
        else:
            typical_amount = 0.5 * (sorted_amounts[mid - 1] + sorted_amounts[mid])
    else:
        typical_amount = 0.0

    return {
        "dow": dow,
        "dom": dom,
        "month": month,
        "is_weekend": is_weekend,
        "is_month_start": is_month_start,
        "is_month_end": is_month_end,
        "amount": typical_amount,
    }


def forecast_next_for_type(tr_type: str, models: dict, rows: list[dict]) -> dict:
    tr_type = tr_type.lower()
    # forecast next coarse category and amount for a given type of expense or income
    feats = _default_future_features_for_type(tr_type, rows)
    dow = feats["dow"]
    month = feats["month"]
    amount = feats["amount"]
    is_weekend = feats["is_weekend"]
    is_month_start = feats["is_month_start"]
    is_month_end = feats["is_month_end"]

    # expense
    if tr_type == "expense":
        clf: RandomForestClassifier = models.get("exp_clf")
        reg: RandomForestRegressor = models.get("exp_reg")
        if clf is None or reg is None:
            return {}

        # classifier features
        x_clf = [dow, month, amount, is_weekend, is_month_start, is_month_end]
        coarse_id = clf.predict([x_clf])[0]
        coarse_label = ID_TO_COARSE[coarse_id]

        # pick a fine category inside coarse bucket for regression
        fine_counts = Counter()
        for r in rows:
            if r["type"] != "expense":
                continue
            # find coarse to match build_datasets
            category = r["category"]
            if category not in CATEGORY_TO_ID:
                continue
            fine_counts[category] += 1

        if fine_counts:
            main_fine = fine_counts.most_common(1)[0][0]
        else:
            main_fine = None

        if main_fine is not None:
            fine_id = CATEGORY_TO_ID[main_fine]
        else:
            # use 0 if nothing
            fine_id = 0

        x_reg = [dow, month, is_weekend, is_month_start, fine_id]
        amount_pred = reg.predict([x_reg])[0]

        return {
            "type": "expense",
            "coarse_category": coarse_label,
            "amount": amount_pred,
        }

    # income
    else:
        clf: RandomForestClassifier = models.get("inc_clf")
        reg: RandomForestRegressor = models.get("inc_reg")
        if clf is None or reg is None:
            return {}

        x_clf = [dow, month, amount, is_weekend, is_month_start, is_month_end]
        coarse_id = clf.predict([x_clf])[0]
        coarse_label = ID_TO_COARSE[coarse_id]

        fine_counts = Counter()
        for r in rows:
            if r["type"] != "income":
                continue
            category = r["category"]
            if category not in CATEGORY_TO_ID:
                continue
            fine_counts[category] += 1

        if fine_counts:
            main_fine = fine_counts.most_common(1)[0][0]
        else:
            main_fine = None

        if main_fine is not None:
            fine_id = CATEGORY_TO_ID[main_fine]
        else:
            fine_id = 0

        x_reg = [dow, month, is_weekend, is_month_start, fine_id]
        amount_pred = reg.predict([x_reg])[0]

        return {
            "type": "income",
            "coarse_category": coarse_label,
            "amount": amount_pred,
        }

def forecast_next(rows: list[dict], sep_rows: list[dict], models: dict, tr_type: str) -> dict:
    res = {
        "success": False,
        "n_transactions": len(sep_rows),
        "pred": {}
    }

    if len(rows) < MIN_REQ_TRANSACTIONS:
        return res

    forecast = forecast_next_for_type(tr_type, models, rows)
    res["success"] = True
    res["pred"] = forecast

    return res

def forecast_next_expense() -> dict:
    # load db, train models, get forecasts
    rows = load_rows()
    expense_rows, _ = row_by_type_tuple(rows)
    models = train_expense_models(rows)
    return forecast_next(rows, expense_rows, models, "expense")

def forecast_next_income() -> dict:
    # load db, train models, get forecasts
    rows = load_rows()
    _, income_rows = row_by_type_tuple(rows)
    models = train_income_models(rows)
    return forecast_next(rows, income_rows, models, "income")
