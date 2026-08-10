#Users/mac/crimemap/backend-fastapi/test_data.py
"""
Dataset de prueba dirigido para verificar las funciones nuevas:
reputación, alertas de patrones, insignia de confiabilidad,
límite de frecuencia, y alerta de proximidad.

Ejecutar UNA VEZ, después de tu seed.py normal, sin borrar los datos existentes.
"""

import hashlib
import psycopg2
from datetime import datetime, timedelta

def hash_device(texto):
    return hashlib.sha256(texto.encode()).hexdigest()

# Punto de referencia: úsalo para simular "tu ubicación" al probar en el navegador
# (ponte en el inspector de Chrome, Sensors, y fija esta lat/lng como tu GPS simulado)
PUNTO_PRUEBA_LAT = -2.1650
PUNTO_PRUEBA_LNG = -79.9400  # cerca de Bastión Popular

def conectar():
    return psycopg2.connect(host="localhost", port=5432, dbname="crimemap", user="mac", password="")

def limpiar_datos_prueba(cur):
    """Borra dispositivos de prueba si ya existen, para poder correr el script varias veces."""
    for i in range(1, 20):
        cur.execute("DELETE FROM reports WHERE device_hash = %s", (hash_device(f"prueba_{i}"),))
        cur.execute("DELETE FROM reputacion_dispositivo WHERE device_hash = %s", (hash_device(f"prueba_{i}"),))

def caso_rafaga_temporal(cur):
    """
    6 reportes del mismo tipo, en el mismo punto, dentro de los últimos 8 minutos,
    de 6 dispositivos distintos. Debe disparar detectarRafaga() en el próximo
    reporte real que se cree cerca de este punto (la detección corre al insertar,
    así que aquí solo dejamos el terreno listo; el disparo ocurre al crear el
    reporte #7 desde la app).
    """
    ahora = datetime.now()
    for i in range(1, 7):
        cur.execute("""
            INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, estado, created_at)
            VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, 'pendiente', %s)
        """, (
            'Robo a persona', 4,
            PUNTO_PRUEBA_LNG + (i * 0.0003), PUNTO_PRUEBA_LAT + (i * 0.0003),
            hash_device(f"prueba_{i}"), 2,
            ahora - timedelta(minutes=8 - i)
        ))
    print("✅ Caso 1: 6 reportes 'Robo a persona' cerca del punto de prueba, últimos 8 min.")
    print(f"   Para disparar la alerta de ráfaga: crea un 7mo reporte 'Robo a persona' en lat={PUNTO_PRUEBA_LAT}, lng={PUNTO_PRUEBA_LNG} desde la app.")

def caso_dispositivo_nuevo_sospechoso(cur):
    """
    Un dispositivo con 'primera_actividad' hace 10 minutos, y reportes que ya
    acumularon 8 confirmaciones. Debe marcar sospechoso al evaluarse en el
    próximo reporte de ese mismo device_hash.
    """
    dh = hash_device("prueba_sospechoso")
    hace_10_min = datetime.now() - timedelta(minutes=10)

    cur.execute("""
        INSERT INTO reputacion_dispositivo (device_hash, puntos, reportes_totales, primera_actividad)
        VALUES (%s, 100, 1, %s)
        ON CONFLICT (device_hash) DO UPDATE SET primera_actividad = %s
    """, (dh, hace_10_min, hace_10_min))

    cur.execute("""
        INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, estado, created_at)
        VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, 'pendiente', %s)
    """, ('Homicidio', 5, PUNTO_PRUEBA_LNG, PUNTO_PRUEBA_LAT, dh, 8, hace_10_min))

    print("✅ Caso 2: dispositivo con 10 min de antigüedad y 8 confirmaciones ya acumuladas.")
    print(f"   device_hash de prueba: {dh[:16]}...")
    print("   Para disparar la alerta: crea un 2do reporte desde ese mismo device_id en la app.")

def caso_dispositivo_confiable(cur):
    """
    Dispositivo con 130 puntos exactos (6 aprobaciones), para ver la insignia ⭐
    en cualquier reporte que haga a partir de ahora.
    """
    dh = hash_device("prueba_confiable")
    cur.execute("""
        INSERT INTO reputacion_dispositivo (device_hash, puntos, reportes_totales, reportes_aprobados, bloqueado)
        VALUES (%s, 130, 6, 6, false)
        ON CONFLICT (device_hash) DO UPDATE SET puntos = 130, reportes_aprobados = 6
    """, (dh,))

    cur.execute("""
        INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, estado, created_at)
        VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, 'aprobado', NOW())
    """, ('Robo a persona', 3, PUNTO_PRUEBA_LNG + 0.001, PUNTO_PRUEBA_LAT + 0.001, dh, 2))

    print("✅ Caso 3: dispositivo con 130 puntos (⭐ confiable) y un reporte ya aprobado.")
    print(f"   Búscalo en el mapa cerca de lat={PUNTO_PRUEBA_LAT + 0.001}, lng={PUNTO_PRUEBA_LNG + 0.001}")

