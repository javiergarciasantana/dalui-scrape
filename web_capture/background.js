chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "process_urls") {
        // Llamamos a la función asíncrona y le enviamos la respuesta al popup
        processQueue(request.urls, request.tabId)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ error: err.toString() }));
        return true; // Obligatorio para respuestas asíncronas en Chrome
    }
});

async function processQueue(urls, activeTabId = null) {
    let extractedProducts = [];
    
    const data = await chrome.storage.local.get(['scrapingRules']);
    const rules = data.scrapingRules || {};

    for (let url of urls) {
        try {
            // Prevenir errores si se intenta extraer en una página del sistema
            if (url.startsWith('chrome://') || url.startsWith('edge://')) {
                return { error: "No puedes extraer datos de páginas de sistema del navegador." };
            }

            const domain = new URL(url).hostname.replace('www.', '');
            const rule = rules[domain];
            
            // ERROR MÁS COMÚN: No hay regla guardada
            if (!rule) {
                return { error: `No has configurado reglas para el dominio: ${domain}. Haz clic derecho en el icono de la extensión > Opciones.` };
            }

            let targetTabId = activeTabId;
            let closeAfter = false;

            if (!targetTabId || urls.length > 1) {
                const newTab = await chrome.tabs.create({ url: url, active: false });
                targetTabId = newTab.id;
                closeAfter = true;
                
                await new Promise(resolve => {
                    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                        if (tabId === targetTabId && info.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(listener);
                            setTimeout(resolve, 1500); 
                        }
                    });
                });
            }

            await chrome.scripting.executeScript({ target: { tabId: targetTabId }, files: ['content.js'] });

            const product = await new Promise((resolve) => {
                chrome.tabs.sendMessage(targetTabId, { action: "extract_data", rule: rule }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({ error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response);
                    }
                });
            });

            if (product && !product.error) {
                extractedProducts.push(product);
            }

            if (closeAfter) chrome.tabs.remove(targetTabId);

        } catch (e) {
            console.error("Error procesando " + url, e);
        }
    }

    if (extractedProducts.length > 0) {
        chrome.storage.local.set({ productQueue: extractedProducts }, () => {
            chrome.tabs.create({ url: "preview.html" });
        });
        return { success: true };
    } else {
        return { error: "No se pudo extraer el producto. Revisa que los selectores CSS sean correctos en las Opciones." };
    }
}