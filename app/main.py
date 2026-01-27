"""NeuVector Demo Web Application - Main Entry Point."""

from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

from app.api.routes import router as api_router
from app.api.websocket import router as ws_router
from app.demos import DemoRegistry
from app.config import BASE_DIR


# Create FastAPI app
app = FastAPI(
    title="NeuVector Demo Platform",
    description="Interactive web interface for NeuVector demonstrations",
    version="1.0.0",
)

# Mount static files
static_path = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Set up templates
templates_path = BASE_DIR / "templates"
templates = Jinja2Templates(directory=str(templates_path))

# Include routers
app.include_router(api_router)
app.include_router(ws_router)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Render the main page."""
    demos = DemoRegistry.get_all()
    categories = DemoRegistry.get_by_category()

    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "demos": demos,
            "categories": categories,
        },
    )


@app.on_event("startup")
async def startup_event():
    """Application startup tasks."""
    # Log registered demos
    demos = DemoRegistry.list_ids()
    print(f"[STARTUP] Registered demos: {demos}")
    print(f"[STARTUP] Static files: {static_path}")
    print(f"[STARTUP] Templates: {templates_path}")


if __name__ == "__main__":
    import uvicorn
    from app.config import HOST, PORT

    uvicorn.run(app, host=HOST, port=PORT)
