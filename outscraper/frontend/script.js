// Main JS logic - Personal Use Version
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const resultsSection = document.getElementById('results-section');
    const leadsTableBody = document.getElementById('leads-body');
    const resultCount = document.getElementById('result-count');
    const loadingIndicator = document.getElementById('loading-indicator');
    const searchBtn = document.getElementById('search-btn');
    const stopBtn = document.getElementById('stop-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const statusMessage = document.getElementById('status-message');
    const liveStatus = document.getElementById('live-status');
    const statusBadge = document.getElementById('app-status-badge');
    const leadCounter = document.getElementById('live-lead-counter');
    const exportActions = document.getElementById('export-actions');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // State Variables
    let isScrapingActive = false;
    let leadsData = [];
    let scrapingInterval = null;

    // Theme logic
    function syncIcons() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        if (isDark) {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }

    syncIcons();

    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        const isDark = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        syncIcons();
    });

    // Mobile Menu Toggle logic
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menuToggle.classList.toggle('active');
        });
    }

    // Toast Notification System
    function showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        requestAnimationFrame(() => {
            setTimeout(() => toast.classList.add('show'), 10);
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    // Helper: Update App Status
    function updateAppStatus(status) {
        statusBadge.classList.remove('status-idle', 'status-scraping', 'status-stopped', 'status-completed');
        let statusClass = 'status-idle';
        let statusText = 'Idle';

        switch (status) {
            case 'scraping': statusClass = 'status-scraping'; statusText = 'Scraping'; break;
            case 'stopped': statusClass = 'status-stopped'; statusText = 'Stopped'; break;
            case 'completed': statusClass = 'status-completed'; statusText = 'Completed'; break;
        }

        statusBadge.classList.add(statusClass);
        statusBadge.textContent = statusText;
    }

    // Helper: Update Lead Counter
    function updateLeadCount(count) {
        if (count > 0) {
            leadCounter.textContent = `${count} Leads`;
            leadCounter.classList.remove('hidden');
        } else {
            leadCounter.classList.add('hidden');
        }
    }

    // Stop button handler
    stopBtn.addEventListener('click', () => {
        stopScraping();
    });

    function stopScraping(reason = 'stopped') {
        if (scrapingInterval) {
            clearTimeout(scrapingInterval);
            scrapingInterval = null;
        }
        isScrapingActive = false;
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<span>Search</span>';
        stopBtn.disabled = true;

        searchForm.classList.remove('scraping-active');
        searchBtn.classList.remove('scraping-active');
        loadingIndicator.classList.add('hidden');

        if (reason === 'completed') {
            liveStatus.textContent = 'Completed';
            liveStatus.classList.remove('hidden', 'searching', 'stopped');
            liveStatus.classList.add('completed');
            updateAppStatus('completed');
            statusMessage.style.display = 'block';
            statusMessage.textContent = `Search finished. Total leads extracted: ${leadsData.length}`;
            statusMessage.className = 'status-message success';
        } else if (reason === 'stopped') {
            liveStatus.textContent = 'Stopped by user';
            liveStatus.classList.remove('hidden', 'searching');
            liveStatus.classList.add('stopped');
            updateAppStatus('stopped');
            statusMessage.style.display = 'block';
            statusMessage.textContent = `Scraping stopped. Total leads extracted: ${leadsData.length}`;
            statusMessage.className = 'status-message success';
        } else {
            liveStatus.textContent = 'Error';
            liveStatus.classList.remove('hidden', 'searching', 'stopped', 'completed');
            updateAppStatus('stopped');
            statusMessage.style.display = 'block';
            statusMessage.textContent = reason;
            statusMessage.className = 'status-message error';
        }

        if (leadsData.length > 0) exportActions.style.display = 'flex';
    }

    // Initialize Socket.io
    const socket = io(API_BASE_URL);

    socket.on('connect', () => {
        console.log('Connected to WebSocket:', socket.id);
    });

    socket.on('newLead', (lead) => {
        if (!isScrapingActive) return;
        const exists = leadsData.some(existing =>
            existing.name === lead.name && existing.address === lead.address
        );

        if (!exists) {
            leadsData.push(lead);
            updateLeadCount(leadsData.length);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${lead.name || 'N/A'}</strong></td>
                <td>${formatPhoneNumber(lead.phone) || 'N/A'}</td>
                <td>${lead.address || 'N/A'}</td>
                <td>
                    ${lead.website && lead.website !== 'N/A'
                    ? `<a href="${lead.website}" class="website-link" target="_blank">${lead.website}</a>`
                    : 'N/A'}
                </td>
            `;
            leadsTableBody.appendChild(row);
        }
    });

    socket.on('progress', (data) => {
        if (!isScrapingActive) return;
        liveStatus.textContent = `Scraping... ${data.percent}% (${data.collected}/${data.limit})`;
    });

    socket.on('scrapingComplete', (data) => {
        stopScraping('completed');
    });

    socket.on('scrapingError', (data) => {
        stopScraping(data.message || 'Unknown error occurred');
    });

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const keyword = document.getElementById('keyword').value.trim();
        const location = document.getElementById('location').value.trim();

        if (!keyword || !location) {
            alert('Please enter both keyword and location');
            return;
        }

        if (isScrapingActive) stopScraping();

        isScrapingActive = true;
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<span class="spinner-sm"></span> Searching...';
        stopBtn.disabled = false;

        updateAppStatus('scraping');
        updateLeadCount(0);
        searchForm.classList.add('scraping-active');
        searchBtn.classList.add('scraping-active');

        resultsSection.style.display = 'block';
        leadsTableBody.innerHTML = '';
        loadingIndicator.classList.remove('hidden');
        exportActions.style.display = 'none';
        resultCount.textContent = '0';
        statusMessage.style.display = 'none';
        leadsData = [];

        liveStatus.textContent = 'Searching via SerpApi...';
        liveStatus.classList.remove('hidden', 'stopped');
        liveStatus.classList.add('searching');

        try {
            const response = await fetch(`${API_BASE_URL}/api/search/outscraper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, location, limit: 500 })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to start scraping');

            leadsData = data.leads || [];
            renderTable(leadsData);
            updateLeadCount(leadsData.length);
            stopScraping('completed');
        } catch (error) {
            console.error('Search error:', error);
            stopScraping(error.message);
        }
    });

    function renderTable(data) {
        if (!resultCount || !leadsTableBody) return;
        resultCount.textContent = data.length;
        leadsTableBody.innerHTML = '';
        data.forEach(lead => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${lead.name || 'N/A'}</strong></td>
                <td>${formatPhoneNumber(lead.phone) || 'N/A'}</td>
                <td>${lead.address || 'N/A'}</td>
                <td>
                    ${lead.website && lead.website !== 'N/A'
                    ? `<a href="${lead.website}" class="website-link" target="_blank">${lead.website}</a>`
                    : 'N/A'}
                </td>
            `;
            leadsTableBody.appendChild(row);
        });
    }

    function formatPhoneNumber(phone) {
        if (!phone || phone === 'N/A') return 'N/A';
        const cleaned = ('' + phone).replace(/\D/g, '');
        if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        if (cleaned.length === 11) return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        return phone;
    }

    // Export functionality
    exportCsvBtn.addEventListener('click', () => exportData('csv'));
    exportExcelBtn.addEventListener('click', () => exportData('excel'));
    exportPdfBtn.addEventListener('click', () => exportData('pdf'));

    function exportData(format) {
        if (leadsData.length === 0) return;
        const csvContent = "data:text/csv;charset=utf-8," +
            "Name,Phone,Address,Website\n" +
            leadsData.map(l => `${escapeCSV(l.name)},${escapeCSV(l.phone)},${escapeCSV(l.address)},${escapeCSV(l.website)}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `google_maps_leads.${format}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function escapeCSV(str) {
        if (!str) return '';
        const stringValue = String(str);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }
});
