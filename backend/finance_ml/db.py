import sqlite3

con = sqlite3.connect('../../local.db')
cur = con.cursor()

tr = cur.execute("SELECT * FROM transactions")

def get_transactions():
    return tr.fetchall()