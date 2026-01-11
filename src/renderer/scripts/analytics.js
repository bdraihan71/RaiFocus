// Analytics and Reporting Logic
(function () {
    let analyticsData = [];
    let categories = [];
    let currentRange = 'today';
    let charts = {
        category: null,
        daily: null
    };
    let isInitialized = false; // Flag to prevent double listeners
    let detailedReportPage = 1;
    const REPORT_ROWS_PER_PAGE = 20;

    // Exposed function to be called when view is switched
    window.loadAnalytics = async function () {
        console.log('⚡ loadAnalytics called');

        // Always try to load fresh data
        await loadInitialData(); // Load categories

        // Initialize listeners only once
        if (!isInitialized) {
            initializeAnalytics();
            isInitialized = true;
        }

        // Always Refresh Report for current view (or default to today)
        handleRangeChange(currentRange || 'today');
    };

    function initializeAnalytics() {
        console.log('Initializing Analytics (Listeners)...');
        setupEventListeners();
    }

    function setupEventListeners() {
        // Range buttons
        const rangeButtons = document.querySelectorAll('.period-buttons .btn');
        rangeButtons.forEach(btn => {
            // Cloning isn't strictly necessary if we use isInitialized flag, but safer
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.period-buttons .btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const range = e.target.dataset.range;
                handleRangeChange(range);
            });
        });

        // Custom date generation
        const generateBtn = document.getElementById('generateCustomReportBtn');
        if (generateBtn) {
            const newGenerateBtn = generateBtn.cloneNode(true);
            generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);

            newGenerateBtn.addEventListener('click', () => {
                const start = document.getElementById('reportStartDate').value;
                const end = document.getElementById('reportEndDate').value;
                if (start && end) {
                    const endDateFull = dayjs(end).endOf('day').toISOString();
                    const startDateFull = dayjs(start).startOf('day').toISOString();
                    generateReport(startDateFull, endDateFull);
                } else {
                    if (window.showCustomAlert) {
                        window.showCustomAlert('Please select both start and end dates.', 'Missing Dates');
                    } else {
                        alert('Please select both start and end dates.');
                    }
                }
            });
        }

        // Export Report
        const exportBtn = document.getElementById('exportReportBtn');
        if (exportBtn) {
            const newExportBtn = exportBtn.cloneNode(true);
            exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
            newExportBtn.addEventListener('click', exportReportToCSV);
        }
    }

    async function loadInitialData() {
        try {
            categories = await window.electronAPI.getCategories();
            console.log(`Loaded ${categories.length} categories for analytics.`);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    function handleRangeChange(range) {
        currentRange = range;
        const customGroup = document.getElementById('customDateGroup');

        if (range === 'custom') {
            if (customGroup) customGroup.display = 'flex'; // Fix: previously was style.display
            if (customGroup) customGroup.style.display = 'flex';
            return;
        } else {
            if (customGroup) customGroup.style.display = 'none';
        }

        const { start, end } = getDateRange(range);
        generateReport(start, end);
    }

    function getDateRange(range) {
        const now = dayjs();
        let start, end;

        switch (range) {
            case 'today':
                start = now.startOf('day');
                end = now.endOf('day');
                break;
            case 'week':
                start = now.startOf('week');
                end = now.endOf('week');
                break;
            case 'month':
                start = now.startOf('month');
                end = now.endOf('month');
                break;
            case 'year':
                start = now.startOf('year');
                end = now.endOf('year');
                break;
            default:
                start = now.startOf('day');
                end = now.endOf('day');
        }

        return {
            start: start.toISOString(),
            end: end.toISOString()
        };
    }

    async function generateReport(startDate, endDate) {
        console.log(`Generating report from ${startDate} to ${endDate}`);

        try {
            // Fetch data
            analyticsData = await window.electronAPI.getTimeEntries({
                startDate: startDate,
                endDate: endDate
            });

            console.log(`Fetched ${analyticsData.length} records.`);

            // Reset pagination
            detailedReportPage = 1;

            // Update UI
            updateSummaryCards(analyticsData);
            updateDetailedTable(analyticsData);
            renderCharts(analyticsData);

        } catch (error) {
            console.error('Error generating report:', error);
        }
    }

    function updateSummaryCards(data) {
        const totalSeconds = data.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const totalTimeStr = formatDurationAnalytics(totalSeconds);
        const totalTimeEl = document.getElementById('totalReportTime');
        if (totalTimeEl) totalTimeEl.textContent = totalTimeStr;

        const categoryCounts = {};
        data.forEach(entry => {
            categoryCounts[entry.category_id] = (categoryCounts[entry.category_id] || 0) + (entry.duration || 0);
        });

        let topCategory = '-';
        let maxTime = 0;

        for (const [id, time] of Object.entries(categoryCounts)) {
            if (time > maxTime) {
                maxTime = time;
                const cat = categories.find(c => c.id === id);
                if (cat) topCategory = cat.name;
            }
        }
        const topCatEl = document.getElementById('topReportCategory');
        if (topCatEl) topCatEl.textContent = topCategory;

        const sessionsEl = document.getElementById('totalReportSessions');
        if (sessionsEl) sessionsEl.textContent = data.length.toString();
    }

    function updateDetailedTable(data) {
        const tbody = document.getElementById('reportTableBody');
        if (!tbody) return;

        // Force Clear!
        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No data found for this period.</td></tr>';
            return;
        }

        // Pagination Logic
        const startIndex = (detailedReportPage - 1) * REPORT_ROWS_PER_PAGE;
        const endIndex = startIndex + REPORT_ROWS_PER_PAGE;
        const displayData = data.slice(startIndex, endIndex);

        const fragment = document.createDocumentFragment();

        displayData.forEach(entry => {
            const category = categories.find(c => c.id === entry.category_id);
            const date = dayjs(entry.start_time).format('MMM D, YYYY');
            const time = dayjs(entry.start_time).format('h:mm A');
            const duration = formatDurationAnalytics(entry.duration || 0);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${date}</td>
                <td>
                    <span class="badge-category" style="background-color: ${category ? category.color : '#ccc'}">
                        ${category ? category.name : 'Unknown'}
                    </span>
                </td>
                <td>${(entry.note || 'Focus Session').substring(0, 50)}</td>
                <td>${duration}</td>
                <td>${time}</td>
            `;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);

        // Render Pagination Controls inside the table container or just append to the section?
        // Let's remove old controls if any
        const existingControls = document.getElementById('reportPaginationControls');
        if (existingControls) existingControls.remove();

        const totalPages = Math.ceil(data.length / REPORT_ROWS_PER_PAGE);

        if (totalPages > 1) {
            const tableContainer = document.querySelector('.table-container');
            const controls = document.createElement('div');
            controls.id = 'reportPaginationControls';
            controls.style.display = 'flex';
            controls.style.justifyContent = 'center';
            controls.style.gap = '15px';
            controls.style.marginTop = '15px';
            controls.style.alignItems = 'center';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn btn-secondary btn-sm';
            prevBtn.textContent = 'Previous';
            prevBtn.disabled = detailedReportPage === 1;
            prevBtn.onclick = () => {
                detailedReportPage--;
                updateDetailedTable(analyticsData);
            };

            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-secondary btn-sm';
            nextBtn.textContent = 'Next';
            nextBtn.disabled = detailedReportPage === totalPages;
            nextBtn.onclick = () => {
                detailedReportPage++;
                updateDetailedTable(analyticsData);
            };

            const info = document.createElement('span');
            info.textContent = `Page ${detailedReportPage} of ${totalPages}`;
            info.style.color = '#888';
            info.style.fontSize = '14px';

            controls.appendChild(prevBtn);
            controls.appendChild(info);
            controls.appendChild(nextBtn);

            if (tableContainer) tableContainer.parentNode.insertBefore(controls, tableContainer.nextSibling);
        }
    }

    function renderCharts(data) {
        const categoryData = {};
        data.forEach(entry => {
            const cat = categories.find(c => c.id === entry.category_id);
            const name = cat ? cat.name : 'Unknown';
            const color = cat ? cat.color : '#ccc';

            if (!categoryData[name]) {
                categoryData[name] = { value: 0, color: color };
            }
            categoryData[name].value += (entry.duration || 0);
        });

        const catLabels = Object.keys(categoryData);
        const catValues = Object.values(categoryData).map(d => Math.round(d.value / 60));
        const catColors = Object.values(categoryData).map(d => d.color);

        const catCanvas = document.getElementById('categoryChart');
        if (catCanvas) {
            if (charts.category) charts.category.destroy();

            const catCtx = catCanvas.getContext('2d');
            charts.category = new Chart(catCtx, {
                type: 'doughnut',
                data: {
                    labels: catLabels,
                    datasets: [{
                        data: catValues,
                        backgroundColor: catColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right' }
                    }
                }
            });
        }

        const dailyMap = {};
        data.forEach(entry => {
            const date = dayjs(entry.start_time).format('MMM D');
            dailyMap[date] = (dailyMap[date] || 0) + (entry.duration || 0);
        });

        const dailyLabels = Object.keys(dailyMap);
        const dailyValues = Object.values(dailyMap).map(v => Math.round(v / 60));

        const dailyCanvas = document.getElementById('dailyChart');
        if (dailyCanvas) {
            if (charts.daily) charts.daily.destroy();

            const dailyCtx = dailyCanvas.getContext('2d');
            charts.daily = new Chart(dailyCtx, {
                type: 'bar',
                data: {
                    labels: dailyLabels,
                    datasets: [{
                        label: 'Minutes Focused',
                        data: dailyValues,
                        backgroundColor: '#667eea',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }

    function exportReportToCSV() {
        if (!analyticsData || analyticsData.length === 0) {
            alert('No data to export.');
            return;
        }

        const headers = ['Date', 'Time', 'Project', 'Note', 'Duration (Seconds)', 'Duration (Formatted)'];
        const rows = analyticsData.map(entry => {
            const category = categories.find(c => c.id === entry.category_id);
            const durationFormatted = formatDurationAnalytics(entry.duration || 0);
            return [
                dayjs(entry.start_time).format('YYYY-MM-DD'),
                dayjs(entry.start_time).format('HH:mm:ss'),
                category ? category.name : 'Unknown',
                `"${(entry.note || '').replace(/"/g, '""')}"`,
                entry.duration,
                durationFormatted
            ];
        });

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `raifocus_report_${dayjs().format('YYYY-MM-DD')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function formatDurationAnalytics(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
})();
