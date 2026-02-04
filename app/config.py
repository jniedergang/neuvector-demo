"""Configuration for NeuVector Demo Web Application."""

import os
import subprocess
from pathlib import Path

# Application version
APP_VERSION = "1.1.0"

def _get_git_info():
    """Get git commit hash and branch if available."""
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            cwd=Path(__file__).parent.parent
        ).decode().strip()
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            stderr=subprocess.DEVNULL,
            cwd=Path(__file__).parent.parent
        ).decode().strip()
        return commit, branch
    except Exception:
        return None, None

GIT_COMMIT, GIT_BRANCH = _get_git_info()

# Base paths
BASE_DIR = Path(__file__).parent.parent
MANIFESTS_DIR = BASE_DIR / "manifests"

# Kubernetes configuration
# When running in-cluster, use service account (KUBECONFIG should be empty/None)
# When running locally, use specified kubeconfig
def _get_kubeconfig():
    """Detect if running in-cluster or use specified kubeconfig."""
    # If KUBECONFIG env var is explicitly set, use it
    if "KUBECONFIG" in os.environ:
        return os.environ["KUBECONFIG"] or None
    # Check if running in-cluster (ServiceAccount token exists)
    if Path("/var/run/secrets/kubernetes.io/serviceaccount/token").exists():
        return None  # kubectl will use in-cluster config automatically
    # Default for local development
    return "/root/.kube/config-downstream"

KUBECONFIG = _get_kubeconfig()
NAMESPACE = os.environ.get("DEMO_NAMESPACE", "neuvector-demo")
NEUVECTOR_NAMESPACE = os.environ.get("NEUVECTOR_NAMESPACE", "neuvector")

# NeuVector API configuration
# URL for NeuVector REST API on controller (port 10443)
NEUVECTOR_API_URL = os.environ.get(
    "NEUVECTOR_API_URL",
    "https://neuvector-svc-controller.neuvector:10443"
)

# Server configuration
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))

# Kubectl settings
KUBECTL_TIMEOUT = int(os.environ.get("KUBECTL_TIMEOUT", "120"))

# Security: allowed kubectl commands (whitelist)
ALLOWED_KUBECTL_COMMANDS = {
    "get",
    "apply",
    "delete",
    "create",
    "exec",
    "wait",
    "describe",
    "logs",
}

# Admission control test namespace
FORBIDDEN_NAMESPACE = "untrusted-namespace"

# Security: namespace restrictions
ALLOWED_NAMESPACES = {NAMESPACE, NEUVECTOR_NAMESPACE, "default", FORBIDDEN_NAMESPACE}
