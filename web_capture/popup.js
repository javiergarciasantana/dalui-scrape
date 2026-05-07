// Navegación de pestañas
document.getElementById('btnTab1').onclick = () => switchTab('tab1', 'btnTab1');
document.getElementById('btnTab2').onclick = () => switchTab('tab2', 'btnTab2');

function switchTab(tabId, btnId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById(btnId).classList.add('active');
}

// Extraer único
document.getElementById('extractSingle').onclick = async () => {
    const btn = document.getElementById('extractSingle');
    btn.innerText = "Extrayendo... ⏳"; 
    
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.runtime.sendMessage({ action: "process_urls", urls: [tab.url], tabId: tab.id }, (response) => {
        btn.innerText = "Extraer Producto"; 
        if (response && response.error) {
            alert("⚠️ Error: " + response.error);
        }
    });
};

// Extraer Bulk (Masivo)
document.getElementById('extractBulk').onclick = () => {
    let urls = document.getElementById('bulkUrls').value.split('\n').map(u => u.trim()).filter(u => u);
    if(urls.length === 0 || urls.length > 5) return alert("Introduce entre 1 y 5 URLs");
    
    const btn = document.getElementById('extractBulk');
    btn.innerText = "Extrayendo... ⏳";
    
    chrome.runtime.sendMessage({ action: "process_urls", urls: urls }, (response) => {
        btn.innerText = "Extraer Cola";
        if (response && response.error) {
            alert("⚠️ Error: " + response.error);
        }
    });
};

// --- NUEVO: Abrir la página de configuración (Opciones) ---
document.getElementById('btnOptions').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
        // Esta es la forma oficial y recomendada por Chrome
        chrome.runtime.openOptionsPage();
    } else {
        // Fallback por si acaso
        window.open(chrome.runtime.getURL('options.html'));
    }
});