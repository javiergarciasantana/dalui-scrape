import ollama

def procesar_descripcion_lituano(descripcion_lituano):
    """
    Usa Ollama local para limpiar el texto y extraer la pieza clave en lituano.
    """
    prompt = f"""
    Eres un experto en repuestos de coches. 
    Lee la siguiente descripción en Lituano: "{descripcion_lituano}".
    Tu tarea es extraer únicamente el nombre principal de la pieza de repuesto o el número de pieza (OEM) para usarlo en un motor de búsqueda de una tienda online.
    No me des explicaciones, devuelve SOLO la palabra, palabras clave o código exacto en Lituano.
    """
    
    try:
        response = ollama.chat(model='llama3', messages=[
            {'role': 'user', 'content': prompt}
        ])
        keyword_lt = response['message']['content'].strip()
        
        # Limpieza extra por si la IA añade comillas
        keyword_lt = keyword_lt.replace('"', '').replace("'", "")
        return keyword_lt
    except Exception as e:
        return f"Error con la IA: {e}"