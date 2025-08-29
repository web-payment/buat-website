document.addEventListener('DOMContentLoaded', () => {
    // === Elemen UI ===
    const body = document.body;
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const notificationContainer = document.getElementById('notification-container');
    const keyListContainer = document.getElementById('api-key-list-container');
    const manageProjectsBtn = document.getElementById('manage-projects-btn');
    const projectModal = document.getElementById('project-modal');
    const projectModalCloseBtn = projectModal.querySelector('.modal-close');
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
    const cloudflareModalCloseBtn = cloudflareModal.querySelector('.modal-close');
    const cloudflareModalTitle = document.getElementById('cloudflare-modal-title');
    const cloudflareModalBody = document.getElementById('cloudflare-modal-body');
    const cfSuccessModal = document.getElementById('cf-success-modal');
    const cfSuccessMessage = document.getElementById('cf-success-message');
    const cfNameserverList = document.getElementById('cf-nameserver-list');
    const cfSuccessOkBtn = document.getElementById('cf-success-ok-btn');
    const generalSettingsForm = document.getElementById('general-settings-form');
    const waInput = document.getElementById('whatsapp-number');
    const discountDateInput = document.getElementById('discount-end-date');
    const logoutBtn = document.getElementById('logout-btn-nav');
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.admin-section');
    const pricingPlanList = document.getElementById('pricing-plan-list');
    const addPlanBtn = document.getElementById('add-plan-btn');
    const planEditorModal = document.getElementById('plan-editor-modal');
    const planEditorForm = document.getElementById('plan-editor-form');
    const planEditorTitle = document.getElementById('plan-editor-title');
    const planIdInput = document.getElementById('plan-id');
    const planEditorModalCloseBtn = planEditorModal.querySelector('.modal-close');

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
            setTimeout(() => notif.remove(), 300);
        }, 4000);
    };

    const openModal = (modal) => modal.style.display = 'flex';
    const closeModal = (modal) => modal.style.display = 'none';
    
    const showConfirmation = (title, message) => {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        openModal(confirmationModal);
        return new Promise((resolve) => {
            confirmBtnYes.onclick = () => { closeModal(confirmationModal); resolve(true); };
            confirmBtnNo.onclick = () => { closeModal(confirmationModal); resolve(false); };
        });
    };

    const showApiKeySuccessPopup = (newKey) => {
        const expiryText = newKey.expires_at === 'permanent' ? 'Permanen' : formatFullDate(newKey.expires_at);
        apiKeyDetailsContainer.innerHTML = `<div class="detail-item"><span>Kunci API</span><span>${newKey.name}</span></div><div class="detail-item"><span>Kadaluwarsa</span><span>${expiryText}</span></div>`;
        apiKeyTextToCopy = `Ini adalah data apikey anda\nApikey: ${newKey.name}\nKadaluwarsa: ${expiryText}`;
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
        if (Object.keys(keys).length === 0) { keyListContainer.innerHTML = '<p>Belum ada API Key yang dibuat.</p>'; return; }
        Object.keys(keys).forEach(key => {
            const keyData = keys[key];
            const expiry = keyData.expires_at === 'permanent' ? 'Permanen' : `Kadaluwarsa: ${formatFullDate(keyData.expires_at)}`;
            const item = document.createElement('div');
            item.className = 'key-item';
            item.innerHTML = `<div class="key-info"><span class="key-name">${key}</span><span class="key-expiry">${expiry}</span></div><button class="delete-btn" data-key="${key}"><i class="fas fa-trash-alt"></i></button>`;
            keyListContainer.appendChild(item);
        });
    };
    
    const renderProjects = (projects) => {
        modalBody.innerHTML = '';
        if (projects.length === 0) { modalBody.innerHTML = '<p>Tidak ada proyek/repositori yang ditemukan.</p>'; return; }
        let projectHtml = projects.map(proj => {
            const githubButton = proj.hasGithub ? `<button class="delete-btn delete-repo-btn" data-name="${proj.name}">Hapus Repo</button>` : '';
            const vercelButton = proj.hasVercel ? `<button class="delete-btn delete-vercel-btn" data-name="${proj.name}">Hapus Vercel</button>` : '';
            const repoInfo = proj.hasGithub ? `<a href="${proj.githubUrl}" target="_blank">${proj.name}</a><span>${proj.isPrivate ? 'Private' : 'Public'}</span>` : `<strong>${proj.name}</strong><span>(Hanya ada di Vercel)</span>`;
            return `<div class="repo-item"><div class="item-info">${repoInfo}</div><div class="repo-actions">${githubButton}${vercelButton}</div></div>`;
        }).join('');
        modalBody.innerHTML = `<ul class="list-item-container">${projectHtml}</ul>`;
    };
    
    const renderPricingPlans = (plans = []) => {
        pricingPlanList.innerHTML = '';
        if (plans.length === 0) {
            pricingPlanList.innerHTML = '<p>Belum ada paket harga yang ditambahkan.</p>';
            return;
        }
        plans.forEach(plan => {
            const planEl = document.createElement('div');
            planEl.className = 'plan-item';
            planEl.innerHTML = `
                <div class="plan-info">
                    <h4>${plan.name}</h4>
                    <p>Normal: Rp ${plan.normalPrice.toLocaleString('id-ID')} | Diskon: Rp ${(plan.discountPrice || 0).toLocaleString('id-ID')}</p>
                </div>
                <div class="plan-actions">
                    <button class="edit-btn" data-id='${plan.id}'>Edit</button>
                    <button class="delete-btn" data-id='${plan.id}'>Hapus</button>
                </div>
            `;
            pricingPlanList.appendChild(planEl);
        });
    };

    const openPlanEditor = (plan = null) => {
        planEditorForm.reset();
        if (plan) {
            planEditorTitle.textContent = 'Edit Paket Harga';
            planIdInput.value = plan.id;
            document.getElementById('plan-name').value = plan.name;
            document.getElementById('plan-normal-price').value = plan.normalPrice;
            document.getElementById('plan-discount-price').value = plan.discountPrice || '';
            document.getElementById('plan-description').value = plan.description || '';
        } else {
            planEditorTitle.textContent = 'Tambah Paket Harga';
            planIdInput.value = '';
        }
        openModal(planEditorModal);
    };

    const showCloudflareSuccessPopup = (data) => {
        cfSuccessMessage.innerHTML = `Domain <strong>${data.domain}</strong> berhasil ditambahkan ke akun Cloudflare Anda.`;
        cfNameserverList.innerHTML = data.nameservers.map(ns => `<li class="nameserver-item"><span>${ns}</span><button class="copy-ns-btn" data-ns="${ns}">Copy</button></li>`).join('');
        openModal(cfSuccessModal);
    };

    // === Fungsi untuk memuat konten dinamis ===
    const loadSettings = async () => {
        try {
            const settings = await callApi('getSettings');
            waInput.value = settings.whatsappNumber || '';
            if (settings.discountEndDate) {
                const date = new Date(settings.discountEndDate);
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                discountDateInput.value = date.toISOString().slice(0, 16);
            } else {
                discountDateInput.value = '';
            }
            renderPricingPlans(settings.pricingPlans);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    };
    const loadApiKeys = async () => {
        try {
            const keys = await callApi('getApiKeys');
            renderApiKeys(keys);
        } catch (error) {
             showNotification(error.message, 'error');
             keyListContainer.innerHTML = `<p style="color:var(--error-color);">${error.message}</p>`;
        }
    }
    
    // === Fungsi Utama & Event Listener ===
    const showAdminPanelUI = () => {
        body.classList.remove('login-view');
        body.classList.add('admin-view');
        loginScreen.style.display = 'none';
        adminPanel.style.display = 'block';
        loadSettings(); // Muat tab default
    };
    
    const showLoginUI = () => {
        body.classList.remove('admin-view');
        body.classList.add('login-view');
        adminPanel.style.display = 'none';
        loginScreen.style.display = 'block';
    };

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            if (!targetId) return; 

            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'pengaturan') loadSettings();
            else if (targetId === 'kelola-produk') loadApiKeys();
        });
    });

    loginBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        if (!password) return showNotification('Password tidak boleh kosong.', 'error');
        localStorage.setItem('adminPassword', password); 
        loginBtn.textContent = 'Memverifikasi...'; loginBtn.disabled = true;
        try {
            await callApi('getApiKeys');
            showAdminPanelUI();
            showNotification('Login berhasil!', 'success');
        } catch (error) {
            showNotification(`Login Gagal: ${error.message}`, 'error');
            localStorage.removeItem('adminPassword'); 
        } finally {
            loginBtn.textContent = 'Masuk'; loginBtn.disabled = false;
        }
    });

    const tryAutoLogin = async () => {
        try {
            if (localStorage.getItem('adminPassword')) {
                await callApi('getApiKeys');
                showAdminPanelUI();
            } else {
                showLoginUI();
            }
        } catch (error) {
            localStorage.removeItem('adminPassword');
            showLoginUI();
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    };
    
    generalSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.textContent = 'Menyimpan...'; button.disabled = true;
        const data = {
            whatsappNumber: waInput.value.trim(),
            discountEndDate: discountDateInput.value ? new Date(discountDateInput.value).toISOString() : null
        };
        try {
            const res = await callApi('updateGeneralSettings', data);
            showNotification(res.message, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            button.textContent = 'Simpan Pengaturan Umum'; button.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminPassword');
        showNotification('Anda telah logout.', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1500);
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

    apiKeySuccessOkBtn.addEventListener('click', () => {
        closeModal(apiKeySuccessModal);
        loadApiKeys();
    });
    
    apiKeyCopyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(apiKeyTextToCopy).then(() => {
            apiKeyCopyBtn.innerHTML = '<i class="fas fa-check"></i> Tersalin!';
            setTimeout(() => {
                apiKeyCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
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
        let action, title, message;
        if (targetButton.classList.contains('delete-repo-btn')) {
            action = 'deleteRepo'; title = 'Hapus Repositori GitHub?';
            message = `Yakin menghapus permanen repositori '${repoName}' di GitHub?`;
        } else if (targetButton.classList.contains('delete-vercel-btn')) {
            action = 'deleteVercelProject'; title = 'Hapus Proyek Vercel?';
            message = `Yakin menghapus proyek '${repoName}' dari Vercel?`;
        } else { return; }
        
        const confirmed = await showConfirmation(title, message);
        if (confirmed) {
            targetButton.textContent = 'Menghapus...'; targetButton.disabled = true;
            try {
                const result = await callApi(action, { repoName: repoName, projectName: repoName });
                showNotification(result.message, 'success');
                manageProjectsBtn.click(); // Refresh list
            } catch (error) {
                showNotification(error.message, 'error');
                targetButton.disabled = false; // Re-enable on failure
            }
        }
    });
    
    manageDomainsBtn.addEventListener('click', async () => {
        cloudflareModalBody.innerHTML = '<p>Memuat zona dari Cloudflare...</p>';
        openModal(cloudflareModal);
        try {
            const zones = await callApi('listAllCloudflareZones');
            // renderCloudflareZones(zones); // Logic for this is complex, ensure it's fully implemented
            cloudflareModalBody.innerHTML = '<p>Fungsi render Cloudflare belum diimplementasikan sepenuhnya di kode ini.</p>'
        } catch (error) {
            showNotification(error.message, 'error');
            cloudflareModalBody.innerHTML = `<p style="color: var(--error-color);">Gagal memuat. Pastikan CLOUDFLARE_API_TOKEN sudah benar.</p>`;
        }
    });
    
    addPlanBtn.addEventListener('click', () => openPlanEditor());
    planEditorModalCloseBtn.addEventListener('click', () => closeModal(planEditorModal));

    pricingPlanList.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const planId = parseInt(target.dataset.id);

        if (target.classList.contains('edit-btn')) {
            const settings = await callApi('getSettings');
            const planToEdit = settings.pricingPlans.find(p => p.id === planId);
            if (planToEdit) openPlanEditor(planToEdit);
        }

        if (target.classList.contains('delete-btn')) {
            const confirmed = await showConfirmation('Hapus Paket?', 'Anda yakin ingin menghapus paket harga ini?');
            if (confirmed) {
                try {
                    await callApi('deletePricingPlan', { planId });
                    showNotification('Paket berhasil dihapus', 'success');
                    loadSettings(); // Muat ulang
                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }
        }
    });

    planEditorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const planId = planIdInput.value ? parseInt(planIdInput.value) : null;
        const planData = {
            id: planId,
            name: document.getElementById('plan-name').value,
            normalPrice: parseInt(document.getElementById('plan-normal-price').value),
            discountPrice: parseInt(document.getElementById('plan-discount-price').value) || 0,
            description: document.getElementById('plan-description').value,
        };
        
        const button = e.target.querySelector('button[type="submit"]');
        button.textContent = 'Menyimpan...'; button.disabled = true;

        try {
            const action = planId ? 'updatePricingPlan' : 'addPricingPlan';
            const message = planId ? 'Paket berhasil diperbarui' : 'Paket berhasil ditambahkan';
            await callApi(action, planData);
            showNotification(message, 'success');
            closeModal(planEditorModal);
            loadSettings(); // Muat ulang
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            button.textContent = 'Simpan Paket'; button.disabled = false;
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
                    loadApiKeys();
                } catch (error) {
                    showNotification(`Gagal: ${error.message}`, 'error');
                }
            }
        }
    });

    document.getElementById('permanent-key').addEventListener('change', (e) => {
        document.getElementById('duration-section').style.display = e.target.checked ? 'none' : 'block';
    });

    // === Inisialisasi Aplikasi ===
    const init = () => {
        const themeToggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme_preference_v1') || 'dark';
        if (savedTheme === 'dark') { body.classList.add('dark-mode'); themeToggle.innerHTML = '<i class="fas fa-sun"></i>'; } 
        else { body.classList.remove('dark-mode'); themeToggle.innerHTML = '<i class="fas fa-moon"></i>'; }
        themeToggle.addEventListener('click', () => {
            const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem('theme_preference_v1', newTheme);
            if (newTheme === 'dark') { body.classList.add('dark-mode'); themeToggle.innerHTML = '<i class="fas fa-sun"></i>'; }
            else { body.classList.remove('dark-mode'); themeToggle.innerHTML = '<i class="fas fa-moon"></i>'; }
        });

        // Close modal listeners
        projectModalCloseBtn.addEventListener('click', () => closeModal(projectModal));
        cloudflareModalCloseBtn.addEventListener('click', () => closeModal(cloudflareModal));
        
        setTimeout(tryAutoLogin, 700);
    };
    
    init();
});