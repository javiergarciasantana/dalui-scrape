from scrapling.fetchers import StealthySession
import urllib.parse
import json


def obtener_detalles_internos(session, url_producto):
    """
    Usa la sesión existente para entrar en la página del producto y extraer
    fotos extra, especificaciones y códigos OE.
    """    
    detalles = {
        "especificaciones": {},
        "imagenes_extra": [],
        "oe_numbers": []
    }
    
    try:
        page = session.fetch(url_producto, network_idle=True)
        
        # 1. Extraer tabla de especificaciones (clase product-information)
        filas = page.css('.product-information table tr')
        for fila in filas:
            ths = fila.css('th')
            tds = fila.css('td')
            
            if ths and tds:
                clave = "".join(ths[0].css('::text').getall()).strip()
                valor = "".join(tds[0].css('::text').getall()).strip()
                
                if clave and valor:
                    detalles["especificaciones"][clave] = valor
                    
        # 2. Extraer TODAS las imágenes en alta resolución
        imgs = page.css('.product-images img')
        for img in imgs:
            src = img.attrib.get('src') or img.attrib.get('data-src')
            if src and src not in detalles["imagenes_extra"]:
                if "logo" not in src.lower() and "icon" not in src.lower():
                    if src.startswith('/'):
                        src = f"https://daliubaze.lt{src}"
                    detalles["imagenes_extra"].append(src)
                    
        # 3. Extraer números OE (Original Equipment) - Vital para repuestos
        oe_filas = page.css('#oetable tr')
        for fila in oe_filas:
            tds = fila.css('td')
            if len(tds) >= 2:
                marca = tds[0].xpath('string(.)').get(default='').strip()
                codigo = tds[1].xpath('string(.)').get(default='').strip()
                if marca and codigo:
                    detalles["oe_numbers"].append(f"{marca}: {codigo}")

        return detalles
    except Exception as e:
        print(f"Error al extraer detalles de {url_producto}: {e}")
        return detalles

def buscar_en_daliubaze(keyword_lt):
    base_url = "https://daliubaze.lt"
    target_url = f"{base_url}/autodalys?sPhrase={urllib.parse.quote(keyword_lt)}"
    
    productos = []
    
    try:
        print(f"Buscando en: {target_url}")
        with StealthySession(headless=True, solve_cloudflare=True) as session:
            page = session.fetch(target_url)
        
            if "cloudflare" in page.text.lower():
                print("Bloqueado por Cloudflare. Intentando configuración más agresiva...")
                return []

            tarjetas = page.css('.listItem')
            
            if not tarjetas:
                return productos

            for tarjeta in tarjetas[:5]: # Límite de 5 para no demorar mucho
                try:
                    caption = tarjeta.find('div', class_='caption')
                    tag_a = caption.find('h3').find('a') if caption and caption.find('h3') else None
                    
                    titulo = tag_a.text.strip() if tag_a else "Sin título"
                    enlace = tag_a['href'] if tag_a else target_url
                    
                    basket = tarjeta.find('div', class_='basket')
                    tag_precio = basket.find('span', class_='list-price').find('strong') if basket and basket.find('span', class_='list-price') else None
                    precio = tag_precio.text.strip() if tag_precio else "N/A"
                        
                    if titulo != "Sin título":
                        print(f"Extrayendo interior de: {titulo}...")
                        # Enviamos la sesión activa a la función interna
                        detalles_internos = obtener_detalles_internos(session, enlace)
                        
                        productos.append({
                            'titulo': titulo,
                            'precio': f"{precio} €" if precio != "N/A" else precio,
                            'enlace': enlace,
                            'detalles': detalles_internos
                        })
                except Exception as e:
                    print(f"Error procesando tarjeta: {e}")
                    continue

        # Backup JSON local
        with open('productos_extraidos.json', 'w', encoding='utf-8') as f:
            json.dump(productos, f, ensure_ascii=False, indent=4)
            
        return productos

    except Exception as e:
        print(f"Error global: {e}")
        return []