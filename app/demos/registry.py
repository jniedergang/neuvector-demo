"""Demo registry with auto-discovery."""

from typing import Type, Optional

from app.demos.base import DemoModule


class DemoRegistry:
    """Registry for demo modules with decorator-based registration."""

    _demos: dict[str, DemoModule] = {}

    @classmethod
    def register(cls, demo_class: Type[DemoModule]) -> Type[DemoModule]:
        """
        Decorator to register a demo module.

        Usage:
            @DemoRegistry.register
            class MyDemo(DemoModule):
                ...
        """
        instance = demo_class()
        if not instance.id:
            raise ValueError(f"Demo {demo_class.__name__} must have an 'id' attribute")
        cls._demos[instance.id] = instance
        return demo_class

    @classmethod
    def get(cls, demo_id: str) -> Optional[DemoModule]:
        """Get a demo by ID."""
        return cls._demos.get(demo_id)

    @classmethod
    def get_all(cls) -> list[DemoModule]:
        """Get all registered demos."""
        return list(cls._demos.values())

    @classmethod
    def get_by_category(cls) -> dict[str, list[DemoModule]]:
        """Get demos grouped by category."""
        categories: dict[str, list[DemoModule]] = {}
        for demo in cls._demos.values():
            if demo.category not in categories:
                categories[demo.category] = []
            categories[demo.category].append(demo)
        return categories

    @classmethod
    def list_ids(cls) -> list[str]:
        """Get list of all demo IDs."""
        return list(cls._demos.keys())
