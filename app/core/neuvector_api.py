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

            # Filter by group name if provided
            if group_name:
                # Extract service name from group (nv.opensuse.neuvector-demo -> opensuse)
                service = group_name.replace("nv.", "").split(".")[0] if group_name.startswith("nv.") else group_name
                incidents = [
                    i for i in incidents
                    if service in i.get("workload_name", "") or service in i.get("group", "")
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

            # Filter by group name if provided
            if group_name:
                # Extract service name from group
                service = group_name.replace("nv.", "").split(".")[0] if group_name.startswith("nv.") else group_name
                violations = [
                    v for v in violations
                    if service in v.get("client_name", "") or service in v.get("server_name", "") or service in v.get("group", "")
                ]

            # Sort by time (most recent first) and limit
            violations = sorted(violations, key=lambda x: x.get("reported_at", ""), reverse=True)
            return violations[:limit]

        except httpx.RequestError as e:
            raise NeuVectorAPIError(f"Connection error: {str(e)}")
