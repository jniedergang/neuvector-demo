# NeuVector Demo Web Application

Application web interactive pour executer des demonstrations NeuVector sur un cluster Kubernetes.

## Fonctionnalites

### Actions Plateforme
- **Prepare** : Deploie le namespace `neuvector-demo` et les pods de test
- **Status** : Verifie l'etat de la plateforme et des pods
- **Reset** : Supprime le namespace et toutes les ressources de demo

### Demos Disponibles

| Demo | Description |
|------|-------------|
| **Interception de Process** | Test d'execution de commandes (curl) avec visualisation du blocage par NeuVector |
| **DLP Detection** | Test d'envoi de donnees sensibles (carte credit, SSN) |

### Interface

- **Visualization interactive** : Diagramme Source → Target montrant l'etat de la connexion
- **NeuVector Events** : Affichage des incidents et violations detectes en temps reel
- **Allowed Processes** : Gestion des regles de process (ajout/suppression)
- **Cluster Status** : Affichage de l'etat du cluster K8s et de l'API NeuVector

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Visualization  │  NeuVector Events  │  Allowed Processes │  │
│  │  [Source]──────►[Target]             │  - curl            │  │
│  │   Status: OK/Blocked/Intercepted     │  - wget            │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket / HTTP
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FastAPI Pod (neuvector-demo)                  │
│  ┌────────────┐  ┌─────────────────┐  ┌───────────────────────┐ │
│  │ WebSocket  │  │ NeuVector API   │  │ kubectl (in-cluster)  │ │
│  │ Streaming  │  │ Client          │  │ exec, apply, get...   │ │
│  └────────────┘  └─────────────────┘  └───────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Demo Pods     │  │ NeuVector     │  │ Kubernetes    │
│ opensuse-test │  │ Controller    │  │ API Server    │
│ nginx-test    │  │ REST API      │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Structure du Projet

```
neuvector-demo-web/
├── app/
│   ├── main.py              # Application FastAPI
│   ├── config.py            # Configuration
│   ├── api/
│   │   ├── routes.py        # Endpoints REST
│   │   └── websocket.py     # WebSocket handlers
│   ├── core/
│   │   ├── kubectl.py       # Wrapper kubectl securise
│   │   ├── neuvector_api.py # Client API NeuVector
│   │   └── websocket_manager.py
│   ├── demos/               # Modules de demo
│   │   ├── base.py          # Classe abstraite
│   │   ├── connectivity.py  # Demo interception process
│   │   ├── dlp.py           # Demo DLP
│   │   └── registry.py      # Auto-registration
│   └── lifecycle/           # Actions prepare/reset/status
├── static/
│   ├── css/style.css
│   └── js/
│       ├── main.js          # Logique UI + Visualization
│       └── websocket.js     # Client WebSocket
├── templates/
│   └── index.html
├── manifests/
│   ├── deployment.yaml      # Deployment + Service
│   ├── deployment-registry.yaml  # Version avec registre prive
│   ├── rbac.yaml            # ServiceAccount + Roles
│   └── demo-pods.yaml       # Pods de test
├── scripts/
│   ├── deploy.sh            # Deploiement initial (import direct)
│   ├── deploy-registry.sh   # Deploiement avec registre prive
│   ├── redeploy.sh          # Mise a jour rapide
│   └── undeploy.sh          # Suppression complete
├── Dockerfile
└── requirements.txt
```

---

## Deploiement

### Prerequis

- Cluster Kubernetes (RKE2/K3s) avec NeuVector installe
- `kubectl` configure avec acces au cluster
- Docker ou Podman pour builder l'image

### Methode 1 : Import Direct dans Containerd (Sans Registre)

Cette methode importe l'image directement dans containerd sur le noeud. Utile pour les environnements de test ou sans registre.

```bash
# Deploiement initial
./scripts/deploy.sh -n <NODE_IP> -u rancher

# Mise a jour (rebuild + rolling restart)
./scripts/redeploy.sh -n <NODE_IP> -u rancher
```

**Options :**
| Option | Description | Default |
|--------|-------------|---------|
| `-n, --node` | IP du noeud Kubernetes | `172.16.3.21` |
| `-u, --user` | Utilisateur SSH | `rancher` |
| `-k, --kubeconfig` | Chemin kubeconfig | `~/.kube/config-downstream` |

**Fonctionnement :**
1. Build de l'image Docker localement
2. Export en tar (`docker save`)
3. Copie via SCP vers le noeud
4. Import dans containerd (`ctr images import`)
5. Deploiement des manifests Kubernetes

