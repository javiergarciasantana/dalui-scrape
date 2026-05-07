chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract_data") {
        const rule = request.rule;
        try {
            const titulo = document.querySelector(rule.title)?.innerText.trim() || 'Sin Título';
            const precio = document.querySelector(rule.price)?.innerText.trim() || '';
            const sku = rule.sku ? (document.querySelector(rule.sku)?.innerText.trim() || '') : '';
            
            // Extracción de descripción/especificaciones
            let descripcionHtml = "";
            if (rule.desc) {
                const descNode = document.querySelector(rule.desc);
                descripcionHtml = descNode ? descNode.outerHTML : "";
            }

            let imagenes = [];
            const imgNodes = document.querySelectorAll(rule.images);
            imgNodes.forEach(img => {
                let src = img.src || img.getAttribute('data-src');
                if (src && !imagenes.includes(src)) imagenes.push(src);
            });

            sendResponse({ 
                titulo, 
                precio, 
                sku, 
                imagenes, 
                descripcionManual: descripcionHtml, // Enviamos el HTML extraído
                categoria: "Auto dalys" 
            });
        } catch (e) {
            sendResponse({ error: e.toString() });
        }
    }
    return true;
});