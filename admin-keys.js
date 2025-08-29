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

    const showNotification = (message, type = 'success') => {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = message;
        notificationContainer.innerHTML = '';
        notificationContainer.appendChild(notif);
        setTimeout(() => { notif.style.opacity = '0'; setTimeout(() => notif.remove(), 300); }, 4000);
    };

    const openModal = (modal) => modal.style.display = 'flex';
    const closeModal = (modal) => modal.style.display = 'none';

    const showConfirmation = (title, message) => {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        openModal(confirmationModal);
        return new Promise((resolve) => {
            const onYes = () => { closeModal(confirmationModal); resolve(true); };
            const onNo = () => { closeModal(confirmationModal); resolve(false); };
            confirmBtnYes.onclick = onYes;
            confirmBtnNo.onclick = onNo;
        });
    };

    const renderApiKeys = (keys) => {
        keyListContainer.innerHTML = '';
        if (Object.keys(keys).length === 0) { keyListContainer.innerHTML = '<p>Belum ada API Key.</p>'; return; }
        Object.keys(keys).forEach(key => {
            const expiry = keys[key].expires_at === 'permanent' ? 'Permanen' : `Kadaluwarsa: ${new Date(keys[key].expires_at).toLocaleString('id-ID')}`;
            const item = document.createElement('div');
            item.className = 'key-item';
            item.innerHTML = `<div class="key-info"><span class="key-name">${key}</span><span class="key-expiry">${expiry}</span></div><button class="delete-btn" data-key="${key}"><i class="fas fa-trash-alt"></i></button>`;
            keyListContainer.appendChild(item);
        });
    };
    
    const renderProjects = (projects) => {
        modalBody.innerHTML = '';
        if (projects.length === 0) { modalBody.innerHTML = '<p>Tidak ada proyek.</p>'; return; }
        modalBody.innerHTML = `<ul>${projects.map(p => `<li class="repo-item"><div class="repo-info">${p.hasGithub ? `<a href="${p.githubUrl}" target="_blank">${p.name}</a>`:`<strong>${p.name}</strong><span>(Hanya Vercel)</span>`}</div><div class="repo-actions">${p.hasGithub ? `<button class="delete-btn" data-name="${p.name}" data-action="deleteRepo">Hapus Repo</button>`:''}${p.hasVercel ? `<button class="delete-btn" style="background-color:var(--warn-color)" data-name="${p.name}" data-action="deleteVercelProject">Hapus Vercel</button>`:''}</div></li>`).join('')}</ul>`;
    };

    const renderPricingPlans = (plans = []) => {
        pricingPlanList.innerHTML = '';
        if (plans.length === 0) { pricingPlanList.innerHTML = '<p>Belum ada paket harga.</p>'; return; }
        plans.forEach(plan => {
            const planEl = document.createElement('div');
            planEl.className = 'plan-item';
            planEl.innerHTML = `<div class="plan-info"><h4>${plan.name}</h4><p>Normal: Rp ${plan.price.toLocaleString('id-ID')} | Diskon: Rp ${(plan.discountPrice || 0).toLocaleString('id-ID')}</p></div><div class="plan-actions"><button class="edit-btn" data-id='${plan.id}'>Edit</button><button class="delete-btn" data-id='${plan.id}'>Hapus</button></div>`;
            pricingPlanList.appendChild(planEl);
        });
    };

    const openPlanEditor = (plan = null) => {
        planEditorForm.reset();
        planEditorTitle.textContent = plan ? 'Edit Paket Harga' : 'Tambah Paket Harga';
        planIdInput.value = plan ? plan.id : '';
        document.getElementById('plan-name').value = plan ? plan.name : '';
        document.getElementById('plan-price').value = plan ? plan.price : '';
        document.getElementById('plan-discount-price').value = plan ? plan.discountPrice || '' : '';
        document.getElementById('plan-description').value = plan ? plan.description || '' : '';
        openModal(planEditorModal);
    };

    const loadSettings = async () => {
        try {
            const settings = await callApi('getSettings');
            waInput.value = settings.whatsappNumber || '';
            if (settings.discountEndDate) {
                const date = new Date(settings.discountEndDate);
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                discountDateInput.value = date.toISOString().slice(0, 16);
            } else { discountDateInput.value = ''; }
            renderPricingPlans(settings.pricingPlans);
        } catch (error) { showNotification(error.message, 'error'); }
    };

    const loadApiKeys = async () => {
        try {
            const keys = await callApi('getApiKeys');
            renderApiKeys(keys);
        } catch (error) { showNotification(error.message, 'error'); }
    };

    const showAdminPanelUI = () => {
        body.classList.replace('login-view', 'admin-view');
        loginScreen.style.display = 'none';
        adminPanel.style.display = 'block';
        loadSettings();
    };
    
    const showLoginUI = () => {
        body.classList.replace('admin-view', 'login-view');
        adminPanel.style.display = 'none';
        loginScreen.style.display = 'block';
    };

    const tryAutoLogin = async () => {
        if (localStorage.getItem('adminPassword')) {
            try { await callApi('getApiKeys'); showAdminPanelUI(); } 
            catch (error) { localStorage.removeItem('adminPassword'); showLoginUI(); }
        } else { showLoginUI(); }
        loadingOverlay.classList.add('hidden');
    };
    
    loginBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        localStorage.setItem('adminPassword', password);
        loginBtn.disabled = true;
        try {
            await callApi('getApiKeys');
            showAdminPanelUI();
        } catch (error) {
            showNotification(`Login Gagal: ${error.message}`, 'error');
            localStorage.removeItem('adminPassword');
        } finally { loginBtn.disabled = false; }
    });

    navButtons.forEach(button => button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        if (!targetId) return;
        navButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));
        button.classList.add('active');
        document.getElementById(targetId).classList.add('active');
        if (targetId === 'pengaturan') loadSettings();
        else if (targetId === 'kelola-produk') loadApiKeys();
    }));

    generalSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        try {
            await callApi('updateGeneralSettings', {
                whatsappNumber: waInput.value.trim(),
                discountEndDate: discountDateInput.value ? new Date(discountDateInput.value).toISOString() : null
            });
            showNotification('Pengaturan umum berhasil disimpan', 'success');
        } catch (error) { showNotification(error.message, 'error');
        } finally { button.disabled = false; }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminPassword');
        window.location.reload();
    });

    document.getElementById('create-key-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        try {
            await callApi('createApiKey', {
                key: document.getElementById('new-apikey-name').value.trim(),
                duration: document.getElementById('new-apikey-duration').value,
                unit: document.getElementById('new-apikey-unit').value,
                isPermanent: document.getElementById('permanent-key').checked
            });
            showNotification('API Key berhasil dibuat.', 'success');
            e.target.reset();
            loadApiKeys();
        } catch (error) { showNotification(error.message, 'error');
        } finally { button.disabled = false; }
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
        } else if (target.classList.contains('delete-btn')) {
            const confirmed = await showConfirmation('Hapus Paket?', 'Anda yakin ingin menghapus paket harga ini?');
            if (confirmed) {
                try { await callApi('deletePricingPlan', { planId }); showNotification('Paket berhasil dihapus', 'success'); loadSettings(); } 
                catch (error) { showNotification(error.message, 'error'); }
            }
        }
    });

    planEditorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        const planData = {
            id: planIdInput.value ? parseInt(planIdInput.value) : null,
            name: document.getElementById('plan-name').value,
            price: parseInt(document.getElementById('plan-price').value),
            discountPrice: parseInt(document.getElementById('plan-discount-price').value) || 0,
            description: document.getElementById('plan-description').value,
        };
        try {
            await callApi(planData.id ? 'updatePricingPlan' : 'addPricingPlan', planData);
            showNotification(`Paket berhasil ${planData.id ? 'diperbarui' : 'ditambahkan'}.`, 'success');
            closeModal(planEditorModal);
            loadSettings();
        } catch (error) { showNotification(error.message, 'error');
        } finally { button.disabled = false; }
    });

    manageProjectsBtn.addEventListener('click', async () => {
        modalBody.innerHTML = '<p>Memuat proyek...</p>';
        openModal(projectModal);
        try { const projects = await callApi('listProjects'); renderProjects(projects); } 
        catch (error) { modalBody.innerHTML = `<p style="color: var(--error-color);">${error.message}</p>`; }
    });

    modalBody.addEventListener('click', async (e) => {
        const targetButton = e.target.closest('button.delete-btn');
        if (!targetButton) return;
        const name = targetButton.dataset.name;
        const action = targetButton.dataset.action;
        const confirmed = await showConfirmation(`Hapus ${action === 'deleteRepo' ? 'Repositori' : 'Proyek Vercel'}?`, `Yakin ingin menghapus '${name}'?`);
        if (confirmed) {
            targetButton.disabled = true;
            try { await callApi(action, { repoName: name, projectName: name }); showNotification('Berhasil dihapus.', 'success'); manageProjectsBtn.click(); } 
            catch (error) { showNotification(error.message, 'error'); targetButton.disabled = false; }
        }
    });

    keyListContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.delete-btn');
        if (button) {
            const key = button.dataset.key;
            if (await showConfirmation('Hapus Kunci API?', `Yakin ingin menghapus kunci "${key}"?`)) {
                try { await callApi('deleteApiKey', { key }); showNotification('Kunci berhasil dihapus.', 'success'); loadApiKeys(); } 
                catch (error) { showNotification(`Gagal: ${error.message}`, 'error'); }
            }
        }
    });

    document.getElementById('permanent-key').addEventListener('change', (e) => {
        document.getElementById('duration-section').style.display = e.target.checked ? 'none' : 'block';
    });

    const init = () => {
        const themeToggle = document.getElementById('theme-toggle');
        const savedTheme = localStorage.getItem('theme_preference_v1') || 'dark';
        body.classList.toggle('dark-mode', savedTheme === 'dark');
        themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        themeToggle.addEventListener('click', () => {
            const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem('theme_preference_v1', newTheme);
            body.classList.toggle('dark-mode', newTheme === 'dark');
            themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
        
        projectModalCloseBtn.addEventListener('click', () => closeModal(projectModal));
        tryAutoLogin();
    };
    
    init();
});