"""NeuVector REST API client for security policy management."""

import ssl
from typing import Any, Optional

import httpx


class NeuVectorAPIError(Exception):
    """Exception for NeuVector API errors."""
    pass


class NeuVectorAPI:
    """Async client for NeuVector REST API."""

    def __init__(
        self,
        base_url: str,
        username: str,
        password: str,
        verify_ssl: bool = False,
    ):
        """
        Initialize NeuVector API client.

        Args:
            base_url: NeuVector controller API URL (e.g., https://controller:10443)
            username: NeuVector username
            password: NeuVector password
            verify_ssl: Whether to verify SSL certificates (default False for self-signed)
        """
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.verify_ssl = verify_ssl
        self.token: Optional[str] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                verify=self.verify_ssl,
                timeout=30.0,
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _auth_headers(self) -> dict[str, str]:
        """Get headers with authentication token."""
        if not self.token:
            raise NeuVectorAPIError("Not authenticated - call authenticate() first")
        return {
            "Content-Type": "application/json",
            "X-Auth-Token": self.token,
        }

    async def authenticate(self) -> str:
        """
        Authenticate with NeuVector API.

        Returns:
            Authentication token

        Raises:
            NeuVectorAPIError: If authentication fails
        """
        client = await self._get_client()

        payload = {
            "password": {
                "username": self.username,
                "password": self.password,
            }
        }

        try:
            response = await client.post(
                "/v1/auth",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code != 200:
                error_msg = f"Authentication failed: {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        error_msg = f"Authentication failed: {error_data['error']}"
                except Exception:
                    pass
                raise NeuVectorAPIError(error_msg)

            data = response.json()
            self.token = data.get("token", {}).get("token")
            if not self.token:
                raise NeuVectorAPIError("No token in authentication response")

            return self.token

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def logout(self):
        """
        Logout and release the session.

        Raises:
            NeuVectorAPIError: If logout fails
        """
        if not self.token:
            return

        client = await self._get_client()

        try:
            await client.delete(
                "/v1/auth",
                headers=self._auth_headers(),
            )
        except Exception:
            pass  # Ignore logout errors
        finally:
            self.token = None

    async def get_groups(self, scope: str = "local") -> list[dict[str, Any]]:
        """
        Get all workload groups.

        Args:
            scope: Scope filter ("local", "fed", or empty for all)

        Returns:
            List of group objects

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            params = {}
            if scope:
                params["scope"] = scope

            response = await client.get(
                "/v1/group",
                headers=self._auth_headers(),
                params=params,
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get groups: {response.status_code}")

            data = response.json()
            return data.get("groups", [])

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_group(self, group_name: str) -> dict[str, Any]:
        """
        Get a specific group by name.

        Args:
            group_name: Name of the group

        Returns:
            Group object

        Raises:
            NeuVectorAPIError: If request fails or group not found
        """
        client = await self._get_client()

        try:
            response = await client.get(
                f"/v1/group/{group_name}",
                headers=self._auth_headers(),
            )

            if response.status_code == 404:
                raise NeuVectorAPIError(f"Group not found: {group_name}")
            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get group: {response.status_code}")

            data = response.json()
            return data.get("group", {})

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_process_profile(self, group_name: str) -> dict[str, Any]:
        """
        Get process profile rules for a group.

        Args:
            group_name: Name of the group (e.g., "nv.opensuse.neuvector-demo")

        Returns:
            Process profile object with process_list

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                f"/v1/process_profile/{group_name}",
                headers=self._auth_headers(),
            )

            if response.status_code == 404:
                raise NeuVectorAPIError(f"Process profile not found: {group_name}")
            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get process profile: {response.status_code}")

            data = response.json()
            return data.get("process_profile", {})

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def delete_process_rule(
        self,
        group_name: str,
        process_name: str,
        process_path: str,
    ) -> dict[str, Any]:
        """
        Delete a process rule from the process profile.

        Args:
            group_name: Name of the group (e.g., "nv.opensuse.neuvector-demo")
            process_name: Name of the process to delete
            process_path: Path of the process to delete

        Returns:
            Result of the delete operation

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            # NeuVector API uses PATCH with delete_process_rules array
            payload = {
                "process_profile_config": {
                    "group": group_name,
                    "process_delete_list": [
                        {
                            "name": process_name,
                            "path": process_path,
                        }
                    ]
                }
            }

            response = await client.patch(
                f"/v1/process_profile/{group_name}",
                json=payload,
                headers=self._auth_headers(),
            )

            if response.status_code not in (200, 204):
                error_msg = f"Failed to delete process rule: {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        error_msg = f"Failed to delete process rule: {error_data['error']}"
                except Exception:
                    pass
                raise NeuVectorAPIError(error_msg)

            return {"success": True, "group": group_name, "deleted": process_name}

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def set_group_policy_mode(
        self,
        group_name: str,
        policy_mode: str,
        baseline_profile: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Set the policy mode for a group.

        Args:
            group_name: Name of the group (e.g., "nv.opensuse.neuvector-demo")
            policy_mode: Policy mode ("Discover", "Monitor", or "Protect")
            baseline_profile: Optional baseline profile ("basic" or "zero-drift")

        Returns:
            Updated group configuration

        Raises:
            NeuVectorAPIError: If request fails
        """
        if policy_mode not in ("Discover", "Monitor", "Protect"):
            raise NeuVectorAPIError(f"Invalid policy mode: {policy_mode}")

        client = await self._get_client()

        # Convert group name (nv.<service>.<namespace>) to service name (<service>.<namespace>)
        if group_name.startswith("nv."):
            service_name = group_name[3:]  # Remove "nv." prefix
        else:
            service_name = group_name

        payload = {
            "config": {
                "policy_mode": policy_mode,
                "services": [service_name],
            }
        }

        try:
            response = await client.patch(
                "/v1/service/config",
                json=payload,
                headers=self._auth_headers(),
            )

            if response.status_code not in (200, 204):
                error_msg = f"Failed to update service: {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        error_msg = f"Failed to update service: {error_data['error']}"
                except Exception:
                    pass
                raise NeuVectorAPIError(error_msg)

            return {"success": True, "group": group_name, "policy_mode": policy_mode}

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_demo_groups(self, namespace: str = "neuvector-demo") -> list[dict[str, Any]]:
        """
        Get groups related to demo workloads.

        Args:
            namespace: Namespace to filter groups

        Returns:
            List of demo-related groups
        """
        all_groups = await self.get_groups()

        # Filter for groups in the demo namespace
        # NeuVector group names follow pattern: nv.<service>.<namespace>
        suffix = f".{namespace}"
        demo_groups = [
            g for g in all_groups
            if g.get("name", "").startswith("nv.") and g.get("name", "").endswith(suffix)
        ]

        return demo_groups

    async def get_recent_incidents(
        self,
        group_name: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Get recent process/file incidents (security events).

        Args:
            group_name: Optional group name to filter (e.g., "nv.opensuse.neuvector-demo")
            limit: Maximum number of incidents to return

        Returns:
            List of incident objects

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                "/v1/log/incident",
                headers=self._auth_headers(),
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get incidents: {response.status_code}")

            data = response.json()
            incidents = data.get("incidents", [])

            # Filter by group name if provided - use flexible matching
            if group_name:
                # Extract service name from group (nv.opensuse.neuvector-demo -> opensuse)
                service = group_name.replace("nv.", "").split(".")[0] if group_name.startswith("nv.") else group_name
                # Also filter for neuvector-demo namespace
                incidents = [
                    i for i in incidents
                    if (service in i.get("workload_name", "") or
                        service in i.get("group", "") or
                        "neuvector-demo" in i.get("workload_domain", ""))
                ]

            # Sort by time (most recent first) and limit
            incidents = sorted(incidents, key=lambda x: x.get("reported_at", ""), reverse=True)
            return incidents[:limit]

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_recent_violations(
        self,
        group_name: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Get recent network policy violations.

        Args:
            group_name: Optional group name to filter
            limit: Maximum number of violations to return

        Returns:
            List of violation objects

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                "/v1/log/violation",
                headers=self._auth_headers(),
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get violations: {response.status_code}")

            data = response.json()
            violations = data.get("violations", [])

            # Filter by group name if provided - use flexible matching
            if group_name:
                # Extract service name from group
                service = group_name.replace("nv.", "").split(".")[0] if group_name.startswith("nv.") else group_name
                violations = [
                    v for v in violations
                    if (service in v.get("client_name", "") or
                        service in v.get("server_name", "") or
                        service in v.get("group", "") or
                        "neuvector-demo" in v.get("client_domain", "") or
                        "neuvector-demo" in v.get("server_domain", ""))
                ]

            # Sort by time (most recent first) and limit
            violations = sorted(violations, key=lambda x: x.get("reported_at", ""), reverse=True)
            return violations[:limit]

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_dlp_sensors(self) -> list[dict[str, Any]]:
        """
        Get all DLP sensors.

        Returns:
            List of DLP sensor objects

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                "/v1/dlp/sensor",
                headers=self._auth_headers(),
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get DLP sensors: {response.status_code}")

            data = response.json()
            return data.get("sensors", [])

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_group_dlp_config(self, group_name: str) -> dict[str, Any]:
        """
        Get DLP configuration for a group.

        Args:
            group_name: Name of the group (e.g., "nv.production1.neuvector-demo")

        Returns:
            DLP configuration object with sensors list

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                f"/v1/dlp/group/{group_name}",
                headers=self._auth_headers(),
            )

            if response.status_code == 404:
                # Group has no DLP config yet, return empty
                return {"sensors": [], "status": True}
            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get DLP config: {response.status_code}")

            data = response.json()
            return data.get("dlp_group", {})

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def update_group_dlp_sensors(
        self,
        group_name: str,
        sensors: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Update DLP sensors configuration for a group.

        Args:
            group_name: Name of the group
            sensors: List of sensor configs [{"name": "sensor.creditcard", "action": "allow"}]

        Returns:
            Updated DLP configuration

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            # Format the sensors correctly for NeuVector API
            # RESTDlpSetting format: {"name": "sensor.xxx", "action": "allow"}
            formatted_sensors = []
            for s in sensors:
                formatted_sensors.append({
                    "name": s.get("name"),
                    "action": s.get("action", "allow"),
                })

            # NeuVector API uses "replace" field for GUI-style full replacement
            # "sensors" is for adding/changing, "delete" is for removing
            payload = {
                "config": {
                    "name": group_name,
                    "status": True,
                    "replace": formatted_sensors,  # Use "replace" to replace entire list
                }
            }

            response = await client.patch(
                f"/v1/dlp/group/{group_name}",
                json=payload,
                headers=self._auth_headers(),
            )

            if response.status_code not in (200, 204):
                error_msg = f"Failed to update DLP config: {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        error_msg = f"Failed to update DLP config: {error_data['error']}"
                    elif "message" in error_data:
                        error_msg = f"Failed to update DLP config: {error_data['message']}"
                    else:
                        error_msg = f"Failed to update DLP config: {response.status_code} - {error_data}"
                except Exception:
                    error_msg = f"Failed to update DLP config: {response.status_code} - {response.text}"
                raise NeuVectorAPIError(error_msg)

            return {"success": True, "group": group_name, "sensors": formatted_sensors}

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_recent_threats(
        self,
        group_name: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Get recent DLP/WAF threat events.

        Args:
            group_name: Optional group name to filter
            limit: Maximum number of threats to return

        Returns:
            List of threat objects

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                "/v1/log/threat",
                headers=self._auth_headers(),
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get threats: {response.status_code}")

            data = response.json()
            threats = data.get("threats", [])

            # Filter by group name if provided - use flexible matching
            if group_name:
                # Extract service name from group
                service = group_name.replace("nv.", "").split(".")[0] if group_name.startswith("nv.") else group_name
                threats = [
                    t for t in threats
                    if (service in t.get("client_workload_name", "") or
                        service in t.get("server_workload_name", "") or
                        service in t.get("group", "") or
                        "neuvector-demo" in t.get("client_workload_domain", "") or
                        "neuvector-demo" in t.get("server_workload_domain", ""))
                ]

            # Sort by time (most recent first) and limit
            threats = sorted(threats, key=lambda x: x.get("reported_at", ""), reverse=True)
            return threats[:limit]

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def set_group_dlp_sensor(
        self,
        group_name: str,
        sensor_name: str,
        enabled: bool,
        action: str = "allow",
    ) -> dict[str, Any]:
        """
        Enable or disable a specific DLP sensor for a group.

        Args:
            group_name: Name of the group
            sensor_name: Name of the sensor (e.g., "sensor.creditcard")
            enabled: True to enable, False to disable
            action: "allow" for Alert, "deny" for Block

        Returns:
            Result of the operation

        Raises:
            NeuVectorAPIError: If request fails
        """
        # First, get current DLP config
        current_config = await self.get_group_dlp_config(group_name)
        current_sensors = current_config.get("sensors", [])

        # Build new sensor list
        # Find if sensor already exists
        sensor_exists = False
        new_sensors = []

        for sensor in current_sensors:
            if sensor.get("name") == sensor_name:
                sensor_exists = True
                if enabled:
                    # Update with new action
                    new_sensors.append({"name": sensor_name, "action": action})
                # If disabled, don't add it to the list
            else:
                # Keep other sensors as-is
                sensor_data = {"name": sensor.get("name"), "action": sensor.get("action", "allow")}
                new_sensors.append(sensor_data)

        # If sensor didn't exist and we want to enable it
        if not sensor_exists and enabled:
            new_sensors.append({"name": sensor_name, "action": action})

        # Update the group with new sensors list
        return await self.update_group_dlp_sensors(group_name, new_sensors)

    # ========== Admission Control API ==========

    async def get_admission_state(self) -> dict[str, Any]:
        """
        Get admission control state.

        Returns:
            Admission control state object

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                "/v1/admission/state",
                headers=self._auth_headers(),
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get admission state: {response.status_code}")

            data = response.json()
            return data.get("state", {})

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def set_admission_state(self, enable: bool, mode: str = "monitor") -> dict[str, Any]:
        """
        Enable or disable admission control.

        Args:
            enable: True to enable, False to disable
            mode: "monitor" or "protect"

        Returns:
            Result of the operation

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            payload = {
                "state": {
                    "enable": enable,
                    "mode": mode,
                }
            }

            response = await client.patch(
                "/v1/admission/state",
                json=payload,
                headers=self._auth_headers(),
            )

            if response.status_code not in (200, 204):
                raise NeuVectorAPIError(f"Failed to update admission state: {response.status_code}")

            return {"success": True, "enable": enable, "mode": mode}

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def get_admission_rules(self, scope: str = "local") -> list[dict[str, Any]]:
        """
        Get all admission control rules.

        Args:
            scope: "local", "fed", or empty for all

        Returns:
            List of admission rule objects

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            params = {}
            if scope:
                params["scope"] = scope

            response = await client.get(
                "/v1/admission/rules",
                headers=self._auth_headers(),
                params=params,
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get admission rules: {response.status_code}")

            data = response.json()
            return data.get("rules", [])

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def create_admission_rule(
        self,
        rule_type: str = "deny",
        comment: str = "",
        criteria: list[dict[str, Any]] = None,
        disable: bool = False,
    ) -> dict[str, Any]:
        """
        Create a new admission control rule.

        Args:
            rule_type: "deny" or "allow"
            comment: Rule description
            criteria: List of criteria objects
            disable: Whether to create the rule as disabled

        Returns:
            Created rule object

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            payload = {
                "config": {
                    "category": "Kubernetes",
                    "rule_type": rule_type,
                    "comment": comment,
                    "criteria": criteria or [],
                    "disable": disable,
                }
            }

            response = await client.post(
                "/v1/admission/rule",
                json=payload,
                headers=self._auth_headers(),
            )

            if response.status_code not in (200, 201):
                error_msg = f"Failed to create admission rule: {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        error_msg = f"Failed to create admission rule: {error_data['error']}"
                except Exception:
                    pass
                raise NeuVectorAPIError(error_msg)

            return response.json()

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def delete_admission_rule(self, rule_id: int) -> dict[str, Any]:
        """
        Delete an admission control rule.

        Args:
            rule_id: ID of the rule to delete

        Returns:
            Result of the operation

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.delete(
                f"/v1/admission/rule/{rule_id}",
                headers=self._auth_headers(),
            )

            if response.status_code not in (200, 204):
                raise NeuVectorAPIError(f"Failed to delete admission rule: {response.status_code}")

            return {"success": True, "deleted_id": rule_id}

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")

    async def create_namespace_deny_rule(
        self,
        namespace: str,
        comment: str = "",
    ) -> dict[str, Any]:
        """
        Create an admission rule to deny all resources in a specific namespace.

        Args:
            namespace: Namespace to block
            comment: Rule description

        Returns:
            Created rule object

        Raises:
            NeuVectorAPIError: If request fails
        """
        criteria = [
            {
                "name": "namespace",
                "op": "=",
                "value": namespace,
            }
        ]

        if not comment:
            comment = f"Deny all resources in namespace '{namespace}'"

        return await self.create_admission_rule(
            rule_type="deny",
            comment=comment,
            criteria=criteria,
            disable=False,
        )

    async def get_admission_events(
        self,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Get recent admission control events (from audit logs).

        Args:
            limit: Maximum number of events to return

        Returns:
            List of admission event objects

        Raises:
            NeuVectorAPIError: If request fails
        """
        client = await self._get_client()

        try:
            response = await client.get(
                "/v1/log/audit",
                headers=self._auth_headers(),
            )

            if response.status_code != 200:
                raise NeuVectorAPIError(f"Failed to get audit logs: {response.status_code}")

            data = response.json()
            audits = data.get("audits", [])

            # Filter for admission-related events
            admission_events = [
                a for a in audits
                if "admission" in a.get("name", "").lower()
                or a.get("name", "") in ["Admission.Control.Denied", "Admission.Control.Allowed"]
            ]

            # Sort by time (most recent first) and limit
            admission_events = sorted(
                admission_events,
                key=lambda x: x.get("reported_at", ""),
                reverse=True
            )

            return admission_events[:limit]

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")
