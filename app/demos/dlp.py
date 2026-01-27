"""DLP (Data Loss Prevention) demo - test sensitive data detection."""

from typing import Any, AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


@DemoRegistry.register
class DLPDemo(DemoModule):
    """Demo to test NeuVector DLP detection."""

    id = "dlp"
    name = "DLP Detection Test"
    description = "Send simulated sensitive data (credit card numbers, SSN patterns) to test NeuVector DLP rules."
    category = "DLP"
    icon = "🔒"

    @property
    def parameters(self) -> list[DemoParameter]:
        return [
            DemoParameter(
                name="pod_name",
                label="Source Pod",
                type="select",
                default="production1",
                required=True,
                options=[
                    {"value": "production1", "label": "Production1"},
                ],
                help_text="Pod from which to send test data",
            ),
            DemoParameter(
                name="target",
                label="Target",
                type="select",
                default="nginx",
                required=True,
                options=[
                    {"value": "nginx", "label": "Internal Nginx Pod"},
                    {"value": "external", "label": "External Service (httpbin.org)"},
                ],
                help_text="Where to send the test data",
            ),
            DemoParameter(
                name="data_type",
                label="Sensitive Data Type",
                type="select",
                default="credit_card",
                required=True,
                options=[
                    {"value": "credit_card", "label": "Credit Card Number"},
                    {"value": "ssn", "label": "Social Security Number"},
                    {"value": "custom", "label": "Custom Pattern"},
                ],
                help_text="Type of sensitive data to simulate",
            ),
            DemoParameter(
                name="custom_data",
                label="Custom Data",
                type="text",
                default="",
                placeholder="Enter custom test data",
                help_text="Custom data to send (only used if 'Custom Pattern' selected)",
            ),
        ]

    def _get_test_data(self, data_type: str, custom_data: str) -> tuple[str, str]:
        """Get test data based on type. Returns (data, description)."""
        # These are obviously fake test patterns
        test_patterns = {
            "credit_card": ("4111-1111-1111-1111", "Test Visa card number"),
            "ssn": ("123-45-6789", "Test SSN pattern"),
        }

        if data_type == "custom" and custom_data:
            return custom_data, "Custom test data"

        return test_patterns.get(data_type, ("test-data-12345", "Generic test data"))

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        pod_name = params.get("pod_name", "production1")
        target = params.get("target", "nginx")
        data_type = params.get("data_type", "credit_card")
        custom_data = params.get("custom_data", "")

        test_data, data_desc = self._get_test_data(data_type, custom_data)

        yield f"[INFO] Starting DLP detection test from pod '{pod_name}'"
        yield f"[INFO] Data type: {data_desc}"
        yield f"[INFO] Target: {target}"
        yield ""

        # Determine target URL
        if target == "nginx":
            target_url = f"http://web1.{NAMESPACE}.svc.cluster.local"
        else:
            target_url = "https://httpbin.org/post"

        # Build curl command with POST data
        curl_args = [
            "curl", "-v", "-X", "POST",
            "-H", "Content-Type: application/x-www-form-urlencoded",
            "-d", f"sensitive_data={test_data}",
            "-m", "15",
            target_url,
        ]

        yield f"[CMD] Sending POST request with sensitive data pattern"
        yield f"[CMD] Target: {target_url}"
        yield ""

        # Execute curl in pod
        try:
            async for line in kubectl.exec_in_pod(
                pod_name=pod_name,
                command=curl_args,
                namespace=NAMESPACE,
                timeout=30,
            ):
                yield line
        except Exception as e:
            yield f"[ERROR] {str(e)}"
            return

        yield ""
        yield "[INFO] DLP test complete"
        yield "[INFO] Check NeuVector console for DLP violations"
        yield "[INFO] Look in Security Events > DLP for detected sensitive data"
