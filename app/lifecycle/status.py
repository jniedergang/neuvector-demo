"""Platform status check."""

from typing import AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE, NEUVECTOR_NAMESPACE


async def get_status(kubectl: Kubectl) -> AsyncGenerator[str, None]:
    """
    Check the status of the demo platform.

    Yields:
        Status information
    """
    yield "[STATUS] Checking platform status..."
    yield ""

    # Check demo namespace
    yield f"[CHECK] Demo namespace '{NAMESPACE}':"
    try:
        stdout, stderr, rc = await kubectl.run(
            "get", "namespace", NAMESPACE,
            namespace=None,
            check=False,
        )
        if rc == 0:
            yield f"  [OK] Namespace exists"

            # Get pods in demo namespace
            stdout, stderr, rc = await kubectl.run(
                "get", "pods", "-o", "wide",
                namespace=NAMESPACE,
                check=False,
            )
            if stdout.strip():
                yield ""
                yield f"  Pods in {NAMESPACE}:"
                for line in stdout.strip().split("\n"):
                    yield f"    {line}"
            else:
                yield "  [WARNING] No pods found in namespace"
        else:
            yield f"  [NOT READY] Namespace does not exist"
            yield "  [INFO] Run 'Prepare' to create the demo environment"
    except Exception as e:
        yield f"  [ERROR] {e}"

    yield ""

    # Check NeuVector namespace
    yield f"[CHECK] NeuVector namespace '{NEUVECTOR_NAMESPACE}':"
    try:
        stdout, stderr, rc = await kubectl.run(
            "get", "pods", "-o", "wide",
            namespace=NEUVECTOR_NAMESPACE,
            check=False,
        )
        if rc == 0 and stdout.strip():
            yield f"  [OK] NeuVector pods:"
            for line in stdout.strip().split("\n"):
                yield f"    {line}"
        else:
            yield f"  [WARNING] No NeuVector pods found"
            yield "  [INFO] Ensure NeuVector is installed in the cluster"
    except Exception as e:
        yield f"  [ERROR] {e}"

    yield ""

    # Check cluster connectivity
    yield "[CHECK] Cluster connectivity:"
    try:
        stdout, stderr, rc = await kubectl.run(
            "get", "nodes", "-o", "wide",
            namespace=None,
            check=False,
        )
        if rc == 0:
            yield "  [OK] Cluster accessible"
            yield ""
            yield "  Nodes:"
            for line in stdout.strip().split("\n"):
                yield f"    {line}"
        else:
            yield f"  [ERROR] Cannot connect to cluster: {stderr.strip()}"
    except Exception as e:
        yield f"  [ERROR] {e}"

    yield ""
    yield "[STATUS] Status check complete"
