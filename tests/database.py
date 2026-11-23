#!/usr/bin/env python3
"""Execute migration and verify critical database constraints using stdlib SQLite."""
import sqlite3
from pathlib import Path

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(Path("backend/migrations/0001_initial.sql").read_text())
def rejected(query, values=()):
    try:
        db.execute(query, values)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(f"Constraint failed to reject: {query}")

db.execute("INSERT INTO users(id,identity_provider,identity_subject) VALUES ('u1','auth','sub1')")
db.execute("INSERT INTO products(id,code,name) VALUES ('p1','margenpro','MargenPro')")
db.execute("""INSERT INTO orders(id,user_id,product_id,provider,provider_reference,amount_minor,currency)
 VALUES ('o1','u1','p1','mercadopago','ref1',1000,'ARS')""")
rejected("""INSERT INTO entitlements(id,user_id,product_id,order_id,status)
 VALUES ('e1','u1','p1','o1','active')""")
db.execute("UPDATE orders SET status='approved' WHERE id='o1'")
db.execute("""INSERT INTO entitlements(id,user_id,product_id,order_id,status)
 VALUES ('e1','u1','p1','o1','active')""")
rejected("INSERT INTO users(id,identity_provider,identity_subject) VALUES ('u2','auth','sub1')")
rejected("INSERT INTO orders(id,user_id,product_id,provider,amount_minor,currency) VALUES ('o2','missing','p1','mercadopago',100,'ARS')")
rejected("INSERT INTO orders(id,user_id,product_id,provider,amount_minor,currency) VALUES ('o2','u1','p1','mercadopago',0,'ARS')")
rejected("INSERT INTO orders(id,user_id,product_id,provider,amount_minor,currency,status) VALUES ('o2','u1','p1','mercadopago',100,'ARS','invalid')")
rejected("INSERT INTO entitlements(id,user_id,product_id,order_id,status) VALUES ('e2','u1','p1','o1','active')")
rejected("INSERT INTO entitlements(id,user_id,product_id,order_id,status) VALUES ('e2','u1','p1','o1','revoked')")
db.execute("INSERT INTO payment_events(id,provider,provider_event_id) VALUES ('ev1','mercadopago','evt1')")
rejected("INSERT INTO payment_events(id,provider,provider_event_id) VALUES ('ev2','mercadopago','evt1')")
db.execute("INSERT INTO payments(id,order_id,provider,provider_payment_id,status,verified_at) VALUES ('pay1','o1','mercadopago','mp1','approved','2026-01-01')")
rejected("INSERT INTO payments(id,order_id,provider,provider_payment_id,status,verified_at) VALUES ('pay2','o1','mercadopago','mp1','approved','2026-01-01')")
# A different account or product cannot claim a paid order.
db.execute("INSERT INTO users(id,identity_provider,identity_subject) VALUES ('u2','auth','sub2')")
db.execute("INSERT INTO products(id,code,name) VALUES ('p2','other','Other')")
db.execute("""INSERT INTO orders(id,user_id,product_id,provider,provider_reference,amount_minor,currency,status)
 VALUES ('o2','u1','p1','mercadopago','ref2',1000,'ARS','approved')""")
rejected("INSERT INTO entitlements(id,user_id,product_id,order_id,status) VALUES ('e2','u2','p1','o2','active')")
rejected("INSERT INTO entitlements(id,user_id,product_id,order_id,status) VALUES ('e2','u1','p2','o2','active')")
db.execute("INSERT INTO entitlements(id,user_id,product_id,order_id,status) VALUES ('e2','u1','p1','o2','active')")
rejected("UPDATE entitlements SET user_id='u2' WHERE id='e2'")
rejected("UPDATE entitlements SET product_id='p2' WHERE id='e2'")
rejected("UPDATE orders SET user_id='u2' WHERE id='o2'")
rejected("UPDATE orders SET product_id='p2' WHERE id='o2'")
db.execute("UPDATE orders SET status='pending' WHERE id='o2'")
assert db.execute("SELECT status FROM entitlements WHERE id='e2'").fetchone()[0] == 'revoked'

db.execute("UPDATE orders SET status='refunded' WHERE id='o1'")
assert db.execute("SELECT status FROM entitlements WHERE id='e1'").fetchone()[0] == 'revoked'
rejected("UPDATE entitlements SET status='active',revoked_at=NULL WHERE id='e1'")
print("Database schema and integrity checks passed.")
