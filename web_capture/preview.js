let rawTemplateHtml = "";
let productQueue = [];
let currentIndex = 0;

// 1. Al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
    // Cargar la plantilla HTML
    try {
        const response = await fetch(chrome.runtime.getURL("article_page_gnz.html"));
        rawTemplateHtml = await response.text();
    } catch (e) {
        console.error("Error cargando la plantilla HTML:", e);
    }
    
    // Obtener los datos guardados en la memoria de la extensión
    chrome.storage.local.get(['productQueue'], (result) => {
        if (result.productQueue && result.productQueue.length > 0) {
            productQueue = result.productQueue;
            loadSlide(currentIndex);
            attachListeners();
        }
    });
});

document.getElementById('btnPrev').onclick = () => {
    if (currentIndex > 0) { currentIndex--; loadSlide(currentIndex); }
};

document.getElementById('btnNext').onclick = () => {
    if (currentIndex < productQueue.length - 1) { currentIndex++; loadSlide(currentIndex); }
};

function loadSlide(index) {
    const prod = productQueue[index];
    document.getElementById('slideCounter').innerText = `Producto ${index + 1} de ${productQueue.length}`;
    
    document.getElementById('editTitle').value = prod.titulo || "";
    document.getElementById('editPrice').value = (prod.precio || "").replace(" €", "").replace(",", ".").trim();
    document.getElementById('editSku').value = prod.sku || "";
    document.getElementById('editCategory').value = prod.categoria || "Auto dalys";
    
    // Si la regla extrajo una descripción HTML, la usamos. Si no, usamos la tabla genérica.
    if (prod.descripcionManual) {
        document.getElementById('editDesc').value = prod.descripcionManual;
    } else {
        // Fallback: generar tabla de especificaciones si no hay selector de descripción
        let specsHtml = "<ul>\n";
        for (const [clave, valor] of Object.entries(prod.especificaciones || {})) {
            specsHtml += `  <li><strong>${clave}:</strong> ${valor}</li>\n`;
        }
        specsHtml += "</ul>";
        document.getElementById('editDesc').value = specsHtml;
    }
    
    renderGallery(prod.imagenes || []);
    updateLivePreview();
}

// 2. Escuchar cambios en los inputs de texto
function attachListeners() {
    const inputs = ['editTitle', 'editPrice', 'editSku', 'editCategory', 'editDesc'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateLivePreview);
    });
}

// 3. Lógica para la Galería de Imágenes Arrastrables (Drag and Drop)
function renderGallery(imageUrls) {
    const gallery = document.getElementById('imageGallery');
    gallery.innerHTML = ""; // Limpiar galería

    imageUrls.forEach((url, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.draggable = true; // Hacemos que sea arrastrable
        item.dataset.src = url; // Guardamos la URL oculta en el elemento

        // Etiqueta para saber cuál es la principal
        const labelText = index === 0 ? "1º (Principal)" : `${index + 1}º`;

        item.innerHTML = `
            <img src="${url}">
            <button class="delete-btn" title="Eliminar imagen">X</button>
            <div class="badge">${labelText}</div>
        `;

        // Evento para borrar la imagen
        item.querySelector('.delete-btn').addEventListener('click', () => {
            item.remove();
            updateGalleryLabels();
            updateLivePreview(); // Actualizar el iframe al borrar
        });

        // Eventos Drag and Drop nativos de HTML5
        item.addEventListener('dragstart', () => item.classList.add('dragging'));
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            updateGalleryLabels();
            updateLivePreview(); // Actualizar el iframe al soltar
        });

        gallery.appendChild(item);
    });

    // Eventos para el contenedor de la galería (para permitir soltar)
    gallery.addEventListener('dragover', e => {
        e.preventDefault(); // Necesario para permitir el "drop"
        const afterElement = getDragAfterElement(gallery, e.clientX);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            gallery.appendChild(draggable);
        } else {
            gallery.insertBefore(draggable, afterElement);
        }
    });
}

