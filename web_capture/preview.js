let rawTemplateHtml = "";
let productQueue = [];
let currentIndex = 0;

// --- LIMPIADOR DE REACT (Lo mantenemos para evitar basura invisible en el editor) ---
function sanitizeHTML(rawHtml) {
    if (!rawHtml) return "";
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const tagsToRemove = ['svg', 'button', 'path', 'g', 'mask', 'style', 'script', 'noscript'];
    tagsToRemove.forEach(tag => { doc.querySelectorAll(tag).forEach(el => el.remove()); });
    doc.querySelectorAll('*').forEach(el => {
        const attributes = Array.from(el.attributes);
        attributes.forEach(attr => {
            if (attr.name !== 'href' && attr.name !== 'src') el.removeAttribute(attr.name);
        });
    });
    doc.querySelectorAll('div:empty, span:empty').forEach(el => el.remove());
    return doc.body.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
    await initI18n(); // Iniciar idiomas
    document.getElementById('btnLang').addEventListener('click', toggleLang);
    
    // --- LÓGICA DEL RICH TEXT EDITOR ---
    const editor = document.getElementById('editDesc');
    const rteButtons = document.querySelectorAll('.rte-btn');
    
    rteButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.getAttribute('data-cmd');
            const val = btn.getAttribute('data-val') || null;
            document.execCommand(cmd, false, val);
            editor.focus();
            updateLivePreview();
            checkEditorState(); // Actualizar color de botones
        });
    });

    // Detectar cuando el cursor se mueve para pintar los botones (Negrita, Italic...) de oscuro
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

    editor.addEventListener('keyup', () => { updateLivePreview(); checkEditorState(); });
    editor.addEventListener('mouseup', checkEditorState);
    editor.addEventListener('input', updateLivePreview);
    
    // Carga inicial
    try {
        const response = await fetch(chrome.runtime.getURL("article_page_gnz.html"));
        rawTemplateHtml = await response.text();
    } catch (e) { console.error(e); }
    
    chrome.storage.local.get(['productQueue'], (result) => {
        if (result.productQueue && result.productQueue.length > 0) {
            productQueue = result.productQueue;
            loadSlide(currentIndex);
            attachListeners();
        }
    });
});

document.getElementById('btnPrev').onclick = () => { if (currentIndex > 0) { currentIndex--; loadSlide(currentIndex); }};
document.getElementById('btnNext').onclick = () => { if (currentIndex < productQueue.length - 1) { currentIndex++; loadSlide(currentIndex); }};

function loadSlide(index) {
    const prod = productQueue[index];
    document.getElementById('slideCounter').innerText = `${t('wordProd')} ${index + 1} ${t('wordOf')} ${productQueue.length}`;
    
    document.getElementById('editTitle').value = prod.titulo || "";
    document.getElementById('editPrice').value = (prod.precio || "").replace(" €", "").replace(",", ".").trim();
    document.getElementById('editSku').value = prod.sku || "";
    document.getElementById('editCategory').value = prod.categoria || "Auto dalys";
    // Si tienes el QTY guardado, úsalo. Si no, por defecto 1
    document.getElementById('editQty').value = prod.qty || 1; 
    
    // Inyectamos el HTML directamente en el editor visual
    if (prod.descripcionManual) {
        document.getElementById('editDesc').innerHTML = sanitizeHTML(prod.descripcionManual);
    } else {
        // Fallback si no hay descripción
        let specsHtml = "<table>\n  <tbody>\n";
        for (const [clave, valor] of Object.entries(prod.especificaciones || {})) {
            specsHtml += `    <tr>\n      <th>${clave}</th>\n      <td>${valor}</td>\n    </tr>\n`;
        }
        specsHtml += "  </tbody>\n</table>";
        document.getElementById('editDesc').innerHTML = specsHtml;
    }
    
    renderGallery(prod.imagenes || []);
    updateLivePreview();
}

function attachListeners() {
    ['editTitle', 'editPrice', 'editSku', 'editQty', 'editCategory'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateLivePreview);
    });
}

function renderGallery(imageUrls) {
    const gallery = document.getElementById('imageGallery');
    gallery.innerHTML = ""; 
    imageUrls.forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item'; item.draggable = true; item.dataset.src = url; 
        const labelText = index === 0 ? t('badgeMain') : `${index + 1}º`;
        item.innerHTML = `
            <img src="${url}">
            <button class="delete-btn" title="X">X</button>
            <div class="badge">${labelText}</div>`;
        item.querySelector('.delete-btn').addEventListener('click', () => { item.remove(); updateGalleryLabels(); updateLivePreview(); });
        item.addEventListener('dragstart', () => item.classList.add('dragging'));
        item.addEventListener('dragend', () => { item.classList.remove('dragging'); updateGalleryLabels(); updateLivePreview(); });
        gallery.appendChild(item);
    });
    gallery.addEventListener('dragover', e => {
        e.preventDefault(); 
        const afterElement = getDragAfterElement(gallery, e.clientX);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) gallery.appendChild(draggable);
        else gallery.insertBefore(draggable, afterElement);
    });
}