---

### Methode 2 : Registre Prive (Recommande pour Production)

Cette methode utilise un registre Docker prive pour stocker l'image.

#### 2.1 Configuration du Registre

**Variables d'environnement :**

```bash
export REGISTRY_URL="registry.example.com"
export REGISTRY_USER="myuser"
export REGISTRY_PASSWORD="mypassword"
export IMAGE_NAME="neuvector-demo-web"
export IMAGE_TAG="v1.0.0"
```

#### 2.2 Build et Push de l'Image

```bash
# Login au registre
docker login $REGISTRY_URL -u $REGISTRY_USER -p $REGISTRY_PASSWORD

# Build avec le tag complet
docker build -t ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} .

# Push vers le registre
docker push ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}
```

#### 2.3 Creer le Secret Kubernetes

```bash
kubectl create namespace neuvector-demo

kubectl create secret docker-registry registry-credentials \
  --namespace neuvector-demo \
  --docker-server=$REGISTRY_URL \
  --docker-username=$REGISTRY_USER \
  --docker-password=$REGISTRY_PASSWORD
```

#### 2.4 Deployer avec le Manifest Registry

Creer `manifests/deployment-registry.yaml` :

```yaml
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: neuvector-demo-web
  namespace: neuvector-demo
  labels:
    app: neuvector-demo-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: neuvector-demo-web
  template:
    metadata:
      labels:
        app: neuvector-demo-web
    spec:
      serviceAccountName: demo-web-sa
      imagePullSecrets:
      - name: registry-credentials
      containers:
      - name: web
        image: registry.example.com/neuvector-demo-web:v1.0.0  # <-- Modifier ici
        imagePullPolicy: Always
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: HOST
          value: "0.0.0.0"
        - name: PORT
          value: "8080"
        - name: DEMO_NAMESPACE
          value: "neuvector-demo"
        - name: NEUVECTOR_NAMESPACE
          value: "neuvector"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: neuvector-demo-web
  namespace: neuvector-demo
spec:
  type: NodePort
  selector:
    app: neuvector-demo-web
  ports:
  - port: 8080
    targetPort: 8080
    nodePort: 30080
    protocol: TCP
    name: http
```

**Deploiement :**

```bash
kubectl apply -f manifests/rbac.yaml
kubectl apply -f manifests/deployment-registry.yaml
```

#### 2.5 Script de Deploiement Automatise (Registre)

Creer `scripts/deploy-registry.sh` :

```bash
#!/bin/bash
set -e

REGISTRY_URL="${REGISTRY_URL:-registry.example.com}"
IMAGE_NAME="${IMAGE_NAME:-neuvector-demo-web}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"

echo "[INFO] Build de l'image..."
docker build -t ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG} .

echo "[INFO] Push vers le registre..."
docker push ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}

echo "[INFO] Deploiement Kubernetes..."
kubectl --kubeconfig "$KUBECONFIG" apply -f manifests/rbac.yaml
kubectl --kubeconfig "$KUBECONFIG" apply -f manifests/deployment-registry.yaml

echo "[INFO] Rollout restart..."
kubectl --kubeconfig "$KUBECONFIG" rollout restart deployment/neuvector-demo-web -n neuvector-demo

echo "[INFO] Attente du rollout..."
kubectl --kubeconfig "$KUBECONFIG" rollout status deployment/neuvector-demo-web -n neuvector-demo

echo "[INFO] Deploiement termine!"
```

---

### Methode 3 : Registre Insecure (Lab/Dev)

Pour un registre sans TLS (lab uniquement) :

#### Configuration containerd (sur chaque noeud)

Editer `/etc/rancher/rke2/registries.yaml` :

```yaml
mirrors:
  "registry.local:5000":
    endpoint:
      - "http://registry.local:5000"
configs:
  "registry.local:5000":
    tls:
      insecure_skip_verify: true
```

Redemarrer RKE2 :
```bash
sudo systemctl restart rke2-server  # ou rke2-agent
```

---

## Acces

| URL | Description |
|-----|-------------|
| `http://<NODE_IP>:30080` | Interface web |
| `http://<NODE_IP>:30080/api/health` | Health check |
| `http://<NODE_IP>:30080/api/demos` | Liste des demos |

---

## Utilisation

### Workflow Standard

