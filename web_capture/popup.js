initI18n(); // Iniciar idiomas

document.getElementById('btnLang').addEventListener('click', toggleLang);

document.getElementById('btnTab1').onclick = () => switchTab('tab1', 'btnTab1');
document.getElementById('btnTab2').onclick = () => switchTab('tab2', 'btnTab2');

function switchTab(tabId, btnId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.getElementById(btnId).classList.add('active');
}

document.getElementById('extractSingle').onclick = async () => {
    const btn = document.getElementById('extractSingle');
    btn.innerText = t('popBtnExtracting'); 
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ action: "process_urls", urls: [tab.url], tabId: tab.id }, (response) => {
        btn.innerText = t('popBtn1'); 
        if (response && response.error) alert("⚠️ Error: " + response.error);
    });
};

// --- Iniciar Modo Visual (Inyección Forzada) ---
const btnVisual = document.getElementById('startVisualMode');
if (btnVisual) {
    btnVisual.onclick = async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") || tab.url.startsWith("chrome-extension://")) {
            alert("⚠️ No puedes usar el inspector aquí. Por favor, navega a una tienda real.");
            return;
        }

        // Le pedimos al background que inyecte el script a la fuerza antes de enviar el mensaje
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error inyectando script:", chrome.runtime.lastError.message);
                alert("⚠️ Error inyectando el inspector. Intenta recargar la página.");
                return;
            }

            // Una vez inyectado con éxito, enviamos el mensaje para iniciar
            chrome.tabs.sendMessage(tab.id, { action: "start_visual_mode", lang: typeof currentLang !== 'undefined' ? currentLang : 'es' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error enviando mensaje:", chrome.runtime.lastError.message);
                } else {
                    window.close(); // Cerramos si todo fue bien
                }
            });
        });
    };
}

document.getElementById('extractBulk').onclick = () => {
    let urls = document.getElementById('bulkUrls').value.split('\n').map(u => u.trim()).filter(u => u);
    if(urls.length === 0 || urls.length > 5) return alert(t('popErrLimit'));
    const btn = document.getElementById('extractBulk');
    btn.innerText = t('popBtnExtracting');
    chrome.runtime.sendMessage({ action: "process_urls", urls: urls }, (response) => {
        btn.innerText = t('popBtn2');
        if (response && response.error) alert("⚠️ Error: " + response.error);
    });
};

document.getElementById('btnOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage ? chrome.runtime.openOptionsPage() : window.open(chrome.runtime.getURL('options.html'));
});