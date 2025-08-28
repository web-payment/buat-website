document.addEventListener('DOMContentLoaded', () => {
    // === Elemen UI (Lengkap seperti kode asli Anda) ===
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
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmBtnYes = document.getElementById('confirm-btn-yes');
    const confirmBtnNo = document.getElementById('confirm-btn-no');
    const showGuideLink = document.getElementById('show-guide-link');
    const guideModal = document.getElementById('guide-modal');
    const guideCloseBtn = document.getElementById('guide-close-btn');
    const discountBanner = document.getElementById('discount-banner');
    const countdownTimer = document.getElementById('countdown-timer');
    // Elemen BARU untuk Modal Harga
    const showPricingBtn = document.getElementById('show-pricing-btn');
    const pricingModal = document.getElementById('pricing-modal');
    const pricingCloseBtn = document.getElementById('pricing-close-btn');
    const pricingGrid = document.getElementById('pricing-grid');


    // === Variabel & State ===
    let toastTimeout;
    let countdownInterval;
    let settings = {};

    // === Fungsi Bantuan & UI (Dari kode asli) ===
    const showToast = (message, type = 'info') => {
        const toast = document.getElementById('toast-notification');
        clearTimeout(toastTimeout);
        const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
        toast.innerHTML = `<i class="fas ${iconMap[type]}"></i> ${message}`;
        toast.className = '';
        toast.classList.add(type, 'show');
        toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 4000);
    };

    const applyTheme = (theme) => {
        body.classList.toggle('dark-mode', theme === 'dark');
        themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    };

    // === Manajemen Data (Lengkap seperti kode asli) ===
    const getSites = () => JSON.parse(localStorage.getItem('createdSites_v1')) || [];
    const saveSite = (siteData) => {
        const sites = getSites();
        sites.unshift(siteData);
        localStorage.setItem('createdSites_v1', JSON.stringify(sites));
    };
    const removeSite = (projectName) => {
        let sites = getSites();
        sites = sites.filter(s => s.projectName !== projectName);
        localStorage.setItem('createdSites_v1', JSON.stringify(sites));
        renderSitesList();
    };
    const updateSiteStatus = (projectName, newStatus) => {
        const sites = getSites();
        const siteIndex = sites.findIndex(s => s.projectName === projectName);
        if (siteIndex > -1) {
            sites[siteIndex].status = newStatus;
            localStorage.setItem('createdSites_v1', JSON.stringify(sites));
        }
        return sites[siteIndex];
    };

    // === Fungsi Render Tampilan (Lengkap seperti kode asli) ===
    const renderSitesList = () => {
        const sites = getSites();
        sitesContainer.style.display = sites.length > 0 ? 'block' : 'none';
        sitesList.innerHTML = '';
        sites.forEach(site => {
            const item = document.createElement('div');
            item.className = 'sites-list-item';
            item.innerHTML = `
                <div class="site-info">
                    <h3>${site.customUrl.replace('https://','')}</h3>
                    <p>${site.vercelUrl.replace('https://','')}</p>
                </div>
                <span class="status ${site.status}">${site.status === 'success' ? 'Aktif' : 'Menunggu'}</span>
                <button class="delete-site-btn" data-project-name="${site.projectName}" data-custom-url="${site.customUrl.replace('https://','')}"><i class="fas fa-times"></i></button>
            `;
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-site-btn')) {
                    showDetailsModal(site);
                }
            });
            item.querySelector('.delete-site-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const btn = e.currentTarget;
                const projectName = btn.dataset.projectName;
                const customUrl = btn.dataset.customUrl;
                showConfirmation('Hapus Riwayat?', `Yakin ingin menghapus riwayat untuk "${customUrl}"? Ini tidak akan menghapus websitenya.`).then(confirmed => {
                    if (confirmed) {
                        removeSite(projectName);
                        showToast('Riwayat berhasil dihapus.', 'success');
                    }
                });
            });
            sitesList.appendChild(item);
        });
    };
    
    const showConfirmation = (title, message) => {
        confirmationModal.querySelector('#confirmation-modal-title').textContent = title;
        confirmationModal.querySelector('#confirmation-modal-message').textContent = message;
        confirmationModal.classList.add('show');
        return new Promise(resolve => {
            confirmBtnYes.onclick = () => { confirmationModal.classList.remove('show'); resolve(true); };
            confirmBtnNo.onclick = () => { confirmationModal.classList.remove('show'); resolve(false); };
        });
    };

    const showDetailsModal = (siteData) => {
        modalVercelUrl.href = siteData.vercelUrl;
        modalVercelUrl.textContent = siteData.vercelUrl.replace('https://','');
        modalCustomUrl.href = siteData.customUrl;
        modalCustomUrl.textContent = siteData.customUrl.replace('https://','');
        modalCheckStatusBtn.dataset.project = siteData.projectName;
        modalCheckStatusBtn.dataset.domain = siteData.customUrl.replace('https://','');
        updateModalStatus(siteData.status);
        detailsModal.classList.add('show');
    };

    const updateModalStatus = (status) => {
        modalCheckStatusBtn.disabled = false;
        modalCheckStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Cek Status';
        if (status === 'success') {
            modalCheckStatusBtn.className = 'button-primary status success';
            modalCheckStatusBtn.textContent = 'Aktif';
            modalCheckStatusBtn.disabled = true;
        } else {
            modalCheckStatusBtn.className = 'button-primary status pending';
        }
    };

    // === Logika API (Gabungan) ===
    const fetchDomains = async () => {
        try {
            const response = await fetch('/api/create-website');
            if (!response.ok) throw new Error('Gagal memuat domain');
            const domains = await response.json();
            rootDomainSelect.innerHTML = domains.length > 0
                ? domains.map(domain => `<option value="${domain}">.${domain}</option>`).join('')
                : '<option value="">Tidak ada domain</option>';
        } catch (error) {
            rootDomainSelect.innerHTML = '<option value="">Error memuat</option>';
            showToast(error.message, 'error');
        }
    };
    
    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/create-website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSettings' })
            });
            if (!response.ok) throw new Error('Gagal memuat pengaturan harga.');
            settings = await response.json();
            updatePricingUI();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        }
    };
    
    // === Fitur Harga & Diskon (Integrasi Baru) ===
    const updatePricingUI = () => {
        pricingGrid.innerHTML = '';
        
        const promoTier = settings.pricingTiers ? settings.pricingTiers.find(t => t.isPromo) : null;
        if (promoTier && promoTier.promoEndDate) {
            const promoEndDate = new Date(promoTier.promoEndDate);
            if (promoEndDate > new Date()) {
                discountBanner.style.display = 'block';
                startCountdown(promoEndDate);
            } else {
                discountBanner.style.display = 'none';
                if(countdownInterval) clearInterval(countdownInterval);
            }
        } else {
            discountBanner.style.display = 'none';
            if(countdownInterval) clearInterval(countdownInterval);
        }

        if (settings.pricingTiers && settings.pricingTiers.length > 0) {
            settings.pricingTiers.forEach(tier => {
                const priceCard = document.createElement('div');
                priceCard.className = 'price-card';
                if (promoTier && tier.id === promoTier.id) {
                    priceCard.style.cssText = 'border: 2px solid var(--error-color); box-shadow: 0 0 15px var(--error-color);';
                }
                priceCard.innerHTML = `
                    <h3>${tier.name}</h3>
                    <p>${tier.description || '&nbsp;'}</p>
                    <div class="price-tag">
                        <div class="final-price">Rp ${parseInt(tier.price || 0).toLocaleString('id-ID')}</div>
                    </div>
                    <button class="button-primary buy-button" data-package-name="${tier.name}">
                        <i class="fab fa-whatsapp"></i> Beli via WhatsApp
                    </button>
                `;
                pricingGrid.appendChild(priceCard);
            });
        } else {
            pricingGrid.innerHTML = '<p>Pilihan harga belum diatur oleh admin.</p>';
        }
    };
    
    const startCountdown = (endDate) => {
        if(countdownInterval) clearInterval(countdownInterval);
        const update = () => {
            const distance = new Date(endDate) - new Date();
            if (distance < 0) {
                clearInterval(countdownInterval);
                discountBanner.style.display = 'none';
                return;
            }
            const d = Math.floor(distance / (1000 * 60 * 60 * 24));
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((distance % (1000 * 60)) / 1000);
            countdownTimer.textContent = `${d}h : ${h}j : ${m}m : ${s}d`;
        };
        update();
        countdownInterval = setInterval(update, 1000);
    };

    // === Event Listeners (Lengkap) ===
    themeToggle.addEventListener('click', () => {
        const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme_preference_v1', newTheme);
        applyTheme(newTheme);
    });

    websiteFileInput.addEventListener('change', () => {
        fileNameSpan.textContent = websiteFileInput.files.length > 0 ? websiteFileInput.files[0].name : 'Pilih file...';
    });
    
    pricingGrid.addEventListener('click', (e) => {
        const buyButton = e.target.closest('.buy-button');
        if (buyButton) {
            const waNumber = settings.whatsappNumber;
            if (!waNumber) return showToast('Nomor WhatsApp admin belum diatur.', 'error');
            const packageName = buyButton.dataset.packageName;
            const message = encodeURIComponent(`Halo, saya tertarik untuk membeli API Key "${packageName}".`);
            window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
        }
    });

    showGuideLink.addEventListener('click', (e) => { e.preventDefault(); guideModal.classList.add('show'); });
    guideCloseBtn.addEventListener('click', () => guideModal.classList.remove('show'));
    guideModal.addEventListener('click', (e) => { if(e.target === guideModal) guideModal.classList.remove('show'); });

    showPricingBtn.addEventListener('click', () => pricingModal.classList.add('show'));
    pricingCloseBtn.addEventListener('click', () => pricingModal.classList.remove('show'));
    pricingModal.addEventListener('click', (e) => { if (e.target === pricingModal) pricingModal.classList.remove('show'); });

    creatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        createBtn.disabled = true;
        btnText.textContent = 'Memproses...';
        const spinner = document.createElement('div'); spinner.className = 'spinner';
        createBtn.prepend(spinner);
        const formData = new FormData();
        formData.append('subdomain', subdomainInput.value.trim());
        formData.append('rootDomain', rootDomainSelect.value);
        formData.append('apiKey', userApiKeyInput.value.trim());
        formData.append('websiteFile', websiteFileInput.files[0]);
        try {
            const response = await fetch('/api/create-website', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            saveSite(result.siteData);
            renderSitesList();
            showDetailsModal(result.siteData);
            creatorForm.reset();
            fileNameSpan.textContent = 'Pilih file...';
            showToast('Website berhasil dibuat!', 'success');
        } catch (error) {
            showToast(`Gagal: ${error.message}`, 'error');
        } finally {
            createBtn.disabled = false;
            btnText.textContent = 'Buat Website';
            spinner.remove();
        }
    });

    modalCloseBtn.addEventListener('click', () => detailsModal.classList.remove('show'));
    detailsModal.addEventListener('click', (e) => { if(e.target === detailsModal) detailsModal.classList.remove('show'); });
    
    modalCheckStatusBtn.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const { domain, project } = btn.dataset;
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:15px; height:15px; border-width:2px;"></div> Memeriksa...';
        try {
            const response = await fetch('/api/create-website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'checkDomainStatus', data: { domain } })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            if(result.status === 'success') {
                const updatedSite = updateSiteStatus(project, result.status);
                if(updatedSite) updateModalStatus(updatedSite.status);
                renderSitesList();
            } else {
                 updateModalStatus('pending');
            }
            showToast(result.message, result.status === 'success' ? 'success' : 'info');
        } catch (error) {
            showToast(error.message, 'error');
            updateModalStatus('pending');
        }
    });

    // === Inisialisasi Halaman (Lengkap) ===
    const initializePage = async () => {
        const savedTheme = localStorage.getItem('theme_preference_v1') || 'light';
        applyTheme(savedTheme);
        renderSitesList();
        try {
            await Promise.all([ fetchDomains(), fetchSettings() ]);
        } catch (error) {
            console.error("Gagal inisialisasi halaman:", error);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    };
    
    initializePage();
});