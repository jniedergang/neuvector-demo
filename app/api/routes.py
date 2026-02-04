"""REST API routes."""

import asyncio
from enum import Enum
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from app.demos import DemoRegistry
from app.config import NAMESPACE, NEUVECTOR_NAMESPACE, NEUVECTOR_API_URL, APP_VERSION, GIT_COMMIT, GIT_BRANCH
from app.core.neuvector_api import NeuVectorAPI, NeuVectorAPIError
from app.core.kubectl import Kubectl


router = APIRouter(prefix="/api", tags=["api"])


def get_effective_api_url(api_url: Optional[str]) -> str:
    """Get effective API URL - use custom if provided, otherwise default."""
    return api_url.strip() if api_url else NEUVECTOR_API_URL


class DemoInfo(BaseModel):
    """Demo information response model."""
    id: str
    name: str
    description: str
    category: str
    icon: str
    parameters: list[dict[str, Any]]


class DemoListResponse(BaseModel):
    """Response model for demo list."""
    demos: list[DemoInfo]
    categories: dict[str, list[str]]


class ConfigResponse(BaseModel):
    """Response model for configuration."""
    demo_namespace: str
    neuvector_namespace: str


@router.get("/demos", response_model=DemoListResponse)
async def list_demos():
    """List all available demos."""
    demos = DemoRegistry.get_all()
    demo_list = [DemoInfo(**demo.to_dict()) for demo in demos]

    # Group by category
    categories = {}
    for demo in demos:
        if demo.category not in categories:
            categories[demo.category] = []
        categories[demo.category].append(demo.id)

    return DemoListResponse(demos=demo_list, categories=categories)


@router.get("/demos/{demo_id}", response_model=DemoInfo)
async def get_demo(demo_id: str):
    """Get details of a specific demo."""
    demo = DemoRegistry.get(demo_id)
    if not demo:
        raise HTTPException(status_code=404, detail=f"Demo '{demo_id}' not found")
    return DemoInfo(**demo.to_dict())


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """Get current configuration."""
    return ConfigResponse(
        demo_namespace=NAMESPACE,
        neuvector_namespace=NEUVECTOR_NAMESPACE,
    )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


class VersionResponse(BaseModel):
    """Response model for version info."""
    version: str
    git_commit: Optional[str] = None
    git_branch: Optional[str] = None


@router.get("/version", response_model=VersionResponse)
async def get_version():
    """Get application version info."""
    return VersionResponse(
        version=APP_VERSION,
        git_commit=GIT_COMMIT,
        git_branch=GIT_BRANCH,
    )


class ClusterInfoResponse(BaseModel):
    """Response model for cluster info."""
    context: str
    connected: bool
    node_count: int
    error: Optional[str] = None


@router.get("/cluster-info", response_model=ClusterInfoResponse)
async def get_cluster_info():
    """Get Kubernetes cluster info and connection status."""
    kubectl = Kubectl()
    info = await kubectl.get_cluster_info()
    return ClusterInfoResponse(**info)


class NeuVectorDefaultUrlResponse(BaseModel):
    """Response model for default NeuVector API URL."""
    api_url: str


@router.get("/neuvector/default-url", response_model=NeuVectorDefaultUrlResponse)
async def get_default_neuvector_url():
    """Get the default NeuVector API URL configured on the server."""
    return NeuVectorDefaultUrlResponse(api_url=NEUVECTOR_API_URL)


class NeuVectorTestRequest(BaseModel):
    """Request model for testing NeuVector connection."""
    username: str
    password: str
    api_url: Optional[str] = None  # Custom API URL (uses default if not provided)


class NeuVectorTestResponse(BaseModel):
    """Response model for NeuVector connection test."""
    success: bool
    message: str
    api_url: str


class GroupStatusRequest(BaseModel):
    """Request model for getting group status."""
    username: str
    password: str
    group_name: str
    api_url: Optional[str] = None


class GroupStatusResponse(BaseModel):
    """Response model for group status."""
    success: bool
    group_name: str
    policy_mode: Optional[str] = None
    profile_mode: Optional[str] = None
    baseline_profile: Optional[str] = None
    message: str = ""


