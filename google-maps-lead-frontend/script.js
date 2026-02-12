const API_BASE_URL = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const resultsSection = document.getElementById('results-section');
    const leadsTableBody = document.getElementById('leads-body');
    const resultCount = document.getElementById('result-count');
    const exportBtn = document.getElementById('export-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const searchBtn = document.getElementById('search-btn');
    // Theme logic
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const statusMessage = document.getElementById('status-message');
    const liveStatus = document.getElementById('live-status');
    const pricingModal = document.getElementById('pricing-modal');
    const upgradeStarterBtn = document.getElementById('upgrade-starter-btn');
    const upgradeProBtn = document.getElementById('upgrade-pro-btn');
    const upgradeAgencyBtn = document.getElementById('upgrade-agency-btn');
    const headerUpgradeBtn = document.getElementById('header-upgrade-btn');
    const headerPlanBadge = document.getElementById('header-plan-badge');
    const headerCreditsDisplay = document.getElementById('header-credits-display');

    // State Variables (Moved to top to prevent ReferenceError)
    let isScrapingActive = false;
    let leadsData = [];
    let scrapingInterval = null;
    let currentSearchesLeft = 0;
    let hasShownLimitWarning = false;
    let currentUserPlan = 'Free';

    // Function to sync icons
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

    // Initial sync
    syncIcons();

    themeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        const isDark = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        syncIcons();
    });

    // Mobile Menu Toggle logic
    const menuToggle = document.getElementById('menu-toggle');
    const headerActionsContainer = document.getElementById('header-actions-container');

    if (menuToggle && headerActionsContainer) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menuToggle.classList.toggle('active');
            headerActionsContainer.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!headerActionsContainer.contains(e.target) && !menuToggle.contains(e.target)) {
                menuToggle.classList.remove('active');
                headerActionsContainer.classList.remove('active');
            }
        });

        // Close menu on link click (for mobile experience)
        headerActionsContainer.querySelectorAll('a, button').forEach(item => {
            item.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                headerActionsContainer.classList.remove('active');
            });
        });
    }



    // Elements
    const statusBadge = document.getElementById('app-status-badge');
    const leadCounter = document.getElementById('live-lead-counter');
    const exportActions = document.getElementById('export-actions');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportExcelBtn = document.getElementById('export-excel-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const stopBtn = document.getElementById('stop-btn');
    const searchesLeftSpan = document.getElementById('searches-left-count');



    async function fetchUserData() {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/user/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const user = await res.json();
                currentSearchesLeft = user.credits;

                // Update Header
                if (headerPlanBadge) headerPlanBadge.textContent = user.plan || 'Free';
                currentUserPlan = user.plan || 'Free';
                if (headerCreditsDisplay) headerCreditsDisplay.textContent = `${currentSearchesLeft} Credits`;

                // Update Pricing Modal Buttons
                updatePricingModalButtons(user.plan);

                updateSearchesLeftDisplay();
            }
        } catch (err) {
            console.error('Failed to fetch user data:', err);
        }
    }

    function updatePricingModalButtons(currentPlan) {
        const planKey = (currentPlan || 'Free').toUpperCase();

        const buttons = {
            'FREE': document.getElementById('upgrade-free-btn'),
            'STARTER': document.getElementById('upgrade-starter-btn'),
            'PRO': document.getElementById('upgrade-pro-btn'),
            'AGENCY': document.getElementById('upgrade-agency-btn')
        };

        Object.keys(buttons).forEach(key => {
            const btn = buttons[key];
            if (!btn) return;

            if (key === planKey) {
                btn.textContent = 'Current Plan';
                btn.disabled = true;
                btn.classList.add('btn-disabled');
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            } else {
                // Paid plans that aren't current
                if (key !== 'FREE') {
                    btn.textContent = 'Get Started';
                    btn.disabled = false;
                    btn.classList.remove('btn-disabled', 'btn-outline');
                    btn.classList.add('btn-primary');
                } else {
                    // Free plan that isn't current (implies user is on a paid plan)
                    btn.textContent = 'Included';
                    btn.disabled = true;
                    btn.classList.add('btn-disabled', 'btn-outline');
                    btn.classList.remove('btn-primary');
                }
            }
        });
    }

    function updateSearchesLeftDisplay() {
        if (!searchesLeftSpan) return;

        const token = localStorage.getItem('authToken');
        const badgeContainer = document.querySelector('.searches-left-badge');

        if (!token) {
            // Guest mode: Hide the badge and clear any limit messages
            if (badgeContainer) badgeContainer.style.display = 'none';
            liveStatus.classList.add('hidden');
            liveStatus.textContent = '';

            // Ensure search button is clickable so guest gets the "Login" prompt
            if (!isScrapingActive) {
                searchBtn.disabled = false;
                searchBtn.classList.remove('btn-disabled');
            }
            return;
        }

        // Logged in mode: Show badge and update count
        if (badgeContainer) badgeContainer.style.display = 'flex';
        searchesLeftSpan.textContent = currentSearchesLeft;
        if (headerCreditsDisplay) headerCreditsDisplay.textContent = `${currentSearchesLeft} Credits`;
        updateBadgeStyle(currentSearchesLeft);

        if (currentSearchesLeft <= 0) {
            searchBtn.disabled = true;
            searchBtn.classList.add('btn-disabled');
            liveStatus.textContent = 'Search credit limit reached. Please upgrade to continue.';
            liveStatus.classList.remove('hidden');
            liveStatus.classList.add('limit-reached');
        } else {
            // Re-enable if credits > 0 and not currently scraping
            if (!isScrapingActive) {
                searchBtn.disabled = false;
                searchBtn.classList.remove('btn-disabled');
            }
            liveStatus.classList.add('hidden');
            liveStatus.classList.remove('limit-reached');

            // Trigger limit warning popup when searches match 3 or fewer
            if (currentSearchesLeft <= 3 && !hasShownLimitWarning && currentSearchesLeft > 0) {
                showLimitWarning(currentSearchesLeft);
                hasShownLimitWarning = true;
            }
        }
    }

    function showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`; // Add type class for styling

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            setTimeout(() => toast.classList.add('show'), 10);
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    function showLimitWarning(credits) {
        // Create container if it doesn't exist
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <span class="toast-icon">⚠️</span>
            <span>You have only ${credits} searches left. Upgrade now to avoid interruption.</span>
            <button class="toast-upgrade-btn">Upgrade Plan</button>
        `;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500); // Remove from DOM after animation
        }, 5000);

        // Toast Upgrade Button Click
        toast.querySelector('.toast-upgrade-btn').addEventListener('click', () => {
            togglePricingModal(true);
            toast.remove();
        });
    }

    function togglePricingModal(show) {
        if (!pricingModal) return;
        if (show) {
            pricingModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            pricingModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Razorpay Upgrade Function
    async function upgradePlan(planType, button) {
        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please login to upgrade');
            toggleModal(true);
            return;
        }

        const originalText = button.textContent;
        try {
            button.textContent = 'Processing...';
            button.disabled = true;

            // 1. Create Order
            const orderRes = await fetch(`${API_BASE_URL}/api/payment/order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ planType })
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.message || 'Order creation failed');

            // 2. Initialize Razorpay (Consolidated key is now in orderData)
            const options = {
                "key": orderData.razorpayKey,
                "amount": orderData.amount,
                "currency": orderData.currency,
                "name": "Google Maps Lead Extractor",
                "description": `Upgrade to ${planType} Plan`,
                "image": "https://cdn-icons-png.flaticon.com/512/174/174881.png",
                "order_id": orderData.id,
                "handler": async function (response) {
                    try {
                        // 4. Verify Payment
                        const verifyRes = await fetch(`${API_BASE_URL}/api/payment/verify`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                planType: planType
                            })
                        });

                        const verifyData = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(verifyData.message || 'Payment verification failed');

                        // Success
                        alert(verifyData.message);
                        currentSearchesLeft = verifyData.credits;
                        if (headerPlanBadge) headerPlanBadge.textContent = verifyData.plan;
                        updateSearchesLeftDisplay();
                        togglePricingModal(false);
                        await fetchUserData();

                    } catch (error) {
                        alert(error.message);
                    }
                },
                "prefill": {
                    "name": storedUser.username || "",
                    "email": storedUser.email || ""
                },
                "theme": {
                    "color": "#9333ea"
                }
            };

            const rzp1 = new Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                alert("Payment Failed: " + response.error.description);
            });
            rzp1.open();

        } catch (err) {
            alert(err.message);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    // Upgrade Button Click Handlers
    if (upgradeStarterBtn) {
        upgradeStarterBtn.addEventListener('click', () => upgradePlan('Starter', upgradeStarterBtn));
    }

    if (upgradeProBtn) {
        upgradeProBtn.addEventListener('click', () => upgradePlan('Pro', upgradeProBtn));
    }

    // Upgrade Button Click Handlers

    if (upgradeAgencyBtn) {
        upgradeAgencyBtn.addEventListener('click', () => upgradePlan('Agency', upgradeAgencyBtn));
    }

    if (searchesLeftSpan) {
        updateSearchesLeftDisplay();
    }

    function updateBadgeStyle(count) {
        if (!searchesLeftSpan) return;
        const badge = searchesLeftSpan.closest('.searches-left-badge');
        if (!badge) return;

        badge.classList.remove('warning', 'empty');

        if (count === 0) {
            badge.classList.add('empty');
        } else if (count <= 2) {
            badge.classList.add('warning');
        }
    }



    // Helper: Update App Status
    function updateAppStatus(status) {
        // Remove all previous status classes
        statusBadge.classList.remove('status-idle', 'status-scraping', 'status-stopped', 'status-completed');

        let statusClass = 'status-idle';
        let statusText = 'Idle';

        switch (status) {
            case 'scraping':
                statusClass = 'status-scraping';
                statusText = 'Scraping';
                break;
            case 'stopped':
                statusClass = 'status-stopped';
                statusText = 'Stopped';
                break;
            case 'completed':
                statusClass = 'status-completed';
                statusText = 'Completed';
                break;
            default:
                statusClass = 'status-idle';
                statusText = 'Idle';
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
            clearTimeout(scrapingInterval); // Changed fromclearInterval to clearTimeout for recursive timeout
            scrapingInterval = null;
        }
        isScrapingActive = false;

        // Reset button states
        if (currentSearchesLeft > 0) {
            searchBtn.disabled = false;
        } else {
            searchBtn.disabled = true; // Ensure it stays disabled
        }
        searchBtn.innerHTML = '<span>Search</span>';
        stopBtn.disabled = true;

        // Remove scraping animations
        searchForm.classList.remove('scraping-active');
        searchBtn.classList.remove('scraping-active');

        loadingIndicator.classList.add('hidden');

        // Update live status & message
        if (currentSearchesLeft <= 0) {
            liveStatus.textContent = 'Search credit limit reached. Please upgrade to continue.';
            liveStatus.classList.remove('hidden', 'searching', 'stopped');
            liveStatus.classList.add('limit-reached');
        } else if (reason === 'completed') {
            liveStatus.textContent = 'Completed';
            liveStatus.classList.remove('hidden', 'searching', 'stopped', 'limit-reached');
            liveStatus.classList.add('completed');
            updateAppStatus('completed');

            // Show completion message
            statusMessage.style.display = 'block';
            statusMessage.textContent = `Search finished. Total leads extracted: ${leadsData.length}`;
            statusMessage.className = 'status-message success';

        } else if (reason === 'stopped') {
            liveStatus.textContent = 'Stopped by user';
            liveStatus.classList.remove('hidden', 'searching', 'limit-reached');
            liveStatus.classList.add('stopped');
            updateAppStatus('stopped');

            // Show stopped message
            statusMessage.style.display = 'block';
            statusMessage.textContent = `Scraping stopped. Total leads extracted: ${leadsData.length}`;
            statusMessage.className = 'status-message success'; // Keep it green/neutral for user stop

        } else {
            // It's an ERROR message
            liveStatus.textContent = 'Error';
            liveStatus.classList.remove('hidden', 'searching', 'stopped', 'completed');
            liveStatus.classList.add('limit-reached'); // Use red style
            updateAppStatus('stopped');

            // Show error message
            statusMessage.style.display = 'block';
            statusMessage.textContent = reason; // Display the actual error
            statusMessage.className = 'status-message error';
        }

        if (leadsData.length > 0) {
            exportActions.style.display = 'flex';
        }
    }

    // Initialize Socket.io
    const socket = io(API_BASE_URL);

    socket.on('connect', () => {
        console.log('Connected to WebSocket:', socket.id);
    });

    socket.on('newLead', (lead) => {
        if (!isScrapingActive) return;

        // Dedup check
        const exists = leadsData.some(existing =>
            existing.name === lead.name && existing.address === lead.address
        );

        if (!exists) {
            leadsData.push(lead);
            updateLeadCount(leadsData.length);

            // Append row directly for performance
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

            // Auto-scroll
            // resultsSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    });

    socket.on('progress', (data) => {
        if (!isScrapingActive) return;
        liveStatus.textContent = `Scraping... ${data.percent}% (${data.collected}/${data.limit})`;
        // Could update a progress bar here if we had one
    });

    socket.on('log', (data) => {
        if (!isScrapingActive) return;
        statusMessage.style.display = 'block';
        statusMessage.textContent = data.message;
        statusMessage.className = 'status-message';
    });

    socket.on('scrapingComplete', (data) => {
        console.log('Scraping complete:', data);
        stopScraping('completed');
        // Update credits locally since backend deducted them
        // A fresh fetchUserData() would be better to sync exactly
        fetchUserData();
    });

    socket.on('scrapingError', (data) => {
        console.error('Scraping error:', data);
        stopScraping(data.message || 'Unknown error occurred');
    });


    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const keyword = document.getElementById('keyword').value.trim();
        const location = document.getElementById('location').value.trim();
        const limit = 500; // Default limit

        if (!keyword || !location) {
            alert('Please enter both keyword and location');
            return;
        }

        const token = localStorage.getItem('authToken');
        if (!token) {
            alert('Please login to start searching');
            toggleModal(true);
            return;
        }

        if (isScrapingActive) {
            stopScraping();
        }

        // Reset UI
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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    keyword,
                    location,
                    limit: 50 // SerpApi free tier usually allows ~20 results per page, but we'll request up to 50 if applicable
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    // Free tier limit reached or insufficient credits
                    stopScraping(data.message || 'Free tier limit reached.');
                    if (data.message.includes('Free tier')) {
                        showToast(data.message, 'warning');
                    } else {
                        togglePricingModal(true);
                    }
                } else {
                    throw new Error(data.message || 'Failed to start scraping');
                }
            } else {
                console.log('Scraping successful:', data.total);

                // Handle results
                leadsData = data.leads || [];
                renderTable(leadsData);
                updateLeadCount(leadsData.length);

                if (data.remainingFreeCredits !== undefined) {
                    // For SerpApi, credits are managed on their platform
                    console.log(`Remaining SerpApi Credits Information: ${data.remainingFreeCredits}`);
                }

                stopScraping('completed');

                // Refresh user data (credits, etc.)
                fetchUserData();
            }

        } catch (error) {
            console.error('Search error:', error);
            stopScraping(error.message);
        }
    });

    // Modified fetchData to handle recursion and errors better
    // Note: We need to redefine fetchData outside or attach logic to it. 
    // Since fetchData is defined inside the event listener, we need to modify the event listener logic slightly 
    // or just let the recursion happen within fetchData if we move the definition or adjust it.

    // Actually, looking at the code structure, fetchData is defined INSIDE the 'submit' listener.
    // So we can just add the recursion logic inside that fetchData function.

    // Let's replace the ENTIRE submit listener content to be safe and clean.


    let pollRetryCount = 0;
    const MAX_POLL_RETRIES = 60; // Max 5 minutes (5s * 60)

    async function pollTaskStatus(taskId) {
        const pollInterval = 5000; // Safe 5-second retry interval

        try {
            const response = await fetch(`${API_BASE_URL}/get-task-results/${taskId}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'Success') {
                leadsData = data.results;
                renderTable(leadsData);
                updateLeadCount(leadsData.length);
                updateAppStatus('completed');
                statusMessage.textContent = `Successfully extracted ${leadsData.length} leads!`;
                statusMessage.className = 'status-message success';
                loadingIndicator.classList.add('hidden');

                if (currentSearchesLeft > 0) {
                    searchBtn.disabled = false;
                } else {
                    searchBtn.disabled = true;
                }

                searchBtn.textContent = 'Search';
                if (leadsData.length > 0) exportActions.style.display = 'flex';
                pollRetryCount = 0; // Reset for next search
            } else if (data.status === 'Pending' || data.status === 'Running' || data.status === 'Waiting') {
                pollRetryCount++;
                updateAppStatus('scraping');

                if (pollRetryCount >= MAX_POLL_RETRIES) {
                    throw new Error('Task took too long to complete. Please try again later.');
                }

                statusMessage.textContent = `Processing task: ${taskId} (${data.status})... Attempt ${pollRetryCount}/${MAX_POLL_RETRIES}`;
                setTimeout(() => pollTaskStatus(taskId), pollInterval);
            } else if (data.status === 'Error' || data.status === 'Failed' || data.error) {
                throw new Error(data.message || 'Task failed on the provider side.');
            } else {
                // Unexpected status, wait and try again
                console.warn('Unexpected task status:', data.status);
                setTimeout(() => pollTaskStatus(taskId), pollInterval);
            }
        } catch (error) {
            console.error('Polling error:', error);
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.className = 'status-message error';
            loadingIndicator.classList.add('hidden');

            if (currentSearchesLeft > 0) {
                searchBtn.disabled = false;
            } else {
                searchBtn.disabled = true;
            }

            searchBtn.textContent = 'Search';
            updateAppStatus('stopped');
            pollRetryCount = 0;
        }
    }

    function renderTable(data) {
        if (!resultCount || !leadsTableBody) return;
        resultCount.textContent = data.length;
        leadsTableBody.innerHTML = '';

        data.forEach(lead => {
            const row = document.createElement('tr');
            // Modified Column Order: Name, Phone, Address, Website
            // Removed: Email, Rating
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

    function downloadData(format) {
        if (leadsData.length === 0) return;

        // Plan Logic: Starter is limited to CSV
        const plan = currentUserPlan.toUpperCase();
        if ((format === 'excel' || format === 'pdf') && (plan === 'FREE' || plan === 'STARTER')) {
            showToast(`Upgrade to Pro to export as ${format.toUpperCase()}`, 'warning');
            togglePricingModal(true);
            return;
        }

        // Headers for export
        const headers = ['Name', 'Phone', 'Address', 'Website'];

        if (format === 'csv') {
            const csvRows = [headers.join(',')];
            leadsData.forEach(lead => {
                const row = [
                    escapeCSV(lead.name),
                    escapeCSV(lead.phone),
                    escapeCSV(lead.address),
                    escapeCSV(lead.website)
                ];
                csvRows.push(row.join(','));
            });
            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            triggerDownload(blob, 'csv');
        } else if (format === 'excel') {
            // Frontend-only Excel Hack (HTML Table to XLS)
            let tableHTML = '<table border="1"><thead><tr>';
            headers.forEach(h => { tableHTML += `<th>${h}</th>`; });
            tableHTML += '</tr></thead><tbody>';

            leadsData.forEach(lead => {
                tableHTML += '<tr>';
                tableHTML += `<td>${lead.name || ''}</td>`;
                tableHTML += `<td>${lead.phone || ''}</td>`;
                tableHTML += `<td>${lead.address || ''}</td>`;
                tableHTML += `<td>${lead.website || ''}</td>`;
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table>';

            const blob = new Blob(['\ufeff', tableHTML], { type: 'application/vnd.ms-excel' });
            triggerDownload(blob, 'xls');
        } else if (format === 'pdf') {
            generatePDF(headers, leadsData);
        }
    }

    function generatePDF(headers, data) {
        // Simple printable HTML approach for PDF
        const printWindow = window.open('', '_blank');
        let html = `
            <html>
                <head>
                    <title>Leads Export - ${new Date().toLocaleDateString()}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h1 { color: #9333ea; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f3f4f6; }
                        .footer { margin-top: 30px; font-size: 0.8rem; color: #666; text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Promptix Leads Report</h1>
                    <p>Total Leads extracted: ${data.length}</p>
                    <table>
                        <thead>
                            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${data.map(lead => `
                                <tr>
                                    <td>${lead.name || ''}</td>
                                    <td>${lead.phone || ''}</td>
                                    <td>${lead.address || ''}</td>
                                    <td>${lead.website || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="footer">Generated by Promptix - Google Maps Lead Extractor</div>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();

        // Brief delay to ensure styles load before print dialog
        setTimeout(() => {
            printWindow.print();
            // Optional: Close window after print
            // printWindow.close();
        }, 500);
    }

    function triggerDownload(blob, ext) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads - ${new Date().toISOString().slice(0, 10)}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    exportCsvBtn.addEventListener('click', () => downloadData('csv'));
    exportExcelBtn.addEventListener('click', () => downloadData('excel'));
    exportPdfBtn.addEventListener('click', () => downloadData('pdf'));

    const historyBtn = document.getElementById('history-btn'); // Payments button
    const searchHistoryBtn = document.getElementById('search-history-btn');
    const historyModal = document.getElementById('history-modal');
    const historyBody = document.getElementById('history-body');
    const noHistoryMsg = document.getElementById('no-history-msg');

    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            const token = localStorage.getItem('authToken');
            if (!token) {
                // Not logged in -> Show login modal
                toggleModal(true);
                return;
            }
            fetchPaymentHistory();
            toggleHistoryModal(true);
        });
    }

    function toggleHistoryModal(show) {
        if (!historyModal) return;
        if (show) {
            historyModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            historyModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Close history modal on close button click
    if (historyModal) {
        const closeBtn = historyModal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => toggleHistoryModal(false));
        }
        // Close on outside click
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) {
                toggleHistoryModal(false);
            }
        });
    }


    // History Loading & Error Elements
    const historyLoading = document.getElementById('history-loading');
    const historyError = document.getElementById('history-error');
    const retryHistoryBtn = document.getElementById('retry-history-btn');
    const historyTableContainer = document.querySelector('#history-modal .table-container');

    if (retryHistoryBtn) {
        retryHistoryBtn.addEventListener('click', () => fetchPaymentHistory());
    }

    async function fetchPaymentHistory() {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        // Reset UI States
        noHistoryMsg.classList.add('hidden');
        if (historyError) historyError.classList.add('hidden');
        if (historyLoading) historyLoading.classList.remove('hidden');
        if (historyTableContainer) historyTableContainer.style.display = 'none';

        historyBody.innerHTML = ''; // Clear existing rows

        try {
            const res = await fetch(`${API_BASE_URL}/api/payment/history`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const history = await res.json();
                renderHistoryTable(history);
            } else {
                throw new Error('Failed to fetch history');
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
            if (historyError) historyError.classList.remove('hidden');
        } finally {
            if (historyLoading) historyLoading.classList.add('hidden');
        }
    }

    function renderHistoryTable(history) {
        historyBody.innerHTML = '';
        const tableContainer = document.querySelector('#history-modal .table-container');

        if (!history || history.length === 0) {
            noHistoryMsg.classList.remove('hidden');
            if (tableContainer) tableContainer.style.display = 'none';
            return;
        }

        noHistoryMsg.classList.add('hidden');
        if (tableContainer) tableContainer.style.display = 'block';

        history.forEach(item => {
            const row = document.createElement('tr');
            const dateDate = new Date(item.date);
            const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const formattedDate = dateDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(',', ''); // Remove comma for cleaner look e.g. "Feb 11 2026 11:30 AM"

            // Status Badge Logic
            let statusClass = 'badge-created'; // Default/Created (Yellow)
            if (item.status === 'SUCCESS') statusClass = 'badge-success'; // Green
            else if (item.status === 'FAILED') statusClass = 'badge-failed'; // Red

            row.innerHTML = `
                <td data-label="Date">${formattedDate}</td>
                <td data-label="Plan"><strong>${item.plan}</strong></td>
                <td data-label="Amount">₹${item.amount}</td>
                <td data-label="Status"><span class="badge-status ${statusClass}">${item.status}</span></td>
                <td data-label="Reference ID">
                    <div style="font-family:monospace; font-size:0.9em; display:flex; align-items:center; gap:8px;">
                        ${item.paymentId}
                        <button class="btn-copy" onclick="navigator.clipboard.writeText('${item.paymentId}').then(() => showToast('Copied to clipboard!', 'success'))" title="Copy ID">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                    </div>
                </td>
                <td data-label="Invoice">
                    ${item.status === 'SUCCESS' ?
                    `<button class="btn-download-invoice" data-id="${item.paymentId}" title="Download Invoice">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>` :
                    '<span style="color:#94a3b8; font-size:0.8em;">-</span>'
                }
                </td>
            `;
            historyBody.appendChild(row);
        });

        // Add Event Listeners for Download Buttons
        document.querySelectorAll('.btn-download-invoice').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const button = e.currentTarget;
                const paymentId = button.getAttribute('data-id');
                const originalContent = button.innerHTML;

                // Show loading state on button
                button.innerHTML = '<span style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-radius:50%; border-top-color:transparent; animation:spin 1s linear infinite;"></span>';
                button.disabled = true;

                try {
                    const token = localStorage.getItem('authToken');
                    const res = await fetch(`${API_BASE_URL}/api/payment/invoice/${paymentId}/pdf`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (res.status === 401) {
                        toggleHistoryModal(false);
                        toggleModal(true); // Open login modal
                        showToast('Please login to download invoice', 'warning');
                        return;
                    }

                    if (!res.ok) throw new Error('Failed to download invoice');

                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);

                    // Trigger download
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `invoice - ${paymentId}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    // Cleanup
                    window.URL.revokeObjectURL(url);
                    showToast('Invoice downloaded successfully', 'success');

                } catch (err) {
                    console.error('Download error:', err);
                    showToast('Could not download invoice. Please try again.', 'error');
                } finally {
                    button.innerHTML = originalContent;
                    button.disabled = false;
                }
            });
        });
    }


    function escapeCSV(str) {
        if (!str) return '';
        const stringValue = String(str);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    function formatPhoneNumber(phone) {
        if (!phone || phone === 'N/A') return 'N/A';

        // Remove all non-numeric characters for processing
        const cleaned = ('' + phone).replace(/\D/g, '');

        // Check if it's likely a US/India 10 digit number
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }

        // Check for 11 digits (start with 1 or similar country code)
        if (cleaned.length === 11) {
            return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }

        // Return original if no specific pattern matches (many Google Maps results are already formatted)
        // If the original had content but cleaned was empty (e.g. only text?), return original
        if (cleaned.length === 0 && phone.length > 0) return phone;

        return phone;
    }

    // --- Authentication Logic ---
    const authModal = document.getElementById('auth-modal');
    const loginTrigger = document.getElementById('login-trigger');
    const closeModal = document.querySelector('.close-modal');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');
    const userProfile = document.getElementById('user-profile');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');

    // Check for existing token
    const storedToken = localStorage.getItem('authToken');
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');

    if (storedToken && storedUser.username) {
        updateAuthUI(true, storedUser.username);
        fetchUserData(); // Fetch fresh credits on load
    }

    // UI Functions
    function updateAuthUI(isLoggedIn, username = '') {
        if (isLoggedIn) {
            loginTrigger.classList.add('hidden');
            userProfile.classList.remove('hidden');
            if (usernameDisplay) usernameDisplay.textContent = username;
            fetchUserData(); // Always fetch fresh credits when UI updates to logged in
        } else {
            loginTrigger.classList.remove('hidden');
            userProfile.classList.add('hidden');
            if (usernameDisplay) usernameDisplay.textContent = '';
            // Reset to guest defaults if logged out
            currentSearchesLeft = 0;
            updateSearchesLeftDisplay();
        }
    }

    function toggleModal(show) {
        if (show) {
            authModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            authModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Event Listeners
    if (loginTrigger) {
        loginTrigger.addEventListener('click', () => toggleModal(true));
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => toggleModal(false));
    }

    window.addEventListener('click', (e) => {
        if (e.target === authModal) toggleModal(false);
        if (e.target === pricingModal) togglePricingModal(false);
    });

    const pricingClose = pricingModal?.querySelector('.close-modal');
    if (pricingClose) {
        pricingClose.addEventListener('click', () => togglePricingModal(false));
    }

    if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            updateAuthUI(false);
        });
    }

    // Login Handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const btn = loginForm.querySelector('button');
            const originalText = btn.textContent;

            try {
                btn.textContent = 'Logging in...';
                btn.disabled = true;

                const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Login failed');

                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                updateAuthUI(true, data.user.username);
                toggleModal(false);
                loginForm.reset();

            } catch (err) {
                alert(err.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Register Handler
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;
            const btn = registerForm.querySelector('button');
            const originalText = btn.textContent;

            try {
                btn.textContent = 'Signing up...';
                btn.disabled = true;

                const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Registration failed');

                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                updateAuthUI(true, data.user.username);
                toggleModal(false);
                registerForm.reset();

            } catch (err) {
                alert(err.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Check for active job on page load
    async function checkActiveJob() {
        const token = localStorage.getItem('authToken'); // Changed from 'token' to 'authToken' to match existing code
        if (!token) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/jobs/active`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.active) {
                const job = data.job;
                console.log('Resuming active job:', job.jobId);

                // Update UI to searching state
                isScrapingActive = true;
                leadsData = []; // Or we could fetch current results if we had an endpoint for that
                updateLeadCount(job.progress || 0);

                const searchCard = document.querySelector('.search-card');
                const searchBtn = document.getElementById('search-btn');
                const liveStatus = document.getElementById('live-status');
                const statusMessage = document.getElementById('status-message');

                searchCard.classList.add('scraping-active');
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<span class="loader"></span> Searching...';

                liveStatus.classList.remove('hidden', 'stopped');
                liveStatus.classList.add('searching');
                liveStatus.textContent = `Scraping... (Resumed task ${job.jobId})`;

                statusMessage.style.display = 'block';
                statusMessage.textContent = `Resuming search for ${job.keyword} in ${job.location}...`;
            }
        } catch (error) {
            console.error('Error checking active job:', error);
        }
    }

    // Call on load
    checkActiveJob();
});
