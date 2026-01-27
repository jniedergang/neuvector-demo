#!/bin/bash
#
# Script de mise a jour de l'application NeuVector Demo Web
# Rebuild l'image et redeploy sans interruption
#
# Usage: ./redeploy.sh [OPTIONS]
#
# Options:
#   -n, --node       IP ou hostname du noeud Kubernetes (default: 172.16.3.21)
#   -u, --user       Utilisateur SSH (default: rancher)
#   -k, --kubeconfig Chemin du kubeconfig (default: ~/.kube/config-downstream)
#   -h, --help       Afficher l'aide
#

set -e

# Configuration par defaut
NODE_IP="${NODE_IP:-172.16.3.21}"
SSH_USER="${SSH_USER:-rancher}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config-downstream}"
IMAGE_NAME="neuvector-demo-web"
IMAGE_TAG="latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Couleurs
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# Parsing des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--node)
            NODE_IP="$2"
            shift 2
            ;;
        -u|--user)
            SSH_USER="$2"
            shift 2
            ;;
        -k|--kubeconfig)
            KUBECONFIG="$2"
            shift 2
            ;;
        -h|--help)
            head -18 "$0" | tail -14
            exit 0
            ;;
        *)
            echo "Option inconnue: $1"
            exit 1
            ;;
    esac
done

# Detection du builder
if command -v docker &> /dev/null; then
    BUILDER="docker"
else
    BUILDER="podman"
fi

cd "$PROJECT_DIR"

# Build
log_info "Build de l'image..."
$BUILDER build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

# Export
log_info "Export de l'image..."
TMP_TAR="/tmp/${IMAGE_NAME}.tar"
rm -f "$TMP_TAR"  # Remove existing tar to avoid podman error
$BUILDER save "${IMAGE_NAME}:${IMAGE_TAG}" -o "$TMP_TAR"

# Copie
log_info "Copie vers $NODE_IP..."
scp -o StrictHostKeyChecking=no "$TMP_TAR" "${SSH_USER}@${NODE_IP}:/tmp/"

# Import
log_info "Import dans containerd..."
ssh "${SSH_USER}@${NODE_IP}" "sudo /var/lib/rancher/rke2/bin/ctr \
    -a /run/k3s/containerd/containerd.sock \
    -n k8s.io images import /tmp/${IMAGE_NAME}.tar"

# Nettoyage
ssh "${SSH_USER}@${NODE_IP}" "rm -f /tmp/${IMAGE_NAME}.tar"
rm -f "$TMP_TAR"

# Rolling restart du deployment
log_info "Redemarrage du deployment..."
kubectl --kubeconfig "$KUBECONFIG" rollout restart deployment/neuvector-demo-web -n neuvector-demo

# Attendre
log_info "Attente du rollout..."
kubectl --kubeconfig "$KUBECONFIG" rollout status deployment/neuvector-demo-web -n neuvector-demo --timeout=120s

log_info "Mise a jour terminee!"
log_info "Application: http://${NODE_IP}:30080"
