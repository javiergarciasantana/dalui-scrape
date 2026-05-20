// ==========================================
// preview.js
// Estados, Listeners y Lógica Principal
// ==========================================

import {
    sanitizeHTML,
    cleanImageUrlForWooCommerce,
    getCurrentImages,
    renderGallery,
    updateLivePreview,
    fetchCategories
} from './preview-funcs.js';

let rawTemplateHtml = "";
let productQueue = [];
let currentIndex = 0;

document.addEventListener("DOMContentLoaded", async () => {
    await initI18n(); // initI18n proviene de i18n.js (global)
    document.getElementById('btnLang').addEventListener('click', toggleLang);
    
    // Carga de categorías inicial
    fetchCategories();

    // --- CONFIGURACIÓN DEL RICH TEXT EDITOR ---
    const editor = document.getElementById('editDesc');
    const rteButtons = document.querySelectorAll('.rte-btn');
    
    rteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.getAttribute('data-cmd');
            const val = btn.getAttribute('data-val') || null;
            document.execCommand(cmd, false, val);
            editor.focus();
            updateLivePreview(rawTemplateHtml);
            checkEditorState(); 
        });
    });

    function checkEditorState() {
        rteButtons.forEach(btn => {
            const cmd = btn.getAttribute('data-cmd');
            if (cmd === 'undo' || cmd === 'redo' || cmd === 'formatBlock') return;
            try {
                if (document.queryCommandState(cmd)) btn.classList.add('active');
                else btn.classList.remove('active');
            } catch (e) {}
        });
    }

    editor.addEventListener('keyup', () => { updateLivePreview(rawTemplateHtml); checkEditorState(); });
    editor.addEventListener('mouseup', checkEditorState);
    editor.addEventListener('input', () => updateLivePreview(rawTemplateHtml));
    
    // --- SOPORTE PARA PEGAR IMÁGENES ---
    document.addEventListener('paste', (e) => {
        // Ignorar si el usuario está escribiendo en el Título, Precio, etc.
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        if (isInput) return; 

        // Si está en el editor de texto (RTE), dejamos que el editor se encargue
        if (e.target.isContentEditable) return; 

        let added = false;
        const currentImages = getCurrentImages();

        // 1. ¿Es una imagen copiada directamente desde otra página web? (Extraemos el HTML/URL)
        const html = e.clipboardData.getData('text/html');
        if (html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const img = doc.querySelector('img');
            if (img && img.src) {
                if (!currentImages.includes(img.src)) currentImages.push(img.src);
                added = true;
            }
        }

        // 2. ¿Es un texto que parece una URL de imagen? (ej. https://.../foto.jpg)
        const text = e.clipboardData.getData('text/plain');
        if (!added && text && text.match(/^https?:\/\/.*\.(png|jpg|jpeg|webp|gif)/i)) {
            const cleanUrl = text.trim();
            if (!currentImages.includes(cleanUrl)) currentImages.push(cleanUrl);
            added = true;
        }

        // 3. ¿Es una captura de pantalla pura o un archivo de imagen copiado? (Blob/Base64)
        if (!added && e.clipboardData.items) {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image') === 0) {
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64Url = event.target.result;
                        currentImages.push(base64Url);
                        renderGallery(currentImages, () => updateLivePreview(rawTemplateHtml));
                        updateLivePreview(rawTemplateHtml);
                    };
                    reader.readAsDataURL(blob);
                    added = true;
                    break; // Solo tomamos la primera imagen del portapapeles
                }
            }
        }

        // Si detectamos y procesamos una imagen, recargamos la interfaz y prevenimos acciones nativas
        if (added) {
            e.preventDefault();
            renderGallery(currentImages, () => updateLivePreview(rawTemplateHtml));
            updateLivePreview(rawTemplateHtml);
        }
    });
    
    // --- CARGA DEL TEMPLATE Y PRODUCTOS ---
    try {
        const response = await fetch(chrome.runtime.getURL("article_page_gnz.html"));
        rawTemplateHtml = await response.text();
    } catch (e) { console.error("Error cargando HTML:", e); }
    
    chrome.storage.local.get(['productQueue'], (result) => {
        if (result.productQueue && result.productQueue.length > 0) {
            productQueue = result.productQueue;
            loadSlide(currentIndex);
            attachListeners();
        }
    });
});

