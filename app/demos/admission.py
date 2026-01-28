"""
Admission Control demo - test NeuVector admission control rules.

This demo creates/deletes pods in different namespaces to test
NeuVector admission control rules blocking resource creation.

Prerequisites:
1. NeuVector admission control must be enabled
2. An admission rule must be configured to block creation in forbidden_namespace1
"""

from typing import Any, AsyncGenerator

from app.core.kubectl import Kubectl
from app.config import NAMESPACE
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


FORBIDDEN_NAMESPACE = "forbidden-namespace1"
ALLOWED_NAMESPACE = NAMESPACE  # neuvector-demo


@DemoRegistry.register
class AdmissionControlDemo(DemoModule):
    """
    Demo to test NeuVector Admission Control rules.

    Creates a test pod in selected namespace. When the forbidden namespace
    is selected, NeuVector admission control should block the creation.
    """

    id = "admission"
    name = "Admission Control"
    description = "Test NeuVector admission control rules by creating pods in allowed/forbidden namespaces."
    category = "Admission"
    icon = "🚫"

    @property
    def parameters(self) -> list[DemoParameter]:
        return [
            DemoParameter(
                name="action",
                label="Action",
                type="select",
                default="create",
                required=True,
                options=[
                    {"value": "create", "label": "Create Pod"},
                    {"value": "delete", "label": "Delete Pod"},
                    {"value": "status", "label": "Check Status"},
                ],
                help_text="Action to perform on test pod",
            ),
            DemoParameter(
                name="namespace",
                label="Target Namespace",
                type="select",
                default=ALLOWED_NAMESPACE,
                required=True,
                options=[
                    {"value": ALLOWED_NAMESPACE, "label": f"Allowed ({ALLOWED_NAMESPACE})"},
                    {"value": FORBIDDEN_NAMESPACE, "label": f"Forbidden ({FORBIDDEN_NAMESPACE})"},
                ],
                help_text="Namespace where to create the pod",
            ),
            DemoParameter(
                name="pod_name",
                label="Pod Name",
                type="text",
                default="test-admission-pod",
                required=True,
                placeholder="Pod name",
                help_text="Name of the test pod to create/delete",
            ),
        ]

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        action = params.get("action", "create")
        namespace = params.get("namespace", ALLOWED_NAMESPACE)
        pod_name = params.get("pod_name", "test-admission-pod")

        yield f"[INFO] Admission Control Test"
        yield f"[INFO] Action: {action}"
        yield f"[INFO] Namespace: {namespace}"
        yield f"[INFO] Pod: {pod_name}"
        yield ""

        if action == "create":
            async for line in self._create_pod(kubectl, namespace, pod_name):
                yield line
        elif action == "delete":
            async for line in self._delete_pod(kubectl, namespace, pod_name):
                yield line
        elif action == "status":
            async for line in self._check_status(kubectl, namespace, pod_name):
                yield line
        else:
            yield f"[ERROR] Unknown action: {action}"

    async def _create_pod(
        self,
        kubectl: Kubectl,
        namespace: str,
        pod_name: str,
    ) -> AsyncGenerator[str, None]:
        """Create a test pod."""
        yield f"[CMD] Creating pod '{pod_name}' in namespace '{namespace}'..."
        yield ""

        # Simple pod manifest
        pod_yaml = f"""apiVersion: v1
kind: Pod
metadata:
  name: {pod_name}
  namespace: {namespace}
  labels:
    app: admission-test
spec:
  containers:
  - name: nginx
    image: nginx:alpine
    resources:
      limits:
        memory: "64Mi"
        cpu: "100m"
"""

        try:
            # Apply the pod manifest
            async for line in kubectl.apply_from_stdin(pod_yaml, namespace):
                yield line

            yield ""
            yield f"[OK] Pod '{pod_name}' created successfully in '{namespace}'"
            yield "[INFO] Admission control ALLOWED this resource creation"

        except Exception as e:
            error_str = str(e).lower()
            yield f"[ERROR] {str(e)}"

            # Check if this is an admission control denial
            if "admission" in error_str or "denied" in error_str or "blocked" in error_str:
                yield ""
                yield "[BLOCKED] Admission control DENIED this resource creation!"
                yield "[INFO] Check SUSE Security Events for admission violation details"
                raise Exception("Admission control blocked pod creation")
            else:
                yield ""
                yield "[ERROR] Pod creation failed (not admission-related)"

    async def _delete_pod(
        self,
        kubectl: Kubectl,
        namespace: str,
        pod_name: str,
    ) -> AsyncGenerator[str, None]:
        """Delete a test pod."""
        yield f"[CMD] Deleting pod '{pod_name}' from namespace '{namespace}'..."
        yield ""

        try:
            async for line in kubectl.delete_pod(pod_name, namespace):
                yield line

            yield ""
            yield f"[OK] Pod '{pod_name}' deleted from '{namespace}'"

        except Exception as e:
            yield f"[ERROR] {str(e)}"

    async def _check_status(
        self,
        kubectl: Kubectl,
        namespace: str,
        pod_name: str,
    ) -> AsyncGenerator[str, None]:
        """Check pod status."""
        yield f"[CMD] Checking pod '{pod_name}' in namespace '{namespace}'..."
        yield ""

        try:
            async for line in kubectl.get_pod_status(pod_name, namespace):
                yield line

        except Exception as e:
            if "not found" in str(e).lower():
                yield f"[INFO] Pod '{pod_name}' not found in '{namespace}'"
            else:
                yield f"[ERROR] {str(e)}"
