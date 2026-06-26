const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname)); // מאפשר לשרת להציג את קבצי ה-HTML, CSS, JS

// חיבור לבסיס הנתונים (ייווצר קובץ אמיתי בתיקייה)
const db = new sqlite3.Database(path.join(__dirname, 'budget.db'), (err) => {
    if (err) console.error('שגיאה בחיבור ל-DB:', err.message);
    else console.log('מחובר לבסיס הנתונים SQLite בהצלחה.');
});

// הרצת קובץ ה-setup.sql רק אם ה-DB חדש
db.serialize(() => {
    const sqlInit = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8');
    db.exec(sqlInit, (err) => {
        if (err) console.error('שגיאה בהרצת סקריפט ההקמה:', err.message);
        else console.log('טבלאות ונתוני בסיס הוקמו/אומתו בהצלחה.');
    });
});

// נקודת קצה (API) לקבלת נתוני החודש הנוכחי
app.get('/api/month/:month', (req, requireMonth) => {
    const targetMonth = req.params.month;
    
    // שאילתה השולפת את הסעיפים, קבוצותיהם, והסכומים (מתוכנן + מנוצל בפועל)
    const query = `
        SELECT mr.id, c.name AS category_name, c.type AS category_type, bi.name AS item_name, 
               mr.planned_amount, mr.actual_amount 
        FROM monthly_records mr
        JOIN budget_items bi ON mr.item_id = bi.id
        JOIN categories c ON bi.category_id = c.id
        WHERE mr.month = ?
    `;
    
    db.all(query, [targetMonth], (err, rows) => {
        if (err) return req.res.status(500).json({ error: err.message });
        
        // אם החודש עדיין לא קיים ב-records, ניצור אותו אוטומטית מנתוני הברירת מחדל
        if (rows.length === 0) {
            db.all("SELECT id, default_planned FROM budget_items", [], (err, items) => {
                if (err) return req.res.status(500).json({ error: err.message });
                
                const stmt = db.prepare("INSERT INTO monthly_records (month, item_id, planned_amount) VALUES (?, ?, ?)");
                items.forEach(item => {
                    stmt.run(targetMonth, item.id, item.default_planned);
                });
                stmt.finalize(() => {
                    // שליפה מחדש לאחר היצירה
                    db.all(query, [targetMonth], (err, newRows) => {
                        return req.res.json(newRows);
                    });
                });
            });
        } else {
            req.res.json(rows);
        }
    });
});

// נקודת קצה לעדכון מצטבר של סכום הניצול בפועל (ע"י לחצן ה- +)
app.post('/api/update-actual', (req, res) => {
    const { recordId, amountToAdd } = req.body;
    
    if (!recordId || isNaN(amountToAdd)) {
        return res.status(400).json({ success: false, error: "נתונים שגויים" });
    }

    // שאילתת SQL שמוסיפה את הסכום החדש לסכום הקיים בשדה בפועל
    const query = `
        UPDATE monthly_records 
        SET actual_amount = actual_amount + ? 
        WHERE id = ?
    `;

    db.run(query, [amountToAdd, recordId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`האפליקציה רצה בהצלחה במצב אופליין בכתובת: http://localhost:${PORT}`);
});