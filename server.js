const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname)); 

const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
    if (err) console.error('שגיאה בחיבור ל-DB:', err.message);
    else console.log('מחובר לבסיס הנתונים SQLite בהצלחה.');
});

function cleanupDuplicateBudgetItems(callback) {
    const cleanupSql = `
        PRAGMA foreign_keys = OFF;
        BEGIN TRANSACTION;

        DROP TABLE IF EXISTS dup_items;

        CREATE TEMP TABLE dup_items AS
            SELECT bi.id AS dup_id, ki.keep_id
            FROM budget_items bi
            JOIN (
                SELECT MIN(id) AS keep_id, category_id, name
                FROM budget_items
                GROUP BY category_id, name
            ) ki ON bi.category_id = ki.category_id AND bi.name = ki.name
            WHERE bi.id != ki.keep_id;

        CREATE TEMP TABLE normalized_records AS
            SELECT
                mr.month AS month,
                COALESCE((SELECT keep_id FROM dup_items WHERE dup_id = mr.item_id), mr.item_id) AS item_id,
                MAX(mr.planned_amount) AS planned_amount,
                SUM(mr.actual_amount) AS actual_amount
            FROM monthly_records mr
            GROUP BY mr.month,
                     COALESCE((SELECT keep_id FROM dup_items WHERE dup_id = mr.item_id), mr.item_id);

        DELETE FROM monthly_records;

        INSERT INTO monthly_records (month, item_id, planned_amount, actual_amount)
        SELECT month, item_id, planned_amount, actual_amount FROM normalized_records;

        DELETE FROM budget_items
        WHERE id IN (SELECT dup_id FROM dup_items);

        DROP TABLE IF EXISTS normalized_records;
        DROP TABLE IF EXISTS dup_items;

        COMMIT;
        PRAGMA foreign_keys = ON;
    `;

    db.exec(cleanupSql, callback);
}

function normalizeMonthlyRecords(callback) {
    const sql = `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_items_unique_cat_name
        ON budget_items(category_id, name);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_records_unique_month_item
        ON monthly_records(month, item_id);
    `;

    db.exec(sql, callback);
}

db.serialize(() => {
    const sqlInit = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8');
    db.exec(sqlInit, (err) => {
        if (err) console.error('שגיאה בהרצת סקריפט ההקמה:', err.message);

        cleanupDuplicateBudgetItems((cleanupErr) => {
            if (cleanupErr) {
                console.error('שגיאה בניקוי כפילויות:', cleanupErr.message);
                return;
            }

            normalizeMonthlyRecords((normErr) => {
                if (normErr) {
                    console.error('שגיאה בנורמליזציה של רשומות החודשים:', normErr.message);
                    return;
                }

                ensureYearMonthRecords(new Date().getFullYear(), (yearErr) => {
                    if (yearErr) console.error('שגיאה בברירת המחדל של חודשי השנה:', yearErr.message);
                });
            });
        });
    });
});

function ensureMonthRecords(targetMonth, callback) {
    db.all("SELECT id, default_planned FROM budget_items", [], (err, items) => {
        if (err) return callback(err);

        const stmt = db.prepare(`
            INSERT OR IGNORE INTO monthly_records (month, item_id, planned_amount, actual_amount)
            VALUES (?, ?, ?, 0)
        `);

        items.forEach(item => {
            stmt.run(targetMonth, item.id, item.default_planned);
        });

        stmt.finalize(() => {
            db.run(`
                DELETE FROM monthly_records
                WHERE month = ? AND id NOT IN (
                    SELECT MIN(id)
                    FROM monthly_records
                    WHERE month = ?
                    GROUP BY item_id
                )
            `, [targetMonth, targetMonth], (err) => {
                if (err) return callback(err);
                callback(null);
            });
        });
    });
}

function ensureYearMonthRecords(year, callback) {
    const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
    let pending = months.length;

    if (pending === 0) return callback(null);

    months.forEach(month => {
        ensureMonthRecords(month, (err) => {
            if (err) return callback(err);
            pending -= 1;
            if (pending === 0) callback(null);
        });
    });
}

function getMonthRecords(targetMonth, callback) {
    const query = `
        SELECT mr.id, c.name AS category_name, c.type AS category_type, bi.name AS item_name, 
               mr.planned_amount, mr.actual_amount 
        FROM monthly_records mr
        JOIN budget_items bi ON mr.item_id = bi.id
        JOIN categories c ON bi.category_id = c.id
        WHERE mr.month = ?
        ORDER BY c.name, bi.name
    `;

    ensureMonthRecords(targetMonth, (err) => {
        if (err) return callback(err);
        db.all(query, [targetMonth], (err, rows) => callback(err, rows));
    });
}

