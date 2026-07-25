import sqlite3

conn = sqlite3.connect('budget.db')
cur = conn.cursor()

rows_before = cur.execute("SELECT id, name FROM budget_items WHERE name IN ('מקווה גברים', 'מקווה נשים') ORDER BY id").fetchall()
print('before:', rows_before)

cur.execute("""
UPDATE budget_items
SET name = CASE
    WHEN name = 'מקווה גברים' THEN 'מקווה 1'
    WHEN name = 'מקווה נשים' THEN 'מקווה 2'
    ELSE name
END
WHERE name IN ('מקווה גברים', 'מקווה נשים')
""")
conn.commit()
rows_after = cur.execute("SELECT id, name FROM budget_items WHERE name IN ('מקווה 1', 'מקווה 2', 'מקווה גברים', 'מקווה נשים') ORDER BY id").fetchall()
print('after:', rows_after)
conn.close()
