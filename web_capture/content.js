chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extract_data") {
        const rule = request.rule;
        try {
            const titulo = document.querySelector(rule.title)?.innerText.trim() || 'Sin Título';
            const precio = document.querySelector(rule.price)?.innerText.trim() || '';
            const sku = rule.sku ? (document.querySelector(rule.sku)?.innerText.trim() || '') : '';
            
            // --- NUEVA LÓGICA DE DESCRIPCIÓN MÚLTIPLE ---
            let descripcionHtml = "";
            if (rule.desc) {
                // Separamos por comas por si has puesto varios selectores
                const selectores = rule.desc.split(',');
                
                selectores.forEach(selector => {
                    if (!selector.trim()) return;
                    // Buscamos TODOS los elementos que coincidan con cada selector
                    const nodos = document.querySelectorAll(selector.trim());
                    nodos.forEach(nodo => {
                        // Sumamos el HTML de cada bloque encontrado
                        descripcionHtml += nodo.outerHTML + "\n<br><br>\n";
                    });
                });
            }

            // Extracción de imágenes
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
                descripcionManual: descripcionHtml, 
                categoria: "Auto dalys" 
            });
        } catch (e) {
            sendResponse({ error: e.toString() });
        }
    }
    return true;
});