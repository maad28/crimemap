#Users/mac/crimemap/backend-fastapi/routers/predict.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import numpy as np
import os
import pickle

router = APIRouter(prefix="/predict", tags=["predicción"])

MODELS_DIR = "ml"
AVAILABLE_MODELS = {
    "xgboost":       "model_xgboost.pkl",
    "random_forest": "model_random_forest.pkl",
    "knn":           "model_knn.pkl",
}

class PredictRequest(BaseModel):
    lat:    float
    lng:    float
    fecha:  str
    hora:   int
    modelo: str = "xgboost"

def build_features(lat, lng, fecha, hora):
    dt = datetime.strptime(fecha, "%Y-%m-%d")
    return np.array([[
        np.sin(2 * np.pi * hora / 24),
        np.cos(2 * np.pi * hora / 24),
        np.sin(2 * np.pi * dt.weekday() / 7),
        np.cos(2 * np.pi * dt.weekday() / 7),
        np.sin(2 * np.pi * dt.month / 12),
        np.cos(2 * np.pi * dt.month / 12),
        lat,
        lng,
    ]])

@router.get("/models")
def list_models():
    """Lista los modelos disponibles y cuáles están entrenados."""
    result = []
    for name, filename in AVAILABLE_MODELS.items():
        path = os.path.join(MODELS_DIR, filename)
        result.append({
            "id":       name,
            "nombre":   {
                "xgboost":       "XGBoost",
                "random_forest": "Random Forest",
                "knn":           "KNN Espacial",
            }[name],
            "descripcion": {
                "xgboost":       "Alta precisión, detecta patrones complejos temporales y espaciales",
                "random_forest": "Robusto y estable, bueno para zonas con pocos datos",
                "knn":           "Predice basándose en zonas geográficamente similares",
            }[name],
            "entrenado": os.path.exists(path),
        })
    return result

@router.post("/")
def predecir(req: PredictRequest):
    if req.modelo not in AVAILABLE_MODELS:
        raise HTTPException(400, f"Modelo inválido. Opciones: {list(AVAILABLE_MODELS.keys())}")

    path = os.path.join(MODELS_DIR, AVAILABLE_MODELS[req.modelo])
    if not os.path.exists(path):
        raise HTTPException(503, f"Modelo '{req.modelo}' no entrenado. POST /predict/train primero")

    with open(path, "rb") as f:
        model = pickle.load(f)

    features = build_features(req.lat, req.lng, req.fecha, req.hora)
    pred     = max(0, int(round(model.predict(features)[0])))
    nivel    = "ALTO" if pred >= 8 else "MEDIO" if pred >= 4 else "BAJO"

    return {
        "lat": req.lat, "lng": req.lng,
        "fecha": req.fecha, "hora": req.hora,
        "modelo": req.modelo,
        "robos_estimados": pred,
        "nivel_riesgo":    nivel,
        "color": {"ALTO": "#E24B4A", "MEDIO": "#BA7517", "BAJO": "#1D9E75"}[nivel],
    }

@router.post("/predict-grid")
def predecir_grid(fecha: str, hora: int, modelo: str = "xgboost"):
    """
    Predice para una grilla de puntos sobre Guayaquil.
    Retorna lista de zonas con nivel de riesgo para pintar el mapa.
    """
    path = os.path.join(MODELS_DIR, AVAILABLE_MODELS.get(modelo, "model_xgboost.pkl"))
    if not os.path.exists(path):
        raise HTTPException(503, f"Modelo '{modelo}' no entrenado")

    with open(path, "rb") as f:
        model = pickle.load(f)

    # Grilla sobre Guayaquil urbano
    lats = np.arange(-2.260, -2.090, 0.008)
    lngs = np.arange(-79.970, -79.870, 0.008)

    results = []
    for lat in lats:
        for lng in lngs:
            features = build_features(lat, lng, fecha, hora)
            pred     = max(0, float(model.predict(features)[0]))
            nivel    = "ALTO" if pred >= 8 else "MEDIO" if pred >= 4 else "BAJO"
            results.append({
                "lat": round(float(lat), 4),
                "lng": round(float(lng), 4),
                "robos_estimados": round(pred, 2),
                "nivel_riesgo":    nivel,
                "color": {"ALTO": "#E24B4A", "MEDIO": "#BA7517", "BAJO": "#1D9E75"}[nivel],
            })

    return {"fecha": fecha, "hora": hora, "modelo": modelo, "zonas": results}