def caso_dispositivo_bloqueado(cur):
    """
    Dispositivo con puntos por debajo de 30 (ya bloqueado), para probar
    que el sistema rechaza sus nuevos reportes con 403.
    """
    dh = hash_device("prueba_bloqueado")
    cur.execute("""
        INSERT INTO reputacion_dispositivo (device_hash, puntos, reportes_totales, reportes_rechazados, bloqueado)
        VALUES (%s, 25, 3, 5, true)
        ON CONFLICT (device_hash) DO UPDATE SET puntos = 25, bloqueado = true
    """, (dh,))

    print("✅ Caso 4: dispositivo bloqueado (25 puntos).")
    print(f"   Para probar el bloqueo, usa device_id = 'prueba_bloqueado' desde el formulario (necesitas simularlo en el navegador, ver nota abajo).")

def caso_limite_frecuencia(cur):
    """
    Un dispositivo con 3 reportes en los últimos 5 minutos, para que el 4to
    reporte (creado en vivo desde la app) sea rechazado por exceder el límite.
    """
    dh = hash_device("prueba_frecuencia")
    ahora = datetime.now()
    for i in range(3):
        cur.execute("""
            INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, estado, created_at)
            VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, 'pendiente', %s)
        """, ('Vandalismo', 2, PUNTO_PRUEBA_LNG - 0.002, PUNTO_PRUEBA_LAT - 0.002, dh, 0,
              ahora - timedelta(minutes=5 - i)))

    print("✅ Caso 5: dispositivo con 3 reportes en los últimos 5 minutos.")
    print(f"   device_id de prueba: 'prueba_frecuencia' — el 4to intento desde ese mismo device_id debe dar 429.")

def caso_alerta_proximidad(cur):
    """
    Un reporte 'aprobado' hace 20 minutos, exactamente en el punto de prueba,
    para que ProximityAlert lo detecte al simular tu ubicación ahí.
    """
    dh = hash_device("prueba_proximidad")
    hace_20_min = datetime.now() - timedelta(minutes=20)
    cur.execute("""
        INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, estado, created_at)
        VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, 'aprobado', %s)
    """, ('Asalto a mano armada', 4, PUNTO_PRUEBA_LNG, PUNTO_PRUEBA_LAT, dh, 3, hace_20_min))

    print("✅ Caso 6: reporte 'aprobado' hace 20 minutos, en el punto de prueba exacto.")
    print(f"   Simula tu GPS en lat={PUNTO_PRUEBA_LAT}, lng={PUNTO_PRUEBA_LNG} para ver ProximityAlert.")

def caso_alerta_por_confirmaciones(cur):
    """
    Un reporte PENDIENTE (no aprobado) pero con 12 confirmaciones,
    para probar la rama 'confirmado por N ciudadanos' de la alerta de proximidad.
    """
    dh = hash_device("prueba_confirmaciones")
    hace_15_min = datetime.now() - timedelta(minutes=15)
    cur.execute("""
        INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, estado, created_at)
        VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, 'pendiente', %s)
    """, ('Extorsión', 3, PUNTO_PRUEBA_LNG + 0.0005, PUNTO_PRUEBA_LAT + 0.0005, dh, 12, hace_15_min))

    print("✅ Caso 7: reporte pendiente con 12 confirmaciones (no aprobado por Autoridad todavía).")
    print("   Debe activar la alerta por la rama 'confirmado por ciudadanos', no 'verificado por autoridad'.")

def main():
    conn = conectar()
    cur = conn.cursor()

    print("Limpiando datos de prueba anteriores...")
    limpiar_datos_prueba(cur)
    conn.commit()

    print("\nInsertando casos de prueba...\n")
    caso_rafaga_temporal(cur)
    caso_dispositivo_nuevo_sospechoso(cur)
    caso_dispositivo_confiable(cur)
    caso_dispositivo_bloqueado(cur)
    caso_limite_frecuencia(cur)
    caso_alerta_proximidad(cur)
    caso_alerta_por_confirmaciones(cur)

    conn.commit()
    cur.close()
    conn.close()

    print("\n✅ Dataset de prueba insertado correctamente.")
    print(f"\nPunto de referencia para simular tu GPS: lat={PUNTO_PRUEBA_LAT}, lng={PUNTO_PRUEBA_LNG}")
    print("(En Chrome DevTools: More tools → Sensors → Location → Custom, pon esas coordenadas)")

if __name__ == "__main__":
    main()