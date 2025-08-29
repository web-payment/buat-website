import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import formidable from "formidable";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { promises as dns } from 'dns';

// --- Konfigurasi ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const REPO_NAME_FOR_JSON = process.env.REPO_NAME_FOR_JSON;
const VERCEL_A_RECORD = '76.76.21.21';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const VERCEL_API_BASE = `https://api.vercel.com`;
const VERCEL_HEADERS = { "Authorization": `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" };
const TEAM_QUERY = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
const CF_HEADERS = { "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };

// --- Fungsi Helper ---
async function readJsonFromGithub(filePath) {
    try {
        const { data } = await octokit.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME_FOR_JSON, path: filePath });
        const content = Buffer.from(data.content, "base64").toString();
        return JSON.parse(content);
    } catch (err) {
        if (err.status === 404) return {};
        throw err;
    }
}
async function writeJsonToGithub(filePath, json, message) {
    let sha;
    try {
        const { data } = await octokit.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME_FOR_JSON, path: filePath });
        sha = data.sha;
    } catch (err) {
        if (err.status !== 404) throw err;
    }
    const content = Buffer.from(JSON.stringify(json, null, 2)).toString("base64");
    await octokit.repos.createOrUpdateFileContents({ owner: REPO_OWNER, repo: REPO_NAME_FOR_JSON, path: filePath, message, content, sha });
}

const getAllFiles = (dirPath, arrayOfFiles = []) => {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
};

// --- Handler Utama ---
export default async function handler(request, response) {
    if (request.method === 'GET') {
        return handleGetDomains(request, response);
    }
    if (request.method === 'POST') {
        const contentType = request.headers['content-type'] || '';
        if (contentType.includes('multipart/form-data')) {
            return handleCreateWebsite(request, response);
        } else {
            return handleJsonActions(request, response);
        }
    }
    return response.status(405).json({ message: 'Metode tidak diizinkan.' });
}

// --- Logika GET ---
async function handleGetDomains(req, res) {
    try {
        const domainsData = JSON.parse(fs.readFileSync(path.resolve('./data/domains.json'), 'utf-8'));
        return res.status(200).json(Object.keys(domainsData));
    } catch (error) {
        if (error.code === 'ENOENT') {
             return res.status(500).json({ message: "File konfigurasi domain tidak ditemukan." });
        }
        return res.status(500).json({ message: "Gagal memuat daftar domain." });
    }
}

// --- Logika POST untuk Admin & Publik ---
async function handleJsonActions(req, res) {
    try {
        const { action, data, adminPassword } = req.body;
        const SETTINGS_PATH = "data/settings.json";
        const APIKEYS_PATH = "data/apikeys.json";

        // Aksi publik
        switch(action) {
            case 'getSettings': {
                const settings = await readJsonFromGithub(SETTINGS_PATH);
                const defaultSettings = {
                    whatsappNumber: "",
                    discountEndDate: null,
                    pricingPlans: []
                };
                return res.status(200).json({ ...defaultSettings, ...settings });
            }
            case 'checkDomainStatus': {
                const { domain } = data;
                if (!domain) return res.status(400).json({ message: "Nama domain diperlukan." });
                try {
                    const addresses = await dns.resolve(domain);
                    if (addresses.includes(VERCEL_A_RECORD)) {
                        return res.status(200).json({ status: 'success', message: 'Domain sudah terhubung.' });
                    }
                } catch (err) {}
                return res.status(200).json({ status: 'pending', message: 'Domain belum terhubung.' });
            }
        }
        
        // Aksi admin
        if (adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ message: "Password admin salah."});

        switch (action) {
            // --- FUNGSI LAMA YANG DIHAPUS, DIGANTI DENGAN YANG BARU DI BAWAH ---
            // case "updateSettings": { ... }

            // --- FUNGSI BARU UNTUK PENGATURAN HARGA ---
            case "updateGeneralSettings": {
                const { whatsappNumber, discountEndDate } = data;
                const settings = await readJsonFromGithub(SETTINGS_PATH) || {};
                settings.whatsappNumber = whatsappNumber;
                settings.discountEndDate = discountEndDate;
                await writeJsonToGithub(SETTINGS_PATH, settings, "Update general settings");
                return res.status(200).json({ message: "Pengaturan umum berhasil disimpan." });
            }
            case "addPricingPlan": {
                const newPlan = data;
                if (!newPlan.name || !newPlan.price) {
                    return res.status(400).json({ message: "Nama dan Harga Normal wajib diisi." });
                }
                const settings = await readJsonFromGithub(SETTINGS_PATH) || {};
                if (!settings.pricingPlans) settings.pricingPlans = [];
                newPlan.id = Date.now();
                settings.pricingPlans.push(newPlan);
                await writeJsonToGithub(SETTINGS_PATH, settings, `Add pricing plan: ${newPlan.name}`);
                return res.status(200).json({ message: "Paket harga berhasil ditambahkan.", newPlan });
            }
            case "updatePricingPlan": {
                const updatedPlan = data;
                const settings = await readJsonFromGithub(SETTINGS_PATH);
                const planIndex = settings.pricingPlans.findIndex(p => p.id === updatedPlan.id);
                if (planIndex === -1) return res.status(404).json({ message: "Paket harga tidak ditemukan." });
                settings.pricingPlans[planIndex] = updatedPlan;
                await writeJsonToGithub(SETTINGS_PATH, settings, `Update pricing plan: ${updatedPlan.name}`);
                return res.status(200).json({ message: "Paket harga berhasil diperbarui." });
            }
            case "deletePricingPlan": {
                const { planId } = data;
                const settings = await readJsonFromGithub(SETTINGS_PATH);
                settings.pricingPlans = settings.pricingPlans.filter(p => p.id !== planId);
                await writeJsonToGithub(SETTINGS_PATH, settings, `Delete pricing plan ID: ${planId}`);
                return res.status(200).json({ message: "Paket harga berhasil dihapus." });
            }

            // --- FUNGSI BAWAAN LAINNYA TETAP ADA ---
            case "getApiKeys": {
                const apiKeys = await readJsonFromGithub(APIKEYS_PATH);
                return res.status(200).json(apiKeys);
            }
            case "createApiKey": {
                let apiKeys = await readJsonFromGithub(APIKEYS_PATH);
                const { key, duration, unit, isPermanent } = data;
                if (!key || apiKeys[key]) return res.status(400).json({ message: "Nama API Key tidak valid atau sudah ada."});
                const now = new Date();
                let expires_at = "permanent";
                if (!isPermanent) {
                    const d = parseInt(duration, 10);
                    const expiryDate = new Date(now);
                    if (unit === "days") expiryDate.setDate(expiryDate.getDate() + d);
                    else if (unit === "weeks") expiryDate.setDate(expiryDate.getDate() + (d * 7));
                    else if (unit === "months") expiryDate.setMonth(expiryDate.getMonth() + d);
                    expires_at = expiryDate.toISOString();
                }
                apiKeys[key] = { created_at: now.toISOString(), expires_at };
                await writeJsonToGithub(APIKEYS_PATH, apiKeys, `Create API Key: ${key}`);
                return res.status(200).json({ message: `Kunci '${key}' berhasil dibuat.`, newKey: { name: key, ...apiKeys[key] } });
            }
            case "deleteApiKey": {
                let apiKeys = await readJsonFromGithub(APIKEYS_PATH);
                const { key } = data;
                if (!apiKeys[key]) return res.status(404).json({ message: "API Key tidak ditemukan."});
                delete apiKeys[key];
                await writeJsonToGithub(APIKEYS_PATH, apiKeys, `Delete API Key: ${key}`);
                return res.status(200).json({ message: `Kunci '${key}' berhasil dihapus.` });
            }
            case "listProjects": {
                const { data: githubRepos } = await octokit.repos.listForAuthenticatedUser({ sort: 'created', direction: 'desc' });
                const vercelRes = await fetch(`${VERCEL_API_BASE}/v9/projects${TEAM_QUERY}`, { headers: VERCEL_HEADERS });
                if (!vercelRes.ok) throw new Error("Gagal mengambil data dari Vercel.");
                const { projects: vercelProjects = [] } = await vercelRes.json();
                const allProjects = {};
                githubRepos.forEach(repo => { allProjects[repo.name] = { name: repo.name, githubUrl: repo.html_url, isPrivate: repo.private, hasGithub: true, hasVercel: false }; });
                vercelProjects.forEach(proj => {
                    if (allProjects[proj.name]) { allProjects[proj.name].hasVercel = true; } 
                    else { allProjects[proj.name] = { name: proj.name, githubUrl: null, isPrivate: null, hasGithub: false, hasVercel: true }; }
                });
                return res.status(200).json(Object.values(allProjects));
            }
            case "deleteRepo": {
                await octokit.repos.delete({ owner: REPO_OWNER, repo: data.repoName });
                return res.status(200).json({ message: `Repositori '${data.repoName}' berhasil dihapus.` });
            }
            case "deleteVercelProject": {
                const deleteRes = await fetch(`${VERCEL_API_BASE}/v9/projects/${data.projectName}${TEAM_QUERY}`, { method: 'DELETE', headers: VERCEL_HEADERS });
                if (!deleteRes.ok) {
                    const error = await deleteRes.json();
                    throw new Error(`Gagal hapus proyek Vercel: ${error.error.message}`);
                }
                return res.status(200).json({ message: `Proyek Vercel '${data.projectName}' berhasil dihapus.` });
            }
            case "listAllCloudflareZones": {
                const response = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=100`, { headers: CF_HEADERS });
                const result = await response.json();
                if (!result.success) throw new Error("Gagal mengambil zona dari Cloudflare.");
                return res.status(200).json(result.result);
            }
            case "addCloudflareZone": {
                 const { domainName } = data;
                if (!domainName) throw new Error("Nama domain diperlukan.");
                const zonesResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=1`, { headers: CF_HEADERS });
                const zonesResult = await zonesResponse.json();
                if (!zonesResult.success) throw new Error(zonesResult.errors[0]?.message || "Gagal memverifikasi akun Cloudflare.");
                if (zonesResult.result.length === 0 && !process.env.CLOUDFLARE_ACCOUNT_ID) {
                     throw new Error("Account ID Cloudflare tidak ditemukan. Harap tambahkan di .env atau pastikan ada minimal 1 domain di akun Anda.");
                }
                const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || zonesResult.result[0].account.id;
                const createResponse = await fetch(`https://api.cloudflare.com/client/v4/zones`, {
                    method: 'POST', headers: CF_HEADERS, body: JSON.stringify({ name: domainName, account: { id: accountId } })
                });
                const createResult = await createResponse.json();
                if (!createResult.success) throw new Error(createResult.errors[0]?.message || "Gagal menambahkan domain.");
                return res.status(200).json({ message: `Domain ${domainName} berhasil ditambahkan.`, nameservers: createResult.result.name_servers, domain: createResult.result.name });
            }
            case "listDnsRecords": {
                const { zoneId } = data;
                if (!zoneId) throw new Error("Zone ID diperlukan.");
                const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`, { headers: CF_HEADERS });
                const result = await response.json();
                if (!result.success) throw new Error("Gagal mengambil data DNS.");
                return res.status(200).json(result.result);
            }
            case "bulkDeleteDnsRecords": {
                const { zoneId, recordIds } = data;
                if (!zoneId || !recordIds || recordIds.length === 0) throw new Error("Data tidak lengkap untuk hapus DNS.");
                const results = await Promise.all(recordIds.map(recordId => 
                    fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, { method: 'DELETE', headers: CF_HEADERS })
                ));
                const successCount = results.filter(r => r.ok).length;
                return res.status(200).json({ message: `${successCount} dari ${recordIds.length} record DNS berhasil dihapus.` });
            }
            default:
                return res.status(400).json({ message: "Aksi tidak dikenal." });
        }
    } catch (error) {
        console.error("JSON Action Error:", error.message);
        return res.status(500).json({ message: error.message });
    }
}

// --- Logika POST untuk Create Website ---
async function handleCreateWebsite(request, response) {
    const tempDir = path.join("/tmp", `website-${Date.now()}`);
    try {
        const form = formidable({ maxFileSize: 10 * 1024 * 1024, uploadDir: "/tmp" });
        const [fields, files] = await form.parse(request);
        const { subdomain, rootDomain, apiKey } = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]]));
        const uploadedFile = files.websiteFile[0];
        if (!subdomain || !rootDomain || !apiKey || !uploadedFile) throw new Error("Semua kolom wajib diisi.");

        const validApiKeys = await readJsonFromGithub("data/apikeys.json");
        const keyData = validApiKeys[apiKey];
        if (!keyData || (keyData.expires_at !== "permanent" && new Date() > new Date(keyData.expires_at))) {
           throw new Error("API Key tidak valid atau sudah kadaluwarsa.");
        }
        
        const repoName = subdomain;

        fs.mkdirSync(tempDir);
        if (uploadedFile.mimetype === "application/zip") {
            const zip = new AdmZip(uploadedFile.filepath);
            zip.extractAllTo(tempDir, true);
        } else {
             throw new Error("Hanya file .zip yang didukung.");
        }
        
        const uploadRoot = tempDir;
        if (!fs.existsSync(path.join(uploadRoot, 'index.html'))) {
            throw new Error("File 'index.html' tidak ditemukan di dalam root .zip Anda. Pastikan 'index.html' ada di lapisan paling luar dalam .zip.");
        }

        await octokit.repos.createForAuthenticatedUser({ name: repoName, private: false });
        
        const allFiles = getAllFiles(uploadRoot);
        for (const filePath of allFiles) {
            const content = fs.readFileSync(filePath, "base64");
            const githubPath = path.relative(uploadRoot, filePath).replace(/\\/g, "/");
            await octokit.repos.createOrUpdateFileContents({
                owner: REPO_OWNER, repo: repoName, path: githubPath,
                message: `Commit: ${githubPath}`, content
            });
        }
        
        const vercelProjectRes = await fetch(`${VERCEL_API_BASE}/v9/projects${TEAM_QUERY}`, {
            method: "POST", headers: VERCEL_HEADERS,
            body: JSON.stringify({ name: repoName, gitRepository: { type: "github", repo: `${REPO_OWNER}/${repoName}` } })
        });
        const vercelProject = await vercelProjectRes.json();
        if (vercelProject.error) throw new Error(`Vercel Error: ${vercelProject.error.message}`);
        
        const vercelUrl = `${repoName}.vercel.app`;
        
        await fetch(`${VERCEL_API_BASE}/v13/deployments${TEAM_QUERY}`, {
            method: 'POST', headers: VERCEL_HEADERS,
            body: JSON.stringify({ name: repoName, gitSource: { type: 'github', repoId: vercelProject.link.repoId, ref: 'main' }, target: 'production' })
        });

        const finalDomain = `${subdomain}.${rootDomain}`;
        await fetch(`${VERCEL_API_BASE}/v10/projects/${repoName}/domains${TEAM_QUERY}`, {
            method: "POST", headers: VERCEL_HEADERS,
            body: JSON.stringify({ name: finalDomain })
        });
        
        const allDomains = JSON.parse(fs.readFileSync(path.resolve('./data/domains.json'), 'utf-8'));
        const domainInfo = allDomains[rootDomain];
        if (!domainInfo) throw new Error("Konfigurasi domain utama tidak ditemukan.");
        
        const cfAuthHeader = { "Authorization": `Bearer ${domainInfo.apitoken}` };
        
        const recordsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${domainInfo.zone}/dns_records?name=${finalDomain}`, { headers: cfAuthHeader }).then(res => res.json());
        if (recordsRes.success && recordsRes.result.length > 0) {
            for (const record of recordsRes.result) {
                await fetch(`https://api.cloudflare.com/client/v4/zones/${domainInfo.zone}/dns_records/${record.id}`, { method: 'DELETE', headers: cfAuthHeader });
            }
        }
        
        await fetch(`https://api.cloudflare.com/client/v4/zones/${domainInfo.zone}/dns_records`, {
            method: "POST", headers: { ...cfAuthHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ type: 'A', name: subdomain, content: VERCEL_A_RECORD, proxied: false, ttl: 1 })
        });
        
        return response.status(200).json({
            message: "Proses pembuatan website dimulai!",
            siteData: { projectName: repoName, vercelUrl: `https://${vercelUrl}`, customUrl: `https://${finalDomain}`, status: 'pending' }
        });
    } catch (error) {
        console.error("Create Website Error:", error);
        return response.status(500).json({ message: error.message });
    } finally {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

export const config = { api: { bodyParser: false } };