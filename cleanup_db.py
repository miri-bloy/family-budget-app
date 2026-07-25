import sqlite3

conn = sqlite3.connect('budget.db')
cur = conn.cursor()

print('Starting budget.db cleanup')
cur.execute('PRAGMA foreign_keys = OFF')
cur.execute('BEGIN TRANSACTION')

# Normalize duplicate budget_items by category and name
cur.execute('SELECT id, category_id, name FROM budget_items')
items = cur.fetchall()
keep = {}
dups = []
for id_, cat, name in items:
    key = (cat, name)
    if key not in keep:
        keep[key] = id_
    else:
        dups.append((id_, keep[key]))

if dups:
    print(f'Found {len(dups)} duplicate budget_items entries')
    for dup_id, keep_id in dups:
        cur.execute('SELECT month, planned_amount, actual_amount FROM monthly_records WHERE item_id = ?', (dup_id,))
        rows = cur.fetchall()
        for month, planned_amount, actual_amount in rows:
            cur.execute('SELECT id, planned_amount, actual_amount FROM monthly_records WHERE month = ? AND item_id = ?', (month, keep_id))
            existing = cur.fetchone()
            if existing:
                existing_id, existing_planned, existing_actual = existing
                new_planned = max(existing_planned or 0, planned_amount or 0)
                new_actual = (existing_actual or 0) + (actual_amount or 0)
                cur.execute('UPDATE monthly_records SET planned_amount = ?, actual_amount = ? WHERE id = ?', (new_planned, new_actual, existing_id))
                cur.execute('DELETE FROM monthly_records WHERE item_id = ? AND month = ? AND id != ?', (dup_id, month, existing_id))
            else:
                cur.execute('UPDATE monthly_records SET item_id = ? WHERE item_id = ? AND month = ?', (keep_id, dup_id, month))

    dup_ids = [dup_id for dup_id, _ in dups]
    cur.execute('DELETE FROM budget_items WHERE id IN ({})'.format(','.join('?' for _ in dup_ids)), dup_ids)
else:
    print('No duplicate budget_items entries found')

# Remove duplicate monthly_records by month + item_id
cur.execute('DELETE FROM monthly_records WHERE id NOT IN (SELECT MIN(id) FROM monthly_records GROUP BY month, item_id)')

# Ensure all months of 2026 contain every unique budget item once
cur.execute('SELECT id, default_planned FROM budget_items ORDER BY id')
unique_items = cur.fetchall()
months = [f'2026-{m:02d}' for m in range(1, 13)]
for month in months:
    cur.execute('SELECT item_id FROM monthly_records WHERE month = ?', (month,))
    existing = {row[0] for row in cur.fetchall()}
    for item_id, default_planned in unique_items:
        if item_id not in existing:
            cur.execute('INSERT INTO monthly_records (month, item_id, planned_amount, actual_amount) VALUES (?, ?, ?, 0)', (month, item_id, default_planned))

conn.commit()
cur.execute('PRAGMA foreign_keys = ON')
conn.close()
print('Cleanup complete')
