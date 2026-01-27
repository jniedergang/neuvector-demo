#!/bin/bash
#
# Script de deploiement avec registre prive
# Usage: ./deploy-registry.sh [OPTIONS]
#
# Options:
#   -r, --registry   URL du registre (default: $REGISTRY_URL ou registry.example.com)
#   -i, --image      Nom de l'image (default: neuvector-demo-web)
#   -t, --tag        Tag de l'image (default: latest)
#   -k, --kubeconfig Chemin du kubeconfig (default: ~/.kube/config)
#   -h, --help       Afficher l'aide
#
# Variables d'environnement:
#   REGISTRY_URL      URL du registre Docker
#   REGISTRY_USER     Utilisateur pour le registre
#   REGISTRY_PASSWORD Mot de passe pour le registre
#

set -e

# Configuration par defaut
REGISTRY_URL="${REGISTRY_URL:-registry.example.com}"
IMAGE_NAME="${IMAGE_NAME:-neuvector-demo-web}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NAMESPACE="neuvector-demo"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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
        -r|--registry)
            REGISTRY_URL="$2"
            shift 2
            ;;
        -i|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -k|--kubeconfig)
            KUBECONFIG="$2"
            shift 2
            ;;
        -h|--help)
            head -20 "$0" | tail -16
            exit 0
            ;;
        *)
            log_error "Option inconnue: $1"
            exit 1
            ;;
    esac
done

FULL_IMAGE="${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}"

log_info "Configuration:"
log_info "  Registry: $REGISTRY_URL"
log_info "  Image: $FULL_IMAGE"
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

# Detection du builder
if command -v docker &> /dev/null; then
    BUILDER="docker"
else
    BUILDER="podman"
fi
log_info "Builder: $BUILDER"

# Etape 1: Build de l'image
log_info "Etape 1/5: Build de l'image..."
cd "$PROJECT_DIR"
$BUILDER build -t "$FULL_IMAGE" .

# Etape 2: Push vers le registre
log_info "Etape 2/5: Push vers le registre..."
$BUILDER push "$FULL_IMAGE"

# Etape 3: Creer le namespace si necessaire
log_info "Etape 3/5: Creation du namespace..."
kubectl --kubeconfig "$KUBECONFIG" create namespace "$NAMESPACE" 2>/dev/null || true

# Etape 4: Verifier/Creer le secret registry-credentials
log_info "Etape 4/5: Verification du secret registry-credentials..."
if ! kubectl --kubeconfig "$KUBECONFIG" get secret registry-credentials -n "$NAMESPACE" &>/dev/null; then
    if [[ -z "$REGISTRY_USER" ]] || [[ -z "$REGISTRY_PASSWORD" ]]; then
        log_warn "Secret registry-credentials non trouve et REGISTRY_USER/REGISTRY_PASSWORD non definis"
        log_warn "Creez le secret manuellement:"
        log_warn "  kubectl create secret docker-registry registry-credentials \\"
        log_warn "    --namespace $NAMESPACE \\"
        log_warn "    --docker-server=$REGISTRY_URL \\"
        log_warn "    --docker-username=<user> \\"
        log_warn "    --docker-password=<password>"
    else
        log_info "Creation du secret registry-credentials..."
        kubectl --kubeconfig "$KUBECONFIG" create secret docker-registry registry-credentials \
            --namespace "$NAMESPACE" \
            --docker-server="$REGISTRY_URL" \
            --docker-username="$REGISTRY_USER" \
            --docker-password="$REGISTRY_PASSWORD"
    fi
fi

# Etape 5: Deploiement Kubernetes
log_info "Etape 5/5: Deploiement des manifests Kubernetes..."

# Appliquer RBAC
kubectl --kubeconfig "$KUBECONFIG" apply -f "$PROJECT_DIR/manifests/rbac.yaml"

# Generer et appliquer le deployment avec la bonne image
log_info "Application du deployment avec image: $FULL_IMAGE"
sed "s|image:.*|image: $FULL_IMAGE|" "$PROJECT_DIR/manifests/deployment-registry.yaml" | \
    kubectl --kubeconfig "$KUBECONFIG" apply -f -

# Attendre que le pod soit ready
log_info "Attente du demarrage du pod..."
kubectl --kubeconfig "$KUBECONFIG" rollout status deployment/neuvector-demo-web \
    -n "$NAMESPACE" --timeout=120s

# Verification finale
log_info "Verification du deploiement..."
kubectl --kubeconfig "$KUBECONFIG" get pods -n "$NAMESPACE"

echo ""
log_info "=========================================="
log_info "Deploiement termine avec succes!"
log_info "=========================================="
echo ""

# Obtenir l'IP du noeud pour l'acces
NODE_IP=$(kubectl --kubeconfig "$KUBECONFIG" get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}' 2>/dev/null || echo "<NODE_IP>")
log_info "Application accessible sur: http://${NODE_IP}:30080"
log_info "Health check: http://${NODE_IP}:30080/api/health"
