"""
Sigstore Image Signature Verification demo.

Demonstrates NeuVector's ability to verify container image signatures
using Sigstore/Cosign. A signed image can be deployed while an unsigned
image is blocked by admission control.

Prerequisites:
1. demo-registry running in neuvector-demo namespace (NodePort 30500)
2. demo-signed:latest and demo-unsigned:latest images pushed to registry
3. demo-signed:latest signed with cosign keypair
"""

from typing import Any, AsyncGenerator
from pathlib import Path

from app.core.kubectl import Kubectl
from app.config import NAMESPACE
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


REGISTRY_URL = "localhost:30500"
ROOT_OF_TRUST_NAME = "demo-root"
VERIFIER_NAME = "cosign-demo"

# Cosign public key (embedded)
COSIGN_PUBLIC_KEY = (Path(__file__).parent.parent.parent / "sigstore" / "cosign.pub").read_text().strip()


@DemoRegistry.register
class SigstoreDemo(DemoModule):
    """
    Demo for Sigstore image signature verification with NeuVector.
    """

    id = "sigstore"
    name = "Image Signature Verification"
    description = "Verify container image signatures using Sigstore/Cosign."
    category = "Supply Chain"
    icon = "🔏"

    @property
    def parameters(self) -> list[DemoParameter]:
        return [
            DemoParameter(
                name="action",
                label="Action",
                type="select",
                default="deploy_signed",
                options=[
                    {"value": "setup", "label": "Setup Sigstore"},
                    {"value": "deploy_signed", "label": "Deploy Signed Image"},
                    {"value": "deploy_unsigned", "label": "Deploy Unsigned Image"},
                    {"value": "cleanup", "label": "Cleanup"},
                ],
                help_text="Action to perform",
            ),
            DemoParameter(
                name="namespace",
                label="Namespace",
                type="select",
                default=NAMESPACE,
                options=[
                    {"value": NAMESPACE, "label": NAMESPACE},
                ],
                help_text="Target namespace",
            ),
            DemoParameter(
                name="pod_name",
                label="Pod Name",
                type="text",
                default="test-sigstore",
                help_text="Name of the test pod",
            ),
        ]

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        action = params.get("action", "deploy_signed")
        namespace = params.get("namespace", NAMESPACE)
        pod_name = params.get("pod_name", "test-sigstore")
        nv_username = params.get("nv_username", "admin")
        nv_password = params.get("nv_password", "")

        if action == "setup":
            async for line in self._setup(kubectl, nv_username, nv_password):
                yield line
        elif action == "deploy_signed":
            async for line in self._deploy(kubectl, namespace, pod_name, signed=True):
                yield line
        elif action == "deploy_unsigned":
            async for line in self._deploy(kubectl, namespace, pod_name, signed=False):
                yield line
        elif action == "cleanup":
            async for line in self._cleanup(kubectl, namespace, pod_name, nv_username, nv_password):
                yield line

    async def _setup(self, kubectl: Kubectl, username: str, password: str) -> AsyncGenerator[str, None]:
        """Set up Sigstore root of trust, verifier, and admission rule."""
        from app.core.neuvector_api import NeuVectorAPI
        from app.config import NEUVECTOR_API_URL

        yield "[STEP 1/4] Creating Sigstore Root of Trust..."

        api = NeuVectorAPI(base_url=NEUVECTOR_API_URL, username=username, password=password)
        try:
            await api.authenticate()

            # Create root of trust
            try:
                await api.create_root_of_trust(
                    name=ROOT_OF_TRUST_NAME,
                    is_private=False,
                    rootless_keypairs_only=True,
                    comment="Demo root of trust for Sigstore verification",
                )
                yield f"[OK] Root of Trust '{ROOT_OF_TRUST_NAME}' created"
            except Exception as e:
                if "already" in str(e).lower() or "409" in str(e):
                    yield f"[INFO] Root of Trust '{ROOT_OF_TRUST_NAME}' already exists"
                else:
                    yield f"[ERROR] Failed to create Root of Trust: {e}"
                    return

            # Create verifier
            yield "[STEP 2/4] Creating Cosign Verifier..."
            try:
                await api.create_verifier(
                    root_name=ROOT_OF_TRUST_NAME,
                    name=VERIFIER_NAME,
                    verifier_type="keypair",
                    public_key=COSIGN_PUBLIC_KEY,
                    comment="Cosign keypair verifier for demo",
                )
                yield f"[OK] Verifier '{VERIFIER_NAME}' created with public key"
            except Exception as e:
                if "already" in str(e).lower() or "409" in str(e):
                    yield f"[INFO] Verifier '{VERIFIER_NAME}' already exists"
                else:
                    yield f"[ERROR] Failed to create Verifier: {e}"
                    return

            # Create admission control deny rule for unsigned images
            yield "[STEP 3/4] Creating Admission Control rule..."
            try:
                verifier_path = f"{ROOT_OF_TRUST_NAME}/{VERIFIER_NAME}"
                await api.create_admission_rule(
                    rule_type="deny",
                    comment=f"[Demo] Deny images not signed by {verifier_path}",
                    criteria=[
                        {
                            "name": "imageSigned",
                            "op": "=",
                            "value": "false",
                        }
                    ],
                )
                yield "[OK] Admission rule created: deny unsigned images"
            except Exception as e:
                yield f"[WARNING] Admission rule may already exist: {e}"

            # Enable admission control in protect mode
            yield "[STEP 4/4] Enabling Admission Control in Protect mode..."
            try:
                await api.set_admission_state(enable=True, mode="protect")
                yield "[OK] Admission Control enabled in Protect mode"
            except Exception as e:
                yield f"[WARNING] Could not set admission state: {e}"

            yield ""
            yield "[OK] Sigstore setup complete! You can now test with signed and unsigned images."

            await api.logout()
            await api.close()

        except Exception as e:
            yield f"[ERROR] Setup failed: {e}"
            await api.close()

    async def _deploy(self, kubectl: Kubectl, namespace: str, pod_name: str, signed: bool) -> AsyncGenerator[str, None]:
        """Deploy a pod with a signed or unsigned image."""
        image_name = "demo-signed" if signed else "demo-unsigned"
        image_ref = f"{REGISTRY_URL}/{image_name}:latest"
        status = "SIGNED" if signed else "UNSIGNED"

        yield f"[STEP 1/2] Deploying {status} image: {image_ref}"
        yield f"[CMD] kubectl run {pod_name} --image={image_ref} -n {namespace}"

        # Delete existing pod if any
        try:
            async for _ in kubectl.delete_pod(pod_name, namespace=namespace):
                pass
        except Exception:
            pass

        # Create the pod
        yield f"[STEP 2/2] Creating pod '{pod_name}'..."
        success = False
        try:
            async for line in kubectl.run_streaming(
                "run", pod_name,
                f"--image={image_ref}",
                "--restart=Never",
                "--command", "--", "sleep", "300",
                namespace=namespace,
            ):
                yield line
                if "created" in line.lower():
                    success = True
                if "denied" in line.lower() or "admission" in line.lower():
                    success = False
        except Exception as e:
            err_msg = str(e).lower()
            if "denied" in err_msg or "admission" in err_msg:
                success = False
                yield f"[BLOCKED] {e}"
            else:
                yield f"[ERROR] {e}"

        yield ""
        if signed:
            if success:
                yield f"[OK] Signed image deployed successfully! Pod '{pod_name}' is running."
            else:
                yield f"[ERROR] Signed image was unexpectedly blocked. Check Sigstore setup."
        else:
            if success:
                yield f"[WARNING] Unsigned image was NOT blocked! Admission control may not be configured."
            else:
                yield f"[OK] Unsigned image was BLOCKED by admission control! NeuVector verified the signature."

    async def _cleanup(self, kubectl: Kubectl, namespace: str, pod_name: str, username: str, password: str) -> AsyncGenerator[str, None]:
        """Clean up Sigstore demo resources."""
        from app.core.neuvector_api import NeuVectorAPI
        from app.config import NEUVECTOR_API_URL

        yield "[STEP 1/3] Deleting test pods..."
        for pname in [pod_name, f"{pod_name}-unsigned"]:
            try:
                async for line in kubectl.delete_pod(pname, namespace=namespace):
                    yield line
            except Exception:
                pass

        yield "[STEP 2/3] Removing Sigstore configuration..."
        api = NeuVectorAPI(base_url=NEUVECTOR_API_URL, username=username, password=password)
        try:
            await api.authenticate()

            # Delete verifier
            try:
                await api.delete_verifier(ROOT_OF_TRUST_NAME, VERIFIER_NAME)
                yield f"[OK] Verifier '{VERIFIER_NAME}' deleted"
            except Exception:
                yield f"[INFO] Verifier '{VERIFIER_NAME}' not found"

            # Delete root of trust
            try:
                await api.delete_root_of_trust(ROOT_OF_TRUST_NAME)
                yield f"[OK] Root of Trust '{ROOT_OF_TRUST_NAME}' deleted"
            except Exception:
                yield f"[INFO] Root of Trust '{ROOT_OF_TRUST_NAME}' not found"

            await api.logout()
            await api.close()
        except Exception as e:
            yield f"[WARNING] Could not clean NeuVector config: {e}"
            await api.close()

        yield "[STEP 3/3] Removing admission rules..."
        # Note: we don't delete admission rules automatically to avoid removing user rules
        yield "[INFO] Admission rules should be removed manually if needed"

        yield ""
        yield "[OK] Sigstore cleanup complete."
