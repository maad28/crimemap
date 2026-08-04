
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import clustering, heatmap, predict

app = FastAPI(title="CrimeMap GYE — Análisis Espacial", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clustering.router)
app.include_router(heatmap.router)
app.include_router(predict.router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "fastapi-spatial"}