app.get('/api/month/:month', (req, res) => {
    const targetMonth = req.params.month;

    getMonthRecords(targetMonth, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/update-actual', (req, res) => {
    const { recordId, amountToAdd } = req.body;
    if (!recordId || isNaN(amountToAdd)) return res.status(400).json({ success: false });

    const query = `UPDATE monthly_records SET actual_amount = actual_amount + ? WHERE id = ?`;
    db.run(query, [amountToAdd, recordId], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// נקודת הקצה המתוקנת לסיכום השנתי
app.get('/api/annual-summary', (req, res) => {
    // שליפה ישירה של החודש מתוך הפורמט הקיים במערכת
    const queryMonths = `
        SELECT 
            mr.month as raw_month,
            SUM(CASE WHEN c.type = 'INCOME' THEN mr.actual_amount ELSE 0 END) as total_income,
            SUM(CASE WHEN c.type = 'EXPENSE' THEN mr.actual_amount ELSE 0 END) as total_expense
        FROM monthly_records mr
        JOIN budget_items bi ON mr.item_id = bi.id
        JOIN categories c ON bi.category_id = c.id
        GROUP BY mr.month;
    `;

    const queryCategories = `
        SELECT 
            c.name as category_name,
            c.type as category_type,
            bi.name as item_name,
            (bi.default_planned * 12) as total_planned,
            SUM(mr.actual_amount) as total_actual
        FROM budget_items bi
        JOIN categories c ON bi.category_id = c.id
        LEFT JOIN monthly_records mr ON mr.item_id = bi.id
        GROUP BY c.name, bi.name
        ORDER BY c.type DESC, c.name, bi.name;
    `;

    db.all(queryMonths, [], (err, monthRows) => {
        if (err) return res.status(500).json({ error: err.message });

        // יצירת מבנה קבוע מראש בסדר כרונולוגי לועזי מוחלט (מינואר עד דצמבר)
        const orderedMonths = [
            { key: "01", name: "ינואר", income: 0, expense: 0 },
            { key: "02", name: "פברואר", income: 0, expense: 0 },
            { key: "03", name: "מרץ", income: 0, expense: 0 },
            { key: "04", name: "אפריל", income: 0, expense: 0 },
            { key: "05", name: "מאי", income: 0, expense: 0 },
            { key: "06", name: "יוני", income: 0, expense: 0 },
            { key: "07", name: "יולי", income: 0, expense: 0 },
            { key: "08", name: "אוגוסט", income: 0, expense: 0 },
            { key: "09", name: "ספטמבר", income: 0, expense: 0 },
            { key: "10", name: "אוקטובר", income: 0, expense: 0 },
            { key: "11", name: "נובמבר", income: 0, expense: 0 },
            { key: "12", name: "דצמבר", income: 0, expense: 0 }
        ];

        // התאמת הנתונים שנשלפו מה-DB למבנה הכרונולוגי לפי בדיקת הטקסט (לדוגמה: "2026-04" מכיל את "04")
        monthRows.forEach(row => {
            if (row.raw_month) {
                const parts = row.raw_month.split('-');
                const monthTargetNum = parts[1] || ""; // יחלץ את ה-"04"
                
                const targetObj = orderedMonths.find(m => m.key === monthTargetNum);
                if (targetObj) {
                    targetObj.income = row.total_income || 0;
                    targetObj.expense = row.total_expense || 0;
                }
            }
        });

        db.all(queryCategories, [], (err, catRows) => {
            if (err) return res.status(500).json({ error: err.message });

            const categoriesMap = {};
            catRows.forEach(row => {
                if (!categoriesMap[row.category_name]) {
                    categoriesMap[row.category_name] = {
                        category_name: row.category_name,
                        category_type: row.category_type,
                        actual_amount: 0,
                        planned_amount: 0,
                        subItems: []
                    };
                }
                categoriesMap[row.category_name].actual_amount += (row.total_actual || 0);
                categoriesMap[row.category_name].planned_amount += row.total_planned;
                
                categoriesMap[row.category_name].subItems.push({
                    item_name: row.item_name,
                    actual_amount: (row.total_actual || 0),
                    planned_amount: row.total_planned
                });
            });

            res.json({
                months: orderedMonths, // נשלח את המערך המסודר כרונולוגית תמיד
                categories: Object.values(categoriesMap)
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`השרת רץ בכתובת: http://localhost:${PORT}`);
});