1. **Ouvrir l'interface** : `http://<NODE_IP>:30080`
2. **Configurer NeuVector** : Cliquer sur l'icone ⚙️ et entrer les credentials
3. **Preparer l'environnement** : Cliquer **Prepare** pour deployer les pods de test
4. **Selectionner une demo** : Choisir "Interception de Process"
5. **Configurer et executer** : Ajuster les parametres et cliquer **Run Demo**
6. **Observer** :
   - La visualization montre l'etat (Success/Blocked/Intercepted)
   - Les events NeuVector s'affichent en temps reel
   - Les Allowed Processes sont mis a jour
7. **Nettoyer** : Cliquer **Reset** pour supprimer les ressources

### Demo : Interception de Process

Cette demo teste le blocage de processus par NeuVector :

1. **Mode Discover** : Tous les process sont autorises et appris
2. **Mode Protect** : Seuls les process appris sont autorises
3. **Test** :
   - Executer `curl` vers une URL → process autorise
   - Supprimer `curl` des Allowed Processes
   - Ré-executer → **Process Intercepted** (exit code 137)

---

## Configuration

### Variables d'Environnement

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Adresse d'ecoute |
| `PORT` | `8080` | Port d'ecoute |
| `DEMO_NAMESPACE` | `neuvector-demo` | Namespace pour les demos |
| `NEUVECTOR_NAMESPACE` | `neuvector` | Namespace NeuVector |
| `KUBECONFIG` | In-cluster | Chemin kubeconfig (dev only) |

### API NeuVector

L'application se connecte a l'API NeuVector via :
- **URL** : `https://neuvector-svc-controller.neuvector:10443`
- **Authentification** : Username/Password configurables dans l'UI

---

## Ajout d'une Nouvelle Demo

1. Creer un fichier dans `app/demos/` :

```python
from typing import Any, AsyncGenerator
from app.core.kubectl import Kubectl
from app.config import NAMESPACE
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry


@DemoRegistry.register
class MaDemo(DemoModule):
    id = "ma-demo"
    name = "Ma Demo"
    description = "Description de la demo"
    category = "Security"
    icon = "🔧"

    @property
    def parameters(self) -> list[DemoParameter]:
        return [
            DemoParameter(
                name="param1",
                label="Mon Parametre",
                type="text",
                default="valeur",
                required=True,
            ),
        ]

    async def execute(
        self,
        kubectl: Kubectl,
        params: dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        yield "[INFO] Execution de la demo..."

        async for line in kubectl.exec_in_pod(
            pod_name="opensuse-test",
            command=["echo", "Hello"],
            namespace=NAMESPACE,
        ):
            yield line

        yield "[INFO] Demo terminee"
```

2. Importer dans `app/demos/__init__.py` :

```python
from app.demos.ma_demo import MaDemo
```

3. Rebuilder et redeployer

---

## Securite

- **Validation stricte** des noms de pods (regex Kubernetes)
- **Whitelist de commandes** kubectl autorisees
- **Namespaces restreints** : seul `neuvector-demo` est accessible
- **Timeout** sur toutes les commandes (30s par defaut)
- **RBAC** : ServiceAccount avec permissions minimales

---

## Troubleshooting

### L'application ne demarre pas

```bash
# Verifier les logs du pod
kubectl logs -n neuvector-demo -l app=neuvector-demo-web

# Verifier les events
kubectl get events -n neuvector-demo --sort-by='.lastTimestamp'
```

### Erreur "Image not found"

**Methode Import Direct :**
```bash
# Verifier que l'image est presente dans containerd
ssh rancher@<NODE_IP> "sudo /var/lib/rancher/rke2/bin/ctr \
  -a /run/k3s/containerd/containerd.sock \
  -n k8s.io images ls | grep neuvector-demo"
```

**Methode Registre :**
```bash
# Verifier le secret
kubectl get secret registry-credentials -n neuvector-demo -o yaml

# Verifier les events d'ImagePull
kubectl describe pod -n neuvector-demo -l app=neuvector-demo-web
```

### NeuVector API "Not configured"

1. Cliquer sur ⚙️ Settings
2. Entrer le username/password NeuVector
3. Cliquer "Test Connection"
4. Si OK, cliquer "Save"

### K8s Cluster "Disconnected"

Verifier que le ServiceAccount a les permissions :
```bash
kubectl auth can-i get pods -n neuvector-demo --as=system:serviceaccount:neuvector-demo:demo-web-sa
```

---

## Developpement Local

```bash
# Installer les dependances
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Lancer l'application (necessite kubeconfig)
export KUBECONFIG=~/.kube/config-downstream
python run.py
```

---

## Licence

MIT
