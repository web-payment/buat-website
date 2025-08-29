document.addEventListener('DOMContentLoaded', () => {
    // === Elemen UI ===
    const creatorForm = document.getElementById('creator-form');
    const subdomainInput = document.getElementById('subdomain-name');
    const rootDomainSelect = document.getElementById('root-domain-select');
    const websiteFileInput = document.getElementById('website-file');
    const fileNameSpan = document.getElementById('file-name-span');
    const userApiKeyInput = document.getElementById('user-api-key');
    const createBtn = document.getElementById('create-btn');
    const btnText = document.getElementById('btn-text');
    const sitesContainer = document.getElementById('created-sites-container');
    const sitesList = document.getElementById('sites-list');
    const detailsModal = document.getElementById('details-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalVercelUrl = document.getElementById('modal-vercel-url');
    const modalCustomUrl = document.getElementById('modal-custom-url');
    const modalCheckStatusBtn = document.getElementById('modal-check-status-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const loadingOverlay = document.getElementById('loading-overlay');
    const showPricingBtn = document.getElementById('show-pricing-btn');
    const pricingModal = document.getElementById('pricing-modal');
    const pricingModalCloseBtn = document.getElementById('pricing-modal-close-btn');
    const pricingModalList = document.getElementById('pricing-modal-list');
    const modalDiscountBanner = document.getElementById('modal-discount-banner');
    const modalCountdownTimer = document.getElementById('modal-countdown-timer');

    let toastTimeout, countdownInterval, settings = {};

    const showToast = (message, type = 'success') => {
        const toast = document.getElementById('toast-notification');
        toast.textContent = message;
        toast.className = '';
        toast.classList.add(type, 'show');
        toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 4000);
    };

    const applyTheme = (theme) => {
        body.classList.toggle('dark-mode', theme === 'dark');
        themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    };

    const renderSitesList = () => {
        const sites = JSON.parse(localStorage.getItem('createdSites_v1')) || [];
        sitesContainer.style.display = sites.length > 0 ? 'block' : 'none';
        sitesList.innerHTML = sites.map(site => `
            <div class="sites-list-item" data-site='${JSON.stringify(site)}'>
                <div class="site-info"><h3>${site.customUrl.replace('https://','')}</h3><p>${site.vercelUrl.replace('https://','')}</p></div>
                <span class="status ${site.status}">${site.status === 'success' ? 'Aktif' : 'Menunggu'}</span>
            </div>`).join('');
    };
    
    const showDetailsModal = (siteData) => {
        modalVercelUrl.href = siteData.vercelUrl;
        modalVercelUrl.textContent = siteData.vercelUrl.replace('https://','');
        modalCustomUrl.href = siteData.customUrl;
        modalCustomUrl.textContent = siteData.customUrl.replace('https://','');
        modalCheckStatusBtn.dataset.domain = siteData.customUrl.replace('https://','');
        detailsModal.classList.add('show');
    };

    const fetchAPI = async (action, data = {}) => {
        const response = await fetch('/api/create-website', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        return result;
    };

    const updatePricingUI = () => {
        const { pricingPlans = [], discountEndDate } = settings;
        const isDiscountActive = discountEndDate && new Date(discountEndDate) > new Date();
        
        pricingModalList.innerHTML = '';
        if (pricingPlans.length === 0) {
            pricingModalList.innerHTML = '<p style="text-align:center; color: var(--text-muted)">Belum ada paket harga.</p>';
        } else {
            pricingPlans.forEach(plan => {
                const price = isDiscountActive && plan.discountPrice ? plan.discountPrice : plan.price;
                const oldPrice = isDiscountActive && plan.discountPrice ? `<div class="normal-price">Rp ${plan.price.toLocaleString('id-ID')}</div>` : '';
                const planEl = document.createElement('div');
                planEl.className = 'pricing-plan';
                planEl.innerHTML = `<h4>${plan.name}</h4><p>${plan.description || ''}</p><div class="price-tag">${oldPrice}<div class="final-price">Rp ${price.toLocaleString('id-ID')}</div></div><button class="button-primary buy-plan-btn" data-plan-name="${plan.name}"><i class="fab fa-whatsapp"></i> Beli Paket Ini</button>`;
                pricingModalList.appendChild(planEl);
            });
        }
        modalDiscountBanner.style.display = isDiscountActive ? 'block' : 'none';
        if (isDiscountActive) startCountdown(new Date(discountEndDate));
        else if (countdownInterval) clearInterval(countdownInterval);
    };

    const startCountdown = (endDate) => {
        if(countdownInterval) clearInterval(countdownInterval);
        const update = () => {
            const distance = endDate - new Date();
            if (distance < 0) { clearInterval(countdownInterval); updatePricingUI(); return; }
            const days = Math.floor(distance / 86400000);
            const hours = Math.floor((distance % 86400000) / 3600000);
            const minutes = Math.floor((distance % 3600000) / 60000);
            const seconds = Math.floor((distance % 60000) / 1000);
            const pad = (n) => n < 10 ? '0' + n : n;
            modalCountdownTimer.textContent = `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        };
        update();
        countdownInterval = setInterval(update, 1000);
    };

    // === Event Listeners ===
    themeToggle.addEventListener('click', () => {
        const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme_preference_v1', newTheme);
        applyTheme(newTheme);
    });

    subdomainInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    });

    websiteFileInput.addEventListener('change', () => {
        fileNameSpan.textContent = websiteFileInput.files.length > 0 ? websiteFileInput.files[0].name : 'Pilih file...';
    });

    creatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        createBtn.disabled = true;
        btnText.innerHTML = '<div class="spinner"></div>';
        const formData = new FormData();
        formData.append('subdomain', subdomainInput.value);
        formData.append('rootDomain', rootDomainSelect.value);
        formData.append('apiKey', userApiKeyInput.value);
        formData.append('websiteFile', websiteFileInput.files[0]);
        try {
            const response = await fetch('/api/create-website', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            const sites = JSON.parse(localStorage.getItem('createdSites_v1')) || [];
            sites.unshift(result.siteData);
            localStorage.setItem('createdSites_v1', JSON.stringify(sites));
            renderSitesList();
            showDetailsModal(result.siteData);
            creatorForm.reset();
            fileNameSpan.textContent = 'Pilih file...';
        } catch (error) {
            showToast(`Gagal: ${error.message}`, 'error');
        } finally {
            createBtn.disabled = false;
            btnText.textContent = 'Buat Website';
        }
    });
    
    sitesList.addEventListener('click', (e) => {
        const item = e.target.closest('.sites-list-item');
        if (item) showDetailsModal(JSON.parse(item.dataset.site));
    });
    
    [detailsModal, pricingModal].forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    });
    
    modalCloseBtn.addEventListener('click', () => detailsModal.classList.remove('show'));
    pricingModalCloseBtn.addEventListener('click', () => pricingModal.classList.remove('show'));
    showPricingBtn.addEventListener('click', () => pricingModal.classList.add('show'));

    pricingModalList.addEventListener('click', (e) => {
        const buyButton = e.target.closest('.buy-plan-btn');
        if (buyButton) {
            const planName = buyButton.dataset.planName;
            if (!settings.whatsappNumber) return showToast('Nomor WhatsApp admin belum diatur.', 'error');
            const message = encodeURIComponent(`Halo, saya tertarik membeli paket: "${planName}".`);
            window.open(`https://wa.me/${settings.whatsappNumber}?text=${message}`, '_blank');
        }
    });

    // === Inisialisasi Halaman ===
    const initializePage = async () => {
        applyTheme(localStorage.getItem('theme_preference_v1') || 'dark');
        renderSitesList();
        try {
            const domains = await (await fetch('/api/create-website')).json();
            rootDomainSelect.innerHTML = domains.map(d => `<option value="${d}">.${d}</option>`).join('');
            settings = await fetchAPI('getSettings');
            updatePricingUI();
        } catch (error) {
            showToast('Gagal memuat data awal.', 'error');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    };
    
    initializePage();
});