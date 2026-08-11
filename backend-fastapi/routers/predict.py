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

# --- Definición única de "riesgo", usada también en backend-express
# (zonas.js / authority.js) para zonas_concentracion y el ranking de
# Analítica. Riesgo = severidad acumulada de reportes 'aprobado' por
# semana, dentro de una ventana fija de historial reciente. Umbrales
# fijos (no percentiles) para que sean explicables sin depender de
# cuántos datos hay entrenados en un momento dado — mismos números en
# los dos backends, si se ajustan hay que cambiarlos en ambos lados.
DIAS_HISTORIAL      = 180
SEMANAS_HISTORIAL   = DIAS_HISTORIAL / 7
UMBRAL_RIESGO_ALTO  = 10   # puntos de severidad acumulada por semana
UMBRAL_RIESGO_MEDIO = 4


def clasificar_nivel(riesgo_semanal):
    if riesgo_semanal >= UMBRAL_RIESGO_ALTO:
        return "ALTO"
    if riesgo_semanal >= UMBRAL_RIESGO_MEDIO:
        return "MEDIO"
    return "BAJO"

ZONAS_CIUDAD = [
    {"nombre": "Socio Vivienda",              "lat": -2.12214, "lng": -79.95721},
    {"nombre": "Monte Sinaí",                 "lat": -2.11542, "lng": -79.97015},
    {"nombre": "El Guasmo Sur",               "lat": -2.26182, "lng": -79.89845},
    {"nombre": "Isla Trinitaria",             "lat": -2.24251, "lng": -79.91632},
    {"nombre": "Bastión Popular",             "lat": -2.09115, "lng": -79.93124},
    {"nombre": "Febres Cordero (Suburbio)",   "lat": -2.21453, "lng": -79.93241},
    {"nombre": "Pascuales Centro",            "lat": -2.05941, "lng": -79.90422},
    {"nombre": "Cristo del Consuelo",         "lat": -2.22635, "lng": -79.91421},
    {"nombre": "Sauces (Etapas 1-9)",         "lat": -2.13142, "lng": -79.89215},
    {"nombre": "Alborada",                    "lat": -2.14152, "lng": -79.89942},
    {"nombre": "Mucho Lote 1",                "lat": -2.07841, "lng": -79.91232},
    {"nombre": "Puerto Santa Ana",            "lat": -2.18025, "lng": -79.87412},
    {"nombre": "Urdesa Central",              "lat": -2.16782, "lng": -79.90924},
    {"nombre": "Los Ceibos",                  "lat": -2.16853, "lng": -79.93815},
    {"nombre": "Kennedy Norte",               "lat": -2.15842, "lng": -79.89124},
    {"nombre": "Barrio Centenario",           "lat": -2.22741, "lng": -79.89312},
]

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

@router.get("/ranking-zonas")
def ranking_zonas(fecha: str, hora: int):
    """
    Ejecuta XGBoost sobre las 16 zonas reales de la ciudad, para una fecha y
    hora dadas, y devuelve el ranking ordenado por riesgo estimado.
    Responde: ¿cuál zona tiene mayor riesgo a esta hora específica?
    """
    path = os.path.join(MODELS_DIR, AVAILABLE_MODELS["xgboost"])
    if not os.path.exists(path):
        raise HTTPException(503, "Modelo XGBoost no entrenado")

    with open(path, "rb") as f:
        model = pickle.load(f)

    resultados = []
    for zona in ZONAS_CIUDAD:
        features = build_features(zona["lat"], zona["lng"], fecha, hora)
        pred = max(0, float(model.predict(features)[0]))
        resultados.append({
            "nombre": zona["nombre"],
            "lat": zona["lat"], "lng": zona["lng"],
            "riesgo_estimado": round(pred, 2),
            "nivel_riesgo": clasificar_nivel(pred),
        })

    resultados_ordenados = sorted(resultados, key=lambda x: x["riesgo_estimado"], reverse=True)

    return {
        "fecha": fecha, "hora": hora,
        "ranking": resultados_ordenados,
        "zona_mayor_riesgo": resultados_ordenados[0]["nombre"] if resultados_ordenados else None,
    }

