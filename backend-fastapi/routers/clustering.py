#/Users/mac/crimemap/backend-fastapi/routers/clustering.py
from fastapi import APIRouter
from sklearn.cluster import DBSCAN
import numpy as np
from db.connection import get_conn

router = APIRouter(prefix="/clustering", tags=["clustering"])

@router.get("/")
def get_clusters(eps_meters: float = 500, min_samples: int = 3):
    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT id, ST_Y(ubicacion::geometry) AS lat,
               ST_X(ubicacion::geometry) AS lng, tipo
        FROM reports
        WHERE created_at > NOW() - INTERVAL '30 days'
          AND estado = 'aprobado'
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()

    if not rows:
        return {"clusters": []}

    coords  = np.array([[r["lat"], r["lng"]] for r in rows])
    eps_rad = eps_meters / 6371000
    db      = DBSCAN(eps=eps_rad, min_samples=min_samples, metric='haversine').fit(np.radians(coords))
    labels  = db.labels_
    clusters = {}
    for i, label in enumerate(labels):
        if label == -1: continue
        clusters.setdefault(label, {"points": [], "tipos": []})
        clusters[label]["points"].append({"lat": rows[i]["lat"], "lng": rows[i]["lng"]})
        clusters[label]["tipos"].append(rows[i]["tipo"])

    return {"clusters": [
        {"cluster_id": int(l), "count": len(d["points"]),
         "centroid_lat": sum(p["lat"] for p in d["points"]) / len(d["points"]),
         "centroid_lng": sum(p["lng"] for p in d["points"]) / len(d["points"]),
         "tipo_frecuente": max(set(d["tipos"]), key=d["tipos"].count)}
        for l, d in clusters.items()
    ]}
