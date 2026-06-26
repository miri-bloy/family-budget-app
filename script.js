const CURRENT_MONTH = "2026-04"; 

let currentMonthRecords = [];

document.addEventListener("DOMContentLoaded", () => {
    loadMonthlyData();
});

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    if(event && event.target) event.target.classList.add('active');
}

function loadMonthlyData() {
    fetch(`/api/month/${CURRENT_MONTH}`)
        .then(res => res.json())
        .then(data => {
            currentMonthRecords = data;
            renderTables(data);
            calculateAndDisplayTotals(); 
        })
        .catch(err => console.error("שגיאה בטעינת הנתונים מהשרת:", err));
}

// פונקציה מורחבת לחישוב סכומי מאקרו ואחוזי התקדמות כלליים לכרטיסיות הראשיות
function calculateAndDisplayTotals() {
    let totalIncomeActual = 0;
    let totalIncomePlanned = 0;
    
    let totalExpensesActual = 0;
    let totalExpensesPlanned = 0;

    currentMonthRecords.forEach(record => {
        if (record.category_type === 'INCOME') {
            totalIncomeActual += record.actual_amount;
            totalIncomePlanned += record.planned_amount;
        } else if (record.category_type === 'EXPENSE') {
            totalExpensesActual += record.actual_amount;
            totalExpensesPlanned += record.planned_amount;
        }
    });

    let balance = totalIncomeActual - totalExpensesActual;

    // 1. הצגת המספרים המדויקים
    document.getElementById('total-income-display').innerText = totalIncomeActual.toFixed(2) + " ₪";
    document.getElementById('total-expenses-display').innerText = totalExpensesActual.toFixed(2) + " ₪";
    document.getElementById('total-balance-display').innerText = balance.toFixed(2) + " ₪";
    
    // צביעת טקסט היתרה במידה והוא שלילי
    const balanceDisplay = document.getElementById('total-balance-display');
    if (balance < 0) balanceDisplay.style.color = "#e74c3c";
    else balanceDisplay.style.color = "#2c3e50";

    // 2. חישוב אחוזים עבור כרטיס הכנסות
    let incomePercent = 0;
    if (totalIncomePlanned !== 0) {
        incomePercent = Math.round((totalIncomeActual / totalIncomePlanned) * 100);
    }
    document.getElementById('income-percent-label').innerText = incomePercent + "%";
    
    const incomeBar = document.getElementById('income-bar-fill');
    incomeBar.style.width = `${Math.min(Math.max(incomePercent, 0), 100)}%`;
    incomeBar.className = 'progress-bar-fill';
    if (incomePercent < 100) incomeBar.classList.add('bg-warning'); // טרם הושלמו כל ההכנסות
    else incomeBar.classList.add('bg-normal');

    // 3. חישוב אחוזים עבור כרטיס הוצאות
    let expensePercent = 0;
    if (totalExpensesPlanned !== 0) {
        expensePercent = Math.round((totalExpensesActual / totalExpensesPlanned) * 100);
    }
    document.getElementById('expense-percent-label').innerText = expensePercent + "%";
    
    const expenseBar = document.getElementById('expense-bar-fill');
    expenseBar.style.width = `${Math.min(Math.max(expensePercent, 0), 100)}%`;
    expenseBar.className = 'progress-bar-fill';
    if (expensePercent > 100) expenseBar.classList.add('bg-danger');      // חריגה מהמסגרת הכוללת
    else if (expensePercent > 85) expenseBar.classList.add('bg-warning'); // התקרבות לקצה המסגרת
    else expenseBar.classList.add('bg-normal');
}

