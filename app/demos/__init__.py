# Demo modules
from app.demos.registry import DemoRegistry
from app.demos.base import DemoModule

# Import demos to trigger registration
from app.demos import connectivity
from app.demos import dlp
from app.demos import admission
from app.demos import attack

__all__ = ["DemoRegistry", "DemoModule"]
