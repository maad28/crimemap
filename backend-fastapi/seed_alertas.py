"""
Inserta alertas de actividad sospechosa de ejemplo en alertas_sospecha,
usando device_hash y reportes reales ya existentes en la base (reports /
reputacion_dispositivo).

A diferencia de seed.py, este script NO borra reports ni reputacion_dispositivo —
solo reemplaza el contenido de alertas_sospecha. Pensado para poblar el panel
Autoridad > Alertas con casos de demo sin tener que re-generar todos los reportes.
"""
import json, os, random
from datetime import datetime, timedelta
import psycopg2
from dotenv import load_dotenv

load_dotenv()


def reportes_de(cur, device_hash, limite=5):
    cur.execute("""
        SELECT id, tipo, ST_Y(ubicacion::geometry) AS lat, ST_X(ubicacion::geometry) AS lng, created_at
        FROM reports
        WHERE device_hash = %s
        ORDER BY created_at DESC
        LIMIT %s
    """, (device_hash, limite))
    cols = ["id", "tipo", "lat", "lng", "created_at"]
    return [
        {**dict(zip(cols, row)), "created_at": row[4].isoformat()}
        for row in cur.fetchall()
    ]


def seed_alertas():
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", 5432),
        dbname=os.getenv("DB_NAME", "crimemap"),
        user=os.getenv("DB_USER") or os.popen("whoami").read().strip(),
        password=os.getenv("DB_PASSWORD", ""),
    )
    cur = conn.cursor()

    cur.execute("SELECT device_hash FROM reputacion_dispositivo ORDER BY random() LIMIT 30")
    hashes = [r[0] for r in cur.fetchall()]
    if len(hashes) < 3:
        print("No hay suficientes dispositivos en reputacion_dispositivo — corre primero seed.py.")
        cur.close()
        conn.close()
        return

    cur.execute("DELETE FROM alertas_sospecha")
    conn.commit()

    filas = []

    # --- Ráfagas temporales: varios reportes del mismo tipo, cerca, en poco tiempo ---
    rafagas_tipos = ["Robo a persona", "Asalto a mano armada", "Robo a domicilio"]
    for tipo in rafagas_tipos:
        cur.execute("""
            SELECT ST_Y(ubicacion::geometry) AS lat, ST_X(ubicacion::geometry) AS lng
            FROM reports WHERE tipo = %s ORDER BY random() LIMIT 1
        """, (tipo,))
        row = cur.fetchone()
        if not row:
            continue
        lat, lng = row
        n_disp = random.randint(4, 6)
        detalle = {
            "sospechoso": True,
            "motivo": "rafaga_temporal",
            "total_reportes": random.randint(6, 9),
            "dispositivos_involucrados": random.sample(hashes, min(n_disp, len(hashes))),
            "tipo": tipo,
            "lat": lat,
            "lng": lng,
        }
        creado = datetime.now() - timedelta(hours=random.randint(1, 72))
        revisada = random.random() < 0.3
        filas.append(("rafaga_temporal", detalle, revisada, creado))

    # --- Dispositivos nuevos con actividad inmediata alta ---
    for _ in range(3):
        dev = random.choice(hashes)
        detalle = {
            "sospechoso": True,
            "motivo": "dispositivo_nuevo_actividad_alta",
            "minutos_desde_creacion": random.randint(5, 28),
            "confirmaciones_recibidas": random.randint(5, 14),
            "device_hash": dev,
            "reportes": reportes_de(cur, dev),
        }
        creado = datetime.now() - timedelta(hours=random.randint(1, 48))
        revisada = random.random() < 0.3
        filas.append(("dispositivo_nuevo_actividad_alta", detalle, revisada, creado))

    # --- Dispositivos que excedieron el límite de frecuencia (3+ reportes en 15 min) ---
    for _ in range(2):
        dev = random.choice(hashes)
        reportes = reportes_de(cur, dev, limite=10)
        detalle = {
            "sospechoso": True,
            "motivo": "limite_frecuencia",
            "device_hash": dev,
            "total_reportes_recientes": max(3, len(reportes)),
            "reportes": reportes,
        }
        creado = datetime.now() - timedelta(hours=random.randint(1, 24))
        revisada = random.random() < 0.3
        filas.append(("limite_frecuencia", detalle, revisada, creado))

    for tipo_alerta, detalle, revisada, creado in filas:
        cur.execute(
            """INSERT INTO alertas_sospecha (tipo_alerta, detalle, revisada, created_at)
               VALUES (%s, %s, %s, %s)""",
            (tipo_alerta, json.dumps(detalle), revisada, creado),
        )
    conn.commit()

    cur.close()
    conn.close()
    print(f"✅ {len(filas)} alertas de ejemplo insertadas en alertas_sospecha "
          f"({sum(1 for f in filas if not f[2])} pendientes de revisión).")


if __name__ == "__main__":
    seed_alertas()
