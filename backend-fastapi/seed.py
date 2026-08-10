import random, hashlib, os
from datetime import datetime, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()

TIPOS = [
    "Robo a persona",
    "Robo a domicilio",
    "Robo a vehículo",
    "Asalto a mano armada",
    "Homicidio",
    "Extorsión",
    "Vandalismo",
    "Punto GDO",
    "Otro",
]

# Zonas urbanas de Guayaquil con coordenadas y nivel de riesgo verificados
# (nombre, lat, lng, radio_km, peso_generacion, nivel)
ZONAS_URBANAS = [
    # --- NIVEL ALTO ---
    ("Socio Vivienda",              -2.12214, -79.95721, 0.6, 0.12, "alta"),
    ("Monte Sinaí",                 -2.11542, -79.97015, 0.6, 0.11, "alta"),
    ("El Guasmo Sur",               -2.26182, -79.89845, 0.7, 0.14, "alta"),
    ("Isla Trinitaria",             -2.24251, -79.91632, 0.6, 0.13, "alta"),
    ("Bastión Popular",             -2.09115, -79.93124, 0.6, 0.11, "alta"),
    ("Febres Cordero (Suburbio)",   -2.21453, -79.93241, 0.6, 0.11, "alta"),

    # --- NIVEL MEDIO ---
    ("Pascuales Centro",            -2.05941, -79.90422, 0.6, 0.05, "media"),
    ("Cristo del Consuelo",         -2.22635, -79.91421, 0.5, 0.05, "media"),
    ("Sauces (Etapas 1-9)",         -2.13142, -79.89215, 0.6, 0.05, "media"),
    ("Alborada",                    -2.14152, -79.89942, 0.6, 0.04, "media"),
    ("Mucho Lote 1",                -2.07841, -79.91232, 0.5, 0.04, "media"),

    # --- NIVEL BAJO ---
    ("Puerto Santa Ana",            -2.18025, -79.87412, 0.4, 0.02, "baja"),
    ("Urdesa Central",               -2.16782, -79.90924, 0.5, 0.01, "baja"),
    ("Los Ceibos",                  -2.16853, -79.93815, 0.5, 0.01, "baja"),
    ("Kennedy Norte",                -2.15842, -79.89124, 0.5, 0.01, "baja"),
    ("Barrio Centenario",           -2.22741, -79.89312, 0.4, 0.01, "baja"),
]

PESOS = [z[4] for z in ZONAS_URBANAS]

SEVERIDAD_POR_NIVEL = {
    "alta":  [3, 3, 4, 4, 4, 5, 5, 5],
    "media": [2, 2, 3, 3, 3, 4, 4],
    "baja":  [1, 1, 2, 2, 2, 3],
}

# Debe coincidir con SEVERIDAD_MINIMA_POR_TIPO en backend-express/src/routes/reports.js —
# si se desincroniza, el seed puede generar reportes que la app real nunca dejaría crear.
SEVERIDAD_MINIMA_POR_TIPO = {
    "Homicidio": 5,
    "Extorsión": 4,
    "Asalto a mano armada": 3,
}

CONFIRMACIONES_POR_NIVEL = {
    "alta":  (5, 15),
    "media": (2, 10),
    "baja":  (0, 5),
}

TIPOS_POR_NIVEL = {
    "alta":  ["Robo a persona", "Robo a domicilio", "Asalto a mano armada",
              "Homicidio", "Extorsión", "Punto GDO", "Robo a vehículo"],
    "media": ["Robo a persona", "Robo a vehículo", "Vandalismo",
              "Robo a domicilio", "Otro", "Extorsión"],
    "baja":  ["Vandalismo", "Robo a vehículo", "Otro", "Robo a persona"],
}

# Límites urbanos amplios de Guayaquil, cubriendo desde Pascuales (norte)
# hasta El Guasmo Sur (sur), y desde Monte Sinaí (oeste) hasta Puerto Santa Ana (este)
LAT_MIN, LAT_MAX = -2.270, -2.050
LNG_MIN, LNG_MAX = -79.980, -79.865


def gen_point():
    zona = random.choices(ZONAS_URBANAS, weights=PESOS)[0]
    nombre, lat0, lng0, radio_km, _, nivel = zona
    radio_deg = radio_km / 111.0
    intentos = 0
    while True:
        intentos += 1
        lat = lat0 + random.gauss(0, radio_deg * 0.5)
        lng = lng0 + random.gauss(0, radio_deg * 0.5)
        if LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX:
            return lat, lng, nivel
        if intentos > 30:
            # Si por alguna razón el punto sigue cayendo fuera, devuelve el centro exacto
            return lat0, lng0, nivel