function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.gallery-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateGalleryLabels() {
    document.querySelectorAll('.gallery-item').forEach((item, index) => {
        item.querySelector('.badge').innerText = index === 0 ? t('badgeMain') : `${index + 1}º`;
    });
}

function getCurrentImages() {
    return Array.from(document.querySelectorAll('.gallery-item')).map(item => item.dataset.src);
}

// 4. Actualizar el Iframe
function updateLivePreview() {
    if (!rawTemplateHtml) return;
    const title = document.getElementById('editTitle').value;
    const price = document.getElementById('editPrice').value;
    const sku = document.getElementById('editSku').value;
    const category = document.getElementById('editCategory').value;
    const qty = document.getElementById('editQty').value;
    const desc = document.getElementById('editDesc').innerHTML;
    const images = getCurrentImages(); 

    let html = rawTemplateHtml;

    const magicCSS = `
    <style>
        #wpadminbar { display: none !important; } html, body { margin-top: 0 !important; }
        .gnz-custom-gallery { display: flex !important; flex-wrap: nowrap !important; overflow-x: auto !important; scroll-snap-type: x mandatory !important; -webkit-overflow-scrolling: touch !important; gap: 15px !important; padding-bottom: 15px !important; margin-bottom: 15px !important; align-items: center; }
        .gnz-custom-gallery .gallery-slide { flex: 0 0 100% !important; min-width: 100% !important; scroll-snap-align: center !important; border-radius: 8px !important; overflow: hidden !important; box-shadow: 0 4px 10px rgba(0,0,0,0.1) !important; background: #fff; }
        .gnz-custom-gallery img { width: 100% !important; height: auto !important; display: block !important; object-fit: contain !important; margin: 0 auto !important; }
        .gnz-custom-gallery::-webkit-scrollbar { height: 10px; }
        .gnz-custom-gallery::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 8px; }
        .gnz-custom-gallery::-webkit-scrollbar-thumb { background: #ffed2b; border-radius: 8px; border: 2px solid #f1f1f1; }
    </style>
    </head>`;

    html = html.replace('</head>', magicCSS);
    html = html.replace(/<div class="badge-container.*?<\/div>\s*<\/div>\s*<\/div>/gs, '');
    html = html.replace(/<h1 class="product-title[^>]*>.*?<\/h1>/gs, `<h1 class="product-title product_title entry-title">${title}</h1>`);
    
    const precioLimpio = price.replace(".", ",");
    const bloquePrecio = `<div class="price-wrapper"><p class="price product-page-price"><span class="woocommerce-Price-amount amount"><bdi>${precioLimpio}&nbsp;<span class="woocommerce-Price-currencySymbol">&euro;</span></bdi></span><small class="woocommerce-price-suffix">su PVM</small></p></div>`;
    html = html.replace(/<div class="price-wrapper">.*?<\/div>/gs, bloquePrecio);
    html = html.replace(/<span class="sku">.*?<\/span>/g, `<span class="sku">${sku}</span>`);
    html = html.replace(/<p class="stock in-stock">.*?<\/p>/g, `<p class="stock in-stock">Liko ${qty}</p>`);
    html = html.replace(/<span class="posted_in">Kategorija:.*?<a[^>]*>.*?<\/a><\/span>/g, `<span class="posted_in">Kategorija: <a href="#" rel="tag">${category}</a></span>`);
    html = html.replace(/(<div class="woocommerce-Tabs-panel[^>]*id="tab-description"[^>]*>).*?(<\/div>\s*<\/div>\s*<\/div>)/gs, `$1\n${desc}\n$2`);

    if (images.length > 0) {
        let galleryHtml = "";
        images.forEach((imgUrl) => { galleryHtml += `<div class="gallery-slide"><img src="${imgUrl}" /></div>`; });
        html = html.replace(/<div class="woocommerce-product-gallery__wrapper[^>]*>[\s\S]*?(?=<\/div>\s*<div class="image-tools absolute bottom left)/, `<div class="gnz-custom-gallery">\n${galleryHtml}`);
    }

    document.getElementById('livePreview').srcdoc = html;
}

document.getElementById('btnPublish').addEventListener('click', () => {
    // Aquí es donde mandaremos finalmente los datos a la API
    console.log({
        title: document.getElementById('editTitle').value,
        price: document.getElementById('editPrice').value,
        sku: document.getElementById('editSku').value,
        qty: document.getElementById('editQty').value, // Tu nuevo campo Qty
        category: document.getElementById('editCategory').value,
        imgs: getCurrentImages(), 
        desc: document.getElementById('editDesc').innerHTML // Obtenemos el HTML formateado del editor
    });
    alert(t('msgReady') || "¡Producto configurado! Revisa la consola.");
});