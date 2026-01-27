"""Platform preparation - deploy demo namespace and pods."""

from typing import AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE, MANIFESTS_DIR


async def prepare_platform(kubectl: Kubectl) -> AsyncGenerator[str, None]:
    """
    Prepare the demo platform by creating namespace and deploying test pods.

    Yields:
        Status messages during preparation
    """
    yield "[PREPARE] Starting platform preparation..."
    yield ""

    # Step 1: Create namespace
    yield f"[STEP 1/4] Creating namespace '{NAMESPACE}'..."
    try:
        stdout, stderr, rc = await kubectl.run(
            "create", "namespace", NAMESPACE,
            namespace=None,
            check=False,
        )
        if rc == 0:
            yield f"[OK] Namespace '{NAMESPACE}' created"
        elif "already exists" in stderr:
            yield f"[OK] Namespace '{NAMESPACE}' already exists"
        else:
            yield f"[WARNING] {stderr.strip()}"
    except Exception as e:
        yield f"[ERROR] Failed to create namespace: {e}"
        return

    yield ""

    # Step 2: Apply demo pods manifest
    yield "[STEP 2/4] Deploying test pods..."
    manifest_path = str(MANIFESTS_DIR / "demo-pods.yaml")
    try:
        stdout, stderr, rc = await kubectl.run(
            "apply", "-f", manifest_path,
            namespace=NAMESPACE,
            check=False,
        )
        if rc == 0:
            for line in stdout.strip().split("\n"):
                if line:
                    yield f"[OK] {line}"
        else:
            yield f"[ERROR] {stderr.strip()}"
            return
    except Exception as e:
        yield f"[ERROR] Failed to deploy pods: {e}"
        return

    yield ""

    # Step 3: Wait for pods to be ready
    yield "[STEP 3/4] Waiting for pods to be ready (timeout: 120s)..."
    try:
        stdout, stderr, rc = await kubectl.run(
            "wait", "--for=condition=Ready", "pods", "--all",
            "--timeout=120s",
            namespace=NAMESPACE,
            timeout=130,
            check=False,
        )
        if rc == 0:
            for line in stdout.strip().split("\n"):
                if line:
                    yield f"[OK] {line}"
        else:
            yield f"[WARNING] Some pods may not be ready: {stderr.strip()}"
    except Exception as e:
        yield f"[WARNING] Wait timeout: {e}"

    yield ""

    # Step 4: Show final status
    yield "[STEP 4/4] Final status check..."
    try:
        stdout, stderr, rc = await kubectl.run(
            "get", "pods", "-o", "wide",
            namespace=NAMESPACE,
            check=False,
        )
        yield ""
        yield "Current pods:"
        for line in stdout.strip().split("\n"):
            yield f"  {line}"
    except Exception as e:
        yield f"[WARNING] Could not get pod status: {e}"

    yield ""
    yield "[PREPARE] Platform preparation complete!"
    yield "[INFO] You can now run demos using the test pods"
