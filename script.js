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
    const detailsModalContainer = document.getElementById('details-modal');
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    const loadingOverlay = document.getElementById('loading-overlay');
    const showGuideLink = document.getElementById('show-guide-link');
    const guideModal = document.getElementById('guide-modal');
    const guideCloseBtn = document.getElementById('guide-close-btn');
    const pricingGrid = document.getElementById('pricing-grid');

    // === Variabel & State ===
    let toastTimeout;
    let settings = {};

    // === Fungsi Bantuan & UI ===
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

    // === Manajemen Data Lokal ===
    const getSites = () => JSON.parse(localStorage.getItem('createdSites_v2')) || [];
    const saveSite = (siteData) => {
        const sites = getSites();
        sites.unshift(siteData);
        localStorage.setItem('createdSites_v2', JSON.stringify(sites));
    };
    const updateSiteStatus = (projectName, newStatus) => {
        const sites = getSites();
        const siteIndex = sites.findIndex(s => s.projectName === projectName);
        if (siteIndex > -1) {
            sites[siteIndex].status = newStatus;
            localStorage.setItem('createdSites_v2', JSON.stringify(sites));
        }
        return sites[siteIndex];
    };

    // === Fungsi Render Tampilan ===
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
                </div>
                <span class="status ${site.status}">${site.status === 'success' ? 'Aktif' : 'Menunggu'}</span>
            `;
            item.addEventListener('click', () => showDetailsModal(site));
            sitesList.appendChild(item);
        });
    };
    
    const showDetailsModal = (siteData) => {
        detailsModalContainer.innerHTML = `
            <div class="modal-content">
                <h2>Detail Website</h2>
                <div class="form-group">
                    <label>URL Vercel</label>
                    <a href="${siteData.vercelUrl}" target="_blank">${siteData.vercelUrl}</a>
                </div>
                <div class="form-group">
                    <label>URL Custom</label>
                    <a href="${siteData.customUrl}" target="_blank">${siteData.customUrl}</a>
                </div>
                <button id="modal-check-status-btn" data-project="${siteData.projectName}" data-domain="${siteData.customUrl.replace('https://','')}"></button>
                <button id="modal-close-btn" class="button-primary" style="margin-top: 10px; background-color: var(--text-muted);">Tutup</button>
            </div>
        `;
        const modalCheckStatusBtn = detailsModalContainer.querySelector('#modal-check-status-btn');
        const modalCloseBtn = detailsModalContainer.querySelector('#modal-close-btn');

        const updateModalStatus = (status) => {
            modalCheckStatusBtn.disabled = false;
            modalCheckStatusBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Cek Status';
            if (status === 'success') {
                modalCheckStatusBtn.className = 'status success';
                modalCheckStatusBtn.innerHTML = '<i class="fas fa-check"></i> Aktif';
                modalCheckStatusBtn.disabled = true;
            } else {
                modalCheckStatusBtn.className = 'button-primary status pending';
            }
        };

        updateModalStatus(siteData.status);
        detailsModalContainer.classList.add('show');
        
        modalCloseBtn.addEventListener('click', () => detailsModalContainer.classList.remove('show'));
        modalCheckStatusBtn.addEventListener('click', checkDomainStatus);
    };

    // === Logika API & Aksi ===
    const checkDomainStatus = async (e) => {
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
                if(updatedSite) showDetailsModal(updatedSite);
                renderSitesList();
            }
            showToast(result.message, result.status === 'success' ? 'success' : 'info');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            // Re-enable handled by re-rendering modal
        }
    };
    
    const fetchDomains = async () => {
        try {
            const response = await fetch('/api/create-website');
            if (!response.ok) throw new Error('Gagal memuat domain');
            const domains = await response.json();
            rootDomainSelect.innerHTML = domains.length > 0
                ? domains.map(domain => `<option value="${domain}">.${domain}</option>`).join('')
                : '<option value="">Tidak ada domain</option>';
            if (domains.length === 0) showToast('Admin belum menambahkan domain utama.', 'error');
        } catch (error) {
            rootDomainSelect.innerHTML = '<option value="">Error memuat</option>';
            throw error;
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
    
    // === Fitur Harga Dinamis ===
    const updatePricingUI = () => {
        pricingGrid.innerHTML = ''; // Kosongkan grid
        if (settings.pricingTiers && settings.pricingTiers.length > 0) {
            settings.pricingTiers.forEach(tier => {
                const priceCard = document.createElement('div');
                priceCard.className = 'price-card';
                priceCard.innerHTML = `
                    <h3>${tier.name}</h3>
                    <p>${tier.description || '&nbsp;'}</p>
                    <div class="price-tag">
                        <div class="final-price">Rp ${parseInt(tier.price).toLocaleString('id-ID')}</div>
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
    
    // === Event Listeners ===
    themeToggle.addEventListener('click', () => {
        const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme_preference_v2', newTheme);
        applyTheme(newTheme);
    });

    subdomainInput.addEventListener('input', (e) => {
        const originalValue = e.target.value;
        const formattedValue = originalValue.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (originalValue !== formattedValue) e.target.value = formattedValue;
    });

    websiteFileInput.addEventListener('change', () => {
        fileNameSpan.textContent = websiteFileInput.files.length > 0 ? websiteFileInput.files[0].name : 'Pilih file...';
    });
    
    pricingGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('buy-button')) {
            const waNumber = settings.whatsappNumber;
            if (!waNumber) {
                return showToast('Nomor WhatsApp admin belum diatur.', 'error');
            }
            const packageName = e.target.dataset.packageName;
            const message = encodeURIComponent(`Halo, saya tertarik untuk membeli API Key "${packageName}".`);
            window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
        }
    });

    showGuideLink.addEventListener('click', (e) => { e.preventDefault(); guideModal.classList.add('show'); });
    guideCloseBtn.addEventListener('click', () => guideModal.classList.remove('show'));
    guideModal.addEventListener('click', (e) => { if(e.target === guideModal) guideModal.classList.remove('show'); });
    detailsModalContainer.addEventListener('click', (e) => { if(e.target === detailsModalContainer) detailsModalContainer.classList.remove('show'); });


    creatorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        createBtn.disabled = true;
        btnText.textContent = 'Memproses...';
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        createBtn.prepend(spinner);

        const formData = new FormData();
        formData.append('subdomain', subdomainInput.value.trim());
        formData.append('rootDomain', rootDomainSelect.value);
        formData.append('apiKey', userApiKeyInput.value.trim());
        formData.append('websiteFile', websiteFileInput.files[0]);

        try {
            const response = await fetch('/api/create-website', { method: 'POST', body: formData });
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const textError = await response.text();
                throw new Error(textError.includes('Request Entity Too Large') ? 'File terlalu besar (maks 4.5 MB).' : 'Terjadi error di server.');
            }
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

    // === Inisialisasi Halaman ===
    const initializePage = async () => {
        const savedTheme = localStorage.getItem('theme_preference_v2') || 'light';
        applyTheme(savedTheme);
        renderSitesList();

        try {
            await Promise.all([ fetchDomains(), fetchSettings() ]);
        } catch (error) {
            console.error("Gagal inisialisasi halaman:", error);
            showToast(error.message, 'error');
        } finally {
            // Sembunyikan loading overlay setelah semua proses fetch selesai
            loadingOverlay.classList.add('hidden');
        }
    };
    
    initializePage();
});