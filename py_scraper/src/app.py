import streamlit as st
import streamlit.components.v1 as components
from py_scraper.src.scraper import buscar_en_daliubaze
import re

st.set_page_config(page_title="Gestor de Repuestos a WP", layout="wide")

# --- INICIALIZACIÓN DE ESTADO ---
if 'vista_actual' not in st.session_state:
    st.session_state.vista_actual = 'buscar'
if 'resultados' not in st.session_state:
    st.session_state.resultados = []
if 'producto_seleccionado' not in st.session_state:
    st.session_state.producto_seleccionado = None

# --- FUNCIONES DE AYUDA ---
def generar_descripcion_html(detalles):
    specs_html = "<ul>\n"
    for clave, valor in detalles.get('especificaciones', {}).items():
        specs_html += f"  <li><strong>{clave}:</strong> {valor}</li>\n"
    specs_html += "</ul>"
    return specs_html

def renderizar_html_real(titulo, precio, descripcion, imagenes, kodas, categoria):
    try:
        with open("../html/article_page_gnz.html", "r", encoding="utf-8") as f:
            html = f.read()
            
        # 1. Limpiar la barra superior de WordPress inyectando CSS
        html = html.replace('</head>', '<style>#wpadminbar { display: none !important; } html, body { margin-top: 0 !important; }</style>\n</head>')
        
        # 2. Eliminar el cartel rojo de descuento (-23%)
        html = re.sub(r'<div class="badge-container.*?</div>\s*</div>\s*</div>', '', html, flags=re.DOTALL)
        
        # 3. Reemplazar Título
        html = re.sub(r'<h1 class="product-title[^>]*>.*?</h1>', f'<h1 class="product-title product_title entry-title">{titulo}</h1>', html, flags=re.DOTALL)
        
        # 4. Reemplazar Precio
        precio_limpio = str(precio).replace(" €", "").replace(".", ",")
        bloque_precio_limpio = f'''
        <div class="price-wrapper">
            <p class="price product-page-price">
                <span class="woocommerce-Price-amount amount"><bdi>{precio_limpio}&nbsp;<span class="woocommerce-Price-currencySymbol">&euro;</span></bdi></span>
                <small class="woocommerce-price-suffix">su PVM</small>
            </p>
        </div>'''
        html = re.sub(r'<div class="price-wrapper">.*?</div>', bloque_precio_limpio, html, flags=re.DOTALL)
        
        # 5. Reemplazar Descripción
        html = re.sub(
            r'(<div class="woocommerce-Tabs-panel[^>]*id="tab-description"[^>]*>).*?(</div>\s*</div>\s*</div>)', 
            rf'\1\n{descripcion}\n\2', 
            html, 
            flags=re.DOTALL
        )
        
        # 6. Reemplazar el "Kodas" (SKU)
        html = re.sub(r'<span class="sku">.*?</span>', f'<span class="sku">{kodas}</span>', html)
        
        # 7. Reemplazar Categoría
        html = re.sub(r'<span class="posted_in">Kategorija:.*?<a[^>]*>.*?</a></span>', f'<span class="posted_in">Kategorija: <a href="#" rel="tag">{categoria}</a></span>', html)
        
        # 8. Reemplazar TODAS las imágenes (Reconstruir la Galería)
        if imagenes:
            gallery_html = ""
            for idx, img_url in enumerate(imagenes):
                clase_extra = " first" if idx == 0 else ""
                # Generamos las celdas de la galería respetando las clases del tema
                gallery_html += f'<div data-thumb="{img_url}" class="woocommerce-product-gallery__image slide{clase_extra}"><a href="{img_url}"><img src="{img_url}" class="wp-post-image" style="width:100%; height:auto;" /></a></div>'
            
            # Reemplazamos todo lo que haya dentro de wrapper del slider
            html = re.sub(
                r'(<div class="woocommerce-product-gallery__wrapper[^>]*>).*?(</div>\s*<div class="image-tools absolute bottom left)',
                rf'\1\n{gallery_html}\n\2',
                html,
                flags=re.DOTALL
            )
            
        return html
    except Exception as e:
        return f"<h1>Error al cargar article_page_gnz.html: {e}</h1>"


# ---- VISTA 1: BÚSQUEDA Y RESULTADOS ----
if st.session_state.vista_actual == 'buscar':
    st.title("📦 Importador de Daliubaze a WordPress")
    st.write("Busca artículos, selecciona uno, edítalo y previsualiza cómo quedará en tu tienda.")

    col1, col2 = st.columns([3, 1])
    with col1:
        busqueda = st.text_input("Término de búsqueda (OEM, nombre...):", value="172128")
    with col2:
        num_items = st.slider("Artículos a extraer", min_value=1, max_value=10, value=5)

    if st.button("Buscar y Extraer (Deep Scraping)", type="primary"):
        with st.spinner("⏳ Analizando repuestos..."):
            resultados = buscar_en_daliubaze(busqueda, limite=num_items)
            
            if resultados:
                st.session_state.resultados = resultados
                st.success(f"¡Extracción completa! {len(resultados)} productos listos.")
            else:
                st.error("No se encontraron productos.")

    if st.session_state.resultados:
        st.divider()
        for index, prod in enumerate(st.session_state.resultados):
            with st.container(border=True):
                # Usamos columnas: Imagen, Info, Botón
                col_img, col_info, col_btn = st.columns([1.5, 3, 1])
                
                with col_img:
                    imagenes_extra = prod['detalles'].get('imagenes_extra', [])
                    if imagenes_extra:
                        # Mostramos la primera en grande
                        st.image(imagenes_extra[0], use_container_width=True)
                        # Miniaturas del resto
                        if len(imagenes_extra) > 1:
                            thumbs = st.columns(len(imagenes_extra) - 1)
                            for i, img_url in enumerate(imagenes_extra[1:]):
                                thumbs[i].image(img_url, use_container_width=True)
                    else:
                        st.info("Sin imagen")
                        
                with col_info:
                    st.subheader(prod['titulo'])
                    st.write(f"**Precio:** {prod['precio']}")
                    kodas_prev = prod['detalles'].get('especificaciones', {}).get('Kodas', 'N/A')
                    st.write(f"**Kodas (SKU):** {kodas_prev}")
                
                with col_btn:
                    st.write("") # Espaciador
                    if st.button("👁️ Adaptar y Previsualizar", key=f"prev_{index}", use_container_width=True):
                        st.session_state.producto_seleccionado = prod
                        st.session_state.vista_actual = 'preview'
                        # Limpiar variables de sesión anteriores
                        for k in ['edit_titulo', 'edit_precio', 'edit_desc', 'edit_imgs', 'edit_kodas', 'edit_cat']:
                            if k in st.session_state:
                                del st.session_state[k]
                        st.rerun()