@router.post("/neuvector/group-status", response_model=GroupStatusResponse)
async def get_group_status(request: GroupStatusRequest):
    """Get NeuVector group policy status."""
    api = NeuVectorAPI(
        base_url=get_effective_api_url(request.api_url),
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        group = await api.get_group(request.group_name)
        await api.logout()
        await api.close()

        return GroupStatusResponse(
            success=True,
            group_name=request.group_name,
            policy_mode=group.get("policy_mode"),
            profile_mode=group.get("profile_mode"),
            baseline_profile=group.get("baseline_profile"),
        )
    except NeuVectorAPIError as e:
        await api.close()
        return GroupStatusResponse(
            success=False,
            group_name=request.group_name,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return GroupStatusResponse(
            success=False,
            group_name=request.group_name,
            message=f"Unexpected error: {str(e)}",
        )


class ProcessProfileRequest(BaseModel):
    """Request model for getting process profile rules."""
    username: str
    password: str
    group_name: str
    api_url: Optional[str] = None


class ProcessRule(BaseModel):
    """Process rule model."""
    name: str
    path: str
    action: str
    cfg_type: str  # learned, user_created, ground


class ProcessProfileResponse(BaseModel):
    """Response model for process profile."""
    success: bool
    group_name: str
    mode: Optional[str] = None
    baseline: Optional[str] = None
    process_list: list[ProcessRule] = []
    message: str = ""


class PodInfoRequest(BaseModel):
    """Request model for getting combined pod info (group status + process profile)."""
    username: str
    password: str
    group_name: str
    api_url: Optional[str] = None


class PodInfoResponse(BaseModel):
    """Response model for combined pod info."""
    success: bool
    group_name: str
    # Group status
    policy_mode: Optional[str] = None
    profile_mode: Optional[str] = None
    baseline_profile: Optional[str] = None
    # Process profile
    process_list: list[ProcessRule] = []
    message: str = ""


@router.post("/neuvector/pod-info", response_model=PodInfoResponse)
async def get_pod_info(request: PodInfoRequest):
    """Get NeuVector group status AND process profile in one call.

    This optimizes performance by:
    - Authenticating once instead of twice
    - Making parallel API calls for group and process profile
    - Logging out once instead of twice

    Reduces HTTP requests from ~6 to ~4 per pod.
    """
    api = NeuVectorAPI(
        base_url=get_effective_api_url(request.api_url),
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()

        # Fetch group status and process profile in parallel
        group_result, profile_result = await asyncio.gather(
            api.get_group(request.group_name),
            api.get_process_profile(request.group_name),
            return_exceptions=True,
        )

        await api.logout()
        await api.close()

        # Handle potential exceptions from parallel calls
        group = group_result if not isinstance(group_result, Exception) else {}
        profile = profile_result if not isinstance(profile_result, Exception) else {}

        # Build process list
        process_list = [
            ProcessRule(
                name=p.get("name", ""),
                path=p.get("path", ""),
                action=p.get("action", "allow"),
                cfg_type=p.get("cfg_type", "learned"),
            )
            for p in profile.get("process_list", [])
        ]

        return PodInfoResponse(
            success=True,
            group_name=request.group_name,
            policy_mode=group.get("policy_mode"),
            profile_mode=group.get("profile_mode"),
            baseline_profile=group.get("baseline_profile"),
            process_list=process_list,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return PodInfoResponse(
            success=False,
            group_name=request.group_name,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return PodInfoResponse(
            success=False,
            group_name=request.group_name,
            message=f"Unexpected error: {str(e)}",
        )


@router.post("/neuvector/process-profile", response_model=ProcessProfileResponse)
async def get_process_profile(request: ProcessProfileRequest):
    """Get NeuVector process profile rules for a group."""
    api = NeuVectorAPI(
        base_url=get_effective_api_url(request.api_url),
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        profile = await api.get_process_profile(request.group_name)
        await api.logout()
        await api.close()

        process_list = [
            ProcessRule(
                name=p.get("name", ""),
                path=p.get("path", ""),
                action=p.get("action", "allow"),
                cfg_type=p.get("cfg_type", "learned"),
            )
            for p in profile.get("process_list", [])
        ]

        return ProcessProfileResponse(
            success=True,
            group_name=request.group_name,
            mode=profile.get("mode"),
            baseline=profile.get("baseline"),
            process_list=process_list,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return ProcessProfileResponse(
            success=False,
            group_name=request.group_name,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return ProcessProfileResponse(
            success=False,
            group_name=request.group_name,
            message=f"Unexpected error: {str(e)}",
        )


class DeleteProcessRuleRequest(BaseModel):
    """Request model for deleting a process rule."""
    username: str
    password: str
    group_name: str
    process_name: str
    process_path: str


class DeleteProcessRuleResponse(BaseModel):
    """Response model for process rule deletion."""
    success: bool
    message: str = ""


@router.post("/neuvector/delete-process-rule", response_model=DeleteProcessRuleResponse)
async def delete_process_rule(request: DeleteProcessRuleRequest):
    """Delete a process rule from NeuVector process profile."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        await api.delete_process_rule(
            group_name=request.group_name,
            process_name=request.process_name,
            process_path=request.process_path,
        )
        await api.logout()
        await api.close()

        return DeleteProcessRuleResponse(
            success=True,
            message=f"Process rule '{request.process_name}' deleted",
        )
    except NeuVectorAPIError as e:
        await api.close()
        return DeleteProcessRuleResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return DeleteProcessRuleResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class UpdateGroupRequest(BaseModel):
    """Request model for updating group settings."""
    username: str
    password: str
    service_name: str  # e.g., "opensuse.neuvector-demo"
    api_url: Optional[str] = None
    policy_mode: Optional[str] = None
    profile_mode: Optional[str] = None
    baseline_profile: Optional[str] = None


class UpdateGroupResponse(BaseModel):
    """Response model for group update."""
    success: bool
    message: str = ""


@router.post("/neuvector/update-group", response_model=UpdateGroupResponse)
async def update_group_settings(request: UpdateGroupRequest):
    """Update NeuVector group settings (policy mode, profile mode, baseline)."""
    api = NeuVectorAPI(
        base_url=get_effective_api_url(request.api_url),
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()

        client = await api._get_client()
        config = {"services": [request.service_name]}

        if request.policy_mode:
            config["policy_mode"] = request.policy_mode
        if request.profile_mode:
            config["profile_mode"] = request.profile_mode
        if request.baseline_profile:
            config["baseline_profile"] = request.baseline_profile

        response = await client.patch(
            "/v1/service/config",
            json={"config": config},
            headers=api._auth_headers(),
        )

        await api.logout()
        await api.close()

        if response.status_code in (200, 204):
            return UpdateGroupResponse(success=True, message="Settings updated")
        else:
            # Get error details
            error_detail = ""
            try:
                error_data = response.json()
                error_detail = str(error_data)
            except Exception:
                error_detail = response.text
            return UpdateGroupResponse(
                success=False,
                message=f"Failed ({response.status_code}): {error_detail}"
            )

    except NeuVectorAPIError as e:
        await api.close()
        return UpdateGroupResponse(success=False, message=str(e))
    except Exception as e:
        await api.close()
        return UpdateGroupResponse(success=False, message=str(e))


class ResetDemoRulesRequest(BaseModel):
    """Request model for resetting demo groups to Discover mode."""
    username: str
    password: str
    api_url: Optional[str] = None


class ResetDemoRulesResponse(BaseModel):
    """Response model for reset demo rules."""
    success: bool
    message: str = ""
    groups_reset: list[str] = []
    processes_deleted: int = 0
    network_rules_deleted: int = 0


@router.post("/neuvector/reset-demo-rules", response_model=ResetDemoRulesResponse)
async def reset_demo_rules(request: ResetDemoRulesRequest):
    """Reset NeuVector rules for demo groups (espion1, cible1) to Discover mode and delete learned process/network rules."""
    api = NeuVectorAPI(
        base_url=get_effective_api_url(request.api_url),
        username=request.username,
        password=request.password,
    )

    groups_to_reset = ["espion1.neuvector-demo", "cible1.neuvector-demo"]
    nv_group_names = ["nv.espion1.neuvector-demo", "nv.cible1.neuvector-demo"]
    groups_reset = []
    processes_deleted = 0
    network_rules_deleted = 0
    errors = []

    try:
        await api.authenticate()
        client = await api._get_client()

        # Step 1: Reset policy/profile modes to Discover and baseline to zero-drift
        for service_name in groups_to_reset:
            try:
                config = {
                    "services": [service_name],
                    "policy_mode": "Discover",
                    "profile_mode": "Discover",
                    "baseline_profile": "zero-drift",
                }
                response = await client.patch(
                    f"{api.base_url}/v1/service/config",
                    json={"config": config},
                    headers={"X-Auth-Token": api.token},
                )
                if response.status_code in (200, 204):
                    groups_reset.append(service_name)
                else:
                    errors.append(f"{service_name}: mode reset failed ({response.status_code})")
            except Exception as e:
                errors.append(f"{service_name}: {str(e)}")

        # Step 2: Delete all learned process rules
        for group_name in nv_group_names:
            try:
                # Get process profile
                profile = await api.get_process_profile(group_name)
                process_list = profile.get("process_list", [])

                # Delete each learned process rule
                for proc in process_list:
                    proc_name = proc.get("name")
                    proc_path = proc.get("path", "")
                    if proc_name:
                        try:
                            await api.delete_process_rule(
                                group_name=group_name,
                                process_name=proc_name,
                                process_path=proc_path,
                            )
                            processes_deleted += 1
                        except Exception:
                            pass  # Ignore individual deletion errors
            except Exception as e:
                errors.append(f"{group_name}: process cleanup failed ({str(e)})")

        # Step 3: Delete network rules involving demo groups
        try:
            # Get all policy rules
            response = await client.get(
                f"{api.base_url}/v1/policy/rule",
                headers={"X-Auth-Token": api.token},
            )
            if response.status_code == 200:
                rules_data = response.json()
                rules = rules_data.get("rules", [])

                # Filter rules involving our demo groups
                demo_group_patterns = ["espion1", "cible1", "neuvector-demo"]
                rules_to_delete = []

                for rule in rules:
                    rule_id = rule.get("id")
                    from_group = rule.get("from", "")
                    to_group = rule.get("to", "")

                    # Check if rule involves demo groups
                    involves_demo = any(
                        pattern in from_group or pattern in to_group
                        for pattern in demo_group_patterns
                    )

                    # Only delete learned rules (not user-created), check cfg_type
                    cfg_type = rule.get("cfg_type", "")
                    is_learned = cfg_type == "learned" or cfg_type == ""

                    if involves_demo and is_learned and rule_id is not None:
                        rules_to_delete.append(rule_id)

                # Delete each rule
                for rule_id in rules_to_delete:
                    try:
                        del_response = await client.delete(
                            f"{api.base_url}/v1/policy/rule/{rule_id}",
                            headers={"X-Auth-Token": api.token},
                        )
                        if del_response.status_code in (200, 204):
                            network_rules_deleted += 1
                    except Exception:
                        pass  # Ignore individual deletion errors

        except Exception as e:
            errors.append(f"Network rules cleanup failed: {str(e)}")

        await api.logout()
        await api.close()

        # Build result message
        msg_parts = []
        if groups_reset:
            msg_parts.append(f"{len(groups_reset)} groups reset to Discover")
        if processes_deleted:
            msg_parts.append(f"{processes_deleted} process rules deleted")
        if network_rules_deleted:
            msg_parts.append(f"{network_rules_deleted} network rules deleted")

        if errors:
            return ResetDemoRulesResponse(
                success=len(groups_reset) > 0,
                message=f"{', '.join(msg_parts)}. Errors: {', '.join(errors)}",
                groups_reset=groups_reset,
                processes_deleted=processes_deleted,
                network_rules_deleted=network_rules_deleted,
            )
        return ResetDemoRulesResponse(
            success=True,
            message=', '.join(msg_parts) if msg_parts else "Nothing to reset",
            groups_reset=groups_reset,
            processes_deleted=processes_deleted,
            network_rules_deleted=network_rules_deleted,
        )

    except NeuVectorAPIError as e:
        await api.close()
        return ResetDemoRulesResponse(success=False, message=str(e))
    except Exception as e:
        await api.close()
        return ResetDemoRulesResponse(success=False, message=str(e))


@router.post("/neuvector/test", response_model=NeuVectorTestResponse)
async def test_neuvector_connection(request: NeuVectorTestRequest):
    """Test NeuVector API connection with provided credentials."""
    effective_url = get_effective_api_url(request.api_url)

    api = NeuVectorAPI(
        base_url=effective_url,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        await api.logout()
        await api.close()
        return NeuVectorTestResponse(
            success=True,
            message="Connection successful",
            api_url=effective_url,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return NeuVectorTestResponse(
            success=False,
            message=str(e),
            api_url=effective_url,
        )
    except Exception as e:
        await api.close()
        return NeuVectorTestResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
            api_url=NEUVECTOR_API_URL,
        )


class RecentEventsRequest(BaseModel):
    """Request model for getting recent NeuVector events."""
    username: str
    password: str
    group_name: Optional[str] = None
    limit: int = 10


class NeuVectorEvent(BaseModel):
    """NeuVector event model."""
    event_type: str  # "incident" or "violation"
    name: str
    message: str
    details: str
    reported_at: str
    level: str  # "Warning", "Error", etc.


class RecentEventsResponse(BaseModel):
    """Response model for recent events."""
    success: bool
    events: list[NeuVectorEvent] = []
    message: str = ""


@router.post("/neuvector/recent-events", response_model=RecentEventsResponse)
async def get_recent_events(request: RecentEventsRequest):
    """Get recent NeuVector incidents, violations, and DLP threats for a workload."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()

        # Get incidents, violations, and DLP threats
        incidents = await api.get_recent_incidents(
            group_name=request.group_name,
            limit=request.limit,
        )
        violations = await api.get_recent_violations(
            group_name=request.group_name,
            limit=request.limit,
        )
        threats = await api.get_recent_threats(
            group_name=request.group_name,
            limit=request.limit,
        )

        await api.logout()
        await api.close()

        # Convert to unified event format
        events = []

        for inc in incidents:
            events.append(NeuVectorEvent(
                event_type="incident",
                name=inc.get("name", "Unknown"),
                message=inc.get("message", inc.get("name", "")),
                details=f"{inc.get('workload_name', 'Unknown')} - {inc.get('proc_cmd', inc.get('file_path', ''))}",
                reported_at=inc.get("reported_at", ""),
                level=inc.get("level", "Warning"),
            ))

        for vio in violations:
            # Build details from client/server info
            client = vio.get("client_name", "Unknown")
            server = vio.get("server_name", "Unknown")
            port = vio.get("server_port", "")
            ip = vio.get("server_ip", "")
            details = f"{client} -> {server}"
            if port:
                details += f":{port}"
            if ip:
                details += f" ({ip})"

            events.append(NeuVectorEvent(
                event_type="violation",
                name=vio.get("policy_action", "Violation"),
                message=f"Network violation: {client} to {server}",
                details=details,
                reported_at=vio.get("reported_at", ""),
                level=vio.get("level", "Warning"),
            ))

        for threat in threats:
            # Build details from threat info
            sensor = threat.get("sensor", "")
            client = threat.get("client_workload_name", "Unknown")
            server = threat.get("server_workload_name", "Unknown")
            details = f"{client} -> {server}"
            if sensor:
                details += f" [{sensor}]"

            events.append(NeuVectorEvent(
                event_type="threat",
                name=threat.get("name", "DLP Threat"),
                message=f"DLP: {threat.get('name', 'Unknown')}",
                details=details,
                reported_at=threat.get("reported_at", ""),
                level=threat.get("level", "Warning"),
            ))

        # Sort all events by time (most recent first)
        events = sorted(events, key=lambda x: x.reported_at, reverse=True)

        # Limit total events
        events = events[:request.limit]

        return RecentEventsResponse(
            success=True,
            events=events,
        )

    except NeuVectorAPIError as e:
        await api.close()
        return RecentEventsResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return RecentEventsResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class DLPSensorInfo(BaseModel):
    """DLP sensor info model."""
    name: str
    enabled: bool
    action: str = "allow"  # "allow" = Alert, "deny" = Block


class DLPSensorOption(BaseModel):
    """DLP sensor option for dropdown."""
    value: str  # sensor name
    label: str  # display name
    test_data: str = ""  # test data pattern for this sensor


class DLPSensorsRequest(BaseModel):
    """Request model for getting available DLP sensors."""
    username: str
    password: str


class DLPSensorsResponse(BaseModel):
    """Response model for available DLP sensors."""
    success: bool
    sensors: list[DLPSensorOption] = []
    message: str = ""


# Mapping of sensor names to test data and display labels
DLP_SENSOR_TEST_DATA = {
    "sensor.creditcard": {"label": "Matricule (Amex)", "test_data": "3782-822463-10005"},
    "sensor.visa": {"label": "Matricule (Visa)", "test_data": "4532-0151-2839-0472"},
    "sensor.ssn": {"label": "SSN", "test_data": "078-05-1120"},
    "sensor.passeport": {"label": "Passeport", "test_data": "12AB34567"},
}


@router.post("/dlp/sensors", response_model=DLPSensorsResponse)
async def get_dlp_sensors(request: DLPSensorsRequest):
    """Get all available DLP sensors from NeuVector."""
    import os
    username = request.username or os.environ.get("NEUVECTOR_USERNAME", "admin")
    password = request.password or os.environ.get("NEUVECTOR_PASSWORD", "Admin@123456")

    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=username,
        password=password,
    )

    try:
        await api.authenticate()
        sensors = await api.get_dlp_sensors()
        await api.logout()
        await api.close()

        sensor_options = []
        for sensor in sensors:
            name = sensor.get("name", "")
            if not name:
                continue

            # Get label and test data from mapping, or generate defaults
            sensor_info = DLP_SENSOR_TEST_DATA.get(name, {})
            label = sensor_info.get("label", name.replace("sensor.", "").title())
            test_data = sensor_info.get("test_data", "test-data-12345")

            sensor_options.append(DLPSensorOption(
                value=name,
                label=label,
                test_data=test_data,
            ))

        # Always add custom option at the end
        sensor_options.append(DLPSensorOption(
            value="custom",
            label="Custom Pattern",
            test_data="",
        ))

        return DLPSensorsResponse(
            success=True,
            sensors=sensor_options,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return DLPSensorsResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return DLPSensorsResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class DLPConfigRequest(BaseModel):
    """Request model for getting DLP configuration."""
    username: str
    password: str
    group_name: str


class DLPConfigResponse(BaseModel):
    """Response model for DLP configuration."""
    success: bool
    group_name: str
    sensors: list[DLPSensorInfo] = []
    message: str = ""


@router.post("/neuvector/dlp-config", response_model=DLPConfigResponse)
async def get_dlp_config(request: DLPConfigRequest):
    """Get DLP sensor configuration for a group."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        dlp_config = await api.get_group_dlp_config(request.group_name)
        await api.logout()
        await api.close()

        # Build map of enabled sensors with their actions
        sensor_map = {
            s.get("name"): s.get("action", "allow")
            for s in dlp_config.get("sensors", [])
        }

        # Define the sensors we want to show
        known_sensors = ["sensor.creditcard", "sensor.ssn"]

        sensors = [
            DLPSensorInfo(
                name=sensor_name,
                enabled=sensor_name in sensor_map,
                action=sensor_map.get(sensor_name, "allow"),
            )
            for sensor_name in known_sensors
        ]

        return DLPConfigResponse(
            success=True,
            group_name=request.group_name,
            sensors=sensors,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return DLPConfigResponse(
            success=False,
            group_name=request.group_name,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return DLPConfigResponse(
            success=False,
            group_name=request.group_name,
            message=f"Unexpected error: {str(e)}",
        )


class UpdateDLPSensorRequest(BaseModel):
    """Request model for updating DLP sensor."""
    username: str
    password: str
    group_name: str
    sensor_name: str
    enabled: bool
    action: str = "allow"  # "allow" = Alert, "deny" = Block


class UpdateDLPSensorResponse(BaseModel):
    """Response model for DLP sensor update."""
    success: bool
    message: str = ""


@router.post("/neuvector/update-dlp-sensor", response_model=UpdateDLPSensorResponse)
async def update_dlp_sensor(request: UpdateDLPSensorRequest):
    """Enable or disable a DLP sensor for a group."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        await api.set_group_dlp_sensor(
            group_name=request.group_name,
            sensor_name=request.sensor_name,
            enabled=request.enabled,
            action=request.action,
        )
        await api.logout()
        await api.close()

        status = "enabled" if request.enabled else "disabled"
        action_label = "Alert" if request.action == "allow" else "Block"
        return UpdateDLPSensorResponse(
            success=True,
            message=f"Sensor '{request.sensor_name}' {status} ({action_label})",
        )
    except NeuVectorAPIError as e:
        await api.close()
        return UpdateDLPSensorResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return UpdateDLPSensorResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


# ========== Admission Control Endpoints ==========

class AdmissionStateRequest(BaseModel):
    """Request model for admission control state."""
    username: str
    password: str


class AdmissionStateResponse(BaseModel):
    """Response model for admission control state."""
    success: bool
    enabled: bool = False
    mode: str = ""
    message: str = ""


@router.post("/neuvector/admission-state", response_model=AdmissionStateResponse)
async def get_admission_state(request: AdmissionStateRequest):
    """Get admission control state."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        state = await api.get_admission_state()
        await api.logout()
        await api.close()

        return AdmissionStateResponse(
            success=True,
            enabled=state.get("enable", False),
            mode=state.get("mode", ""),
        )
    except NeuVectorAPIError as e:
        await api.close()
        return AdmissionStateResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return AdmissionStateResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class UpdateAdmissionStateRequest(BaseModel):
    """Request model for updating admission control state."""
    username: str
    password: str
    enable: bool
    mode: str = "monitor"  # "monitor" or "protect"


class UpdateAdmissionStateResponse(BaseModel):
    """Response model for updating admission control state."""
    success: bool
    message: str = ""


@router.post("/neuvector/update-admission-state", response_model=UpdateAdmissionStateResponse)
async def update_admission_state(request: UpdateAdmissionStateRequest):
    """Enable or disable admission control."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        await api.set_admission_state(
            enable=request.enable,
            mode=request.mode,
        )
        await api.logout()
        await api.close()

        status = "enabled" if request.enable else "disabled"
        return UpdateAdmissionStateResponse(
            success=True,
            message=f"Admission control {status} in {request.mode} mode",
        )
    except NeuVectorAPIError as e:
        await api.close()
        return UpdateAdmissionStateResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return UpdateAdmissionStateResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class AdmissionRule(BaseModel):
    """Admission rule model."""
    id: int
    rule_type: str
    comment: str
    criteria: list[dict[str, Any]]
    disable: bool


class AdmissionRulesRequest(BaseModel):
    """Request model for getting admission rules."""
    username: str
    password: str


class AdmissionRulesResponse(BaseModel):
    """Response model for admission rules."""
    success: bool
    rules: list[AdmissionRule] = []
    message: str = ""


@router.post("/neuvector/admission-rules", response_model=AdmissionRulesResponse)
async def get_admission_rules(request: AdmissionRulesRequest):
    """Get all admission control rules."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        rules = await api.get_admission_rules()
        await api.logout()
        await api.close()

        rule_list = [
            AdmissionRule(
                id=r.get("id", 0),
                rule_type=r.get("rule_type", ""),
                comment=r.get("comment", ""),
                criteria=r.get("criteria", []),
                disable=r.get("disable", False),
            )
            for r in rules
        ]

        return AdmissionRulesResponse(
            success=True,
            rules=rule_list,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return AdmissionRulesResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return AdmissionRulesResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class CreateAdmissionRuleRequest(BaseModel):
    """Request model for creating admission rule."""
    username: str
    password: str
    namespace: str
    comment: str = ""


class CreateAdmissionRuleResponse(BaseModel):
    """Response model for creating admission rule."""
    success: bool
    rule_id: Optional[int] = None
    message: str = ""


@router.post("/neuvector/create-admission-rule", response_model=CreateAdmissionRuleResponse)
async def create_admission_rule(request: CreateAdmissionRuleRequest):
    """Create an admission rule to deny resources in a namespace."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        result = await api.create_namespace_deny_rule(
            namespace=request.namespace,
            comment=request.comment,
        )
        await api.logout()
        await api.close()

        rule_id = result.get("id", result.get("rule", {}).get("id"))

        return CreateAdmissionRuleResponse(
            success=True,
            rule_id=rule_id,
            message=f"Admission rule created for namespace '{request.namespace}'",
        )
    except NeuVectorAPIError as e:
        await api.close()
        return CreateAdmissionRuleResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return CreateAdmissionRuleResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class DeleteAdmissionRuleRequest(BaseModel):
    """Request model for deleting admission rule."""
    username: str
    password: str
    rule_id: int


class DeleteAdmissionRuleResponse(BaseModel):
    """Response model for deleting admission rule."""
    success: bool
    message: str = ""


@router.post("/neuvector/delete-admission-rule", response_model=DeleteAdmissionRuleResponse)
async def delete_admission_rule(request: DeleteAdmissionRuleRequest):
    """Delete an admission control rule."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        await api.delete_admission_rule(request.rule_id)
        await api.logout()
        await api.close()

        return DeleteAdmissionRuleResponse(
            success=True,
            message=f"Admission rule {request.rule_id} deleted",
        )
    except NeuVectorAPIError as e:
        await api.close()
        return DeleteAdmissionRuleResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return DeleteAdmissionRuleResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


class AdmissionEvent(BaseModel):
    """Admission event model."""
    name: str
    message: str
    workload: str
    namespace: str
    reported_at: str
    level: str


class AdmissionEventsRequest(BaseModel):
    """Request model for getting admission events."""
    username: str
    password: str
    limit: int = 10


class AdmissionEventsResponse(BaseModel):
    """Response model for admission events."""
    success: bool
    events: list[AdmissionEvent] = []
    message: str = ""


@router.post("/neuvector/admission-events", response_model=AdmissionEventsResponse)
async def get_admission_events(request: AdmissionEventsRequest):
    """Get recent admission control events."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=request.username,
        password=request.password,
    )

    try:
        await api.authenticate()
        events = await api.get_admission_events(limit=request.limit)
        await api.logout()
        await api.close()

        event_list = [
            AdmissionEvent(
                name=e.get("name", "Unknown"),
                message=e.get("message", ""),
                workload=e.get("workload_name", e.get("res_name", "")),
                namespace=e.get("workload_domain", e.get("res_domain", "")),
                reported_at=e.get("reported_at", ""),
                level=e.get("level", "Warning"),
            )
            for e in events
        ]

        return AdmissionEventsResponse(
            success=True,
            events=event_list,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return AdmissionEventsResponse(
            success=False,
            message=str(e),
        )
    except Exception as e:
        await api.close()
        return AdmissionEventsResponse(
            success=False,
            message=f"Unexpected error: {str(e)}",
        )


# ========== Diagnostics Endpoints ==========

class DiagnosticStatus(str, Enum):
    """Status for diagnostic checks."""
    OK = "ok"
    WARNING = "warning"
    ERROR = "error"
    PENDING = "pending"


class DiagnosticCheck(BaseModel):
    """Single diagnostic check result."""
    id: str
    name: str
    category: str
    status: DiagnosticStatus
    message: str
    details: Optional[str] = None


class DiagnosticsRequest(BaseModel):
    """Request model for running diagnostics."""
    username: str
    password: str


class DiagnosticsSummary(BaseModel):
    """Summary of diagnostic results."""
    total: int
    ok: int
    warning: int
    error: int


class DiagnosticsResponse(BaseModel):
    """Response model for diagnostics."""
    success: bool
    checks: list[DiagnosticCheck] = []
    summary: DiagnosticsSummary
    message: str = ""


async def _check_kubernetes_cluster() -> DiagnosticCheck:
    """Check Kubernetes cluster connectivity."""
    kubectl = Kubectl()
    try:
        info = await kubectl.get_cluster_info()
        if info.get("connected"):
            return DiagnosticCheck(
                id="kubernetes",
                name="Kubernetes Cluster",
                category="Infrastructure",
                status=DiagnosticStatus.OK,
                message=f"Connected to {info.get('context', 'cluster')}",
                details=f"{info.get('node_count', 0)} node(s)",
            )
        else:
            return DiagnosticCheck(
                id="kubernetes",
                name="Kubernetes Cluster",
                category="Infrastructure",
                status=DiagnosticStatus.ERROR,
                message="Cannot connect to cluster",
                details=info.get("error", "Connection failed"),
            )
    except Exception as e:
        return DiagnosticCheck(
            id="kubernetes",
            name="Kubernetes Cluster",
            category="Infrastructure",
            status=DiagnosticStatus.ERROR,
            message="Cluster check failed",
            details=str(e),
        )


async def _check_neuvector_api(username: str, password: str) -> tuple[DiagnosticCheck, Optional[NeuVectorAPI]]:
    """Check NeuVector API connectivity and return authenticated API client."""
    if not password:
        return DiagnosticCheck(
            id="neuvector-api",
            name="NeuVector API",
            category="Infrastructure",
            status=DiagnosticStatus.ERROR,
            message="No credentials provided",
            details="Configure API credentials in settings",
        ), None

    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
        username=username,
        password=password,
    )

    try:
        await api.authenticate()
        return DiagnosticCheck(
            id="neuvector-api",
            name="NeuVector API",
            category="Infrastructure",
            status=DiagnosticStatus.OK,
            message="Connected and authenticated",
            details=NEUVECTOR_API_URL,
        ), api
    except NeuVectorAPIError as e:
        await api.close()
        return DiagnosticCheck(
            id="neuvector-api",
            name="NeuVector API",
            category="Infrastructure",
            status=DiagnosticStatus.ERROR,
            message="Authentication failed",
            details=str(e),
        ), None
    except Exception as e:
        await api.close()
        return DiagnosticCheck(
            id="neuvector-api",
            name="NeuVector API",
            category="Infrastructure",
            status=DiagnosticStatus.ERROR,
            message="Connection failed",
            details=str(e),
        ), None


async def _check_demo_namespace() -> DiagnosticCheck:
    """Check if demo namespace exists."""
    kubectl = Kubectl()
    try:
        cmd = kubectl._build_base_command()
        cmd.extend(["get", "namespace", NAMESPACE, "-o", "name"])
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)

        if process.returncode == 0:
            return DiagnosticCheck(
                id="demo-namespace",
                name="Demo Namespace",
                category="Environment",
                status=DiagnosticStatus.OK,
                message=f"Namespace '{NAMESPACE}' exists",
            )
        else:
            return DiagnosticCheck(
                id="demo-namespace",
                name="Demo Namespace",
                category="Environment",
                status=DiagnosticStatus.ERROR,
                message=f"Namespace '{NAMESPACE}' not found",
                details="Run 'Prepare' to create it",
            )
    except Exception as e:
        return DiagnosticCheck(
            id="demo-namespace",
            name="Demo Namespace",
            category="Environment",
            status=DiagnosticStatus.ERROR,
            message="Namespace check failed",
            details=str(e),
        )


async def _check_demo_pods() -> DiagnosticCheck:
    """Check if demo pods are running."""
    kubectl = Kubectl()
    expected_pods = ["espion1", "cible1"]

    try:
        cmd = kubectl._build_base_command()
        cmd.extend(["-n", NAMESPACE, "get", "pods", "-o", "jsonpath={.items[*].metadata.name}"])
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)

        if process.returncode != 0:
            return DiagnosticCheck(
                id="demo-pods",
                name="Demo Pods",
                category="Environment",
                status=DiagnosticStatus.ERROR,
                message="Cannot list pods",
                details=stderr.decode() if stderr else "Unknown error",
            )

        pod_names = stdout.decode().strip().split() if stdout else []
        found_pods = []
        missing_pods = []

        for expected in expected_pods:
            found = any(expected in name for name in pod_names)
            if found:
                found_pods.append(expected)
            else:
                missing_pods.append(expected)

        if len(found_pods) == len(expected_pods):
            return DiagnosticCheck(
                id="demo-pods",
                name="Demo Pods",
                category="Environment",
                status=DiagnosticStatus.OK,
                message=f"All pods found ({len(found_pods)}/{len(expected_pods)})",
                details=", ".join(found_pods),
            )
        elif len(found_pods) > 0:
            return DiagnosticCheck(
                id="demo-pods",
                name="Demo Pods",
                category="Environment",
                status=DiagnosticStatus.WARNING,
                message=f"Some pods missing ({len(found_pods)}/{len(expected_pods)})",
                details=f"Missing: {', '.join(missing_pods)}",
            )
        else:
            return DiagnosticCheck(
                id="demo-pods",
                name="Demo Pods",
                category="Environment",
                status=DiagnosticStatus.ERROR,
                message="No demo pods found",
                details="Run 'Prepare' to deploy them",
            )
    except Exception as e:
        return DiagnosticCheck(
            id="demo-pods",
            name="Demo Pods",
            category="Environment",
            status=DiagnosticStatus.ERROR,
            message="Pod check failed",
            details=str(e),
        )


async def _check_neuvector_groups(api: NeuVectorAPI) -> DiagnosticCheck:
    """Check if NeuVector groups exist for demo pods."""
    expected_groups = [f"nv.espion1.{NAMESPACE}", f"nv.cible1.{NAMESPACE}"]

    try:
        groups = await api.get_groups()
        group_names = [g.get("name", "") for g in groups]

        found_groups = []
        missing_groups = []

        for expected in expected_groups:
            # Check for exact match or partial match with deployment suffix
            found = any(expected in name or name.startswith(expected.replace("nv.", "nv.").split(".")[0:2][0]) for name in group_names if NAMESPACE in name)
            # Simpler check: look for groups containing the pod name and namespace
            pod_name = expected.split(".")[1]  # Extract espion1 or cible1
            found = any(pod_name in name and NAMESPACE in name for name in group_names)
            if found:
                found_groups.append(pod_name)
            else:
                missing_groups.append(pod_name)

        if len(found_groups) == len(expected_groups):
            return DiagnosticCheck(
                id="neuvector-groups",
                name="NeuVector Groups",
                category="NeuVector Config",
                status=DiagnosticStatus.OK,
                message=f"Groups exist ({len(found_groups)}/{len(expected_groups)})",
                details=", ".join(found_groups),
            )
        elif len(found_groups) > 0:
            return DiagnosticCheck(
                id="neuvector-groups",
                name="NeuVector Groups",
                category="NeuVector Config",
                status=DiagnosticStatus.WARNING,
                message=f"Some groups missing ({len(found_groups)}/{len(expected_groups)})",
                details=f"Missing: {', '.join(missing_groups)}",
            )
        else:
            return DiagnosticCheck(
                id="neuvector-groups",
                name="NeuVector Groups",
                category="NeuVector Config",
                status=DiagnosticStatus.ERROR,
                message="No demo groups found",
                details="Pods may not be detected by NeuVector yet",
            )
    except Exception as e:
        return DiagnosticCheck(
            id="neuvector-groups",
            name="NeuVector Groups",
            category="NeuVector Config",
            status=DiagnosticStatus.ERROR,
            message="Groups check failed",
            details=str(e),
        )


async def _check_process_profiles(api: NeuVectorAPI) -> DiagnosticCheck:
    """Check if process profiles have learned rules."""
    try:
        groups = await api.get_demo_groups(NAMESPACE)
        if not groups:
            return DiagnosticCheck(
                id="process-profiles",
                name="Process Profiles",
                category="NeuVector Config",
                status=DiagnosticStatus.WARNING,
                message="No groups to check",
                details="Deploy demo pods first",
            )

        total_rules = 0
        groups_with_rules = 0

        for group in groups:
            group_name = group.get("name", "")
            try:
                profile = await api.get_process_profile(group_name)
                rules = profile.get("process_list", [])
                if rules:
                    groups_with_rules += 1
                    total_rules += len(rules)
            except Exception:
                pass

        if groups_with_rules > 0:
            return DiagnosticCheck(
                id="process-profiles",
                name="Process Profiles",
                category="NeuVector Config",
                status=DiagnosticStatus.OK,
                message=f"{total_rules} rules learned",
                details=f"Across {groups_with_rules} group(s)",
            )
        else:
            return DiagnosticCheck(
                id="process-profiles",
                name="Process Profiles",
                category="NeuVector Config",
                status=DiagnosticStatus.WARNING,
                message="No rules learned yet",
                details="Wait for discovery or trigger activity",
            )
    except Exception as e:
        return DiagnosticCheck(
            id="process-profiles",
            name="Process Profiles",
            category="NeuVector Config",
            status=DiagnosticStatus.ERROR,
            message="Profile check failed",
            details=str(e),
        )


async def _check_dlp_sensors(api: NeuVectorAPI) -> DiagnosticCheck:
    """Check if DLP sensors are configured."""
    try:
        sensors = await api.get_dlp_sensors()

        if not sensors:
            return DiagnosticCheck(
                id="dlp-sensors",
                name="DLP Sensors",
                category="NeuVector Config",
                status=DiagnosticStatus.WARNING,
                message="No DLP sensors found",
                details="DLP features may not work",
            )

        sensor_names = [s.get("name", "") for s in sensors]
        demo_sensors = ["sensor.creditcard", "sensor.ssn"]
        found = [s for s in demo_sensors if s in sensor_names]

        if found:
            return DiagnosticCheck(
                id="dlp-sensors",
                name="DLP Sensors",
                category="NeuVector Config",
                status=DiagnosticStatus.OK,
                message=f"{len(sensors)} sensors available",
                details=f"Demo sensors: {', '.join(found)}",
            )
        else:
            return DiagnosticCheck(
                id="dlp-sensors",
                name="DLP Sensors",
                category="NeuVector Config",
                status=DiagnosticStatus.WARNING,
                message=f"{len(sensors)} sensors (no demo sensors)",
                details="Create custom sensors if needed",
            )
    except Exception as e:
        return DiagnosticCheck(
            id="dlp-sensors",
            name="DLP Sensors",
            category="NeuVector Config",
            status=DiagnosticStatus.ERROR,
            message="DLP check failed",
            details=str(e),
        )


async def _check_admission_control(api: NeuVectorAPI) -> DiagnosticCheck:
    """Check admission control state."""
    try:
        state = await api.get_admission_state()

        enabled = state.get("enable", False)
        mode = state.get("mode", "")

        if enabled:
            return DiagnosticCheck(
                id="admission-control",
                name="Admission Control",
                category="NeuVector Config",
                status=DiagnosticStatus.OK,
                message=f"Enabled ({mode} mode)",
            )
        else:
            return DiagnosticCheck(
                id="admission-control",
                name="Admission Control",
                category="NeuVector Config",
                status=DiagnosticStatus.WARNING,
                message="Disabled",
                details="Enable for admission control demos",
            )
    except Exception as e:
        return DiagnosticCheck(
            id="admission-control",
            name="Admission Control",
            category="NeuVector Config",
            status=DiagnosticStatus.ERROR,
            message="Admission check failed",
            details=str(e),
        )


@router.post("/diagnostics", response_model=DiagnosticsResponse)
async def run_diagnostics(request: DiagnosticsRequest):
    """Run all diagnostic checks."""
    checks: list[DiagnosticCheck] = []
    api: Optional[NeuVectorAPI] = None

    try:
        # Phase 1: Infrastructure checks (parallel)
        k8s_check, (nv_check, api) = await asyncio.gather(
            _check_kubernetes_cluster(),
            _check_neuvector_api(request.username, request.password),
        )
        checks.append(k8s_check)
        checks.append(nv_check)

        # Phase 2: Environment checks (only if K8s is OK)
        if k8s_check.status != DiagnosticStatus.ERROR:
            ns_check, pods_check = await asyncio.gather(
                _check_demo_namespace(),
                _check_demo_pods(),
            )
            checks.append(ns_check)
            checks.append(pods_check)
        else:
            checks.append(DiagnosticCheck(
                id="demo-namespace",
                name="Demo Namespace",
                category="Environment",
                status=DiagnosticStatus.ERROR,
                message="Skipped (K8s unavailable)",
            ))
            checks.append(DiagnosticCheck(
                id="demo-pods",
                name="Demo Pods",
                category="Environment",
                status=DiagnosticStatus.ERROR,
                message="Skipped (K8s unavailable)",
            ))

        # Phase 3: NeuVector config checks (only if NV API is OK)
        if api is not None:
            nv_checks = await asyncio.gather(
                _check_neuvector_groups(api),
                _check_process_profiles(api),
                _check_dlp_sensors(api),
                _check_admission_control(api),
            )
            checks.extend(nv_checks)

            # Cleanup
            await api.logout()
            await api.close()
        else:
            # Add skipped checks
            for check_id, check_name in [
                ("neuvector-groups", "NeuVector Groups"),
                ("process-profiles", "Process Profiles"),
                ("dlp-sensors", "DLP Sensors"),
                ("admission-control", "Admission Control"),
            ]:
                checks.append(DiagnosticCheck(
                    id=check_id,
                    name=check_name,
                    category="NeuVector Config",
                    status=DiagnosticStatus.ERROR,
                    message="Skipped (API unavailable)",
                ))

        # Build summary
        summary = DiagnosticsSummary(
            total=len(checks),
            ok=sum(1 for c in checks if c.status == DiagnosticStatus.OK),
            warning=sum(1 for c in checks if c.status == DiagnosticStatus.WARNING),
            error=sum(1 for c in checks if c.status == DiagnosticStatus.ERROR),
        )

        return DiagnosticsResponse(
            success=True,
            checks=checks,
            summary=summary,
        )

    except Exception as e:
        if api:
            await api.close()
        return DiagnosticsResponse(
            success=False,
            checks=checks,
            summary=DiagnosticsSummary(total=0, ok=0, warning=0, error=0),
            message=f"Diagnostics failed: {str(e)}",
        )
