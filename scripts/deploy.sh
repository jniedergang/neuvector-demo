#!/bin/bash
#
# Script de deploiement de l'application NeuVector Demo Web
# Usage: ./deploy.sh [OPTIONS]
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

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
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
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            log_error "Option inconnue: $1"
            exit 1
            ;;
    esac
done

log_info "Configuration:"
log_info "  Node: $NODE_IP"
log_info "  SSH User: $SSH_USER"
log_info "  Kubeconfig: $KUBECONFIG"
echo ""

# Verification des prerequis
log_info "Verification des prerequis..."

if ! command -v docker &> /dev/null && ! command -v podman &> /dev/null; then
    log_error "Docker ou Podman requis pour builder l'image"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    log_error "kubectl requis"
    exit 1
fi

if [[ ! -f "$KUBECONFIG" ]]; then
    log_error "Kubeconfig non trouve: $KUBECONFIG"
    exit 1
fi

# Detection du builder (docker ou podman)
if command -v docker &> /dev/null; then
    BUILDER="docker"
else
    BUILDER="podman"
fi
log_info "Builder: $BUILDER"

# Etape 1: Build de l'image
log_info "Etape 1/5: Build de l'image Docker..."
cd "$PROJECT_DIR"
$BUILDER build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

# Etape 2: Export de l'image
log_info "Etape 2/5: Export de l'image..."
TMP_TAR="/tmp/${IMAGE_NAME}.tar"
rm -f "$TMP_TAR"  # Remove existing tar to avoid podman error
$BUILDER save "${IMAGE_NAME}:${IMAGE_TAG}" -o "$TMP_TAR"
log_info "Image exportee: $TMP_TAR ($(du -h "$TMP_TAR" | cut -f1))"

# Etape 3: Copie vers le noeud
log_info "Etape 3/5: Copie de l'image vers $NODE_IP..."
scp -o StrictHostKeyChecking=no "$TMP_TAR" "${SSH_USER}@${NODE_IP}:/tmp/"

# Etape 4: Import dans containerd
log_info "Etape 4/5: Import de l'image dans containerd..."
ssh "${SSH_USER}@${NODE_IP}" "sudo /var/lib/rancher/rke2/bin/ctr \
    -a /run/k3s/containerd/containerd.sock \
    -n k8s.io images import /tmp/${IMAGE_NAME}.tar"

# Nettoyage des fichiers temporaires
ssh "${SSH_USER}@${NODE_IP}" "rm -f /tmp/${IMAGE_NAME}.tar"
rm -f "$TMP_TAR"

# Etape 5: Deploiement Kubernetes
log_info "Etape 5/5: Deploiement des manifests Kubernetes..."

# Creer le namespace si necessaire
kubectl --kubeconfig "$KUBECONFIG" create namespace neuvector-demo 2>/dev/null || true

# Appliquer RBAC
kubectl --kubeconfig "$KUBECONFIG" apply -f "$PROJECT_DIR/manifests/rbac.yaml"

# Appliquer le deployment
kubectl --kubeconfig "$KUBECONFIG" apply -f "$PROJECT_DIR/manifests/deployment.yaml"

# Attendre que le pod soit ready
log_info "Attente du demarrage du pod..."
kubectl --kubeconfig "$KUBECONFIG" wait --for=condition=Ready \
    pod -l app=neuvector-demo-web \
    -n neuvector-demo \
    --timeout=120s

# Verification finale
log_info "Verification du deploiement..."
kubectl --kubeconfig "$KUBECONFIG" get pods -n neuvector-demo

echo ""
log_info "=========================================="
log_info "Deploiement termine avec succes!"
log_info "=========================================="
echo ""
log_info "Application accessible sur: http://${NODE_IP}:30080"
log_info "Health check: http://${NODE_IP}:30080/api/health"
