"""Platform preparation - deploy demo namespace and pods."""

import os
from typing import AsyncGenerator

from app.core.kubectl import Kubectl
from app.core.neuvector_api import NeuVectorAPI, NeuVectorAPIError
from app.config import NAMESPACE, MANIFESTS_DIR, NEUVECTOR_API_URL, DEMO_IMAGE_REGISTRY

# NeuVector credentials (from environment or defaults)
NV_USERNAME = os.environ.get("NEUVECTOR_USERNAME", "admin")
NV_PASSWORD = os.environ.get("NEUVECTOR_PASSWORD", "Admin@123456")

# DLP Sensors to create during preparation
DLP_SENSORS = [
    {
        "name": "sensor.ssn",
        "comment": "Social Security Number detection",
        "rules": [
            {
                "name": "SSN",
                "patterns": [
                    {
                        "key": "pattern",
                        "op": "regex",
                        "value": r"\b\d{3}-\d{2}-\d{4}\b",
                        "context": "packet",
                    }
                ],
            }
        ],
    },
    {
        "name": "sensor.passeport",
        "comment": "French passport number detection",
        "rules": [
            {
                "name": "Passeport",
                "patterns": [
                    {
                        "key": "pattern",
                        "op": "regex",
                        "value": r"[0-9]{2}[A-Z]{2}[0-9]{5}",
                        "context": "packet",
                    }
                ],
            }
        ],
    },
]


def generate_demo_pods_manifest(image_registry: str, namespace: str = NAMESPACE) -> str:
    """Generate the demo pods manifest with configurable registry.

    Args:
        image_registry: The image registry to use (e.g., "localhost" or "myregistry.com/project")
        namespace: The namespace for the pods

    Returns:
        YAML manifest as string
    """
    # Determine image pull policy based on registry
    image_pull_policy = "Never" if image_registry == "localhost" else "IfNotPresent"

    return f"""---
# Forbidden namespace for Admission Control demo
apiVersion: v1
kind: Namespace
metadata:
  name: untrusted-namespace
  labels:
    demo: admission-control
    policy: forbidden
---
# Espion1 pod - OpenSUSE for running curl and network tests
apiVersion: v1
kind: Pod
metadata:
  name: espion1
  namespace: {namespace}
  labels:
    app: demo-test
    component: espion
spec:
  containers:
  - name: opensuse
    image: {image_registry}/demo-production1:latest
    imagePullPolicy: {image_pull_policy}
    resources:
      requests:
        memory: "64Mi"
        cpu: "50m"
      limits:
        memory: "128Mi"
        cpu: "200m"
---
# Cible1 pod - Nginx for receiving HTTP requests
apiVersion: v1
kind: Pod
metadata:
  name: cible1
  namespace: {namespace}
  labels:
    app: demo-test
    component: cible
spec:
  containers:
  - name: nginx
    image: {image_registry}/demo-web1:latest
    imagePullPolicy: {image_pull_policy}
    ports:
    - containerPort: 80
      name: http
    - containerPort: 22
      name: ssh
    resources:
      requests:
        memory: "32Mi"
        cpu: "25m"
      limits:
        memory: "64Mi"
        cpu: "100m"
---
# Service for espion1 pod (for internal cluster access)
apiVersion: v1
kind: Service
metadata:
  name: espion1
  namespace: {namespace}
  labels:
    app: demo-test
    component: espion
spec:
  selector:
    app: demo-test
    component: espion
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  type: ClusterIP
---
# Service for cible1 pod (for internal cluster access)
apiVersion: v1
kind: Service
metadata:
  name: cible1
  namespace: {namespace}
  labels:
    app: demo-test
    component: cible
spec:
  selector:
    app: demo-test
    component: cible
  ports:
  - port: 80
    targetPort: 80
    protocol: TCP
    name: http
  type: ClusterIP
"""


