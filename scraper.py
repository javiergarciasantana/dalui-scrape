from zenrows import ZenRowsClient
from bs4 import BeautifulSoup
import urllib.parse
import json

# CONFIGURACIÓN
API_KEY = "44930dd64b19218e2eb68a04296a2b6b1f6c4751" # <-- PON TU CLAVE AQUÍ
client = ZenRowsClient(API_KEY)

def obtener_detalles_internos(url_producto):
    """
    Entra en la página del producto y extrae fotos extra, especificaciones y códigos OE.
    """
    params = {"js_render": "true", "antibot": "true"}
    
    detalles = {
        "especificaciones": {},
        "imagenes_extra": [],
        "oe_numbers": []
    }
    
    try:
        response = client.get(url_producto, params=params)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. Extraer tabla de especificaciones (clase product-information)
        info_div = soup.find('div', class_='product-information')
        if info_div and info_div.find('table'):
            for fila in info_div.find('table').find_all('tr'):
                ths = fila.find_all('th')
                tds = fila.find_all('td')
                if ths and tds:
                    clave = ths[0].text.strip()
                    valor = tds[0].text.strip()
                    detalles["especificaciones"][clave] = valor
                    
        # 2. Extraer TODAS las imágenes en alta resolución
        img_div = soup.find('div', class_='product-images')
        if img_div:
            for img in img_div.find_all('img'):
                src = img.get('src')
                if src and src not in detalles["imagenes_extra"]:
                    detalles["imagenes_extra"].append(src)
                    
        # 3. Extraer números OE (Original Equipment) - Vital para repuestos
        oe_table = soup.find('table', id='oetable')
        if oe_table:
            for fila in oe_table.find_all('tr'):
                tds = fila.find_all('td')
                if len(tds) == 2:
                    marca = tds[0].text.strip()
                    codigo = tds[1].text.strip()
                    detalles["oe_numbers"].append(f"{marca}: {codigo}")

        return detalles
    except Exception as e:
        print(f"Error al extraer detalles de {url_producto}: {e}")
        return detalles

def buscar_en_daliubaze(keyword_lt):
    base_url = "https://daliubaze.lt"
    target_url = f"{base_url}/autodalys?sPhrase={urllib.parse.quote(keyword_lt)}"
    
    params = {
        "js_render": "true",
        "antibot": "true",
        "wait_for": ".listItem",
        "wait": "2000"
    }
    
    productos = []
    
    try:
        print(f"Buscando en: {target_url}")
        response = client.get(target_url, params=params)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        tarjetas = soup.find_all('div', class_=lambda c: c and 'listItem' in c.split())
        
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
                    detalles_internos = obtener_detalles_internos(enlace)
                    
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