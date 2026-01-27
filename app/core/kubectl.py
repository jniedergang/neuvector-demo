"""Secure kubectl wrapper with validation and streaming output."""

import asyncio
import re
import shlex
from typing import AsyncGenerator, Optional

from app.config import (
    ALLOWED_KUBECTL_COMMANDS,
    ALLOWED_NAMESPACES,
    KUBECONFIG,
    KUBECTL_TIMEOUT,
)


class KubectlError(Exception):
    """Custom exception for kubectl errors."""
    pass


class KubectlValidationError(KubectlError):
    """Exception for validation failures."""
    pass


# Regex patterns for validation
POD_NAME_PATTERN = re.compile(r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?$')
NAMESPACE_PATTERN = re.compile(r'^[a-z0-9]([-a-z0-9]*[a-z0-9])?$')


def validate_pod_name(name: str) -> bool:
    """Validate pod name against Kubernetes naming rules."""
    if not name or len(name) > 253:
        return False
    return bool(POD_NAME_PATTERN.match(name))


def validate_namespace(namespace: str) -> bool:
    """Validate namespace name and check against allowed list."""
    if not namespace or len(namespace) > 63:
        return False
    if not NAMESPACE_PATTERN.match(namespace):
        return False
    return namespace in ALLOWED_NAMESPACES


def validate_command(command: str) -> bool:
    """Validate kubectl command against whitelist."""
    return command in ALLOWED_KUBECTL_COMMANDS


class Kubectl:
    """Secure kubectl wrapper with streaming support."""

    def __init__(self, kubeconfig: Optional[str] = None, namespace: Optional[str] = None):
        self.kubeconfig = kubeconfig or KUBECONFIG
        self.default_namespace = namespace

    def _build_base_command(self) -> list[str]:
        """Build base kubectl command with kubeconfig."""
        cmd = ["kubectl"]
        if self.kubeconfig:
            cmd.extend(["--kubeconfig", self.kubeconfig])
        return cmd

    async def run(
        self,
        *args: str,
        namespace: Optional[str] = None,
        timeout: Optional[int] = None,
        check: bool = True,
    ) -> tuple[str, str, int]:
        """
        Run kubectl command and return stdout, stderr, returncode.

        Args:
            *args: kubectl command arguments (e.g., "get", "pods")
            namespace: Override default namespace
            timeout: Command timeout in seconds
            check: Raise exception on non-zero return code

        Returns:
            Tuple of (stdout, stderr, returncode)
        """
        if not args:
            raise KubectlValidationError("No command specified")

        # Validate command
        command = args[0]
        if not validate_command(command):
            raise KubectlValidationError(f"Command '{command}' is not allowed")

        # Build full command
        cmd = self._build_base_command()

        # Add namespace if specified
        ns = namespace or self.default_namespace
        if ns:
            if not validate_namespace(ns):
                raise KubectlValidationError(f"Namespace '{ns}' is not allowed")
            cmd.extend(["-n", ns])

        cmd.extend(args)

        # Execute command
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout or KUBECTL_TIMEOUT,
            )

            stdout_str = stdout.decode("utf-8") if stdout else ""
            stderr_str = stderr.decode("utf-8") if stderr else ""
            returncode = process.returncode or 0

            if check and returncode != 0:
                raise KubectlError(f"kubectl failed: {stderr_str}")

            return stdout_str, stderr_str, returncode

        except asyncio.TimeoutError:
            raise KubectlError(f"Command timed out after {timeout or KUBECTL_TIMEOUT}s")

    async def run_streaming(
        self,
        *args: str,
        namespace: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Run kubectl command and stream output line by line.

        Yields:
            Lines of output from both stdout and stderr
        """
        if not args:
            raise KubectlValidationError("No command specified")

        # Validate command
        command = args[0]
        if not validate_command(command):
            raise KubectlValidationError(f"Command '{command}' is not allowed")

        # Build full command
        cmd = self._build_base_command()

        ns = namespace or self.default_namespace
        if ns:
            if not validate_namespace(ns):
                raise KubectlValidationError(f"Namespace '{ns}' is not allowed")
            cmd.extend(["-n", ns])

        cmd.extend(args)

        # Execute with streaming
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            async def read_with_timeout():
                try:
                    async with asyncio.timeout(timeout or KUBECTL_TIMEOUT):
                        while True:
                            line = await process.stdout.readline()
                            if not line:
                                break
                            yield line.decode("utf-8").rstrip()
                except asyncio.TimeoutError:
                    process.kill()
                    yield f"[ERROR] Command timed out after {timeout or KUBECTL_TIMEOUT}s"

            async for line in read_with_timeout():
                yield line

            await process.wait()

        except Exception as e:
            yield f"[ERROR] {str(e)}"

    async def exec_in_pod(
        self,
        pod_name: str,
        command: list[str],
        namespace: Optional[str] = None,
        container: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Execute command in a pod and stream output.

        Args:
            pod_name: Name of the pod
            command: Command to execute as list of strings
            namespace: Pod namespace
            container: Container name (optional)
            timeout: Command timeout

        Yields:
            Lines of output
        """
        if not validate_pod_name(pod_name):
            raise KubectlValidationError(f"Invalid pod name: {pod_name}")

        args = ["exec", pod_name]
        if container:
            args.extend(["-c", container])
        args.append("--")
        args.extend(command)

        async for line in self.run_streaming(*args, namespace=namespace, timeout=timeout):
            yield line

    async def apply_file(self, filepath: str, namespace: Optional[str] = None) -> tuple[str, str, int]:
        """Apply a manifest file."""
        return await self.run("apply", "-f", filepath, namespace=namespace)

    async def delete_namespace(self, namespace: str, wait: bool = True) -> tuple[str, str, int]:
        """Delete a namespace."""
        if not validate_namespace(namespace):
            raise KubectlValidationError(f"Namespace '{namespace}' is not allowed")

        args = ["delete", "namespace", namespace]
        if wait:
            args.append("--wait=true")

        return await self.run(*args, namespace=None, timeout=300)

    async def get_pods(self, namespace: Optional[str] = None, output: str = "wide") -> tuple[str, str, int]:
        """Get pods in namespace."""
        return await self.run("get", "pods", "-o", output, namespace=namespace)

    async def get_cluster_info(self) -> dict:
        """Get cluster context name and connection status."""
        from pathlib import Path

        # Detect if running in-cluster
        in_cluster = Path("/var/run/secrets/kubernetes.io/serviceaccount/token").exists()

        context = "in-cluster" if in_cluster else "unknown"

        # If not in-cluster, try to get context name
        if not in_cluster and self.kubeconfig:
            try:
                cmd = self._build_base_command()
                cmd.extend(["config", "current-context"])
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5)
                if process.returncode == 0 and stdout:
                    context = stdout.decode("utf-8").strip()
            except Exception:
                pass

        # Test connection by getting namespace (simple check)
        try:
            cmd2 = self._build_base_command()
            cmd2.extend(["get", "namespace", "kube-system", "-o", "name"])
            process2 = await asyncio.create_subprocess_exec(
                *cmd2,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout2, stderr2 = await asyncio.wait_for(process2.communicate(), timeout=10)
            connected = process2.returncode == 0

            # Get node count
            node_count = 0
            if connected:
                cmd3 = self._build_base_command()
                cmd3.extend(["get", "nodes", "-o", "name"])
                process3 = await asyncio.create_subprocess_exec(
                    *cmd3,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout3, stderr3 = await asyncio.wait_for(process3.communicate(), timeout=10)
                if process3.returncode == 0 and stdout3:
                    lines = [l for l in stdout3.decode("utf-8").strip().split('\n') if l]
                    node_count = len(lines)

            return {
                "context": context,
                "connected": connected,
                "node_count": node_count,
            }
        except Exception as e:
            return {
                "context": context,
                "connected": False,
                "node_count": 0,
                "error": str(e),
            }

    async def wait_for_pods(
        self,
        namespace: Optional[str] = None,
        timeout: int = 120,
        condition: str = "Ready",
    ) -> tuple[str, str, int]:
        """Wait for all pods to be ready."""
        return await self.run(
            "wait",
            "--for=condition=" + condition,
            "pods",
            "--all",
            f"--timeout={timeout}s",
            namespace=namespace,
            timeout=timeout + 10,
        )
