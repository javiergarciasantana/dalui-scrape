import streamlit as st
from ai_helper import procesar_descripcion_lituano
from scraper import buscar_en_daliubaze

st.set_page_config(page_title="Buscador de Repuestos LT", layout="wide")

st.title("🚗 Buscador Inteligente - Daliubaze")

# Input del usuario en lituano
descripcion = st.text_area("Aprašykite ieškomą detalę (Describe la pieza en Lituano):", 
                           placeholder="Ej: kairysis priekinis žibintas Golf 2015")

if st.button("Buscar Piezas"):
    if descripcion:
        with st.spinner("🧠 IA analizando el texto en lituano..."):
            # Usamos la nueva función
            keyword_lt = procesar_descripcion_lituano(descripcion)
            st.info(f"**Término de búsqueda extraído:** {keyword_lt}")
            
        with st.spinner("🕸️ Scrapeando daliubaze.lt..."):
            # El scraper sigue funcionando exactamente igual
            resultados = buscar_en_daliubaze(keyword_lt)
            
        if resultados:
            st.success(f"¡Se encontraron {len(resultados)} resultados!")
            
            cols = st.columns(3)
            for index, prod in enumerate(resultados):
                with cols[index % 3]: 
                    st.image(prod['imagen'], use_column_width=True) 
                    st.write(f"**{prod['titulo']}**")
                    st.write(f"Precio: {prod['precio']}")
                    st.markdown(f"[Ver en web original]({prod['enlace']})")
                    
                    if st.button(f"Sincronizar a WordPress", key=f"btn_{index}"):
                        st.warning("La lógica de WordPress se programará aquí.")
        else:
            st.error("No se encontraron resultados o hubo un error en el scraper.")
    else:
        st.warning("Por favor, introduce una descripción.")