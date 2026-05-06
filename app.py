import streamlit as st
from scraper import buscar_en_daliubaze

st.set_page_config(page_title="Gestor de Repuestos a WP", layout="wide")

# CSS personalizado para hacer que parezca una tienda
st.markdown("""
    <style>
    .wp-title { font-size: 24px; font-weight: bold; color: #1e1e1e; margin-bottom: 5px;}
    .wp-price { font-size: 28px; font-weight: bold; color: #d90429; margin-bottom: 15px;}
    .wp-spec-key { font-weight: 600; color: #555;}
    .card-container { padding: 20px; border-radius: 10px; background-color: #f8f9fa; margin-bottom: 20px;}
    </style>
""", unsafe_allow_html=True)

st.title("📦 Importador de Daliubaze a WordPress")
st.write("Escribe el término, extrae los datos reales, y previsualiza cómo se verá el artículo en tu tienda.")

busqueda = st.text_input("Término de búsqueda (OEM, nombre...):", value="172128")

if st.button("Buscar y Extraer (Deep Scraping)", type="primary"):
    with st.spinner("⏳ Atravesando Cloudflare y escaneando las fichas individuales..."):
        resultados = buscar_en_daliubaze(busqueda)
        
        if resultados:
            st.success(f"¡Extracción completa! {len(resultados)} productos listos.")
            st.divider()
            
            # --- RENDERIZADO ESTILO WOOCOMMERCE ---
            for index, prod in enumerate(resultados):
                detalles = prod['detalles']
                imagenes = detalles.get('imagenes_extra', [])
                
                with st.container(border=True):
                    # Usamos 2 columnas: 1 para foto, 1 para info
                    col_img, col_info = st.columns([1, 2])
                    
                    with col_img:
                        # Si hay varias imágenes, mostramos la principal grande
                        if imagenes:
                            st.image(imagenes[0], use_container_width=True)
                            # Mostramos miniaturas debajo si hay más de 1
                            if len(imagenes) > 1:
                                thumbs = st.columns(len(imagenes) - 1)
                                for i, img in enumerate(imagenes[1:]):
                                    with thumbs[i]:
                                        st.image(img, use_container_width=True)
                        else:
                            st.info("Sin imagen disponible")
                            
                    with col_info:
                        st.markdown(f"<div class='wp-title' style='color: gold;'>{prod['titulo']}</div>", unsafe_allow_html=True)
                        st.markdown(f"<div class='wp-price'>{prod['precio']}</div>", unsafe_allow_html=True)
                                                
                        st.markdown("### Especificaciones:")
                        # Renderizamos las especificaciones como una tabla markdown limpia
                        if detalles.get('especificaciones'):
                            for clave, valor in detalles['especificaciones'].items():
                                st.markdown(f"- <span class='wp-spec-key'>{clave}:</span> {valor}", unsafe_allow_html=True)
                        else:
                            st.write("No hay especificaciones en la tabla.")
                            
                        # Renderizamos los códigos OE si existen
                        if detalles.get('oe_numbers'):
                            st.markdown("### Códigos OE (Alternativas):")
                            st.write(" | ".join(detalles['oe_numbers']))
                        
                        st.divider()
                        
                        # Botones de acción simulando el panel de control
                        col_btn1, col_btn2 = st.columns([1, 1])
                        with col_btn1:
                            if st.button("➕ Crear en WordPress", key=f"wp_{index}", use_container_width=True):
                                st.success("Los datos (título, precio, especificaciones, imágenes) se enviarían por API a WP.")
                        with col_btn2:
                            st.markdown(f"<a href='{prod['enlace']}' target='_blank'><button style='width:100%; padding:8px;'>Ver Original</button></a>", unsafe_allow_html=True)

        else:
            st.error("No se encontraron productos o el scraper fue bloqueado.")