// Función auxiliar para saber en qué posición estamos soltando la foto
function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('.gallery-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Actualiza los textos de "1º (Principal)", "2º", etc. tras reordenar
function updateGalleryLabels() {
    const items = document.querySelectorAll('.gallery-item');
    items.forEach((item, index) => {
        const badge = item.querySelector('.badge');
        badge.innerText = index === 0 ? "1º (Principal)" : `${index + 1}º`;
    });
}

// Función para obtener las URLs de las imágenes en su orden actual
function getCurrentImages() {
    const items = document.querySelectorAll('.gallery-item');
    return Array.from(items).map(item => item.dataset.src);
}

// 4. Actualizar el Iframe de Previsualización (como teníamos antes)
function updateLivePreview() {
    if (!rawTemplateHtml) return;

    const title = document.getElementById('editTitle').value;
    const price = document.getElementById('editPrice').value;
    const sku = document.getElementById('editSku').value;
    const category = document.getElementById('editCategory').value;
    const desc = document.getElementById('editDesc').value;
    const images = getCurrentImages(); // Obtenemos el orden visual actual

    let html = rawTemplateHtml;

    html = html.replace('</head>', '<style>#wpadminbar { display: none !important; } html, body { margin-top: 0 !important; }</style>\n</head>');
    html = html.replace(/<div class="badge-container.*?<\/div>\s*<\/div>\s*<\/div>/gs, '');
    html = html.replace(/<h1 class="product-title[^>]*>.*?<\/h1>/gs, `<h1 class="product-title product_title entry-title">${title}</h1>`);
    
    const precioLimpio = price.replace(".", ",");
    const bloquePrecio = `
        <div class="price-wrapper">
            <p class="price product-page-price">
                <span class="woocommerce-Price-amount amount"><bdi>${precioLimpio}&nbsp;<span class="woocommerce-Price-currencySymbol">&euro;</span></bdi></span>
                <small class="woocommerce-price-suffix">su PVM</small>
            </p>
        </div>`;
    html = html.replace(/<div class="price-wrapper">.*?<\/div>/gs, bloquePrecio);
    html = html.replace(/<span class="sku">.*?<\/span>/g, `<span class="sku">${sku}</span>`);
    html = html.replace(/<span class="posted_in">Kategorija:.*?<a[^>]*>.*?<\/a><\/span>/g, `<span class="posted_in">Kategorija: <a href="#" rel="tag">${category}</a></span>`);
    html = html.replace(/(<div class="woocommerce-Tabs-panel[^>]*id="tab-description"[^>]*>).*?(<\/div>\s*<\/div>\s*<\/div>)/gs, `$1\n${desc}\n$2`);

    // Inyectar Galería respetando el nuevo orden
    if (images.length > 0) {
        let galleryHtml = "";
        images.forEach((imgUrl, idx) => {
            let claseExtra = idx === 0 ? " first" : "";
            galleryHtml += `<div data-thumb="${imgUrl}" class="woocommerce-product-gallery__image slide${claseExtra}"><a href="${imgUrl}"><img src="${imgUrl}" class="wp-post-image" style="width:100%; height:auto;" /></a></div>`;
        });
        html = html.replace(/(<div class="woocommerce-product-gallery__wrapper[^>]*>).*?(<\/div>\s*<div class="image-tools absolute bottom left)/gs, `$1\n${galleryHtml}\n$2`);
    }

    document.getElementById('livePreview').srcdoc = html;
}

// Lógica final para Publicar
document.getElementById('btnPublish').addEventListener('click', () => {
    const finalData = {
        titulo: document.getElementById('editTitle').value,
        precio: document.getElementById('editPrice').value,
        sku: document.getElementById('editSku').value,
        categoria: document.getElementById('editCategory').value,
        imagenes: getCurrentImages(), // Se envían en el orden que las dejaste
        descripcion: document.getElementById('editDesc').value
    };
    console.log("Datos listos para WooCommerce:", finalData);
    alert("¡Producto configurado! Revisa la consola (F12) para ver los datos JSON listos para enviar a WordPress.");
});