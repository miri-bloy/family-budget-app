const CURRENT_MONTH = "2026-04"; 
let currentMonthRecords = [];
let previousMonthRecords = [];
let activePage = 'monthly';
let selectedPreviousMonth = CURRENT_MONTH;

document.addEventListener("DOMContentLoaded", () => {
    loadMonthlyData();
    document.getElementById('previous-month-input').value = CURRENT_MONTH;
});

function switchPage(pageId) {
    activePage = pageId;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    if(window.event && window.event.target) window.event.target.classList.add('active');

    if (pageId === 'annual') {
        loadAnnualDataFromServer();
    } else if (pageId === 'monthly') {
        if (!currentMonthRecords.length) loadMonthlyData();
    } else if (pageId === 'previous') {
        document.getElementById('previous-month-label').innerText = formatMonthLabel(selectedPreviousMonth);
    }
}

function loadMonthlyData() {
    fetch(`/api/month/${CURRENT_MONTH}`)
        .then(res => res.json())
        .then(data => {
            currentMonthRecords = data;
            renderTables(data);
            calculateAndDisplayTotals(); 
        })
        .catch(err => console.error(err));
}

function renderTables(records, containerId = "tables-container") {
    const container = document.getElementById(containerId);
    container.innerHTML = ""; 

    if (!records || records.length === 0) {
        container.innerHTML = `<div class="empty-state">אין נתונים להצגה לחודש זה.</div>`;
        return;
    }

    const groups = {};
    records.forEach(r => {
        if (!groups[r.category_name]) groups[r.category_name] = [];
        groups[r.category_name].push(r);
    });

    for (let catName in groups) {
        let block = document.createElement("div");
        block.className = "category-block";
        
        let html = `<h3>${catName}</h3><table><thead><tr><th>סעיף תקציב</th><th style="width: 350px;">מצב ניצול תקציב (מתוכנן / בפועל)</th><th style="width: 80px; text-align: center;">פעולה</th></tr></thead><tbody>`;
            
        groups[catName].forEach(item => {
            const isIncome = item.category_type === 'INCOME';
            let percent = item.planned_amount !== 0 ? Math.round((item.actual_amount / item.planned_amount) * 100) : (item.actual_amount > 0 ? 100 : 0);
            
            let colorClass = 'bg-normal';
            if (!isIncome) {
                if (percent > 100) colorClass = 'bg-danger';
                else if (percent > 85) colorClass = 'bg-warning';
            } else {
                if (percent < 100) colorClass = 'bg-warning';
            }

            // תיקון סדר המספרים כאן על מנת למנוע תצוגה הפוכה בעברית:
            html += `
                <tr>
                    <td><strong>${item.item_name}</strong></td>
                    <td>
                        <div class="budget-progress-container" id="progress-container-${item.id}" data-planned="${item.planned_amount}" data-actual="${item.actual_amount}">
                            <div class="budget-numbers">
                                <span>${percent}%</span>
                                <span style="direction: ltr; display: inline-block;"><span class="txt-actual">${item.actual_amount.toFixed(2)}</span> / ${item.planned_amount.toFixed(2)} ₪</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div id="bar-fill-${item.id}" class="progress-bar-fill ${colorClass}" style="width: ${Math.min(Math.max(percent, 0), 100)}%;"></div>
                            </div>
                        </div>
                    </td>
                    <td style="text-align: center;"><button class="btn-add" onclick="handleAddClick(${item.id}, ${isIncome})">+</button></td>
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
    if (isNaN(amount) || amount <= 0) return alert("אנא הזיני סכום תקין.");

    fetch('/api/update-actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, amountToAdd: amount })
    })
    .then(res => res.json())
    .then(resData => {
        if (resData.success) {
            if (activePage === 'previous') {
                loadPreviousMonthData();
            } else {
                loadMonthlyData();
            }
        }
    });
}

function getRecordsForActivePage() {
    return activePage === 'previous' ? previousMonthRecords : currentMonthRecords;
}

function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-');
    const names = {
        '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל',
        '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוגוסט',
        '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר'
    };
    return `${names[month] || month} ${year}`;
}

function calculateAndDisplayTotals(records = currentMonthRecords, prefix = '') {
    let totalIncomeActual = 0, totalIncomePlanned = 0;
    let totalExpensesActual = 0, totalExpensesPlanned = 0;

    records.forEach(record => {
        if (record.category_type === 'INCOME') {
            totalIncomeActual += record.actual_amount;
            totalIncomePlanned += record.planned_amount;
        } else if (record.category_type === 'EXPENSE') {
            totalExpensesActual += record.actual_amount;
            totalExpensesPlanned += record.planned_amount;
        }
    });

    let balance = totalIncomeActual - totalExpensesActual;

    document.getElementById(`${prefix ? prefix + '-' : ''}income-display`).innerText = totalIncomeActual.toFixed(2) + " ₪";
    document.getElementById(`${prefix ? prefix + '-' : ''}expenses-display`).innerText = totalExpensesActual.toFixed(2) + " ₪";
    document.getElementById(`${prefix ? prefix + '-' : ''}balance-display`).innerText = balance.toFixed(2) + " ₪";
    
    const balanceDisplay = document.getElementById(`${prefix ? prefix + '-' : ''}balance-display`);
    balanceDisplay.style.color = balance < 0 ? "#e74c3c" : "#2c3e50";

    let incomePercent = totalIncomePlanned !== 0 ? Math.round((totalIncomeActual / totalIncomePlanned) * 100) : 0;
    document.getElementById(`${prefix ? prefix + '-' : ''}income-percent-label`).innerText = incomePercent + "%";
    const incomeBar = document.getElementById(`${prefix ? prefix + '-' : ''}income-bar-fill`);
    if (incomeBar) incomeBar.style.width = `${Math.min(Math.max(incomePercent, 0), 100)}%`;

    let expensePercent = totalExpensesPlanned !== 0 ? Math.round((totalExpensesActual / totalExpensesPlanned) * 100) : 0;
    document.getElementById(`${prefix ? prefix + '-' : ''}expense-percent-label`).innerText = expensePercent + "%";
    const expenseBar = document.getElementById(`${prefix ? prefix + '-' : ''}expense-bar-fill`);
    if (expenseBar) expenseBar.style.width = `${Math.min(Math.max(expensePercent, 0), 100)}%`;
}

function loadPreviousMonthData() {
    const input = document.getElementById('previous-month-input').value;
    if (!input) {
        return alert('אנא בחרי חודש תקין.');
    }

    selectedPreviousMonth = input;
    document.getElementById('previous-month-label').innerText = formatMonthLabel(selectedPreviousMonth);

    fetch(`/api/month/${selectedPreviousMonth}`)
        .then(res => res.json())
        .then(data => {
            previousMonthRecords = data;
            renderTables(previousMonthRecords, 'previous-tables-container');
            calculateAndDisplayTotals(previousMonthRecords, 'previous');
        })
        .catch(err => console.error(err));
}

function loadAnnualDataFromServer() {
    fetch('/api/annual-summary')
        .then(res => res.json())
        .then(data => {
            renderAnnualChart(data.months);
            renderAnnualCategories(data.categories);
        })
        .catch(err => console.error(err));
}

function renderAnnualChart(monthsData) {
    const chartContainer = document.getElementById("annual-chart-bars");
    chartContainer.innerHTML = "";

    let maxAmount = 1000;
    monthsData.forEach(m => {
        if (m.income > maxAmount) maxAmount = m.income;
        if (m.expense > maxAmount) maxAmount = m.expense;
    });

    // המערך מגיע כבר ממוין בצורה מושלמת (ינואר עד דצמבר)
    monthsData.forEach(m => {
        const incomeHeight = m.income > 0 ? (m.income / maxAmount) * 100 : 0;
        const expenseHeight = m.expense > 0 ? (m.expense / maxAmount) * 100 : 0;

        const col = document.createElement("div");
        col.className = "chart-month-column";
        col.innerHTML = `
            <div class="chart-bars-pair">
                <div class="chart-bar expense" style="height: ${expenseHeight}%;" title="הוצאות: ${m.expense.toFixed(2)} ₪"></div>
                <div class="chart-bar income" style="height: ${incomeHeight}%;" title="הכנסות: ${m.income.toFixed(2)} ₪"></div>
            </div>
            <div class="chart-month-label">${m.name}</div>
        `;
        chartContainer.appendChild(col);
    });
}

function renderAnnualCategories(categoriesData) {
    const container = document.getElementById("annual-categories-container");
    container.innerHTML = "";

    categoriesData.forEach(cat => {
        const isIncome = cat.category_type === 'INCOME';
        let catPercent = cat.planned_amount > 0 ? Math.round((cat.actual_amount / cat.planned_amount) * 100) : 0;
        
        // 1. סרגל קבוצה ראשי: צבע קבוע מוחלט (ירוק להכנסות, אדום להוצאות)
        let catColorClass = isIncome ? 'bg-normal' : 'bg-danger';

        const item = document.createElement("div");
        item.className = "accordion-item"; 
        
        let subItemsHtml = `<table class="annual-sub-table"><tbody>`;
        
        cat.subItems.forEach(sub => {
            let subPercent = sub.planned_amount > 0 ? Math.round((sub.actual_amount / sub.planned_amount) * 100) : 0;
            
            // 2. סרגלים פנימיים: צביעה חכמה ומקורית לפי יחס הניצול (כולל צהוב ואדום בחריגה)
            let subColorClass = 'bg-normal';
            if (!isIncome) {
                if (subPercent > 100) subColorClass = 'bg-danger';      // חריגה - אדום
                else if (subPercent > 85) subColorClass = 'bg-warning'; // התקרבות לחריגה - צהוב
            } else {
                if (subPercent < 100) subColorClass = 'bg-warning';     // טרם הושג יעד ההכנסה - צהוב
            }

            subItemsHtml += `
                <tr>
                    <td style="width: 150px; font-weight: bold; color: #2c3e50;">${sub.item_name}</td>
                    <td>
                        <div class="budget-progress-container">
                            <div class="budget-numbers">
                                <span>${subPercent}%</span>
                                <span style="direction: ltr; display: inline-block;">${sub.actual_amount.toFixed(2)} / ${sub.planned_amount.toFixed(2)} ₪</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill ${subColorClass}" style="width: ${Math.min(Math.max(subPercent, 0), 100)}%;"></div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        });
        subItemsHtml += `</tbody></table>`;

        item.innerHTML = `
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <div class="accordion-header-main" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span class="accordion-title" style="min-width: 180px;">${cat.category_name}</span>
                    <div class="accordion-progress-wrapper">
                        <div class="budget-progress-container" style="margin: 0; width: 100%;">
                            <div class="budget-numbers">
                                <span>${catPercent}%</span>
                                <span style="direction: ltr; display: inline-block;">${cat.actual_amount.toFixed(2)} / ${cat.planned_amount.toFixed(2)} ₪</span>
                            </div>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill ${catColorClass}" style="width: ${Math.min(Math.max(catPercent, 0), 100)}%;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <span class="accordion-toggle-icon" style="margin-right: 15px;">▼</span>
            </div>
            <div class="accordion-content">${subItemsHtml}</div>
        `;
        container.appendChild(item);
    });
}

function toggleAccordion(headerElement) {
    headerElement.parentElement.classList.toggle("open");
}

// פתיחת חלונית הדיווח המהיר
function openQuickReportModal() {
    document.getElementById("quick-amount").value = "";
    const records = getRecordsForActivePage();
    populateQuickCategorySelect(records);
    populateQuickItemSelect(records, "");
    document.getElementById("quick-report-overlay").classList.add("active");
}

// סגירת חלונית הדיווח המהיר
function closeQuickReportModal() {
    document.getElementById("quick-report-overlay").classList.remove("active");
    document.getElementById("quick-amount").value = "";
    document.getElementById("quick-category-select").value = "";
    document.getElementById("quick-item-input").value = "";
    const datalist = document.getElementById("quick-item-options");
    if (datalist) datalist.innerHTML = "";
}

function populateQuickCategorySelect(records) {
    const select = document.getElementById("quick-category-select");
    select.innerHTML = "<option value=\"\">-- בחרי קטגוריה --</option>";

    const categoryNames = [...new Set(records.map(record => record.category_name))].sort((a, b) => a.localeCompare(b));
    categoryNames.forEach(categoryName => {
        const option = document.createElement("option");
        option.value = categoryName;
        option.textContent = categoryName;
        select.appendChild(option);
    });

    select.value = "";
}

function populateQuickItemSelect(records, selectedCategoryName = "") {
    // Populate the datalist source from records for the given category (kept separate from filtering)
    const datalist = document.getElementById("quick-item-options");
    datalist.innerHTML = "";

    const filteredRecords = selectedCategoryName
        ? records.filter(record => record.category_name === selectedCategoryName)
        : records;

    const sortedRecords = [...filteredRecords].sort((a, b) => a.item_name.localeCompare(b.item_name));
    sortedRecords.forEach(record => {
        const option = document.createElement("option");
        option.value = record.item_name;
        option.setAttribute("data-record-id", record.id);
        option.setAttribute("data-search-text", `${record.item_name} ${record.category_name}`.toLowerCase());
        datalist.appendChild(option);
    });

    document.getElementById("quick-item-input").value = "";
}

function onCategoryChange() {
    const selectedCategoryName = document.getElementById("quick-category-select").value;
    populateQuickItemSelect(getRecordsForActivePage(), selectedCategoryName);
}

function filterQuickItemOptions() {
    const input = document.getElementById("quick-item-input");
    const searchVal = input.value.trim().toLowerCase();
    const selectedCategory = document.getElementById("quick-category-select").value;
    const datalist = document.getElementById("quick-item-options");

    // Rebuild datalist to include only matching entries (removing non-matching helps browsers honor filtering)
    datalist.innerHTML = "";

    const sourceRecords = getRecordsForActivePage();
    const source = selectedCategory
        ? sourceRecords.filter(r => r.category_name === selectedCategory)
        : sourceRecords;

    const sorted = [...source].sort((a, b) => a.item_name.localeCompare(b.item_name));
    sorted.forEach(record => {
        const text = `${record.item_name} ${record.category_name}`.toLowerCase();
        if (!searchVal || text.includes(searchVal)) {
            const opt = document.createElement('option');
            opt.value = record.item_name;
            opt.setAttribute('data-record-id', record.id);
            datalist.appendChild(opt);
        }
    });
}

// שמירת הנתון המהיר ושליחתו ל-API הקיים בשרת
function submitQuickReport() {
    const amountVal = parseFloat(document.getElementById("quick-amount").value);
    const selectedItemName = document.getElementById("quick-item-input").value;
    const selectedOption = Array.from(document.getElementById("quick-item-options").options).find(option => option.value === selectedItemName);
    const selectedRecordId = selectedOption ? parseInt(selectedOption.getAttribute("data-record-id"), 10) : null;

    // בדיקות תקינות
    if (isNaN(amountVal) || amountVal <= 0) {
        alert("אנא הזיני סכום תקציב תקין הגדול מ-0.");
        return;
    }
    if (!selectedRecordId) {
        alert("אנא בחרי סעיף תקציבי מהרשימה.");
        return;
    }

    const activeRecords = getRecordsForActivePage();
    // שליחה לנקודת הקצה הקיימת בשרת שלך (update-actual)
    fetch('/api/update-actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: selectedRecordId, amountToAdd: amountVal })
    })
    .then(res => res.json())
    .then(resData => {
        if (resData.success) {
            closeQuickReportModal(); // סגירת הטופס לפני הרענון

            const rec = activeRecords.find(r => r.id === selectedRecordId);
            if (rec) {
                rec.actual_amount = (rec.actual_amount || 0) + amountVal;
                renderTables(activeRecords, activePage === 'previous' ? 'previous-tables-container' : 'tables-container');
                calculateAndDisplayTotals(activeRecords, activePage === 'previous' ? 'previous' : '');
                const bar = document.getElementById(`bar-fill-${selectedRecordId}`);
                if (bar) {
                    bar.classList.add('pulse');
                    setTimeout(() => bar.classList.remove('pulse'), 950);
                }
            }

            if (activePage === 'previous') {
                loadPreviousMonthData();
            } else {
                loadMonthlyData();
            }
        } else {
            alert("העדכון נכשל בשרת.");
        }
    })
    .catch(err => console.error("שגיאה בעדכון המהיר:", err));
}