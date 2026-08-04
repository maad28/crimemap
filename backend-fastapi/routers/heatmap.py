#/Users/mac/crimemap/backend-fastapi/routers/heatmap.py

from fastapi import APIRouter
from db.connection import get_conn

router = APIRouter(prefix="/heatmap", tags=["heatmap"])

@router.get("/")
def get_heatmap(days: int = 30):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(f"""
        SELECT ST_Y(ubicacion::geometry) AS lat,
               ST_X(ubicacion::geometry) AS lng,
               severidad + (confirmaciones * 0.5) AS peso
        FROM reports
        WHERE created_at > NOW() - INTERVAL '{int(days)} days'
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    return {"points": [[r["lat"], r["lng"], float(r["peso"])] for r in rows]}