@router.post("/train")
def entrenar():
    """Entrena los 3 modelos con los datos históricos."""
    from db.connection import get_conn
    from xgboost import XGBRegressor
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.neighbors import KNeighborsRegressor
    import pandas as pd

    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT EXTRACT(HOUR  FROM created_at)::int AS hora,
               EXTRACT(DOW   FROM created_at)::int AS dia_semana,
               EXTRACT(MONTH FROM created_at)::int AS mes,
               ST_Y(ubicacion::geometry)            AS lat,
               ST_X(ubicacion::geometry)            AS lng
        FROM reports
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()

    if len(rows) < 50:
        raise HTTPException(400, "Necesitas al menos 50 reportes para entrenar")

    df = pd.DataFrame(rows)
    for col, period in [("hora", 24), ("dia_semana", 7), ("mes", 12)]:
        df[f"{col}_sin"] = np.sin(2 * np.pi * df[col] / period)
        df[f"{col}_cos"] = np.cos(2 * np.pi * df[col] / period)

    df["lat_g"] = (df["lat"] * 100).round() / 100
    df["lng_g"] = (df["lng"] * 100).round() / 100
    target = df.groupby(["lat_g", "lng_g", "hora"]).size().reset_index(name="conteo")
    df     = df.merge(target, on=["lat_g", "lng_g", "hora"], how="left")

    feats = ["hora_sin","hora_cos","dia_semana_sin","dia_semana_cos","mes_sin","mes_cos","lat","lng"]
    X, y  = df[feats].values, df["conteo"].values

    os.makedirs(MODELS_DIR, exist_ok=True)

    modelos = {
        "xgboost": XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05, random_state=42
        ),
        "random_forest": RandomForestRegressor(
            n_estimators=150, max_depth=8, random_state=42, n_jobs=-1
        ),
        "knn": KNeighborsRegressor(
            n_neighbors=10, weights='distance', metric='euclidean'
        ),
    }

    resultados = {}
    for nombre, modelo in modelos.items():
        print(f"Entrenando {nombre}...")
        modelo.fit(X, y)
        path = os.path.join(MODELS_DIR, AVAILABLE_MODELS[nombre])
        with open(path, "wb") as f:
            pickle.dump(modelo, f)
        resultados[nombre] = "✅ entrenado"
        print(f"  {nombre} guardado en {path}")

    return {"ok": True, "samples": len(df), "modelos": resultados}


@router.get("/metrics")
def get_metrics():
    """
    Evalúa los 3 modelos con cross-validation y retorna métricas de precisión.
    """
    from db.connection import get_conn
    from xgboost import XGBRegressor
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.neighbors import KNeighborsRegressor
    from sklearn.model_selection import cross_val_score, KFold
    from sklearn.metrics import mean_absolute_error, mean_squared_error
    import numpy as np
    import pandas as pd

    conn = get_conn()
    cur  = conn.cursor()
    cur.execute("""
        SELECT EXTRACT(HOUR  FROM created_at)::int AS hora,
               EXTRACT(DOW   FROM created_at)::int AS dia_semana,
               EXTRACT(MONTH FROM created_at)::int AS mes,
               ST_Y(ubicacion::geometry)            AS lat,
               ST_X(ubicacion::geometry)            AS lng
        FROM reports
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()

    if len(rows) < 50:
        raise HTTPException(400, "Necesitas al menos 50 reportes")

    df = pd.DataFrame(rows)
    for col, period in [("hora",24),("dia_semana",7),("mes",12)]:
        df[f"{col}_sin"] = np.sin(2*np.pi*df[col]/period)
        df[f"{col}_cos"] = np.cos(2*np.pi*df[col]/period)

    df["lat_g"] = (df["lat"]*100).round()/100
    df["lng_g"] = (df["lng"]*100).round()/100
    target = df.groupby(["lat_g","lng_g","hora"]).size().reset_index(name="conteo")
    df     = df.merge(target, on=["lat_g","lng_g","hora"], how="left")

    feats = ["hora_sin","hora_cos","dia_semana_sin","dia_semana_cos","mes_sin","mes_cos","lat","lng"]
    X, y  = df[feats].values, df["conteo"].values

    modelos = {
        "xgboost":       XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.05, random_state=42),
        "random_forest": RandomForestRegressor(n_estimators=150, max_depth=8, random_state=42, n_jobs=-1),
        "knn":           KNeighborsRegressor(n_neighbors=10, weights='distance'),
    }

    kf      = KFold(n_splits=5, shuffle=True, random_state=42)
    results = {}

    for nombre, modelo in modelos.items():
        path = os.path.join(MODELS_DIR, AVAILABLE_MODELS[nombre])
        if not os.path.exists(path):
            results[nombre] = {"error": "Modelo no entrenado"}
            continue

        with open(path, "rb") as f:
            modelo = pickle.load(f)

        mae_scores  = -cross_val_score(modelo, X, y, cv=kf, scoring='neg_mean_absolute_error')
        rmse_scores = np.sqrt(-cross_val_score(modelo, X, y, cv=kf, scoring='neg_mean_squared_error'))
        r2_scores   =  cross_val_score(modelo, X, y, cv=kf, scoring='r2')

        modelo.fit(X, y)
        y_pred = modelo.predict(X)

        results[nombre] = {
            "mae":       round(float(mae_scores.mean()),  4),
            "mae_std":   round(float(mae_scores.std()),   4),
            "rmse":      round(float(rmse_scores.mean()), 4),
            "rmse_std":  round(float(rmse_scores.std()),  4),
            "r2":        round(float(r2_scores.mean()),   4),
            "r2_std":    round(float(r2_scores.std()),    4),
            "samples":   len(df),
            "cv_folds":  5,
        }

    # Ranking por MAE (menor es mejor)
    ranking = sorted(
        [(k, v) for k, v in results.items() if "error" not in v],
        key=lambda x: x[1]["mae"]
    )

    return {
        "metricas":  results,
        "ranking":   [{"modelo": k, "mae": v["mae"], "r2": v["r2"]} for k, v in ranking],
        "mejor_modelo": ranking[0][0] if ranking else None,
    }
