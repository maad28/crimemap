import random, hashlib, os
from datetime import datetime, timedelta
import psycopg2

TIPOS = ["Robo", "Asalto", "Punto GDO", "Vandalismo", "Otro"]
SEVERIDADES = [1, 2, 2, 3, 3, 3, 4, 4, 5]

# Zonas urbanas reales de Guayaquil con peso de incidencia
# (lat_center, lng_center, radio_km, peso)
ZONAS_URBANAS = [
    # Centro histórico - alta incidencia
    (-2.1894, -79.8891, 0.8, 0.20),
    # Urdesa - media
    (-2.1550, -79.9020, 0.6, 0.12),
    # Alborada - media
    (-2.1380, -79.8950, 0.7, 0.10),
    # Sauces - media alta
    (-2.1200, -79.9100, 0.6, 0.09),
    # Mapasingue - alta
    (-2.1100, -79.9050, 0.5, 0.08),
    # Guasmo sur - alta incidencia
    (-2.2300, -79.8900, 0.7, 0.10),
    # Fertisa / Bastión Popular
    (-2.1650, -79.9400, 0.6, 0.08),
    # Kennedy norte
    (-2.1450, -79.9150, 0.5, 0.07),
    # Centenario
    (-2.1750, -79.8980, 0.4, 0.06),
    # Los Esteros
    (-2.1950, -79.9100, 0.4, 0.05),
    # Sur - Chongón aprox urbano
    (-2.2100, -79.9200, 0.5, 0.05),
]

PESOS = [z[3] for z in ZONAS_URBANAS]

def gen_point():
    zona = random.choices(ZONAS_URBANAS, weights=PESOS)[0]
    lat0, lng0, radio_km, _ = zona
    # radio en grados aprox (1 grado ~ 111km)
    radio_deg = radio_km / 111.0
    while True:
        lat = lat0 + random.gauss(0, radio_deg * 0.5)
        lng = lng0 + random.gauss(0, radio_deg * 0.5)
        # Excluir río Guayas (lng > -79.875 en latitudes bajas es probable río)
        if lng > -79.875 and lat < -2.17:
            continue
        # Excluir isla Santay y zonas de manglar
        if lng > -79.860:
            continue
        # Limites urbanos de Guayaquil
        if lat < -2.260 or lat > -2.090:
            continue
        if lng < -79.970 or lng > -79.870:
            continue
        return lat, lng

def gen_timestamp():
    base = datetime.now() - timedelta(days=180)
    # Más denuncias en horas pico: mañana (7-9) y noche (18-22)
    hora = random.choices(
        range(24),
        weights=[1,1,1,1,1,1,2,4,4,3,3,3,3,3,3,3,4,5,6,6,5,4,3,2]
    )[0]
    dia  = random.randint(0, 180)
    return base + timedelta(days=dia, hours=hora, minutes=random.randint(0,59))

def fake_device():
    return hashlib.sha256(str(random.randint(1, 800)).encode()).hexdigest()

def seed(n=5000):
    user = os.getenv("DB_USER") or os.popen("whoami").read().strip()
    conn = psycopg2.connect(
        host="localhost", port=5432,
        dbname="crimemap", user=user, password=""
    )
    cur = conn.cursor()

    # Limpiar datos anteriores
    cur.execute("DELETE FROM reports")
    conn.commit()
    print(f"Datos anteriores eliminados. Insertando {n} reportes...")

    for i in range(n):
        lat, lng = gen_point()
        ts   = gen_timestamp()
        tipo = random.choice(TIPOS)
        sev  = random.choice(SEVERIDADES)
        dev  = fake_device()
        cur.execute(
            """INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, created_at)
               VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, %s)""",
            (tipo, sev, lng, lat, dev, random.randint(0, 15), ts)
        )
        if i % 500 == 0:
            print(f"  {i}/{n}...")
            conn.commit()

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Seed completo — datos solo en zonas urbanas de Guayaquil")

if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    seed(n)