// --- NAVEGACIÓN ENTRE PRODUCTOS (SLIDES) ---
document.getElementById('btnPrev').onclick = () => { if (currentIndex > 0) { currentIndex--; loadSlide(currentIndex); }};
document.getElementById('btnNext').onclick = () => { if (currentIndex < productQueue.length - 1) { currentIndex++; loadSlide(currentIndex); }};

function loadSlide(index) {
    const prod = productQueue[index];
    document.getElementById('slideCounter').innerText = `${t('wordProd')} ${index + 1} ${t('wordOf')} ${productQueue.length}`;
    
    document.getElementById('editTitle').value = prod.titulo || "";
    document.getElementById('editPrice').value = (prod.precio || "").replace(" €", "").replace(",", ".").trim();
    document.getElementById('editSku').value = prod.sku || "";
    document.getElementById('editQty').value = prod.qty || 1; 
    
    if (prod.descripcionManual) {
        document.getElementById('editDesc').innerHTML = sanitizeHTML(prod.descripcionManual);
    } else {
        let specsHtml = "<table>\n  <tbody>\n";
        for (const [clave, valor] of Object.entries(prod.especificaciones || {})) {
            specsHtml += `    <tr>\n      <th>${clave}</th>\n      <td>${valor}</td>\n    </tr>\n`;
        }
        specsHtml += "  </tbody>\n</table>";
        document.getElementById('editDesc').innerHTML = specsHtml;
    }
    
    // Renderizamos la galería y le pasamos el callback para que actualice la preview si algo cambia
    renderGallery(prod.imagenes || [], () => updateLivePreview(rawTemplateHtml));
    updateLivePreview(rawTemplateHtml);
}

function attachListeners() {
    ['editTitle', 'editPrice', 'editSku', 'editQty', 'editCategory'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => updateLivePreview(rawTemplateHtml));
    });
}

// --- PUBLICAR EN WORDPRESS ---
document.getElementById('btnPublish').addEventListener('click', () => {
    const btn = document.getElementById('btnPublish');
    const originalText = btn.innerText;

    chrome.storage.local.get(['wcCredentials'], async (data) => {
        if (!data.wcCredentials || !data.wcCredentials.url || !data.wcCredentials.key || !data.wcCredentials.secret) {
            alert("⚠️ No has configurado la API de WooCommerce. Ve a Opciones (⚙️).");
            return;
        }

        const WC_URL = data.wcCredentials.url;
        const WC_KEY = data.wcCredentials.key;
        const WC_SECRET = data.wcCredentials.secret;
        
        const finalData = {
            title: document.getElementById('editTitle').value,
            price: document.getElementById('editPrice').value,
            sku: document.getElementById('editSku').value,
            qty: document.getElementById('editQty').value,
            category: document.getElementById('editCategory').value,
            imgs: getCurrentImages(), 
            desc: document.getElementById('editDesc').innerHTML 
        };

        btn.innerText = "⏳ Enviando...";
        btn.disabled = true;

        try {
            const woocommercePayload = {
                name: finalData.title,
                type: "simple",
                regular_price: finalData.price.toString(),
                sku: finalData.sku,
                manage_stock: true,
                stock_quantity: parseInt(finalData.qty) || 1,
                description: finalData.desc,
                status: "draft", 
                categories: finalData.category ? [{ id: parseInt(finalData.category) }] : [],
                images: finalData.imgs.map((url, index) => {
                    let extension = ".png"; 
                    if (url.toLowerCase().includes(".jpg") || url.toLowerCase().includes(".jpeg")) extension = ".jpg";
                    if (url.toLowerCase().includes(".webp")) extension = ".webp";
                    
                    return { 
                        src: cleanImageUrlForWooCommerce(url),
                        name: "foto-" + (index + 1) + extension 
                    };
                })
            };

            const auth = btoa(`${WC_KEY}:${WC_SECRET}`);

            const response = await fetch(`${WC_URL}/wp-json/wc/v3/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                body: JSON.stringify(woocommercePayload)
            });

            const result = await response.json();

            if (response.ok) {
                alert(`✅ ¡Éxito! Producto creado como BORRADOR (ID: ${result.id})`);
            } else {
                alert(`❌ Error de WooCommerce: ${result.message}`);
                console.error(result);
            }

        } catch (error) {
            alert("⚠️ Problema de conexión. Verifica la URL de WP en las opciones.");
            console.error(error);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
});