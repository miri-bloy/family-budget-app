-- יצירת טבלת קטגוריות
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL
);

-- יצירת טבלת סעיפי תקציב (הגדרות קבועות)
CREATE TABLE IF NOT EXISTS budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    name TEXT NOT NULL,
    default_planned REAL DEFAULT 0,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

-- יצירת טבלת הרשומות החודשיות הדינמיות (הארכיון והחודש הנוכחי)
CREATE TABLE IF NOT EXISTS monthly_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL, -- פורמט: YYYY-MM
    item_id INTEGER,
    planned_amount REAL,
    actual_amount REAL DEFAULT 0, -- שדה הניצול בפועל שמאתחל ל-0
    FOREIGN KEY(item_id) REFERENCES budget_items(id)
);

-- יצירת טבלת קופת החגים
CREATE TABLE IF NOT EXISTS holiday_fund (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL
);

-- הזנת נתונים ראשוניים מדויקים
INSERT OR IGNORE INTO categories (id, name, type) VALUES 
(1, 'הכנסות שוטפות', 'INCOME'),
(2, 'דיור ותחזוקה', 'EXPENSE'),
(3, 'תחבורה', 'EXPENSE'),
(4, 'מזון', 'EXPENSE'),
(5, 'לימודים', 'EXPENSE'),
(6, 'בריאות וטיפוח', 'EXPENSE'),
(7, 'הלוואות ומיסים', 'EXPENSE'),
(8, 'מתנות ותרומות', 'EXPENSE'),
(9, 'הוצאות לא צפויות', 'EXPENSE');

-- הזנת סעיפים עם סכום מתוכנן כברירת מחדל
INSERT OR IGNORE INTO budget_items (category_id, name, default_planned) VALUES 
(1, 'משכורת מירי', 6000.00),
(1, 'כולל - בסיסי', 1540.00),
(1, 'מזומן', 750.00),
(1, 'דתות', 428.40),
(1, 'כולל ליקוטי הלכות', 360.00),

(2, 'שכר דירה', 0.00),
(2, 'סיוע בשכר דירה', -540.00),
(2, 'טלפון', 40.00),
(2, 'חשמל', 0.00),
(2, 'מים וביוב', 0.00),
(2, 'תחזוקה או תיקונים', 0.00),
(2, 'ציוד', 0.00),
(2, 'ועד בית', 112.00),

(3, 'חופשי חודשי יצחק', 169.00),
(3, 'נסיעות מירי', 157.00),
(3, 'דרייברים', 200.00),

(4, 'קנייה שבועית (ממוצע לסבב)', 300.00),
(4, 'ארוחות מחוץ לבית', 100.00),
(4, 'ארוחות מירי', 50.00),

(5, 'חדר מחשבים מירי', 300.00),
(5, 'חדר מחשבים יצחק', 40.00),
(5, 'מנוי באתרים', 100.00),

(6, 'ציוד עזר רפואי', 50.00),
(6, 'שיער/ציפורניים', 50.00),
(6, 'בגדים יצחק', 0.00),
(6, 'בגדים מירי', 200.00),
(6, 'שיעורי התעמלות', 56.00),
(6, 'מקווה נשים', 120.00),
(6, 'מקווה גברים', 130.00),
(6, 'אחות/בודקת', 100.00),
(6, 'ביקור במרפאה/טיפולי שיניים', 100.00),
(6, 'בית מרקחת', 200.00),

(7, 'כרטיס אשראי-דיירקט', 0.00),
(7, 'כרטיס אשראי-חיוב חודשי', 0.00),
(7, 'כרטיס אשראי-מירי קודם', 0.00),
(7, 'כרטיס אשראי-יצחק קודם', 7.90),
(7, 'ביטוח לאומי יצחק', 171.00),

(8, 'מעשר הורים בלוי', 453.92),
(8, 'מעשר הורים וינשטוק', 453.92),
(8, 'ערבים', 65.00),
(8, 'צדקה', 200.00),

(9, 'אירועים מיוחדים', 100.00),
(9, 'תרבות ופנאי', 100.00);