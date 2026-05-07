// Esperar a que cargue el DOM y los idiomas antes de mostrar las reglas
document.addEventListener('DOMContentLoaded', async () => {
    await initI18n(); // ¡Esta es la línea mágica que inyecta el texto en el HTML!
    
    // Escuchar clics en la bandera para cambiar de idioma
    const btnLang = document.getElementById('btnLang');
    if (btnLang) {
        btnLang.addEventListener('click', toggleLang);
    }
    
    loadRules();
});

const saveBtn = document.getElementById('saveRule');
const cancelBtn = document.getElementById('cancelEdit');

// Guardar o Actualizar Regla
saveBtn.addEventListener('click', () => {
    const domain = document.getElementById('rDomain').value.replace('www.', '').toLowerCase().trim();
    if (!domain) return alert(t('optDom')); // Usar traducción para la alerta si quieres

    const rule = {
        title: document.getElementById('rTitle').value,
        price: document.getElementById('rPrice').value,
        images: document.getElementById('rImages').value,
        sku: document.getElementById('rSku').value,
        desc: document.getElementById('rDesc').value 
    };

    chrome.storage.local.get(['scrapingRules'], (data) => {
        let rules = data.scrapingRules || {};
        rules[domain] = rule;
        
        chrome.storage.local.set({ scrapingRules: rules }, () => {
            alert(t('msgSaved'));
            resetForm();
            loadRules();
        });
    });
});

// Cargar y mostrar las reglas de la memoria
function loadRules() {
    chrome.storage.local.get(['scrapingRules'], (data) => {
        const container = document.getElementById('rulesList');
        container.innerHTML = '';
        const rules = data.scrapingRules || {};

        if (Object.keys(rules).length === 0) {
            container.innerHTML = `<p style="color: #999;">${t('optNoRules')}</p>`;
            return;
        }

        for (const [domain, rule] of Object.entries(rules)) {
            const div = document.createElement('div');
            div.className = 'rule-item';
            div.innerHTML = `
                <div class="rule-info">
                    <strong>${domain}</strong>
                    <p>${t('optTitleSel')}: ${rule.title || '-'} | ${t('optPriceSel')}: ${rule.price || '-'}</p>
                </div>
                <div class="btn-group">
                    <button class="btn-edit" data-domain="${domain}">${t('optBtnEdit')}</button>
                    <button class="btn-delete" data-domain="${domain}">${t('optBtnDel')}</button>
                </div>
            `;
            
            div.querySelector('.btn-edit').onclick = () => fillFormForEdit(domain, rule);
            div.querySelector('.btn-delete').onclick = () => deleteRule(domain);

            container.appendChild(div);
        }
    });
}

function fillFormForEdit(domain, rule) {
    document.getElementById('rDomain').value = domain;
    document.getElementById('rDomain').disabled = true; 
    document.getElementById('rTitle').value = rule.title;
    document.getElementById('rPrice').value = rule.price;
    document.getElementById('rImages').value = rule.images;
    document.getElementById('rSku').value = rule.sku;
    document.getElementById('rDesc').value = rule.desc || "";
    
    document.getElementById('formTitle').innerText = t('optBtnEdit') + ": " + domain;
    saveBtn.innerText = t('optBtnUpdate');
    
    // Actualizar el atributo data-i18n para que al cambiar de idioma sobre la marcha se mantenga
    saveBtn.setAttribute('data-i18n', 'optBtnUpdate'); 
    
    cancelBtn.style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteRule(domain) {
    if (confirm(`${t('optBtnDel')} ${domain}?`)) {
        chrome.storage.local.get(['scrapingRules'], (data) => {
            let rules = data.scrapingRules || {};
            delete rules[domain];
            chrome.storage.local.set({ scrapingRules: rules }, loadRules);
        });
    }
}

function resetForm() {
    document.getElementById('rDomain').value = "";
    document.getElementById('rDomain').disabled = false;
    document.getElementById('rTitle').value = "";
    document.getElementById('rPrice').value = "";
    document.getElementById('rImages').value = "";
    document.getElementById('rSku').value = "";
    document.getElementById('rDesc').value = "";
    
    document.getElementById('formTitle').innerText = t('optAddRule');
    document.getElementById('formTitle').setAttribute('data-i18n', 'optAddRule');
    
    saveBtn.innerText = t('optBtnSave');
    saveBtn.setAttribute('data-i18n', 'optBtnSave');
    
    cancelBtn.style.display = "none";
}

cancelBtn.onclick = resetForm;