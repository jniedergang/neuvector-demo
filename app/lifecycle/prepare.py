"""Platform preparation - deploy demo namespace and pods."""

import os
from typing import AsyncGenerator

from app.core.kubectl import Kubectl
from app.core.neuvector_api import NeuVectorAPI, NeuVectorAPIError
from app.config import NAMESPACE, MANIFESTS_DIR, NEUVECTOR_API_URL

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

    # Step 4: Configure NeuVector (DLP sensors + Admission rule)
    yield "[STEP 4/6] Configuring NeuVector..."
    try:
        nv_api = NeuVectorAPI(
            base_url=NEUVECTOR_API_URL,
            username=NV_USERNAME,
            password=NV_PASSWORD,
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
            username=NV_USERNAME,
            password=NV_PASSWORD,
        )
        await nv_api.authenticate()

        # Check if rule already exists for forbidden-namespace1
        existing_rules = await nv_api.get_admission_rules()
        forbidden_ns = "forbidden-namespace1"
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
                comment="Demo: Deny all deployments in forbidden-namespace1",
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