@router.get("/proximas-horas")
def predecir_proximas_horas(fecha: str, lat: float = -2.1650, lng: float = -79.9400):
    """
    Ejecuta XGBoost para las 24 horas de una fecha dada, en un punto específico.
    Responde: ¿cuál es la peor hora para esta zona en particular?
    """
    path = os.path.join(MODELS_DIR, AVAILABLE_MODELS["xgboost"])
    if not os.path.exists(path):
        raise HTTPException(503, "Modelo XGBoost no entrenado")

    with open(path, "rb") as f:
        model = pickle.load(f)

    resultados = []
    for hora in range(24):
        features = build_features(lat, lng, fecha, hora)
        pred = max(0, float(model.predict(features)[0]))
        resultados.append({"hora": hora, "riesgo_estimado": round(pred, 2)})

    resultados_ordenados = sorted(resultados, key=lambda x: x["riesgo_estimado"], reverse=True)

    return {
        "fecha": fecha,
        "lat": lat, "lng": lng,
        "por_hora": resultados,
        "ranking": resultados_ordenados[:5],
        "hora_mayor_riesgo": resultados_ordenados[0]["hora"] if resultados_ordenados else None,
    }

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
    nivel    = clasificar_nivel(pred)

    return {
        "lat": req.lat, "lng": req.lng,
        "fecha": req.fecha, "hora": req.hora,
        "modelo": req.modelo,
        "riesgo_estimado": pred,
        "nivel_riesgo":    nivel,
        "color": {"ALTO": "#E24B4A", "MEDIO": "#BA7517", "BAJO": "#1D9E75"}[nivel],
    }

@router.post("/predict-grid")
def predecir_grid(fecha: str, hora: int, modelo: str = "xgboost"):
    path = os.path.join(MODELS_DIR, AVAILABLE_MODELS.get(modelo, "model_xgboost.pkl"))
    if not os.path.exists(path):
        raise HTTPException(503, f"Modelo '{modelo}' no entrenado")

    with open(path, "rb") as f:
        model = pickle.load(f)

    lats = np.arange(-2.270, -2.050, 0.006)
    lngs = np.arange(-79.980, -79.865, 0.006)

    results = []
    for lat in lats:
        for lng in lngs:
            features = build_features(lat, lng, fecha, hora)
            pred     = max(0, float(model.predict(features)[0]))
            nivel    = clasificar_nivel(pred)
            results.append({
                "lat": round(float(lat), 4),
                "lng": round(float(lng), 4),
                "riesgo_estimado": round(pred, 2),
                "nivel_riesgo":    nivel,
                "color": {"ALTO": "#E24B4A", "MEDIO": "#BA7517", "BAJO": "#1D9E75"}[nivel],
            })

    return {"fecha": fecha, "hora": hora, "modelo": modelo, "zonas": results}

