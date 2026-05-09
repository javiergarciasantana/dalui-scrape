// ==============================================================
// 1. LÓGICA DE EXTRACCIÓN ORIGINAL
// ==============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log(request.action);
    if (request.action === "extract_data") {
        const rule = request.rule;
        try {
            const titulo = rule.title ? (document.querySelector(rule.title)?.innerText.trim() || 'Sin Título') : 'Sin Título';
            const precio = rule.price ? (document.querySelector(rule.price)?.innerText.trim() || '') : '';
            const sku = rule.sku ? (document.querySelector(rule.sku)?.innerText.trim() || '') : '';

            let descripcionHtml = "";
            if (rule.desc) {
                const selectores = rule.desc.split(',');
                selectores.forEach(selector => {
                    if (!selector.trim()) return;
                    const nodos = document.querySelectorAll(selector.trim());
                    nodos.forEach(nodo => {
                        descripcionHtml += nodo.outerHTML + "\n<br><br>\n";
                    });
                });
            }

            let imagenes = [];
            // ¡AÑADIDO EL IF PARA PREVENIR ERROR SI SALTA LAS IMÁGENES!
            if (rule.images) {
                const imgNodes = document.querySelectorAll(rule.images);
                imgNodes.forEach(img => {
                    let src = img.src || img.getAttribute('data-src');
                    if (src && !imagenes.includes(src)) imagenes.push(src);
                });
            }

            sendResponse({ titulo, precio, sku, imagenes, descripcionManual: descripcionHtml, categoria: "Auto dalys" });
        } catch (e) {
            sendResponse({ error: e.toString() });
        }
    } 
    // --- ESCUCHA DEL NUEVO MODO VISUAL ---
    else if (request.action === "start_visual_mode") {
        startVisualSelector(request.lang);
        sendResponse({ status: "started" });
    }
    return true;
});


// ==============================================================
// 2. LÓGICA DEL INSPECTOR VISUAL (NUEVO)
// ==============================================================

let visualActive = false;
let currentStepIndex = 0;
let draftRule = {};
let uiLang = 'es';

// Los pasos de recolección de datos
const steps = ['title', 'price', 'images', 'sku', 'desc'];

// Diccionario incrustado para el UI flotante
const uiDict = {
    es: { title: "Modo Selección Visual", skip: "Saltar", cancel: "Cancelar", saved: "¡Regla Guardada!", step_title: "Selecciona el TÍTULO", step_price: "Selecciona el PRECIO", step_images: "Selecciona una IMAGEN", step_sku: "Selecciona el SKU", step_desc: "Selecciona la DESCRIPCIÓN" },
    en: { title: "Visual Selection Mode", skip: "Skip", cancel: "Cancel", saved: "Rule Saved!", step_title: "Select the TITLE", step_price: "Select the PRICE", step_images: "Select an IMAGE", step_sku: "Select the SKU", step_desc: "Select the DESCRIPTION" },
    lt: { title: "Vizualus Režimas", skip: "Praleisti", cancel: "Atšaukti", saved: "Taisyklė Išsaugota!", step_title: "Pasirinkite PAVADINIMĄ", step_price: "Pasirinkite KAINĄ", step_images: "Pasirinkite NUOTRAUKĄ", step_sku: "Pasirinkite SKU", step_desc: "Pasirinkite APRAŠYMĄ" }
};

function t(key) { return uiDict[uiLang][key] || key; }

function startVisualSelector(lang) {
    if (visualActive) return;
    visualActive = true;
    currentStepIndex = 0;
    draftRule = {};
    uiLang = lang || 'es';

    injectStyles();
    injectToolbar();
    updateToolbarText();

    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleElementClick, true);
}

function stopVisualSelector() {
    visualActive = false;
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('click', handleElementClick, true);
    
    // Limpiar highlights residuales
    document.querySelectorAll('.wc-highlight').forEach(el => el.classList.remove('wc-highlight'));
    
    const toolbar = document.getElementById('wc-visual-toolbar');
    if (toolbar) toolbar.remove();
}

// --- GENERADOR DEL SELECTOR CSS ---
function getOptimalSelector(el) {
    if (!el || el.tagName === 'BODY' || el.tagName === 'HTML') return 'body';
    
    let tag = el.tagName.toLowerCase();
    
    if (el.id) return `${tag}#${el.id.trim()}`;
    
    if (el.className && typeof el.className === 'string') {
        let classes = el.className.split(/\s+/).filter(c => c && !c.startsWith('wc-'));
        if (classes.length > 0) {
            let selector = `${tag}.${classes.join('.')}`;
            try {
                // Probamos si el navegador acepta este selector sin dar error
                document.querySelector(selector); 
                return selector;
            } catch (error) {
                // Si la web usa clases con caracteres especiales (ej. w-1/2, sm:flex), 
                // el selector fallará. En ese caso, devolvemos solo la etiqueta.
                return tag; 
            }
        }
    }
    return tag; 
}

