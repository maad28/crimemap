#/Users/mac/crimemap/backend-fastapi/routers/heatmap.py

from fastapi import APIRouter
from db.connection import get_conn

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

@router.get("/")
def get_heatmap(days: int = 30):
    """
    Peso por punto = severidad, sin más. Las confirmaciones NO entran aquí a
    propósito: son una señal de confiabilidad ("otros ciudadanos dicen que
    esto pasó"), no de gravedad, y mezclarlas habría hecho que un reporte
    leve muy confirmado se viera más peligroso que uno grave recién creado.
    Es la misma definición de riesgo que usan zonas_concentracion, el
    ranking de Analítica y el modelo de predicción (ver services/zonas.js y
    predict.py) — solo severidad, en toda la app, sin excepciones. Las
    confirmaciones se siguen mostrando en la UI como dato de contexto, pero
    ya no afectan ningún cálculo de riesgo/peligro en ningún lugar.
    Solo reportes 'aprobado': un reporte que la Autoridad rechazó como falso
    ya no debe seguir pintando el mapa público.
    """
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(f"""
        SELECT ST_Y(ubicacion::geometry) AS lat,
               ST_X(ubicacion::geometry) AS lng,
               severidad AS peso
        FROM reports
        WHERE created_at > NOW() - INTERVAL '{int(days)} days'
          AND estado = 'aprobado'
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return {"points": [[r["lat"], r["lng"], float(r["peso"])] for r in rows]}