async def prepare_platform(
    kubectl: Kubectl,
    nv_username: str = None,
    nv_password: str = None,
    image_registry: str = None,
) -> AsyncGenerator[str, None]:
    """
    Prepare the demo platform by creating namespace and deploying test pods.

    Args:
        kubectl: Kubectl instance
        nv_username: Optional NeuVector username (uses env/default if not provided)
        nv_password: Optional NeuVector password (uses env/default if not provided)
        image_registry: Optional image registry (uses DEMO_IMAGE_REGISTRY env/default if not provided)

    Yields:
        Status messages during preparation
    """
    # Use provided credentials or fall back to env/defaults
    username = nv_username or NV_USERNAME
    password = nv_password or NV_PASSWORD
    registry = image_registry or DEMO_IMAGE_REGISTRY
    yield "[PREPARE] Starting platform preparation..."
    yield f"[INFO] Using image registry: {registry}"
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

    # Step 2: Apply demo pods manifest (generated with registry)
    yield "[STEP 2/4] Deploying test pods..."
    manifest_content = generate_demo_pods_manifest(registry, NAMESPACE)
    try:
        async for line in kubectl.apply_from_stdin(manifest_content, namespace=None):
            yield line
        yield "[OK] Demo pods deployed"
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

    # Step 4: Configure NeuVector (DLP sensors + Admission rule)
    yield "[STEP 4/6] Configuring NeuVector..."
    try:
        nv_api = NeuVectorAPI(
            base_url=NEUVECTOR_API_URL,
            username=username,
            password=password,
        )
        await nv_api.authenticate()

        # Create DLP sensors
        yield "[INFO] Creating DLP sensors..."
        existing_sensors = await nv_api.get_dlp_sensors()
        existing_names = {s.get("name") for s in existing_sensors}

        for sensor_config in DLP_SENSORS:
            sensor_name = sensor_config["name"]
            if sensor_name in existing_names:
                yield f"[OK] DLP sensor '{sensor_name}' already exists"
            else:
                try:
                    await nv_api.create_dlp_sensor(
                        name=sensor_name,
                        comment=sensor_config.get("comment", ""),
                        rules=sensor_config.get("rules", []),
                    )
                    yield f"[OK] DLP sensor '{sensor_name}' created"
                except NeuVectorAPIError as e:
                    yield f"[WARNING] Failed to create sensor '{sensor_name}': {e}"

        await nv_api.logout()
        await nv_api.close()
    except NeuVectorAPIError as e:
        yield f"[WARNING] Could not configure DLP sensors: {e}"
    except Exception as e:
        yield f"[WARNING] DLP sensor setup error: {e}"

    yield ""

    # Step 5: Create admission control rule
    yield "[STEP 5/6] Creating admission control rule..."
    try:
        nv_api = NeuVectorAPI(
            base_url=NEUVECTOR_API_URL,
            username=username,
            password=password,
        )
        await nv_api.authenticate()

        # Check if rule already exists for untrusted-namespace
        existing_rules = await nv_api.get_admission_rules()
        forbidden_ns = "untrusted-namespace"
        rule_exists = False

        for rule in existing_rules:
            criteria = rule.get("criteria", [])
            for criterion in criteria:
                if (criterion.get("name") == "namespace" and
                    forbidden_ns in criterion.get("value", "")):
                    rule_exists = True
                    break
            if rule_exists:
                break

        if rule_exists:
            yield f"[OK] Admission rule for '{forbidden_ns}' already exists"
        else:
            criteria = [
                {
                    "name": "namespace",
                    "op": "containsAny",
                    "value": forbidden_ns,
                }
            ]
            await nv_api.create_admission_rule(
                rule_type="deny",
                comment="Demo: Deny all deployments in untrusted-namespace",
                criteria=criteria,
                disable=False,
            )
            yield f"[OK] Admission rule created: deny deployments in '{forbidden_ns}'"

        await nv_api.logout()
        await nv_api.close()
    except NeuVectorAPIError as e:
        yield f"[WARNING] Could not create admission rule: {e}"
    except Exception as e:
        yield f"[WARNING] Admission rule setup error: {e}"

    yield ""

    # Step 6: Show final status
    yield "[STEP 6/6] Final status check..."
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