// --- EVENTOS DEL RATÓN ---
function handleMouseOver(e) {
    if (e.target.closest('#wc-visual-toolbar')) return; // Ignorar barra de herramientas
    e.target.classList.add('wc-highlight');
}

function handleMouseOut(e) {
    e.target.classList.remove('wc-highlight');
}

function handleElementClick(e) {
    if (e.target.closest('#wc-visual-toolbar')) return; // Permitir clics en los botones de la barra
    
    e.preventDefault(); // Evitar navegar a otra página
    e.stopPropagation();

    e.target.classList.remove('wc-highlight');
    
    const currentKey = steps[currentStepIndex];
    let selector = getOptimalSelector(e.target);
    
    // Si estamos en el paso de imágenes y ha clicado una foto, nos aseguramos de atrapar todas las del mismo tipo
    if(currentKey === 'images' && e.target.tagName === 'IMG') {
        // En imágenes, suele ser mejor usar la clase y buscar hijos img: `.galeria img`
        // Aquí lo mantenemos simple usando el selector generado
    }

    draftRule[currentKey] = selector;
    nextStep();
}

// --- FLUJO DE LA INTERFAZ ---
function nextStep() {
    currentStepIndex++;
    if (currentStepIndex >= steps.length) {
        finishAndSave();
    } else {
        updateToolbarText();
    }
}

function finishAndSave() {
    const domain = window.location.hostname.replace('www.', '').toLowerCase().trim();
    
    // Guardamos la regla en el Storage de Chrome
    chrome.storage.local.get(['scrapingRules'], (data) => {
        let rules = data.scrapingRules || {};
        rules[domain] = draftRule;
        
        chrome.storage.local.set({ scrapingRules: rules }, () => {
            alert(t('saved'));
            stopVisualSelector();
        });
    });
}

// --- UI FLOTANTE ---
function injectStyles() {
    if (document.getElementById('wc-visual-styles')) return;
    const style = document.createElement('style');
    style.id = 'wc-visual-styles';
    style.innerHTML = `
        .wc-highlight {
            outline: 3px solid #ffed2b !important;
            background-color: rgba(255, 237, 43, 0.3) !important;
            cursor: crosshair !important;
            transition: all 0.1s;
        }
        #wc-visual-toolbar {
            position: fixed; top: 20px; right: 20px; z-index: 9999999;
            background: #101820; color: white; padding: 20px; border-radius: 12px;
            font-family: sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 300px;
        }
        #wc-visual-toolbar h4 { margin: 0 0 15px 0; color: #ffed2b; font-size: 16px; border-bottom: 1px solid #333; padding-bottom: 10px; }
        #wc-visual-step-text { font-size: 14px; font-weight: bold; margin-bottom: 20px; line-height: 1.4; }
        .wc-btn-group { display: flex; gap: 10px; }
        .wc-btn { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;}
        .wc-btn-skip { background: #40464D; color: white; }
        .wc-btn-skip:hover { background: #5a626b; }
        .wc-btn-cancel { background: #D50032; color: white; }
        .wc-btn-cancel:hover { background: #ff1a53; }
    `;
    document.head.appendChild(style);
}

function injectToolbar() {
    if (document.getElementById('wc-visual-toolbar')) return;

    const div = document.createElement('div');
    div.id = 'wc-visual-toolbar';
    div.innerHTML = `
        <h4>⚙️ ${t('title')}</h4>
        <div id="wc-visual-step-text"></div>
        <div class="wc-btn-group">
            <button id="wc-btn-skip" class="wc-btn wc-btn-skip">${t('skip')}</button>
            <button id="wc-btn-cancel" class="wc-btn wc-btn-cancel">${t('cancel')}</button>
        </div>
    `;
    document.body.appendChild(div);

    document.getElementById('wc-btn-skip').onclick = nextStep;
    document.getElementById('wc-btn-cancel').onclick = stopVisualSelector;
}

function updateToolbarText() {
    const currentKey = steps[currentStepIndex];
    document.getElementById('wc-visual-step-text').innerText = `Paso ${currentStepIndex + 1} de 5:\n👉 ${t('step_' + currentKey)}`;
}