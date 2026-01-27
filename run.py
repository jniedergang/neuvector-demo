#!/usr/bin/env python3
"""Launch script for NeuVector Demo Web Application."""

import uvicorn
from app.config import HOST, PORT


def main():
    """Run the application."""
    print(f"Starting NeuVector Demo Web Application on {HOST}:{PORT}")
    uvicorn.run(
        "app.main:app",
        host=HOST,
        port=PORT,
        reload=True,
        log_level="info",
    )


if __name__ == "__main__":
    main()
