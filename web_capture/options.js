document.addEventListener('DOMContentLoaded', loadRules);

const saveBtn = document.getElementById('saveRule');
const cancelBtn = document.getElementById('cancelEdit');

// Guardar o Actualizar Regla
saveBtn.addEventListener('click', () => {
    const domain = document.getElementById('rDomain').value.replace('www.', '').toLowerCase().trim();
    if (!domain) return alert("El dominio es obligatorio");

    const rule = {
        title: document.getElementById('rTitle').value,
        price: document.getElementById('rPrice').value,
        images: document.getElementById('rImages').value,
        sku: document.getElementById('rSku').value,
        desc: document.getElementById('rDesc').value // Nuevo campo
    };

    chrome.storage.local.get(['scrapingRules'], (data) => {
        let rules = data.scrapingRules || {};
        rules[domain] = rule;
        
        chrome.storage.local.set({ scrapingRules: rules }, () => {
            alert('¡Regla guardada con éxito!');
            resetForm();
            loadRules();
        });
    });
});

// Cargar y mostrar las reglas
function loadRules() {
    chrome.storage.local.get(['scrapingRules'], (data) => {
        const container = document.getElementById('rulesList');
        container.innerHTML = '';
        const rules = data.scrapingRules || {};

        if (Object.keys(rules).length === 0) {
            container.innerHTML = '<p style="color: #999;">No hay reglas configuradas aún.</p>';
            return;
        }

        for (const [domain, rule] of Object.entries(rules)) {
            const div = document.createElement('div');
            div.className = 'rule-item';
            div.innerHTML = `
                <div class="rule-info">
                    <strong>${domain}</strong>
                    <p>Título: ${rule.title || '-'} | Precio: ${rule.price || '-'}</p>
                </div>
                <div class="btn-group">
                    <button class="btn-edit" data-domain="${domain}">Editar</button>
                    <button class="btn-delete" data-domain="${domain}">Borrar</button>
                </div>
            `;
            
            // Evento Editar
            div.querySelector('.btn-edit').onclick = () => fillFormForEdit(domain, rule);
            
            // Evento Borrar
            div.querySelector('.btn-delete').onclick = () => deleteRule(domain);

            container.appendChild(div);
        }
    });
}

function fillFormForEdit(domain, rule) {
    document.getElementById('rDomain').value = domain;
    document.getElementById('rDomain').disabled = true; // No dejamos cambiar el dominio al editar
    document.getElementById('rTitle').value = rule.title;
    document.getElementById('rPrice').value = rule.price;
    document.getElementById('rImages').value = rule.images;
    document.getElementById('rSku').value = rule.sku;
    document.getElementById('rDesc').value = rule.desc || "";
    
    document.getElementById('formTitle').innerText = "📝 Editando regla de " + domain;
    saveBtn.innerText = "Actualizar Regla";
    cancelBtn.style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteRule(domain) {
    if (confirm(`¿Seguro que quieres borrar la regla para ${domain}?`)) {
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
    document.getElementById('formTitle').innerText = "Añadir Nueva Regla";
    saveBtn.innerText = "Guardar Regla";
    cancelBtn.style.display = "none";
}

cancelBtn.onclick = resetForm;