"""Security Mode demo - configure NeuVector policy modes for demo workloads."""

from typing import Any, AsyncGenerator

from app.core.kubectl import Kubectl
from app.core.neuvector_api import NeuVectorAPI, NeuVectorAPIError
from app.config import NAMESPACE, NEUVECTOR_API_URL
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


@DemoRegistry.register
class SecurityModeDemo(DemoModule):
    """Demo to configure NeuVector security policy modes."""

    id = "security-mode"
    name = "Security Policy Mode"
    description = (
        "Configure NeuVector policy modes (Discover/Monitor/Protect) for demo workloads. "
        "Use this to demonstrate how NeuVector enforces security policies."
    )
    category = "Security"
    icon = "🛡️"

    @property
    def parameters(self) -> list[DemoParameter]:
        return [
            DemoParameter(
                name="nv_username",
                label="NeuVector Username",
                type="text",
                default="admin",
                required=True,
                help_text="NeuVector admin username",
            ),
            DemoParameter(
                name="nv_password",
                label="NeuVector Password",
                type="password",
                default="",
                required=True,
                placeholder="Enter password",
                help_text="NeuVector admin password",
            ),
            DemoParameter(
                name="policy_mode",
                label="Policy Mode",
                type="select",
                default="Monitor",
                required=True,
                options=[
                    {"value": "Discover", "label": "Discover (Learning)"},
                    {"value": "Monitor", "label": "Monitor (Alert only)"},
                    {"value": "Protect", "label": "Protect (Block)"},
                ],
                help_text="Security mode to apply to workloads",
            ),
            DemoParameter(
                name="target_group",
                label="Target Group",
                type="select",
                default="all",
                required=True,
                options=[
                    {"value": "all", "label": "All demo pods"},
                    {"value": f"nv.opensuse.{NAMESPACE}", "label": "opensuse"},
                    {"value": f"nv.nginx.{NAMESPACE}", "label": "nginx"},
                ],
                help_text="Which workload group(s) to configure",
            ),
        ]

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        username = params.get("nv_username", "admin")
        password = params.get("nv_password", "")
        policy_mode = params.get("policy_mode", "Monitor")
        target_group = params.get("target_group", "all")

        if not password:
            yield "[ERROR] NeuVector password is required"
            return

        yield "[INFO] Connecting to NeuVector API..."
        yield f"[INFO] API URL: {NEUVECTOR_API_URL}"
        yield ""

        # Create API client
        api = NeuVectorAPI(
            base_url=NEUVECTOR_API_URL,
            username=username,
            password=password,
        )

        try:
            # Authenticate
            await api.authenticate()
            yield "[OK] Authentication successful"
            yield ""

            # Get current state of demo groups
            yield "[STEP 1] Fetching current policy modes..."
            try:
                demo_groups = await api.get_demo_groups(namespace=NAMESPACE)

                if not demo_groups:
                    yield f"[WARNING] No workload groups found in namespace '{NAMESPACE}'"
                    yield "[INFO] Make sure you have run 'Prepare' to create demo pods"
                    yield ""
                else:
                    yield "[INFO] Current policy modes:"
                    for group in demo_groups:
                        name = group.get("name", "unknown")
                        mode = group.get("policy_mode", "unknown")
                        # Extract service name (middle part: nv.<service>.<namespace>)
                        parts = name.split(".")
                        short_name = parts[1] if len(parts) >= 2 else name
                        yield f"  - {short_name}: {mode}"
                    yield ""

            except NeuVectorAPIError as e:
                yield f"[WARNING] Could not fetch current groups: {e}"
                yield ""

            # Apply new policy mode
            yield f"[STEP 2] Applying '{policy_mode}' mode..."
            yield ""

            if target_group == "all":
                # Apply to all demo groups
                if not demo_groups:
                    yield "[ERROR] No demo groups to configure"
                    return

                success_count = 0
                error_count = 0

                for group in demo_groups:
                    group_name = group.get("name")
                    if not group_name:
                        continue

                    # Extract service name (middle part: nv.<service>.<namespace>)
                    parts = group_name.split(".")
                    short_name = parts[1] if len(parts) >= 2 else group_name

                    try:
                        await api.set_group_policy_mode(group_name, policy_mode)
                        yield f"[OK] {short_name} -> {policy_mode}"
                        success_count += 1
                    except NeuVectorAPIError as e:
                        yield f"[ERROR] {short_name}: {e}"
                        error_count += 1

                yield ""
                if error_count == 0:
                    yield f"[OK] Successfully updated {success_count} group(s)"
                else:
                    yield f"[WARNING] Updated {success_count} group(s), {error_count} error(s)"

            else:
                # Apply to specific group
                # Extract service name (middle part: nv.<service>.<namespace>)
                parts = target_group.split(".")
                short_name = parts[1] if len(parts) >= 2 else target_group

                try:
                    await api.set_group_policy_mode(target_group, policy_mode)
                    yield f"[OK] {short_name} -> {policy_mode}"
                    yield ""
                    yield f"[OK] Successfully updated policy mode"
                except NeuVectorAPIError as e:
                    yield f"[ERROR] Failed to update {short_name}: {e}"
                    return

            yield ""
            yield "[INFO] Policy mode update complete"
            yield ""
            yield "[INFO] Policy Mode Effects:"
            if policy_mode == "Discover":
                yield "  - NeuVector is learning normal behavior"
                yield "  - All connections and processes are allowed"
                yield "  - Baseline rules are being created automatically"
            elif policy_mode == "Monitor":
                yield "  - Violations are logged but not blocked"
                yield "  - Check NeuVector console for security events"
                yield "  - Good for testing before enforcing"
            else:  # Protect
                yield "  - Unauthorized connections will be BLOCKED"
                yield "  - Only learned/allowed behaviors permitted"
                yield "  - Check NeuVector console for violations"
            yield ""
            yield "[INFO] Run 'Network Connectivity' or 'DLP Scanner' demos to test the policy"

        except NeuVectorAPIError as e:
            yield f"[ERROR] NeuVector API error: {e}"
            return

        finally:
            # Always logout to release session
            try:
                await api.logout()
            except Exception:
                pass
            await api.close()
