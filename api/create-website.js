import { Octokit } from "@octokit/rest";
import fetch from "node-fetch";
import formidable from "formidable";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { promises as fsPromises } from 'fs'; // Menggunakan fs promises untuk operasi file modern
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
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID; // Opsional

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const VERCEL_API_BASE = `https://api.vercel.com`;
const VERCEL_HEADERS = { "Authorization": `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json" };
const TEAM_QUERY = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
const CF_HEADERS = { "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };

// --- Helper Functions ---
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

async function getAllFilesRecursive(dirPath) {
    const dirents = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dirPath, dirent.name);
        return dirent.isDirectory() ? getAllFilesRecursive(res) : res;
    }));
    return Array.prototype.concat(...files);
}

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
        console.error("Error loading domains:", error);
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

        // Aksi publik (tidak perlu password)
        switch(action) {
            case 'getSettings': {
                const settings = await readJsonFromGithub(SETTINGS_PATH);
                const defaultSettings = {
                    whatsappNumber: "",
                    normalPrice: 50000,
                    discountPrice: 25000,
                    discountEndDate: new Date().toISOString()
                };
                return res.status(200).json({ ...defaultSettings, ...settings });
            }
            case 'checkDomainStatus': {
                const { domain } = data;
                if (!domain) return res.status(400).json({ message: "Nama domain diperlukan." });
                try {
                    const addresses = await dns.resolve(domain);
                    if (addresses.includes(VERCEL_A_RECORD)) {
                        return res.status(200).json({ status: 'success', message: 'Domain sudah terhubung dengan benar.' });
                    }
                } catch (err) {}
                return res.status(200).json({ status: 'pending', message: 'Domain belum terhubung.' });
            }
            case 'checkSubdomain': {
                const { subdomain, rootDomain } = data;
                if (!subdomain || !rootDomain) return res.status(400).json({ message: "Subdomain dan domain utama diperlukan." });
                const finalDomain = `${subdomain}.${rootDomain}`;
                const checkRes = await fetch(`${VERCEL_API_BASE}/v9/projects/${finalDomain}${TEAM_QUERY}`, { headers: VERCEL_HEADERS });
                const result = await checkRes.json();
                return res.status(200).json({ available: !result.available });
            }
        }
        
        // Aksi admin (perlu password)
        if (adminPassword !== ADMIN_PASSWORD) return res.status(403).json({ message: "Password admin salah."});

        switch (action) {
            case "updateSettings": {
                if (!data) return res.status(400).json({ message: "Data pengaturan diperlukan." });
                const currentSettings = await readJsonFromGithub(SETTINGS_PATH);
                const newSettings = { ...currentSettings, ...data };
                await writeJsonToGithub(SETTINGS_PATH, newSettings, "Update app settings");
                return res.status(200).json({ message: "Pengaturan berhasil disimpan.", settings: newSettings });
            }
            case "getApiKeys": {
                const apiKeys = await readJsonFromGithub(APIKEYS_PATH);
                return res.status(200).json(apiKeys);
            }
            case "createApiKey": {
                let apiKeys = await readJsonFromGithub(APIKEYS_PATH);
                const { key, duration, unit, isPermanent } = data;
                if (!key || apiKeys[key]) return res.status(400).json({ message: "Nama API Key tidak boleh kosong atau sudah ada."});
                
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

                const newKeyData = { 
                    created_at: now.toISOString(), 
                    expires_at 
                };
                apiKeys[key] = newKeyData;
                
                await writeJsonToGithub(APIKEYS_PATH, apiKeys, `Create API Key: ${key}`);
                
                return res.status(200).json({ 
                    message: `Kunci '${key}' berhasil dibuat.`, 
                    newKey: { 
                        name: key, 
                        ...newKeyData 
                    } 
                });
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
                githubRepos.forEach(repo => {
                    allProjects[repo.name] = { name: repo.name, githubUrl: repo.html_url, isPrivate: repo.private, hasGithub: true, hasVercel: false };
                });
                vercelProjects.forEach(proj => {
                    if (allProjects[proj.name]) {
                        allProjects[proj.name].hasVercel = true;
                    } else {
                        allProjects[proj.name] = { name: proj.name, githubUrl: null, isPrivate: null, hasGithub: false, hasVercel: true };
                    }
                });
                return res.status(200).json(Object.values(allProjects));
            }
            case "deleteRepo": {
                const { repoName } = data;
                if (!repoName) return res.status(400).json({ message: "Nama repo diperlukan." });
                await octokit.repos.delete({ owner: REPO_OWNER, repo: repoName });
                return res.status(200).json({ message: `Repositori '${repoName}' berhasil dihapus.` });
            }
            case "deleteVercelProject": {
                const { projectName } = data;
                if (!projectName) return res.status(400).json({ message: "Nama proyek diperlukan." });
                const deleteRes = await fetch(`${VERCEL_API_BASE}/v9/projects/${projectName}${TEAM_QUERY}`, { method: 'DELETE', headers: VERCEL_HEADERS });
                if (!deleteRes.ok) {
                    const error = await deleteRes.json();
                    throw new Error(`Gagal menghapus proyek Vercel: ${error.error.message}`);
                }
                return res.status(200).json({ message: `Proyek Vercel '${projectName}' berhasil dihapus.` });
            }
            case "listAllCloudflareZones": {
                let allZones = []; let page = 1; let totalPages;
                do {
                    const response = await fetch(`https://api.cloudflare.com/client/v4/zones?page=${page}&per_page=50`, { headers: CF_HEADERS });
                    const result = await response.json();
                    if (!result.success) throw new Error("Gagal mengambil daftar zona dari Cloudflare.");
                    allZones = allZones.concat(result.result);
                    totalPages = result.result_info.total_pages;
                    page++;
                } while (page <= totalPages);
                return res.status(200).json(allZones);
            }
            case "addCloudflareZone": {
                const { domainName } = data;
                if (!domainName) throw new Error("Nama domain diperlukan.");
                const zonesResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?per_page=1`, { headers: CF_HEADERS });
                const zonesResult = await zonesResponse.json();
                if (!zonesResult.success) throw new Error(zonesResult.errors[0]?.message || "Gagal memverifikasi akun Cloudflare.");
                if (zonesResult.result.length === 0 && !process.env.CLOUDFLARE_ACCOUNT_ID) {
                     throw new Error("Tidak dapat menemukan Account ID Cloudflare. Harap tambahkan di .env atau pastikan ada minimal 1 domain di akun Anda.");
                }
                const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || zonesResult.result[0].account.id;
                const createResponse = await fetch(`https://api.cloudflare.com/client/v4/zones`, {
                    method: 'POST', headers: CF_HEADERS, body: JSON.stringify({ name: domainName, account: { id: accountId } })
                });
                const createResult = await createResponse.json();
                if (!createResult.success) throw new Error(createResult.errors[0]?.message || "Gagal menambahkan domain ke Cloudflare.");
                return res.status(200).json({ message: `Domain ${domainName} berhasil ditambahkan.`, nameservers: createResult.result.name_servers, domain: createResult.result.name });
            }
            case "listDnsRecords": {
                const { zoneId } = data;
                if (!zoneId) throw new Error("Zone ID diperlukan.");
                let allRecords = []; let page = 1; let totalPages;
                do {
                    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?page=${page}&per_page=100`, { headers: CF_HEADERS });
                    const result = await response.json();
                    if (!result.success) throw new Error("Gagal mengambil data DNS dari Cloudflare.");
                    allRecords = allRecords.concat(result.result);
                    totalPages = result.result_info.total_pages;
                    page++;
                } while (page <= totalPages);
                return res.status(200).json(allRecords);
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
            case "bulkDeleteCloudflareZones": {
                const { zoneIds } = data;
                if (!zoneIds || zoneIds.length === 0) throw new Error("Tidak ada zona yang dipilih untuk dihapus.");
                const results = await Promise.all(zoneIds.map(zoneId => 
                    fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { method: 'DELETE', headers: CF_HEADERS })
                ));
                const successCount = results.filter(r => r.ok).length;
                return res.status(200).json({ message: `${successCount} dari ${zoneIds.length} zona berhasil dihapus.` });
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
        await fsPromises.mkdir(tempDir);
        // [UPDATE] Batas upload file dinaikkan ke 50MB
        const form = formidable({ maxFileSize: 50 * 1024 * 1024, uploadDir: tempDir });
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
        // Cek duplikasi di Vercel & GitHub
        const vercelCheckRes = await fetch(`${VERCEL_API_BASE}/v9/projects/${repoName}${TEAM_QUERY}`, { headers: VERCEL_HEADERS });
        if (vercelCheckRes.ok) throw new Error(`Nama proyek "${repoName}" sudah digunakan di Vercel.`);
        try {
            await octokit.repos.get({ owner: REPO_OWNER, repo: repoName });
            throw new Error(`Repositori "${repoName}" sudah ada di GitHub.`);
        } catch (error) {
            if (error.status !== 404) throw error;
        }

        // Ekstrak file dan tentukan root
        const extractDir = path.join(tempDir, "extracted");
        await fsPromises.mkdir(extractDir);
        
        if (uploadedFile.mimetype === "application/zip") {
            const zip = new AdmZip(uploadedFile.filepath);
            zip.extractAllTo(extractDir, true);
        } else if (uploadedFile.mimetype === "text/html") {
            await fsPromises.rename(uploadedFile.filepath, path.join(extractDir, "index.html"));
        } else throw new Error("Format file tidak didukung.");
        
        const allExtractedFiles = await getAllFilesRecursive(extractDir);
        const indexPath = allExtractedFiles.find(f => path.basename(f).toLowerCase() === 'index.html');
        let uploadRoot;
        if (indexPath) {
            uploadRoot = path.dirname(indexPath);
        } else {
            uploadRoot = extractDir;
        }
        
        // Buat repositori GitHub
        await octokit.repos.createForAuthenticatedUser({ name: repoName, private: false });

        // Deteksi Proyek Node.js dan buat vercel.json jika perlu
        const packageJsonPath = path.join(uploadRoot, 'package.json');
        let isNodeProject = false;
        if (fs.existsSync(packageJsonPath)) {
            isNodeProject = true;
            const vercelJsonPath = path.join(uploadRoot, 'vercel.json');
            if (!fs.existsSync(vercelJsonPath)) {
                const packageJson = JSON.parse(await fsPromises.readFile(packageJsonPath, 'utf-8'));
                const mainFile = packageJson.main || 'index.js';

                const vercelConfig = {
                    version: 2,
                    builds: [{ src: mainFile, use: "@vercel/node" }],
                    routes: [{ src: "/(.*)", dest: mainFile }]
                };
                await fsPromises.writeFile(vercelJsonPath, JSON.stringify(vercelConfig, null, 2));
                console.log(`Dibuat vercel.json untuk proyek Node.js: ${repoName}`);
            }
        } else if (!indexPath) {
            throw new Error("File index.html tidak ditemukan dan proyek ini bukan proyek Node.js.");
        }
        
        // Upload semua file dari root yang sudah ditentukan
        const filesToUpload = await getAllFilesRecursive(uploadRoot);
        for (const filePath of filesToUpload) {
            const content = await fsPromises.readFile(filePath, { encoding: 'base64' });
            const githubPath = path.relative(uploadRoot, filePath).replace(/\\/g, "/");
            if (githubPath) {
                await octokit.repos.createOrUpdateFileContents({
                    owner: REPO_OWNER, repo: repoName, path: githubPath,
                    message: `Commit: ${githubPath}`, content
                });
            }
        }
        
        // Buat Proyek di Vercel
        const vercelProjectConfig = {
            name: repoName,
            gitRepository: { type: "github", repo: `${REPO_OWNER}/${repoName}` }
        };
        if (isNodeProject) {
            vercelProjectConfig.framework = "express";
        }

        const vercelProjectRes = await fetch(`${VERCEL_API_BASE}/v9/projects${TEAM_QUERY}`, {
            method: "POST", headers: VERCEL_HEADERS,
            body: JSON.stringify(vercelProjectConfig)
        });
        const vercelProject = await vercelProjectRes.json();
        if (vercelProject.error) throw new Error(`Vercel Error: ${vercelProject.error.message}`);
        
        // Trigger deployment pertama
        await fetch(`${VERCEL_API_BASE}/v13/deployments${TEAM_QUERY}`, {
            method: 'POST', headers: VERCEL_HEADERS,
            body: JSON.stringify({ name: repoName, gitSource: { type: 'github', repoId: vercelProject.link.repoId, ref: 'main' }, target: 'production' })
        });

        // Konfigurasi Domain di Vercel dan Cloudflare
        const finalDomain = `${subdomain}.${rootDomain}`;
        await fetch(`${VERCEL_API_BASE}/v10/projects/${repoName}/domains${TEAM_QUERY}`, {
            method: "POST", headers: VERCEL_HEADERS, body: JSON.stringify({ name: finalDomain })
        });
        
        const allDomains = JSON.parse(fs.readFileSync(path.resolve('./data/domains.json'), 'utf-8'));
        const domainInfo = allDomains[rootDomain];
        if (!domainInfo) throw new Error("Konfigurasi untuk domain utama tidak ditemukan.");
        
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
        
        // [FIX] Mencegah error 'find' pada alias yang mungkin belum ada
        const vercelUrl = vercelProject.alias?.find(a => a.domain.endsWith('.vercel.app'))?.domain || `${repoName}.vercel.app`;

        return response.status(200).json({
            message: "Proses pembuatan website dimulai!",
            siteData: { projectName: repoName, vercelUrl: `https://${vercelUrl}`, customUrl: `https://${finalDomain}`, status: 'pending' }
        });
    } catch (error) {
        console.error("Create Website Error:", error);
        return response.status(500).json({ message: error.message });
    } finally {
        if (fs.existsSync(tempDir)) await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
}

export const config = { api: { bodyParser: false } };