function renderTables(records) {
    const container = document.getElementById("tables-container");
    container.innerHTML = ""; 

    const groups = {};
    records.forEach(r => {
        if (!groups[r.category_name]) groups[r.category_name] = [];
        groups[r.category_name].push(r);
    });

    for (let catName in groups) {
        let block = document.createElement("div");
        block.className = "category-block";
        
        let html = `<h3>${catName}</h3>`;
        html += `<table>
            <thead>
                <tr>
                    <th>סעיף תקציב</th>
                    <th style="width: 350px;">מצב ניצול תקציב (בפועל / מתוכנן)</th>
                    <th style="width: 80px; text-align: center;">פעולה</th>
                </tr>
            </thead>
            <tbody>`;
            
        groups[catName].forEach(item => {
            const isIncome = item.category_type === 'INCOME';
            
            let percent = 0;
            if (item.planned_amount !== 0) {
                percent = Math.round((item.actual_amount / item.planned_amount) * 100);
            } else if (item.actual_amount > 0) {
                percent = 100;
            }
            
            const barWidth = Math.min(Math.max(percent, 0), 100);
            
            let colorClass = 'bg-normal';
            if (!isIncome) {
                if (percent > 100) colorClass = 'bg-danger';
                else if (percent > 85) colorClass = 'bg-warning';
            } else {
                if (percent < 100) colorClass = 'bg-warning';
            }

            html += `
                <tr>
                    <td><strong>${item.item_name}</strong></td>
                    <td>
                        <div class="budget-progress-container" id="progress-container-${item.id}" data-planned="${item.planned_amount}" data-actual="${item.actual_amount}">
                            <div class="budget-numbers">
                                <span>${percent}%</span>
                                <span><span class="txt-actual">${item.actual_amount.toFixed(2)}</span> / ${item.planned_amount.toFixed(2)} ₪</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div id="bar-fill-${item.id}" class="progress-bar-fill ${colorClass}" style="width: ${barWidth}%;"></div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <button class="btn-add" onclick="handleAddClick(${item.id}, ${isIncome})">+</button>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        block.innerHTML = html;
        container.appendChild(block);
    }
}

function handleAddClick(recordId, isIncome) {
    const amountStr = prompt("הזיני סכום להוספה:");
    if (amountStr === null) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert("אנא הזיני סכום מספרי תקין הגדול מ-0.");
        return;
    }

    fetch('/api/update-actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, amountToAdd: amount })
    })
    .then(res => res.json())
    .then(resData => {
        if (resData.success) {
            const container = document.getElementById(`progress-container-${recordId}`);
            const barFill = document.getElementById(`bar-fill-${recordId}`);
            
            const plannedAmount = parseFloat(container.getAttribute('data-planned'));
            const currentActual = parseFloat(container.getAttribute('data-actual'));
            
            const newActual = currentActual + amount;
            container.setAttribute('data-actual', newActual);
            
            const recordIndex = currentMonthRecords.findIndex(r => r.id === recordId);
            if (recordIndex > -1) {
                currentMonthRecords[recordIndex].actual_amount = newActual;
            }
            
            calculateAndDisplayTotals(); // עדכון אוטומטי של הסרגלים בכרטיסיות הראשיות!
            
            let percent = 0;
            if (plannedAmount !== 0) {
                percent = Math.round((newActual / plannedAmount) * 100);
            }
            
            container.querySelector('.budget-numbers').innerHTML = `
                <span>${percent}%</span>
                <span><span class="txt-actual">${newActual.toFixed(2)}</span> / ${plannedAmount.toFixed(2)} ₪</span>
            `;
            
            barFill.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
            
            barFill.className = 'progress-bar-fill'; 
            if (!isIncome) {
                if (percent > 100) barFill.classList.add('bg-danger');
                else if (percent > 85) barFill.classList.add('bg-warning');
                else barFill.classList.add('bg-normal');
            } else {
                if (percent < 100) barFill.classList.add('bg-warning');
                else barFill.classList.add('bg-normal');
            }
        } else {
            alert("העדכון נכשל בשרת.");
        }
    })
    .catch(err => console.error("שגיאה בתקשורת עם השרת:", err));
}