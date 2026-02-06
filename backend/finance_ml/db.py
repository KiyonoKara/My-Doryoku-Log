import sqlite3
import os

# get local.db from app root
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
DB_PATH = os.path.join(project_root, 'local.db')

# connect to db
con = sqlite3.connect(DB_PATH, check_same_thread=False)

def get_transactions() -> list[tuple]:
    """
    Gets all transactions from database
    :return: List of tuples of transactions
    """
    cur = con.cursor()
    tr = cur.execute("SELECT * FROM transactions")
    columns = tr.fetchall()
    cur.close()
    return columns

def convert_transactions_to_dict(transactions) -> list[dict]:
    """
    Transactions from the SQLite transactions table
    :param transactions:
    :return: List of dictionaries
    """
    data = []
    for transaction in transactions:
        vals = {'id': transaction[0], 'date': transaction[1], 'amount': transaction[2],
                'category': transaction[3], 'type': transaction[4],
                'description': transaction[5]}
        data.append(vals)
    return data