def gen_tipo(nivel):
    return random.choice(TIPOS_POR_NIVEL[nivel])


def gen_severidad(nivel, tipo):
    base = random.choice(SEVERIDAD_POR_NIVEL[nivel])
    minimo = SEVERIDAD_MINIMA_POR_TIPO.get(tipo, 1)
    return max(base, minimo)


def gen_confirmaciones(nivel):
    lo, hi = CONFIRMACIONES_POR_NIVEL[nivel]
    return random.randint(lo, hi)


def gen_timestamp():
    base = datetime.now() - timedelta(days=180)
    hora = random.choices(
        range(24),
        weights=[1,1,1,1,1,1,2,4,4,3,3,3,3,3,3,3,4,5,6,6,5,4,3,2]
    )[0]
    dia  = random.randint(0, 180)
    return base + timedelta(days=dia, hours=hora, minutes=random.randint(0,59))


def fake_device():
    return hashlib.sha256(str(random.randint(1, 800)).encode()).hexdigest()


def gen_estado(ts):
    """
    Reportes muy recientes probablemente la Autoridad todavía no los revisó
    (backlog de moderación realista). Los más viejos ya deberían estar resueltos:
    70% aprobado, 20% pendiente, 10% rechazado.
    """
    dias_desde_creacion = (datetime.now() - ts).days
    if dias_desde_creacion < 2:
        return random.choices(
            ["pendiente", "aprobado", "rechazado"], weights=[0.85, 0.12, 0.03]
        )[0]
    return random.choices(
        ["aprobado", "pendiente", "rechazado"], weights=[0.70, 0.20, 0.10]
    )[0]


def gen_rol():
    """Rol opcional del reportante — no todos lo indican."""
    return random.choices([None, "testigo", "victima"], weights=[0.40, 0.35, 0.25])[0]


def seed(n=5000):
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "crimemap"),
        user=os.getenv("DB_USER") or os.popen("whoami").read().strip(),
        password=os.getenv("DB_PASSWORD", ""),
    )
    cur = conn.cursor()

    cur.execute("DELETE FROM reports")
    conn.commit()
    print(f"Datos anteriores eliminados. Insertando {n} reportes...")

    conteo_por_zona = {z[0]: 0 for z in ZONAS_URBANAS}
    conteo_por_nivel = {"alta": 0, "media": 0, "baja": 0}
    conteo_por_tipo = {t: 0 for t in TIPOS}
    conteo_por_estado = {"aprobado": 0, "pendiente": 0, "rechazado": 0}
    conteo_por_rol = {"testigo": 0, "victima": 0, "sin_indicar": 0}

    for i in range(n):
        zona_idx = random.choices(range(len(ZONAS_URBANAS)), weights=PESOS)[0]
        nombre, lat0, lng0, radio_km, _, nivel = ZONAS_URBANAS[zona_idx]
        radio_deg = radio_km / 111.0
        lat = lat0 + random.gauss(0, radio_deg * 0.5)
        lng = lng0 + random.gauss(0, radio_deg * 0.5)
        lat = min(max(lat, LAT_MIN), LAT_MAX)
        lng = min(max(lng, LNG_MIN), LNG_MAX)

        ts     = gen_timestamp()
        tipo   = gen_tipo(nivel)
        sev    = gen_severidad(nivel, tipo)
        conf   = gen_confirmaciones(nivel)
        dev    = fake_device()
        estado = gen_estado(ts)
        rol    = gen_rol()

        conteo_por_zona[nombre] += 1
        conteo_por_nivel[nivel] += 1
        conteo_por_tipo[tipo] += 1
        conteo_por_estado[estado] += 1
        conteo_por_rol[rol or "sin_indicar"] += 1

        cur.execute(
            """INSERT INTO reports (tipo, severidad, ubicacion, device_hash, confirmaciones, created_at, estado, rol_reportante)
               VALUES (%s, %s, ST_MakePoint(%s,%s)::geography, %s, %s, %s, %s, %s)""",
            (tipo, sev, lng, lat, dev, conf, ts, estado, rol)
        )
        if i % 500 == 0:
            print(f"  {i}/{n}...")
            conn.commit()

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Seed completo")
    print(f"   Distribución por zona: {conteo_por_zona}")
    print(f"   Distribución por nivel: {conteo_por_nivel}")
    print(f"   Distribución por tipo: {conteo_por_tipo}")
    print(f"   Distribución por estado: {conteo_por_estado}")
    print(f"   Distribución por rol: {conteo_por_rol}")


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    seed(n)