# ---- VISTA 2: PREVISUALIZACIÓN Y EDICIÓN ----
elif st.session_state.vista_actual == 'preview':
    prod = st.session_state.producto_seleccionado
    
    if st.button("⬅️ Volver a resultados"):
        st.session_state.vista_actual = 'buscar'
        st.rerun()
        
    st.markdown("### ✏️ Ajustar Producto antes de Publicar")
    
    # Inicializamos las variables si no existen
    if 'edit_titulo' not in st.session_state:
        st.session_state.edit_titulo = prod['titulo']
        st.session_state.edit_precio = prod['precio'].replace(" €", "")
        st.session_state.edit_desc = generar_descripcion_html(prod['detalles'])
        st.session_state.edit_kodas = prod['detalles'].get('especificaciones', {}).get('Kodas', '')
        st.session_state.edit_cat = "Auto dalys"
        
        # Unimos todas las URLs separadas por saltos de línea
        st.session_state.edit_imgs = "\n".join(prod['detalles'].get('imagenes_extra', []))

    # ---- CAMPOS DE TEXTO BÁSICOS ----
    col_edit1, col_edit2, col_edit3, col_edit4 = st.columns([3, 1, 1.5, 1.5])
    with col_edit1:
        titulo_editado = st.text_input("Título del Producto", value=st.session_state.edit_titulo, key="edit_titulo")
    with col_edit2:
        precio_editado = st.text_input("Precio (€)", value=st.session_state.edit_precio, key="edit_precio")
    with col_edit3:
        kodas_editado = st.text_input("Kodas (SKU)", value=st.session_state.edit_kodas, key="edit_kodas")
    with col_edit4:
        categoria_editada = st.text_input("Categoría", value=st.session_state.edit_cat, key="edit_cat")
        
    # ---- GESTOR DE IMÁGENES ----
    st.markdown("#### 🖼️ Ordenar y Seleccionar Imágenes")
    col_img_txt, col_img_prev = st.columns([1, 1])
    
    with col_img_txt:
        # El usuario puede cortar, pegar y borrar líneas aquí para alterar las fotos
        imgs_editadas = st.text_area(
            "Mueve las líneas (URL) para cambiar el orden. La primera será la principal. Borra las que no quieras.", 
            value=st.session_state.edit_imgs, 
            height=150, 
            key="edit_imgs"
        )
    
    # Limpiamos las URLs vacías para mostrar un resultado seguro
    lista_imagenes_finales = [url.strip() for url in imgs_editadas.split("\n") if url.strip()]
    
    with col_img_prev:
        st.write("**Previsualización del Orden Final:**")
        if lista_imagenes_finales:
            # Mostramos miniaturas en fila. La primera será más grande.
            cols_preview = st.columns(len(lista_imagenes_finales))
            for i, url in enumerate(lista_imagenes_finales):
                caption = "Principal" if i == 0 else f"Nº {i+1}"
                cols_preview[i].image(url, caption=caption, use_container_width=True)
        else:
            st.warning("No hay imágenes seleccionadas")
            
    desc_editada = st.text_area("Descripción HTML (Especificaciones)", value=st.session_state.edit_desc, height=150, key="edit_desc")
    
    st.divider()

    # ---- BOTÓN DE PUBLICACIÓN Y PREVISUALIZACIÓN ----
    col_prev_title, col_publish = st.columns([4, 1])
    with col_prev_title:
        st.markdown("### 👁️ Vista Final en tu Plantilla (Tiempo Real)")
    with col_publish:
        if st.button("🚀 Publicar en WordPress", type="primary", use_container_width=True):
            datos_finales = {
                "titulo": st.session_state.edit_titulo,
                "precio": st.session_state.edit_precio,
                "descripcion": st.session_state.edit_desc,
                "imagenes": lista_imagenes_finales, # Mandamos la lista final ordenada
                "sku": st.session_state.edit_kodas,
                "categorias": [st.session_state.edit_cat]
            }
            # exito, id_wp = enviar_producto_a_wp(datos_finales)
            st.success(f"¡Producto publicado! (SKU: {datos_finales['sku']}) con {len(lista_imagenes_finales)} imágenes.")

    # Inyección del HTML para ver la página real
    html_final = renderizar_html_real(
        titulo=st.session_state.edit_titulo, 
        precio=st.session_state.edit_precio, 
        descripcion=st.session_state.edit_desc,
        imagenes=lista_imagenes_finales,
        kodas=st.session_state.edit_kodas,
        categoria=st.session_state.edit_cat
    )
    
    components.html(html_final, height=850, scrolling=True)