document.addEventListener('DOMContentLoaded', () => {
    // === Elemen UI ===
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const notificationContainer = document.getElementById('notification-container');
    const keyListContainer = document.getElementById('api-key-list-container');
    const manageProjectsBtn = document.getElementById('manage-projects-btn');
    const projectModal = document.getElementById('project-modal');
    const modalCloseBtn = projectModal.querySelector('.modal-close');
    const modalBody = document.getElementById('modal-body');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmTitle = document.getElementById('confirmation-modal-title');
    const confirmMessage = document.getElementById('confirmation-modal-message');
    const confirmBtnYes = document.getElementById('confirm-btn-yes');
    const confirmBtnNo = document.getElementById('confirm-btn-no');
    const apiKeySuccessModal = document.getElementById('apikey-success-modal');
    const apiKeyDetailsContainer = document.getElementById('apikey-details-container');
    const apiKeySuccessOkBtn = document.getElementById('apikey-success-ok-btn');
    const apiKeyCopyBtn = document.getElementById('apikey-copy-btn');
    const manageDomainsBtn = document.getElementById('manage-domains-btn');
    const cloudflareModal = document.getElementById('cloudflare-modal');
    const cloudflareModalTitle = document.getElementById('cloudflare-modal-title');
    const cloudflareModalBody = document.getElementById('cloudflare-modal-body');
    const cfSuccessModal = document.getElementById('cf-success-modal');
    const cfSuccessMessage = document.getElementById('cf-success-message');
    const cfNameserverList = document.getElementById('cf-nameserver-list');
    const cfSuccessOkBtn = document.getElementById('cf-success-ok-btn');
    
    const settingsForm = document.getElementById('settings-form');
    const waInput = document.getElementById('whatsapp-number');
    const normalPriceInput = document.getElementById('normal-price');
    const discountPriceInput = document.getElementById('discount-price');
    const discountDateInput = document.getElementById('discount-end-date');
    const logoutBtn = document.getElementById('logout-btn');
    
    const addDomainJsonForm = document.getElementById('add-domain-json-form');
    const domainJsonListContainer = document.getElementById('domain-json-list-container');
    let apiKeyTextToCopy = '';

    // === Fungsi Bantuan & Logika Umum ===
    const formatFullDate = (isoString) => new Date(isoString).toLocaleString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    let notificationTimeout;
    const showNotification = (message, type = 'success') => {
        clearTimeout(notificationTimeout);
        notificationContainer.innerHTML = '';
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        notificationContainer.appendChild(notif);
        notificationTimeout = setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 400);
        }, 4000);
    };

    const openModal = (modal) => modal.style.display = 'flex';
    const closeModal = (modal) => modal.style.display = 'none';
    modalCloseBtn.addEventListener('click', () => closeModal(projectModal));
    projectModal.addEventListener('click', (e) => { if (e.target === projectModal) closeModal(projectModal); });
    cloudflareModal.querySelector('.modal-close').addEventListener('click', () => closeModal(cloudflareModal));
    
    const showConfirmation = (title, message, confirmText = 'Hapus') => {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmBtnYes.textContent = confirmText;
        openModal(confirmationModal);
        return new Promise((resolve) => {
            confirmBtnYes.onclick = () => { closeModal(confirmationModal); resolve(true); };
            confirmBtnNo.onclick = () => { closeModal(confirmationModal); resolve(false); };
        });
    };

    const showApiKeySuccessPopup = (newKey) => {
        const expiryText = newKey.expires_at === 'permanent' ? 'Permanen' : formatFullDate(newKey.expires_at);
        apiKeyDetailsContainer.innerHTML = `<div class="detail-item"><span class="detail-label">Kunci API</span><span class="detail-value">${newKey.name}</span></div><div class="detail-item"><span class="detail-label">Dibuat</span><span class="detail-value">${formatFullDate(newKey.created_at)}</span></div><div class="detail-item"><span class="detail-label">Kadaluwarsa</span><span class="detail-value">${expiryText}</span></div>`;
        const notes = "Harap simpan detail kunci ini dengan baik. Informasi ini bersifat rahasia dan tidak akan ditampilkan lagi demi keamanan Anda.";
        apiKeyTextToCopy = `Ini adalah data apikey anda\n-------------------\nApikey: ${newKey.name}\nTanggal buat: ${formatFullDate(newKey.created_at)}\nTanggal kadaluarsa: ${expiryText}\n-------------------\nNotes:\n${notes}`;
        openModal(apiKeySuccessModal);
    };
    
    // === Logika API ===
    const callApi = async (action, data = {}) => {
        const password = localStorage.getItem('adminPassword'); 
        if (!password) throw new Error('Sesi admin tidak valid');
        const response = await fetch('/api/create-website', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, data, adminPassword: password })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        return result;
    };

    // === Fungsi Render Tampilan ===
    const renderApiKeys = (keys) => {
        keyListContainer.innerHTML = '';
        if (!keys || Object.keys(keys).length === 0) { 
            keyListContainer.innerHTML = '<p>Belum ada API Key yang dibuat.</p>'; 
            return; 
        }
        for (const key in keys) {
            const keyData = keys[key];
            const expiry = keyData.expires_at === 'permanent' ? 'Permanen' : `Kadaluwarsa: ${formatFullDate(keyData.expires_at)}`;
            const item = document.createElement('div');
            item.className = 'key-item';
            item.innerHTML = `<div class="key-info"><span class="key-name">${key}</span><span class="key-expiry">${expiry}</span></div><button class="delete-btn" data-key="${key}"><i class="fas fa-trash-alt"></i></button>`;
            keyListContainer.appendChild(item);
        }
    };
    
    const renderProjects = (projects) => {
        modalBody.innerHTML = '';
        if (projects.length === 0) { modalBody.innerHTML = '<p>Tidak ada proyek/repositori yang ditemukan.</p>'; return; }
        let projectHtml = '';
        projects.forEach(proj => {
            const githubButton = proj.hasGithub ? `<button class="delete-btn delete-repo-btn" data-name="${proj.name}">Hapus Repo</button>` : '';
            const vercelButton = proj.hasVercel ? `<button class="delete-btn delete-vercel-btn" data-name="${proj.name}">Hapus Vercel</button>` : '';
            const repoInfo = proj.hasGithub ? `<a href="${proj.githubUrl}" target="_blank">${proj.name}</a><span>${proj.isPrivate ? 'Private' : 'Public'}</span>` : `<strong>${proj.name}</strong><span>(Hanya ada di Vercel)</span>`;
            projectHtml += `<div class="repo-item"><div class="item-info">${repoInfo}</div><div class="repo-actions">${githubButton}${vercelButton}</div></div>`;
        });
        modalBody.innerHTML = `<ul class="list-item-container">${projectHtml}</ul>`;
    };
    
    const renderJsonDomains = (domains) => {
        domainJsonListContainer.innerHTML = '';
        if (Object.keys(domains).length === 0) {
            domainJsonListContainer.innerHTML = '<p>Belum ada domain yang ditambahkan ke file JSON.</p>';
            return;
        }
        for (const domain in domains) {
            const domainData = domains[domain];
            const item = document.createElement('div');
            item.className = 'key-item';
            const hiddenToken = domainData.apitoken.slice(0, 4) + '...' + domainData.apitoken.slice(-4);
            item.innerHTML = `
                <div class="key-info" style="flex-grow: 1;">
                    <span class="key-name">${domain}</span>
                    <span class="key-expiry" style="font-family: monospace; font-size: 0.8em;">Zone: ${domainData.zone}</span>
                    <span class="key-expiry" style="font-family: monospace; font-size: 0.8em;">Token: ${hiddenToken}</span>
                </div>
                <button class="delete-btn" data-domain="${domain}"><i class="fas fa-trash-alt"></i></button>
            `;
            domainJsonListContainer.appendChild(item);
        }
    };

    const loadAndRenderJsonDomains = async () => {
        domainJsonListContainer.innerHTML = '<p>Memuat domain dari JSON...</p>';
        try {
            const domains = await callApi('getDomainsFromJson');
            renderJsonDomains(domains);
        } catch (error) {
            showNotification(error.message, 'error');
            domainJsonListContainer.innerHTML = `<p style="color: var(--error-color);">${error.message}</p>`;
        }
    };
    
    // === Logika Cloudflare ===
    const showCloudflareSuccessPopup = (data) => {
        cfSuccessMessage.innerHTML = `Domain <strong>${data.domain}</strong> berhasil ditambahkan ke akun Cloudflare Anda.`;
        cfNameserverList.innerHTML = data.nameservers.map(ns => `<li class="nameserver-item"><span>${ns}</span><button class="copy-ns-btn" data-ns="${ns}">Copy</button></li>`).join('');
        openModal(cfSuccessModal);
    };

    const setupBulkDeleteControls = (container, listType, context) => {
        const selectAllCheckbox = container.querySelector('.select-all-checkbox');
        const checkboxes = container.querySelectorAll('.item-checkbox');
        const bulkDeleteBtn = container.querySelector('.bulk-delete-btn');
        const updateButtonVisibility = () => {
            const checkedCount = container.querySelectorAll('.item-checkbox:checked').length;
            bulkDeleteBtn.style.display = checkedCount > 0 ? 'inline-flex' : 'none';
            bulkDeleteBtn.textContent = `Hapus ${checkedCount} Item Terpilih`;
        };
        if(selectAllCheckbox) selectAllCheckbox.addEventListener('change', (e) => {
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateButtonVisibility();
        });
        checkboxes.forEach(cb => cb.addEventListener('change', () => {
            if(selectAllCheckbox) selectAllCheckbox.checked = [...checkboxes].every(c => c.checked);
            updateButtonVisibility();
        }));
        if(bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', async () => {
            const selectedItems = [...checkboxes].filter(cb => cb.checked);
            const selectedIds = selectedItems.map(cb => cb.value);
            const selectedNames = selectedItems.map(cb => cb.dataset.name);
            let confirmed = false;
            if (listType === 'zones') {
                const confirmationMessage = `Anda akan MENGHAPUS PERMANEN ${selectedIds.length} zona berikut:\n\n${selectedNames.join('\n')}\n\nLanjutkan?`;
                confirmed = await showConfirmation('KONFIRMASI HAPUS ZONA', confirmationMessage);
            } else {
                confirmed = await showConfirmation('Hapus Record DNS?', `Anda yakin ingin menghapus ${selectedIds.length} record DNS terpilih?`);
            }
            if (confirmed) {
                bulkDeleteBtn.textContent = 'Menghapus...'; bulkDeleteBtn.disabled = true;
                try {
                    let result;
                    if (listType === 'zones') {
                        result = await callApi('bulkDeleteCloudflareZones', { zoneIds: selectedIds });
                    } else { // dns
                        result = await callApi('bulkDeleteDnsRecords', { zoneId: context.zoneId, recordIds: selectedIds });
                    }
                    showNotification(result.message, 'success');
                    if (listType === 'zones') manageDomainsBtn.click();
                    else showDnsRecordsView(context.zoneId, context.zoneName);
                } catch (error) {
                    showNotification(error.message, 'error');
                } finally {
                     bulkDeleteBtn.disabled = false;
                     updateButtonVisibility();
                }
            }
        });
    };
    
    const renderCloudflareZones = (zones) => {
        cloudflareModalTitle.innerHTML = `Manajemen Zona Cloudflare <span class="item-count">${zones.length}</span>`;
        let listHtml = zones.map(zone => `
    <li class="list-item" data-search-term="${zone.name.toLowerCase()}">
        <input type="checkbox" class="item-checkbox" value="${zone.id}" data-name="${zone.name}">
        <div class="item-info">
            <strong>${zone.name}</strong>
            <span>Status: ${zone.status}</span>
        </div>
        <button class="manage-dns-btn" data-zone-id="${zone.id}" data-zone-name="${zone.name}">Kelola DNS</button>
    </li>`).join('');

        cloudflareModalBody.innerHTML = `
            <div class="list-toolbar">
                <form id="add-domain-form" class="add-domain-form">
                    <input type="text" id="new-domain-name" placeholder="Masukkan domain baru..." required>
                    <button type="submit">Tambah</button>
                </form>
            </div>
            <div class="list-toolbar">
                <input type="checkbox" class="select-all-checkbox" title="Pilih Semua">
                <form class="search-form" style="margin-left: 10px;"><input type="search" id="zone-search-input" placeholder="Cari domain..."></form>
                <button class="bulk-delete-btn">Hapus Terpilih</button>
            </div>
            <ul class="list-item-container">${zones.length > 0 ? listHtml : '<li>Tidak ada zona ditemukan.</li>'}</ul>`;
        setupBulkDeleteControls(cloudflareModalBody, 'zones');
    };
    const renderDnsRecords = (records, zoneId, zoneName) => {
        cloudflareModalTitle.innerHTML = `Record DNS: ${zoneName} <span class="item-count">${records.length}</span>`;
        let listHtml = records.map(rec => {
            const searchTerm = `${rec.name} ${rec.type} ${rec.content}`.toLowerCase();
            return `<li class="list-item" data-search-term="${searchTerm}">
                <input type="checkbox" class="item-checkbox" value="${rec.id}" data-name="${rec.name}">
                <div class="item-info">
                    <strong>${rec.name}</strong>
                    <span>${rec.type} &rarr; ${rec.content}</span>
                </div>
            </li>`;
        }).join('');
        
        cloudflareModalBody.innerHTML = `
            <div class="list-toolbar">
                 <button id="cloudflare-modal-back-btn">&larr; Kembali</button>
                 <input type="checkbox" class="select-all-checkbox" title="Pilih Semua">
                 <form class="search-form" style="margin-left: 10px;"><input type="search" id="dns-search-input" placeholder="Cari record..."></form>
                 <button class="bulk-delete-btn">Hapus Terpilih</button>
            </div>
            <ul class="list-item-container">${records.length > 0 ? listHtml : '<li>Tidak ada record DNS.</li>'}</ul>`;
        cloudflareModalBody.querySelector('#cloudflare-modal-back-btn').onclick = () => manageDomainsBtn.click();
        setupBulkDeleteControls(cloudflareModalBody, 'dns', { zoneId, zoneName });
    };
    const showDnsRecordsView = async (zoneId, zoneName) => {
        cloudflareModalBody.innerHTML = `<p>Memuat record DNS untuk ${zoneName}...</p>`;
        try {
            const records = await callApi('listDnsRecords', { zoneId });
            renderDnsRecords(records, zoneId, zoneName);
        } catch (error) {
            showNotification(error.message, 'error');
            manageDomainsBtn.click();
        }
    };
    
    const loadSettings = async () => {
        try {
            const res = await callApi('getSettings');
            waInput.value = res.whatsappNumber;
            normalPriceInput.value = res.normalPrice;
            discountPriceInput.value = res.discountPrice;
            if (res.discountEndDate) {
                const date = new Date(res.discountEndDate);
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                discountDateInput.value = date.toISOString().slice(0, 16);
            }
        } catch (error) {
            // Jangan tampilkan notifikasi error di sini agar tidak mengganggu jika auto-login gagal
            console.error("Gagal memuat pengaturan:", error);
        }
    };
    
    const setupNavigation = () => {
        const navButtons = document.querySelectorAll('.admin-nav .nav-btn');
        const pages = document.querySelectorAll('.admin-card .admin-page');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPageId = button.dataset.page;
                pages.forEach(page => page.style.display = 'none');
                navButtons.forEach(btn => btn.classList.remove('active'));
                document.getElementById(targetPageId).style.display = 'block';
                button.classList.add('active');
                if (targetPageId === 'page-domains-json') {
                    loadAndRenderJsonDomains();
                }
            });
        });
    };
    
    // --- [PERBAIKAN] LOGIKA LOGIN DAN STARTUP ---
    const showAdminPanelAndLoadData = async () => {
        loginScreen.style.display = 'none';
        adminPanel.style.display = 'block';
        
        // Tampilkan pesan loading di dalam panel
        keyListContainer.innerHTML = '<p>Memuat kunci API...</p>';

        // Muat data pengaturan dan API keys
        try {
            await loadSettings();
            const keys = await callApi('getApiKeys');
            renderApiKeys(keys);
        } catch (error) {
            showNotification(`Sesi tidak valid atau gagal memuat data. Silakan login kembali.`, 'error');
            keyListContainer.innerHTML = `<p style="color: var(--error-color);">Gagal memuat kunci.</p>`;
            localStorage.removeItem('adminPassword');
            
            setTimeout(() => {
                adminPanel.style.display = 'none';
                loginScreen.style.display = 'block';
            }, 2500);
        }
    };

    loginBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!password) return showNotification('Password tidak boleh kosong.', 'error');
        localStorage.setItem('adminPassword', password); 
        loginBtn.textContent = 'Memverifikasi...'; loginBtn.disabled = true;
        try {
            // Cukup panggil getSettings untuk verifikasi, lebih ringan dari getApiKeys
            await callApi('getSettings'); 
            showNotification('Login berhasil!', 'success');
            await showAdminPanelAndLoadData();
        } catch (error) {
            showNotification(`Login Gagal: ${error.message}`, 'error');
            localStorage.removeItem('adminPassword'); 
        } finally {
            loginBtn.textContent = 'Masuk'; loginBtn.disabled = false;
        }
    });

    const tryAutoLogin = async () => {
        if (localStorage.getItem('adminPassword')) {
            await showAdminPanelAndLoadData();
        } else {
            loginScreen.style.display = 'block';
        }
        // Selalu sembunyikan loading overlay setelah pengecekan selesai
        loadingOverlay.classList.add('hidden');
    };
    
    // --- EVENT LISTENERS LAINNYA ---
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.textContent = 'Menyimpan...'; button.disabled = true;
        const data = {
            whatsappNumber: waInput.value.trim(),
            normalPrice: parseInt(normalPriceInput.value, 10),
            discountPrice: parseInt(discountPriceInput.value, 10),
            discountEndDate: discountDateInput.value ? new Date(discountDateInput.value).toISOString() : null
        };
        try {
            const res = await callApi('updateSettings', data);
            showNotification(res.message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            button.textContent = 'Simpan Pengaturan'; button.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminPassword');
        showNotification('Anda telah logout.', 'success');
        setTimeout(() => window.location.reload(), 1500);
    });

    document.getElementById('create-key-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const createBtn = e.target.querySelector('button[type="submit"]');
        createBtn.textContent = 'Membuat...'; createBtn.disabled = true;
        const data = {
            key: document.getElementById('new-apikey-name').value.trim(),
            duration: document.getElementById('new-apikey-duration').value,
            unit: document.getElementById('new-apikey-unit').value,
            isPermanent: document.getElementById('permanent-key').checked
        };
        try {
            const result = await callApi('createApiKey', data);
            showApiKeySuccessPopup(result.newKey);
            e.target.reset();
            document.getElementById('duration-section').style.display = 'block';
        } catch (error) {
            showNotification(`Gagal: ${error.message}`, 'error');
        } finally {
            createBtn.textContent = 'Buat Kunci'; createBtn.disabled = false;
        }
    });

    apiKeySuccessOkBtn.addEventListener('click', async () => {
        closeModal(apiKeySuccessModal);
        try {
            const newKeys = await callApi('getApiKeys');
            renderApiKeys(newKeys);
        } catch (error) {
            showNotification('Gagal memuat ulang daftar kunci.', 'error');
        }
    });
    
    apiKeyCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(apiKeyTextToCopy).then(() => {
            apiKeyCopyBtn.innerHTML = '<i class="fas fa-check"></i> Tersalin!';
            setTimeout(() => {
                apiKeyCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
        }).catch(err => {
            console.error('Gagal menyalin teks: ', err);
            showNotification('Gagal menyalin.', 'error');
        });
    });

    manageProjectsBtn.addEventListener('click', async () => {
        modalBody.innerHTML = '<p>Memuat proyek...</p>';
        openModal(projectModal);
        try {
            const projects = await callApi('listProjects');
            renderProjects(projects);
        } catch (error) {
            showNotification(error.message, 'error');
            modalBody.innerHTML = `<p style="color: var(--error-color);">${error.message}</p>`;
        }
    });

    modalBody.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('button.delete-btn');
        if (!targetButton) return;
        const repoName = targetButton.dataset.name;
        let action, title, message, originalText;
        if (targetButton.classList.contains('delete-repo-btn')) {
            action = 'deleteRepo'; title = 'Hapus Repositori GitHub?';
            message = `Tindakan ini akan menghapus permanen repositori '${repoName}' di GitHub.`;
            originalText = 'Hapus Repo';
        } else if (targetButton.classList.contains('delete-vercel-btn')) {
            action = 'deleteVercelProject'; title = 'Hapus Proyek Vercel?';
            message = `Ini akan menghapus proyek '${repoName}' dari Vercel, termasuk semua deployment.`;
            originalText = 'Hapus Vercel';
        } else { return; }
        const confirmed = await showConfirmation(title, message);
        if (confirmed) {
            targetButton.textContent = 'Menghapus...'; targetButton.disabled = true;
            try {
                const result = await callApi(action, { repoName: repoName, projectName: repoName });
                showNotification(result.message, 'success');
                targetButton.closest('.repo-item').style.display = 'none';
            } catch (error) {
                showNotification(error.message, 'error');
                targetButton.textContent = originalText; targetButton.disabled = false;
            }
        }
    });
    
    manageDomainsBtn.addEventListener('click', async () => {
        cloudflareModalBody.innerHTML = '<p>Memuat zona dari Cloudflare...</p>';
        openModal(cloudflareModal);
        try {
            const zones = await callApi('listAllCloudflareZones');
            renderCloudflareZones(zones);
        } catch (error) {
            showNotification(error.message, 'error');
            cloudflareModalBody.innerHTML = `<p style="color: var(--error-color);">Gagal memuat. Pastikan CLOUDFLARE_API_TOKEN sudah benar.</p>`;
        }
    });
    
    cfSuccessOkBtn.addEventListener('click', () => {
        closeModal(cfSuccessModal);
        manageDomainsBtn.click();
    });

    cfNameserverList.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-ns-btn')) {
            const ns = e.target.dataset.ns;
            navigator.clipboard.writeText(ns).then(() => {
                e.target.textContent = 'Tersalin!';
                setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
            });
        }
    });

    cloudflareModalBody.addEventListener('input', (e) => {
        const target = e.target;
        if (target.matches('#zone-search-input, #dns-search-input')) {
            const searchTerm = target.value.toLowerCase();
            const listContainer = target.closest('#cloudflare-modal-body').querySelector('.list-item-container');
            const items = listContainer.querySelectorAll('.list-item');
            items.forEach(item => {
                const itemSearchTerm = item.dataset.searchTerm || '';
                item.style.display = itemSearchTerm.includes(searchTerm) ? 'flex' : 'none';
            });
        }
    });

    cloudflareModalBody.addEventListener('submit', (e) => {
        if (e.target.matches('.search-form, #add-domain-form')) e.preventDefault();
    });

    cloudflareModalBody.addEventListener('click', async (e) => {
        if (e.target.closest('#add-domain-form button')) {
            e.preventDefault();
            const form = e.target.closest('#add-domain-form');
            const input = form.querySelector('#new-domain-name');
            const button = form.querySelector('button');
            const domainName = input.value.trim();
            if (!domainName) return showNotification('Nama domain tidak boleh kosong.', 'error');
            button.textContent = 'Menambahkan...'; button.disabled = true;
            try {
                const result = await callApi('addCloudflareZone', { domainName });
                closeModal(cloudflareModal);
                showCloudflareSuccessPopup(result);
            } catch (error) { 
                showNotification(error.message, 'error');
            } finally { 
                button.textContent = 'Tambah'; button.disabled = false; 
            }
        }
        if (e.target.classList.contains('manage-dns-btn')) {
            showDnsRecordsView(e.target.dataset.zoneId, e.target.dataset.zoneName);
        }
    });

    keyListContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.delete-btn');
        if (button) {
            const key = button.dataset.key;
            const confirmed = await showConfirmation('Hapus Kunci API?', `Anda yakin ingin menghapus kunci "${key}"?`);
            if (confirmed) {
                try {
                    const result = await callApi('deleteApiKey', { key });
                    showNotification(result.message, 'success');
                    const newKeys = await callApi('getApiKeys');
                    renderApiKeys(newKeys);
                } catch (error) {
                    showNotification(`Gagal: ${error.message}`, 'error');
                }
            }
        }
    });

    addDomainJsonForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type="submit"]');
        const data = {
            domainName: document.getElementById('json-domain-name').value.trim(),
            zoneId: document.getElementById('json-zone-id').value.trim(),
            apiToken: document.getElementById('json-api-token').value.trim()
        };
        if (!data.domainName || !data.zoneId || !data.apiToken) {
            return showNotification('Semua field harus diisi.', 'error');
        }
        button.textContent = 'Menambahkan...'; button.disabled = true;
        try {
            const result = await callApi('addDomainToJson', data);
            showNotification(result.message, 'success');
            addDomainJsonForm.reset();
            await loadAndRenderJsonDomains();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            button.textContent = 'Tambah Domain ke JSON'; button.disabled = false;
        }
    });

    domainJsonListContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.delete-btn');
        if (button) {
            const domainName = button.dataset.domain;
            const confirmed = await showConfirmation('Hapus Domain dari JSON?', `Anda yakin ingin menghapus '${domainName}' dari file domains.json?`);
            if (confirmed) {
                try {
                    const result = await callApi('deleteDomainFromJson', { domainName });
                    showNotification(result.message, 'success');
                    await loadAndRenderJsonDomains();
                } catch (error) {
                    showNotification(`Gagal menghapus: ${error.message}`, 'error');
                }
            }
        }
    });

    document.getElementById('permanent-key').addEventListener('change', (e) => {
        document.getElementById('duration-section').style.display = e.target.checked ? 'none' : 'block';
    });

    // === Inisialisasi Aplikasi ===
    const init = () => {
        setupNavigation();
        // [PERBAIKAN] Panggil langsung tanpa timeout agar lebih cepat
        tryAutoLogin(); 
    };
    
    init();
});