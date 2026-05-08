import requests

# Reemplaza esto con tus credenciales reales
WP_URL = "https://tudominio.com/wp-json/wc/v3/products"
CONSUMER_KEY = "tu_ck_..."
CONSUMER_SECRET = "tu_cs_..."

def enviar_producto_a_wp(producto):
    """
    Envía el JSON del producto a WooCommerce para publicarlo.
    """
    # Limpiamos el precio eliminando el símbolo del euro si lo tiene
    precio_limpio = producto['precio'].replace(" €", "").replace(",", ".")
    
    # Preparamos las imágenes
    imagenes = [{"src": img} for img in producto['detalles'].get('imagenes_extra', [])]
    
    # Convertimos las especificaciones en una tabla HTML básica para la descripción
    specs_html = "<ul>"
    for clave, valor in producto['detalles'].get('especificaciones', {}).items():
        specs_html += f"<li><strong>{clave}:</strong> {valor}</li>"
    specs_html += "</ul>"

    data = {
        "name": producto['titulo'],
        "type": "simple",
        "regular_price": precio_limpio,
        "description": specs_html,
        "images": imagenes
    }

    try:
        response = requests.post(
            WP_URL, 
            auth=(CONSUMER_KEY, CONSUMER_SECRET), 
            json=data
        )
        if response.status_code in [200, 201]:
            return True, response.json()['id']
        else:
            return False, response.text
    except Exception as e:
        return False, str(e)