from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router

app = FastAPI(
    title="ReelCut AI Backend",
    description="AI-Assisted Short-Form Video Editing API",
    version="1.0.0"
)

# Enable CORS for frontend Vite dev server and local clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {
        "app": "ReelCut AI",
        "tagline": "Your footage. AI-edited. Your final say.",
        "docs": "/docs",
        "health": "/api/health"
    }
