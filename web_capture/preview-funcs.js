// ==========================================
// preview-functions.js
// Funciones puras y constructores de UI
// ==========================================

export function sanitizeHTML(rawHtml) {
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

export function cleanImageUrlForWooCommerce(url) {
    try {
        let urlObj = new URL(url);
        if (urlObj.hostname.includes('ksd-images.lt') && urlObj.searchParams.has('path')) {
            let realPath = urlObj.searchParams.get('path');
            return `https://${urlObj.hostname}/display/${realPath}`;
        }
        urlObj.search = ""; 
        return urlObj.toString();
    } catch (e) {
        return url; 
    }
}

export function getCurrentImages() {
    return Array.from(document.querySelectorAll('.gallery-item')).map(item => item.dataset.src);
}

export function updateGalleryLabels() {
    document.querySelectorAll('.gallery-item').forEach((item, index) => {
        // "t" proviene del diccionario global de i18n.js
        item.querySelector('.badge').innerText = index === 0 ? t('badgeMain') : `${index + 1}º`;
    });
}

export function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.gallery-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Recibe un callback "onGalleryChange" para avisar a preview.js que debe actualizar el iframe
export function renderGallery(imageUrls, onGalleryChange) {
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
        
        item.querySelector('.delete-btn').addEventListener('click', () => { 
            item.remove(); 
            updateGalleryLabels(); 
            if(onGalleryChange) onGalleryChange(); 
        });
        
        item.addEventListener('dragstart', () => item.classList.add('dragging'));
        item.addEventListener('dragend', () => { 
            item.classList.remove('dragging'); 
            updateGalleryLabels(); 
            if(onGalleryChange) onGalleryChange(); 
        });
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

export function updateLivePreview(rawTemplateHtml) {
    if (!rawTemplateHtml) return;
    const title = document.getElementById('editTitle').value;
    const price = document.getElementById('editPrice').value;
    const sku = document.getElementById('editSku').value;
    const desc = document.getElementById('editDesc').innerHTML;
    const images = getCurrentImages(); 
    
    const categorySelect = document.getElementById('editCategory');
    const category = categorySelect.options[categorySelect.selectedIndex]?.text || "Categoría";

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
    html = html.replace(/<span class="posted_in">Kategorija:.*?<a[^>]*>.*?<\/a><\/span>/g, `<span class="posted_in">Kategorija: <a href="#" rel="tag">${category}</a></span>`);
    html = html.replace(/(<div class="woocommerce-Tabs-panel[^>]*id="tab-description"[^>]*>).*?(<\/div>\s*<\/div>\s*<\/div>)/gs, `$1\n${desc}\n$2`);

    if (images.length > 0) {
        let galleryHtml = "";
        images.forEach((imgUrl) => { galleryHtml += `<div class="gallery-slide"><img src="${imgUrl}" /></div>`; });
        html = html.replace(/<div class="woocommerce-product-gallery__wrapper[^>]*>[\s\S]*?(?=<\/div>\s*<div class="image-tools absolute bottom left)/, `<div class="gnz-custom-gallery">\n${galleryHtml}`);
    }

    document.getElementById('livePreview').srcdoc = html;
}

export async function fetchCategories() {
    const select = document.getElementById('editCategory');
    chrome.storage.local.get(['wcCredentials'], async (data) => {
        if (!data.wcCredentials || !data.wcCredentials.url) {
            select.innerHTML = '<option value="">Faltan credenciales</option>';
            return;
        }
        try {
            const { url, key, secret } = data.wcCredentials;
            const auth = btoa(`${key}:${secret}`);
            const response = await fetch(`${url}/wp-json/wc/v3/products/categories?per_page=100`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            
            if (response.ok) {
                const categories = await response.json();
                select.innerHTML = `<option value="" data-i18n="optLoading">${t('optLoading')}</option>`;
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.id; 
                    option.text = cat.name; 
                    select.appendChild(option);
                });
            } else {
                select.innerHTML = '<option value="">Error al cargar</option>';
            }
        } catch (error) {
            select.innerHTML = '<option value="">Error de conexión</option>';
        }
    });
}
// Selecciona una categoría...