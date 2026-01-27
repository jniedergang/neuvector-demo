#!/bin/bash
#
# Script de suppression de l'application NeuVector Demo Web
# Usage: ./undeploy.sh [OPTIONS]
#
# Options:
#   -k, --kubeconfig Chemin du kubeconfig (default: ~/.kube/config-downstream)
#   -a, --all        Supprimer aussi le namespace neuvector-demo
#   -h, --help       Afficher l'aide
#

set -e

# Configuration par defaut
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config-downstream}"
DELETE_NAMESPACE=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Couleurs
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

# Parsing des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -k|--kubeconfig)
            KUBECONFIG="$2"
            shift 2
            ;;
        -a|--all)
            DELETE_NAMESPACE=true
            shift
            ;;
        -h|--help)
            head -15 "$0" | tail -12
            exit 0
            ;;
        *)
            echo "Option inconnue: $1"
            exit 1
            ;;
    esac
done

log_info "Suppression de l'application NeuVector Demo Web..."

# Supprimer le deployment et service
log_info "Suppression du deployment et service..."
kubectl --kubeconfig "$KUBECONFIG" delete -f "$PROJECT_DIR/manifests/deployment.yaml" --ignore-not-found

# Supprimer RBAC
log_info "Suppression du RBAC..."
kubectl --kubeconfig "$KUBECONFIG" delete -f "$PROJECT_DIR/manifests/rbac.yaml" --ignore-not-found

if [[ "$DELETE_NAMESPACE" == "true" ]]; then
    log_warn "Suppression du namespace neuvector-demo (inclut tous les pods de demo)..."
    kubectl --kubeconfig "$KUBECONFIG" delete namespace neuvector-demo --ignore-not-found --wait=true
fi

log_info "Suppression terminee."