@router.post("/train")
def entrenar():
    """
    Entrena los 3 modelos con los datos históricos.

    El target es la severidad acumulada por semana (riesgo ≈ frecuencia ×
    severidad, "daño esperado"), no la cantidad de reportes — una zona con
    10 vandalismos ya no pesa más que una con 2 homicidios. Se agrupa por
    celda espacio-temporal (lat/lng redondeado a ~1.1km, hora del día) sobre
    los últimos DIAS_HISTORIAL días, y se divide entre las semanas de esa
    ventana para que el número sea una TASA comparable, no un total crudo que
    crece solo porque pasó más tiempo.

    Mismos umbrales fijos (ALTO/MEDIO) y misma unidad (severidad/semana) que
    zonas_concentracion y el ranking de Analítica en backend-express — así
    "riesgo alto" significa lo mismo lo mires desde donde lo mires, ya sea
    observado (zonas reales) o predicho (este modelo).

    Solo usa reportes 'aprobado', igual que el mapa de calor y el clustering
    exploratorio, para no aprender de reportes falsos o sin verificar.
    """
    from db.connection import get_conn
    from xgboost import XGBRegressor
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.neighbors import KNeighborsRegressor
    import pandas as pd

    conn = get_conn()
    cur  = conn.cursor()
    cur.execute(f"""
        SELECT EXTRACT(HOUR  FROM created_at)::int AS hora,
               EXTRACT(DOW   FROM created_at)::int AS dia_semana,
               EXTRACT(MONTH FROM created_at)::int AS mes,
               ST_Y(ubicacion::geometry)            AS lat,
               ST_X(ubicacion::geometry)            AS lng,
               severidad
        FROM reports
        WHERE estado = 'aprobado'
          AND created_at > NOW() - INTERVAL '{DIAS_HISTORIAL} days'
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()

    if len(rows) < 50:
        raise HTTPException(400, "Necesitas al menos 50 reportes aprobados para entrenar")

    df = pd.DataFrame(rows)
    for col, period in [("hora", 24), ("dia_semana", 7), ("mes", 12)]:
        df[f"{col}_sin"] = np.sin(2 * np.pi * df[col] / period)
        df[f"{col}_cos"] = np.cos(2 * np.pi * df[col] / period)

    df["lat_g"] = (df["lat"] * 100).round() / 100
    df["lng_g"] = (df["lng"] * 100).round() / 100
    target = df.groupby(["lat_g", "lng_g", "hora"])["severidad"].sum().reset_index(name="riesgo_total")
    target["riesgo"] = target["riesgo_total"] / SEMANAS_HISTORIAL
    df = df.merge(target[["lat_g", "lng_g", "hora", "riesgo"]], on=["lat_g", "lng_g", "hora"], how="left")

    feats = ["hora_sin","hora_cos","dia_semana_sin","dia_semana_cos","mes_sin","mes_cos","lat","lng"]
    X, y  = df[feats].values, df["riesgo"].values

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

    return {
        "ok": True, "samples": len(df), "modelos": resultados,
        "umbrales_riesgo": {"medio": UMBRAL_RIESGO_MEDIO, "alto": UMBRAL_RIESGO_ALTO},
        "unidad": "severidad acumulada por semana",
    }

@router.get("/metrics")
def get_metrics():
    """
    Evalúa los 3 modelos con cross-validation y retorna métricas de precisión.
    Usa el mismo criterio de datos y el mismo target que /train: reportes en
    estado 'aprobado', prediciendo riesgo (severidad acumulada por semana)
    por celda espacio-temporal, no cantidad de reportes.
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
    cur.execute(f"""
        SELECT EXTRACT(HOUR  FROM created_at)::int AS hora,
               EXTRACT(DOW   FROM created_at)::int AS dia_semana,
               EXTRACT(MONTH FROM created_at)::int AS mes,
               ST_Y(ubicacion::geometry)            AS lat,
               ST_X(ubicacion::geometry)            AS lng,
               severidad
        FROM reports
        WHERE estado = 'aprobado'
          AND created_at > NOW() - INTERVAL '{DIAS_HISTORIAL} days'
    """)
    rows = cur.fetchall()
    cur.close(); conn.close()

    if len(rows) < 50:
        raise HTTPException(400, "Necesitas al menos 50 reportes aprobados")

    df = pd.DataFrame(rows)
    for col, period in [("hora",24),("dia_semana",7),("mes",12)]:
        df[f"{col}_sin"] = np.sin(2*np.pi*df[col]/period)
        df[f"{col}_cos"] = np.cos(2*np.pi*df[col]/period)

    df["lat_g"] = (df["lat"]*100).round()/100
    df["lng_g"] = (df["lng"]*100).round()/100
    target = df.groupby(["lat_g","lng_g","hora"])["severidad"].sum().reset_index(name="riesgo_total")
    target["riesgo"] = target["riesgo_total"] / SEMANAS_HISTORIAL
    df = df.merge(target[["lat_g","lng_g","hora","riesgo"]], on=["lat_g","lng_g","hora"], how="left")

    feats = ["hora_sin","hora_cos","dia_semana_sin","dia_semana_cos","mes_sin","mes_cos","lat","lng"]
    X, y  = df[feats].values, df["riesgo"].values

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
        # RandomForest se guardó con n_jobs=-1 (todos los núcleos). En un
        # contenedor con RAM/CPU muy limitada (como el free tier de Render)
        # eso dispara varios procesos worker a la vez y puede tumbar el
        # servicio por falta de memoria. Forzar 1 solo hilo aquí es más
        # lento pero no cambia el resultado — el número de hilos no afecta
        # las métricas, solo la velocidad.
        if hasattr(modelo, "n_jobs"):
            modelo.n_jobs = 1

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

    ranking = sorted(
        [(k, v) for k, v in results.items() if "error" not in v],
        key=lambda x: x[1]["mae"]
    )

    return {
        "metricas":  results,
        "ranking":   [{"modelo": k, "mae": v["mae"], "r2": v["r2"]} for k, v in ranking],
        "mejor_modelo": ranking[0][0] if ranking else None,
    }