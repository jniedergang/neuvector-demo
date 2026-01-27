"""Platform reset - clean up demo resources."""

from typing import AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE

# Demo pods to delete (not the demo-web itself)
DEMO_PODS = ["production1", "web1"]
DEMO_SERVICES = ["web1"]


async def reset_platform(kubectl: Kubectl) -> AsyncGenerator[str, None]:
    """
    Reset the demo platform by removing demo test pods (not the web UI).

    Yields:
        Status messages during reset
    """
    yield "[RESET] Starting platform reset..."
    yield ""

    # Step 1: Check if namespace exists
    yield f"[STEP 1/3] Checking namespace '{NAMESPACE}'..."
    try:
        stdout, stderr, rc = await kubectl.run(
            "get", "namespace", NAMESPACE,
            namespace=None,
            check=False,
        )
        if rc != 0:
            yield f"[OK] Namespace '{NAMESPACE}' does not exist, nothing to clean"
            yield ""
            yield "[RESET] Reset complete (nothing to do)"
            return
        yield f"[OK] Namespace '{NAMESPACE}' found"
    except Exception as e:
        yield f"[ERROR] Failed to check namespace: {e}"
        return

    yield ""

    # Step 2: List demo pods
    yield "[STEP 2/3] Checking demo resources..."
    pods_to_delete = []
    services_to_delete = []

    for pod_name in DEMO_PODS:
        try:
            stdout, stderr, rc = await kubectl.run(
                "get", "pod", pod_name,
                namespace=NAMESPACE,
                check=False,
            )
            if rc == 0:
                pods_to_delete.append(pod_name)
                yield f"  [FOUND] Pod: {pod_name}"
        except Exception:
            pass

    for svc_name in DEMO_SERVICES:
        try:
            stdout, stderr, rc = await kubectl.run(
                "get", "service", svc_name,
                namespace=NAMESPACE,
                check=False,
            )
            if rc == 0:
                services_to_delete.append(svc_name)
                yield f"  [FOUND] Service: {svc_name}"
        except Exception:
            pass

    if not pods_to_delete and not services_to_delete:
        yield "  [INFO] No demo resources found"
        yield ""
        yield "[RESET] Reset complete (nothing to do)"
        return

    yield ""

    # Step 3: Delete demo resources
    yield "[STEP 3/3] Deleting demo resources..."

    # Delete pods
    for pod_name in pods_to_delete:
        try:
            stdout, stderr, rc = await kubectl.run(
                "delete", "pod", pod_name,
                "--wait=true",
                namespace=NAMESPACE,
                timeout=60,
                check=False,
            )
            if rc == 0:
                yield f"  [OK] Deleted pod: {pod_name}"
            else:
                yield f"  [ERROR] Failed to delete pod {pod_name}: {stderr.strip()}"
        except Exception as e:
            yield f"  [ERROR] Failed to delete pod {pod_name}: {e}"

    # Delete services
    for svc_name in services_to_delete:
        try:
            stdout, stderr, rc = await kubectl.run(
                "delete", "service", svc_name,
                namespace=NAMESPACE,
                timeout=30,
                check=False,
            )
            if rc == 0:
                yield f"  [OK] Deleted service: {svc_name}"
            else:
                yield f"  [ERROR] Failed to delete service {svc_name}: {stderr.strip()}"
        except Exception as e:
            yield f"  [ERROR] Failed to delete service {svc_name}: {e}"

    yield ""
    yield "[RESET] Platform reset complete!"
    yield "[INFO] Demo test pods have been removed"
    yield "[INFO] Run 'Prepare' to set up the demo pods again"
