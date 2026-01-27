"""Base class for demo modules."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Optional

from app.core.kubectl import Kubectl


@dataclass
class DemoParameter:
    """Definition of a configurable parameter for a demo."""
    name: str
    label: str
    type: str  # "text", "select", "number", "checkbox"
    default: Any = None
    required: bool = False
    options: list[dict[str, str]] = field(default_factory=list)  # For select type
    placeholder: str = ""
    help_text: str = ""


@dataclass
class DemoResult:
    """Result of a demo execution."""
    success: bool
    message: str
    data: Optional[dict[str, Any]] = None


class DemoModule(ABC):
    """Abstract base class for demo modules."""

    # Override these in subclasses
    id: str = ""
    name: str = ""
    description: str = ""
    category: str = "General"
    icon: str = "🔧"  # Emoji or icon class

    @property
    @abstractmethod
    def parameters(self) -> list[DemoParameter]:
        """Return list of configurable parameters for this demo."""
        pass

    @abstractmethod
    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        """
        Execute the demo and yield output lines.

        Args:
            kubectl: Kubectl wrapper instance
            params: Dictionary of parameter values

        Yields:
            Output lines to display to user
        """
        pass

    async def validate_params(self, params: dict[str, Any]) -> tuple[bool, str]:
        """
        Validate parameters before execution.

        Returns:
            Tuple of (is_valid, error_message)
        """
        for param in self.parameters:
            if param.required and param.name not in params:
                return False, f"Missing required parameter: {param.label}"
        return True, ""

    def to_dict(self) -> dict[str, Any]:
        """Convert demo info to dictionary for API response."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "icon": self.icon,
            "parameters": [
                {
                    "name": p.name,
                    "label": p.label,
                    "type": p.type,
                    "default": p.default,
                    "required": p.required,
                    "options": p.options,
                    "placeholder": p.placeholder,
                    "help_text": p.help_text,
                }
                for p in self.parameters
            ],
        }
