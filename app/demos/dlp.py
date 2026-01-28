"""
DLP (Data Loss Prevention) demo - test sensitive data detection.

This demo sends simulated sensitive data (credit card numbers, SSN patterns)
through the network to test NeuVector DLP detection and blocking capabilities.

Prerequisites for DLP blocking to work:
1. Network Policy must be set to "Protect" mode
2. Process Profile must be set to "Protect" mode
3. Baseline should be "zero-drift"
4. A DLP sensor must be enabled with action "deny" (Block)

Note on test patterns:
- NeuVector DLP regex excludes repetitive patterns like 4242-4242-4242-4242
  to avoid false positives on test data
- Use realistic-looking patterns like 4532-0151-1283-0366 to trigger blocking
- The curl timeout is set to 3 seconds; if DLP blocks, the connection will timeout
"""

from typing import Any, AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


@DemoRegistry.register
class DLPDemo(DemoModule):
    """
    Demo to test NeuVector DLP detection and blocking.

    Sends a POST request containing sensitive data patterns from a source pod
    to a target (internal nginx pod or external service). When properly configured,
    NeuVector will detect the sensitive data and block the request.
    """

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
                    {"value": "external", "label": "External Service (example.com)"},
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
        # NeuVector DLP regex excludes repetitive patterns like 4242-4242-4242-4242
        # Use realistic-looking test numbers that will trigger DLP blocking
        test_patterns = {
            "credit_card": ("4532-0151-1283-0366", "Test Visa card number"),
            "ssn": ("078-05-1120", "Test SSN pattern"),
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
            target_url = "http://example.com"

        # Build curl command with POST data
        # Send as plain text body for better DLP detection (NeuVector inspects packet payload)
        body = f"Transaction payment info: card={test_data} amount=100.00"
        curl_args = [
            "curl", "-v", "-X", "POST",
            "-H", "Content-Type: text/plain",
            "-d", body,
            "-m", "3",
            target_url,
        ]

        yield f"[CMD] Sending POST request with sensitive data: {test_data}"
        yield f"[CMD] Target: {target_url}"
        yield ""

        # Execute curl in pod
        try:
            async for line in kubectl.exec_in_pod(
                pod_name=pod_name,
                command=curl_args,
                namespace=NAMESPACE,
                timeout=10,
            ):
                yield line
        except Exception as e:
            yield f"[ERROR] {str(e)}"
            return

        yield ""
        yield "[INFO] DLP test complete"
        yield "[INFO] Check NeuVector console for DLP violations"
        yield "[INFO] Look in Security Events > DLP for detected sensitive data"
