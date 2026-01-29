"""REST API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from app.demos import DemoRegistry
from app.config import NAMESPACE, NEUVECTOR_NAMESPACE, NEUVECTOR_API_URL
from app.core.neuvector_api import NeuVectorAPI, NeuVectorAPIError
from app.core.kubectl import Kubectl


router = APIRouter(prefix="/api", tags=["api"])


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


class NeuVectorTestRequest(BaseModel):
    """Request model for testing NeuVector connection."""
    username: str
    password: str


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
        base_url=NEUVECTOR_API_URL,
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


@router.post("/neuvector/process-profile", response_model=ProcessProfileResponse)
async def get_process_profile(request: ProcessProfileRequest):
    """Get NeuVector process profile rules for a group."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
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
        base_url=NEUVECTOR_API_URL,
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


@router.post("/neuvector/test", response_model=NeuVectorTestResponse)
async def test_neuvector_connection(request: NeuVectorTestRequest):
    """Test NeuVector API connection with provided credentials."""
    api = NeuVectorAPI(
        base_url=NEUVECTOR_API_URL,
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
            api_url=NEUVECTOR_API_URL,
        )
    except NeuVectorAPIError as e:
        await api.close()
        return NeuVectorTestResponse(
            success=False,
            message=str(e),
            api_url=NEUVECTOR_API_URL,
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
