"""Connectivity demo - test network access from pod."""

from typing import Any, AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


@DemoRegistry.register
class ConnectivityDemo(DemoModule):
    """Demo to test process interception in a pod."""

    id = "connectivity"
    name = "Interception de Process"
    description = "Execute des commandes dans un pod pour tester l'interception par NeuVector. Affiche les process profile rules appris."
    category = "Security"
    icon = "🛡️"

    @property
    def parameters(self) -> list[DemoParameter]:
        return [
            DemoParameter(
                name="pod_name",
                label="Source Pod",
                type="select",
                default="opensuse-test",
                required=True,
                options=[
                    {"value": "opensuse-test", "label": "OpenSUSE Test Pod"},
                    {"value": "nginx-test", "label": "Nginx Test Pod"},
                ],
                help_text="Pod from which to run the connectivity test",
            ),
            DemoParameter(
                name="target_url",
                label="Target URL",
                type="text",
                default="https://www.google.com",
                required=True,
                placeholder="https://example.com",
                help_text="URL to test connectivity against",
            ),
        ]

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        pod_name = params.get("pod_name", "opensuse-test")
        target_url = params.get("target_url", "https://www.google.com")

        yield f"[INFO] Starting connectivity test from pod '{pod_name}'"
        yield f"[INFO] Target URL: {target_url}"
        yield ""

        # Build curl command
        curl_args = ["curl", "-v", "-m", "10", target_url]

        yield f"[CMD] kubectl exec {pod_name} -n {NAMESPACE} -- {' '.join(curl_args)}"
        yield ""

        # Execute curl in pod and track if process was killed
        process_killed = False
        http_success = False

        try:
            async for line in kubectl.exec_in_pod(
                pod_name=pod_name,
                command=curl_args,
                namespace=NAMESPACE,
                timeout=30,
            ):
                yield line
                # Check for process kill indicators
                lower_line = line.lower()
                if 'exit code 137' in lower_line or 'command terminated' in lower_line:
                    process_killed = True
                # Check for HTTP success
                if 'HTTP/' in line and (' 200 ' in line or ' 301 ' in line or ' 302 ' in line):
                    http_success = True
        except Exception as e:
            yield f"[ERROR] {str(e)}"
            raise  # Re-raise to signal failure

        yield ""

        if process_killed:
            yield "[ERROR] Process was killed by NeuVector (exit code 137)"
            yield "[INFO] This indicates the process profile is blocking curl execution"
            raise Exception("Process blocked by NeuVector")
        elif http_success:
            yield "[OK] Connectivity test successful"
        else:
            yield "[INFO] Connectivity test complete"
            yield "[INFO] Check NeuVector console for network activity and any violations"
