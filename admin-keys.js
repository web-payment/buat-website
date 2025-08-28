document.addEventListener('DOMContentLoaded', () => {
    // === Elemen UI ===
    const loadingOverlay = document.getElementById('loading-overlay');
    const loginScreen = document.getElementById('login-screen');
    const adminPanel = document.getElementById('admin-panel');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('login-btn');
    const notificationContainer = document.getElementById('notification-container');
    const logoutBtn = document.getElementById('logout-btn');

    // === Event Listener Utama ===
    const init = () => {
        setupTheme();
        setTimeout(tryAutoLogin, 500); // Sedikit percepat
        loginBtn.addEventListener('click', handleLogin);
        logoutBtn.addEventListener('click', handleLogout);
        setupTabs();
        setupApiKeySection();
        setupPricingSection();
        setupCloudflareSection();
        setupProjectManagement();
    };

    // === Fungsi Bantuan & Logika Umum ===
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

    const callApi = async (action, data = {}) => {
        const password = localStorage.getItem('adminPassword_v2'); 
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

    const openModal = (container, htmlContent) => {
        container.innerHTML = htmlContent;
        container.style.display = 'flex';
        return container.querySelector('.modal-content');
    };
    
    const closeModal = (container) => {
        container.style.display = 'none';
        container.innerHTML = '';
    };

    const showConfirmation = (title, message) => {
        return new Promise((resolve) => {
            const container = document.getElementById('confirmation-modal');
            const content = openModal(container, `
                <div class="modal-content" style="max-width: 350px; text-align: center;">
                    <h3>${title}</h3>
                    <p style="color: var(--text-muted); margin: 10px 0 20px;">${message}</p>
                    <div style="display: flex; gap: 10px;">
                        <button id="confirm-btn-no" class="full-width" style="background-color: var(--text-muted);">Batal</button>
                        <button id="confirm-btn-yes" class="full-width" style="background-color: var(--error-color);">Ya, Lanjutkan</button>
                    </div>
                </div>
            `);
            content.querySelector('#confirm-btn-yes').onclick = () => { closeModal(container); resolve(true); };
            content.querySelector('#confirm-btn-no').onclick = () => { closeModal(container); resolve(false); };
        });
    };

    // === Manajemen Login & Tema ===
    const handleLogin = async () => {
        const password = passwordInput.value;
        if (!password) return showNotification('Password tidak boleh kosong.', 'error');
        localStorage.setItem('adminPassword_v2', password); 
        loginBtn.textContent = 'Memverifikasi...'; loginBtn.disabled = true;
        try {
            await loadAllAdminData();
            loginScreen.style.display = 'none';
            adminPanel.style.display = 'block';
            showNotification('Login berhasil!', 'success');
        } catch (error) {
            showNotification(`Login Gagal: ${error.message}`, 'error');
            localStorage.removeItem('adminPassword_v2'); 
        } finally {
            loginBtn.textContent = 'Masuk'; loginBtn.disabled = false;
        }
    };
    
    const tryAutoLogin = async () => {
        try {
            if (localStorage.getItem('adminPassword_v2')) {
                await loadAllAdminData();
                loginScreen.style.display = 'none';
                adminPanel.style.display = 'block';
            } else {
                loginScreen.style.display = 'block';
            }
        } catch (error) {
            localStorage.removeItem('adminPassword_v2');
            loginScreen.style.display = 'block';
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminPassword_v2');
        showNotification('Anda telah logout.', 'success');
        setTimeout(() => window.location.reload(), 1500);
    };

    const setupTheme = () => {
        const themeToggle = document.getElementById('theme-toggle');
        const body = document.body;
        const savedTheme = localStorage.getItem('theme_preference_v2') || 'light';
        const applyTheme = (theme) => {
            body.classList.toggle('dark-mode', theme === 'dark');
            themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        };
        applyTheme(savedTheme);
        themeToggle.addEventListener('click', () => {
            const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem('theme_preference_v2', newTheme);
            applyTheme(newTheme);
        });
    };

    // === Manajemen Tab ===
    const setupTabs = () => {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === button.dataset.tab);
                });
            });
        });
    };

    // === Load Data Awal ===
    const loadAllAdminData = async () => {
        const [keys, settings] = await Promise.all([
            callApi('getApiKeys'),
            callApi('getSettings') // Sekarang getSettings juga butuh password
        ]);
        renderApiKeys(keys);
        renderPricingTiers(settings.pricingTiers || []);
        document.getElementById('whatsapp-number').value = settings.whatsappNumber || '';
    };

    // === Bagian API Keys ===
    function setupApiKeySection() {
        const form = document.getElementById('create-key-form');
        const listContainer = document.getElementById('api-key-list-container');
        const modalContainer = document.getElementById('apikey-success-modal');
        const formatFullDate = (iso) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.textContent = 'Membuat...'; btn.disabled = true;
            try {
                const result = await callApi('createApiKey', {
                    key: document.getElementById('new-apikey-name').value.trim(),
                    duration: document.getElementById('new-apikey-duration').value,
                    unit: document.getElementById('new-apikey-unit').value,
                    isPermanent: document.getElementById('permanent-key').checked
                });
                showApiKeySuccessPopup(result.newKey);
                form.reset();
                document.getElementById('duration-section').style.display = 'block';
            } catch (error) {
                showNotification(`Gagal: ${error.message}`, 'error');
            } finally {
                btn.textContent = 'Buat Kunci'; btn.disabled = false;
            }
        });

        document.getElementById('permanent-key').addEventListener('change', (e) => {
            document.getElementById('duration-section').style.display = e.target.checked ? 'none' : 'block';
        });

        listContainer.addEventListener('click', async (e) => {
            const button = e.target.closest('.delete-btn');
            if (!button) return;
            const key = button.dataset.key;
            if (await showConfirmation('Hapus Kunci API?', `Yakin ingin menghapus kunci "${key}"?`)) {
                try {
                    const result = await callApi('deleteApiKey', { key });
                    showNotification(result.message, 'success');
                    renderApiKeys(await callApi('getApiKeys'));
                } catch (error) {
                    showNotification(`Gagal: ${error.message}`, 'error');
                }
            }
        });

        const showApiKeySuccessPopup = (newKey) => {
            const expiryText = newKey.expires_at === 'permanent' ? 'Permanen' : formatFullDate(newKey.expires_at);
            const content = openModal(modalContainer, `
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <h3><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Kunci Dibuat!</h3>
                    <div style="text-align: left; margin: 20px; padding: 10px; background: var(--bg-color); border-radius: 8px;">
                        <p><strong>Kunci API:</strong> ${newKey.name}</p>
                        <p><strong>Kadaluwarsa:</strong> ${expiryText}</p>
                    </div>
                    <p style="font-size: 0.9em; color: var(--text-muted); padding: 0 20px 20px;">Salin dan simpan kunci ini. Anda tidak akan bisa melihatnya lagi.</p>
                    <div style="display: flex; gap: 10px; padding: 0 20px 20px;">
                         <button id="copy-key-btn" class="full-width" style="background-color: var(--text-muted);">Copy Info</button>
                         <button id="ok-btn" class="full-width">OK</button>
                    </div>
                </div>
            `);
            const copyText = `API Key: ${newKey.name}\nKadaluwarsa: ${expiryText}`;
            content.querySelector('#ok-btn').onclick = async () => {
                closeModal(modalContainer);
                renderApiKeys(await callApi('getApiKeys'));
            };
            content.querySelector('#copy-key-btn').onclick = (e) => {
                navigator.clipboard.writeText(copyText).then(() => {
                    e.target.textContent = 'Tersalin!';
                    setTimeout(() => e.target.textContent = 'Copy Info', 2000);
                });
            };
        };
    }
    
    window.renderApiKeys = (keys) => {
        const container = document.getElementById('api-key-list-container');
        container.innerHTML = '';
        if (Object.keys(keys).length === 0) {
            container.innerHTML = '<p>Belum ada API Key yang dibuat.</p>';
            return;
        }
        const formatFullDate = (iso) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
        Object.entries(keys).forEach(([key, data]) => {
            const expiry = data.expires_at === 'permanent' ? 'Permanen' : `Kadaluwarsa: ${formatFullDate(data.expires_at)}`;
            const item = document.createElement('div');
            item.className = 'key-item';
            item.innerHTML = `
                <div class="key-info">
                    <span class="key-name">${key}</span>
                    <span class="key-expiry">${expiry}</span>
                </div>
                <button class="delete-btn" data-key="${key}"><i class="fas fa-trash-alt"></i></button>`;
            container.appendChild(item);
        });
    };

    // === Bagian Pengaturan Harga ===
    function setupPricingSection() {
        const form = document.getElementById('settings-form');
        const container = document.getElementById('pricing-tiers-container');
        document.getElementById('add-tier-btn').addEventListener('click', () => addPricingTier());

        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-tier-btn')) {
                e.target.closest('.price-tier-item').remove();
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.textContent = 'Menyimpan...'; btn.disabled = true;

            const tiers = [];
            document.querySelectorAll('.price-tier-item').forEach(item => {
                tiers.push({
                    id: item.dataset.id,
                    name: item.querySelector('.tier-name').value,
                    price: item.querySelector('.tier-price').value,
                    description: item.querySelector('.tier-description').value,
                });
            });
            
            try {
                await callApi('updateSettings', {
                    whatsappNumber: document.getElementById('whatsapp-number').value,
                    pricingTiers: tiers
                });
                showNotification('Pengaturan berhasil disimpan!', 'success');
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                btn.textContent = 'Simpan Semua Pengaturan'; btn.disabled = false;
            }
        });
    }

    const addPricingTier = (tier = {}) => {
        const container = document.getElementById('pricing-tiers-container');
        const item = document.createElement('div');
        item.className = 'price-tier-item';
        item.dataset.id = tier.id || `new_${Date.now()}`;
        item.innerHTML = `
            <button type="button" class="delete-tier-btn">&times;</button>
            <div class="form-group">
                <label>Nama Paket</label>
                <input type="text" class="tier-name" placeholder="Cth: Paket 7 Hari" value="${tier.name || ''}" required>
            </div>
            <div class="form-group">
                <label>Harga (Rp)</label>
                <input type="number" class="tier-price" placeholder="Cth: 25000" value="${tier.price || ''}" required>
            </div>
            <div class="form-group description-group">
                <label>Deskripsi Singkat (Opsional)</label>
                <textarea class="tier-description" rows="2" placeholder="Cth: Aktif selama 7 hari.">${tier.description || ''}</textarea>
            </div>
        `;
        container.appendChild(item);
    };
    
    window.renderPricingTiers = (tiers) => {
        const container = document.getElementById('pricing-tiers-container');
        container.innerHTML = '';
        if (tiers && tiers.length > 0) {
            tiers.forEach(tier => addPricingTier(tier));
        }
    };

    // === Bagian Cloudflare ===
    function setupCloudflareSection() {
        const btn = document.getElementById('manage-domains-btn');
        const modalContainer = document.getElementById('cloudflare-modal');

        btn.addEventListener('click', async () => {
            const content = openModal(modalContainer, `<div class="modal-content"><p>Memuat zona dari Cloudflare...</p></div>`);
            try {
                const data = await callApi('listAllCloudflareZones');
                renderCloudflareZones(data.zones, data.totalCount);
            } catch (error) {
                showNotification(error.message, 'error');
                content.innerHTML = `<p style="color: var(--error-color);">Gagal memuat. Pastikan CLOUDFLARE_API_TOKEN sudah benar.</p>`;
            }
        });

        const renderCloudflareZones = (zones, totalCount) => {
            let listHtml = zones.map(zone => `
                <li class="list-item">
                    <div class="item-info">
                        <strong>${zone.name}</strong>
                        <span>Status: ${zone.status}</span>
                    </div>
                </li>`).join('');

            const content = openModal(modalContainer, `
                <div class="modal-content">
                    <button class="modal-close">&times;</button>
                    <div class="modal-header">
                        <h2>Manajemen Zona Cloudflare (${totalCount} Domain)</h2>
                    </div>
                    <div id="cloudflare-modal-body">
                        <ul class="list-item-container">${zones.length > 0 ? listHtml : '<li>Tidak ada zona ditemukan.</li>'}</ul>
                    </div>
                </div>
            `);
            content.querySelector('.modal-close').onclick = () => closeModal(modalContainer);
        };
    }
    
    // === Bagian Manajemen Proyek ===
    function setupProjectManagement() {
        const btn = document.getElementById('manage-projects-btn');
        const modalContainer = document.getElementById('project-modal');

        btn.addEventListener('click', async () => {
            const content = openModal(modalContainer, `<div class="modal-content"><p>Memuat proyek...</p></div>`);
            try {
                const projects = await callApi('listProjects');
                renderProjects(projects);
            } catch (error) {
                showNotification(error.message, 'error');
                content.innerHTML = `<p style="color: var(--error-color);">${error.message}</p>`;
            }
        });
        
        const renderProjects = (projects) => {
             let projectHtml = projects.map(proj => {
                const githubButton = proj.hasGithub ? `<button class="delete-btn delete-repo-btn" data-name="${proj.name}">Hapus Repo</button>` : '';
                const vercelButton = proj.hasVercel ? `<button class="delete-btn delete-vercel-btn" data-name="${proj.name}" style="background-color: var(--warn-color);">Hapus Vercel</button>` : '';
                const repoInfo = proj.hasGithub ? `<a href="${proj.githubUrl}" target="_blank">${proj.name}</a>` : `<strong>${proj.name}</strong>`;
                return `<li class="list-item">
                            <div class="item-info">${repoInfo}</div>
                            <div style="display: flex; gap: 5px;">${githubButton}${vercelButton}</div>
                        </li>`;
            }).join('');
            
            const content = openModal(modalContainer, `
                 <div class="modal-content">
                    <button class="modal-close">&times;</button>
                    <h2>Daftar Repositori & Proyek</h2>
                    <div id="modal-body">
                        <ul class="list-item-container">${projects.length > 0 ? projectHtml : '<li>Tidak ada proyek.</li>'}</ul>
                    </div>
                 </div>
            `);
            content.querySelector('.modal-close').onclick = () => closeModal(modalContainer);
            content.querySelector('#modal-body').addEventListener('click', handleDeleteProject);
        };
        
        const handleDeleteProject = async (e) => {
            const targetButton = e.target.closest('button.delete-btn');
            if (!targetButton) return;
            const repoName = targetButton.dataset.name;
            let action, title, message, originalText;

            if (targetButton.classList.contains('delete-repo-btn')) {
                action = 'deleteRepo'; title = 'Hapus Repositori GitHub?';
                message = `Hapus permanen repositori '${repoName}' di GitHub?`;
                originalText = 'Hapus Repo';
            } else if (targetButton.classList.contains('delete-vercel-btn')) {
                action = 'deleteVercelProject'; title = 'Hapus Proyek Vercel?';
                message = `Hapus proyek '${repoName}' dari Vercel?`;
                originalText = 'Hapus Vercel';
            } else { return; }

            if (await showConfirmation(title, message)) {
                targetButton.textContent = '...'; targetButton.disabled = true;
                try {
                    const result = await callApi(action, { repoName: repoName, projectName: repoName });
                    showNotification(result.message, 'success');
                    targetButton.closest('li').remove();
                } catch (error) {
                    showNotification(error.message, 'error');
                    targetButton.textContent = originalText; targetButton.disabled = false;
                }
            }
        };
    }

    // === Inisialisasi Aplikasi ===
    init();
});