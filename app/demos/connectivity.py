"""Connectivity demo - test network access from pod."""

from typing import Any, AsyncGenerator
import re

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
                default="production1",
                required=True,
                options=[
                    {"value": "production1", "label": "Espion1"},
                    {"value": "web1", "label": "Cible1"},
                ],
                help_text="Pod from which to run the test",
            ),
            DemoParameter(
                name="target_type",
                label="Target Type",
                type="select",
                default="public",
                required=True,
                options=[
                    {"value": "pod", "label": "Pod"},
                    {"value": "public", "label": "Public Website"},
                    {"value": "custom", "label": "Custom"},
                ],
                help_text="Type of target to connect to",
            ),
            DemoParameter(
                name="target_pod",
                label="Target Pod",
                type="select",
                default="web1",
                options=[
                    {"value": "production1", "label": "Espion1"},
                    {"value": "web1", "label": "Cible1"},
                ],
                help_text="Target pod (when Target Type is Pod)",
            ),
            DemoParameter(
                name="target_public",
                label="Public Website",
                type="select",
                default="https://www.google.com",
                options=[
                    {"value": "https://www.google.com", "label": "Google"},
                    {"value": "https://www.github.com", "label": "GitHub"},
                    {"value": "https://www.suse.com", "label": "SUSE"},
                ],
                help_text="Public website (when Target Type is Public)",
            ),
            DemoParameter(
                name="target_custom",
                label="Custom Target",
                type="text",
                default="",
                placeholder="hostname, IP or URL",
                help_text="Custom target (when Target Type is Custom)",
            ),
            DemoParameter(
                name="command",
                label="Command",
                type="select",
                default="curl",
                required=True,
                options=[
                    {"value": "curl", "label": "curl"},
                    {"value": "ping", "label": "ping"},
                    {"value": "ssh", "label": "ssh"},
                    {"value": "nmap", "label": "nmap"},
                ],
                help_text="Command to execute",
            ),
        ]

    def _resolve_target(self, params: dict[str, Any]) -> str:
        """Resolve target based on target_type."""
        target_type = params.get("target_type", "public")

        if target_type == "pod":
            pod = params.get("target_pod", "web1")
            return f"{pod}.{NAMESPACE}.svc.cluster.local"
        elif target_type == "public":
            return params.get("target_public", "https://www.google.com")
        else:  # custom
            return params.get("target_custom", "localhost")

    def _extract_host(self, target: str) -> str:
        """Extract hostname from URL or return as-is."""
        # Remove protocol
        if "://" in target:
            target = target.split("://", 1)[1]
        # Remove path
        if "/" in target:
            target = target.split("/", 1)[0]
        # Remove port
        if ":" in target:
            target = target.split(":", 1)[0]
        return target

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        pod_name = params.get("pod_name", "production1")
        command = params.get("command", "curl")
        target = self._resolve_target(params)
        host = self._extract_host(target)

        yield f"[INFO] Starting {command} from pod '{pod_name}'"
        yield f"[INFO] Target: {target}"
        yield ""

        # Build command based on tool
        if command == "curl":
            # For curl, use full URL
            if not target.startswith(("http://", "https://")):
                target = f"http://{target}"
            cmd_args = ["curl", "-v", "-m", "10", target]
        elif command == "ping":
            cmd_args = ["ping", "-c", "4", host]
        elif command == "ssh":
            # Just attempt connection, will fail but shows process execution
            cmd_args = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=5", f"test@{host}"]
        elif command == "nmap":
            cmd_args = ["nmap", "-sT", "-p", "22,80,443", "--max-retries", "1", host]
        else:
            yield f"[ERROR] Unknown command: {command}"
            return

        yield f"[CMD] kubectl exec {pod_name} -n {NAMESPACE} -- {' '.join(cmd_args)}"
        yield ""

        # Execute command in pod and track if process was killed
        process_killed = False
        command_success = False

        try:
            async for line in kubectl.exec_in_pod(
                pod_name=pod_name,
                command=cmd_args,
                namespace=NAMESPACE,
                timeout=30,
            ):
                yield line
                # Check for process kill indicators
                lower_line = line.lower()
                if 'exit code 137' in lower_line or 'command terminated' in lower_line:
                    process_killed = True
                # Check for success indicators based on command
                if command == "curl":
                    if 'HTTP/' in line and (' 200 ' in line or ' 301 ' in line or ' 302 ' in line):
                        command_success = True
                elif command == "ping":
                    if 'bytes from' in lower_line or 'time=' in lower_line:
                        command_success = True
                elif command == "nmap":
                    if 'open' in lower_line:
                        command_success = True
        except Exception as e:
            error_str = str(e).lower()
            if 'exit code 137' in error_str or 'command terminated' in error_str:
                process_killed = True
            yield f"[ERROR] {str(e)}"

        yield ""

        if process_killed:
            yield f"[ERROR] Process '{command}' was killed by NeuVector (exit code 137)"
            yield "[INFO] This indicates the process profile is blocking this command"
            raise Exception("Process blocked by NeuVector")
        elif command_success:
            yield f"[OK] {command} executed successfully"
        else:
            yield f"[INFO] {command} execution complete"
            yield "[INFO] Check NeuVector console for network activity and any violations"
