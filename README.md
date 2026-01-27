# NeuVector Demo Web Application

Application web interactive pour executer des demonstrations NeuVector.

## Fonctionnalites

- **Prepare** : Deploie le namespace `neuvector-demo` et les pods de test
- **Reset** : Supprime le namespace et toutes les ressources de demo
- **Status** : Verifie l'etat de la plateforme

### Demos disponibles

| Demo | Description |
|------|-------------|
| **Network Connectivity** | Test curl depuis un pod vers une URL externe |
| **DLP Detection** | Test d'envoi de donnees sensibles (carte credit, SSN) |

## Architecture

```
Browser <--WebSocket/HTTP--> FastAPI Pod <--kubectl--> Cluster K8S
```

## Structure du projet

```
neuvector-demo-web/
├── app/
│   ├── main.py              # Application FastAPI
│   ├── config.py            # Configuration
│   ├── api/                 # REST et WebSocket endpoints
│   ├── core/                # kubectl wrapper, WebSocket manager
│   ├── demos/               # Modules de demo (extensible)
│   └── lifecycle/           # Actions prepare/reset/status
├── static/                  # CSS/JS
├── templates/               # Templates HTML
├── manifests/               # Manifests Kubernetes
├── scripts/                 # Scripts de deploiement
├── Dockerfile
└── requirements.txt
```

## Deploiement sur Kubernetes

### Prerequis

- Cluster Kubernetes avec NeuVector installe
- Acces SSH au noeud du cluster (user: rancher)
- Docker/Podman pour builder l'image

### Deploiement automatique

```bash
./scripts/deploy.sh
```

### Deploiement manuel

1. **Builder l'image Docker**
   ```bash
   docker build -t neuvector-demo-web:latest .
   ```

2. **Exporter et copier l'image**
   ```bash
   docker save neuvector-demo-web:latest -o /tmp/neuvector-demo-web.tar
   scp /tmp/neuvector-demo-web.tar rancher@<NODE_IP>:/tmp/
   ```

3. **Importer dans containerd**
   ```bash
   ssh rancher@<NODE_IP> "sudo /var/lib/rancher/rke2/bin/ctr \
     -a /run/k3s/containerd/containerd.sock \
     -n k8s.io images import /tmp/neuvector-demo-web.tar"
   ```

4. **Deployer les manifests**
   ```bash
   kubectl apply -f manifests/rbac.yaml
   kubectl apply -f manifests/deployment.yaml
   ```

## Acces

L'application est accessible sur:
- **URL**: `http://<NODE_IP>:30080`
- **Health check**: `http://<NODE_IP>:30080/api/health`

## Utilisation

1. Ouvrir l'interface web
2. Cliquer **Prepare** pour initialiser l'environnement de demo
3. Selectionner une demo dans la barre laterale
4. Configurer les parametres si necessaire
5. Cliquer **Run Demo**
6. Observer les resultats dans la console et dans NeuVector UI
7. Cliquer **Reset** pour nettoyer apres la demo

## Ajout d'une nouvelle demo

1. Creer un fichier dans `app/demos/`:

```python
from app.demos.base import DemoModule, DemoParameter
from app.demos.registry import DemoRegistry

@DemoRegistry.register
class MaDemo(DemoModule):
    id = "ma-demo"
    name = "Ma Demo"
    description = "Description de la demo"
    category = "Category"
    icon = "🔧"

    @property
    def parameters(self):
        return [
            DemoParameter(
                name="param1",
                label="Mon Parametre",
                type="text",
                default="valeur",
                required=True,
            ),
        ]

    async def execute(self, kubectl, params):
        yield "[INFO] Execution de la demo..."
        # Votre logique ici
        async for line in kubectl.exec_in_pod("pod-name", ["commande"]):
            yield line
        yield "[INFO] Demo terminee"
```

2. Importer dans `app/demos/__init__.py`
3. Rebuilder et redeployer l'image

## Configuration

Variables d'environnement:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Adresse d'ecoute |
| `PORT` | `8080` | Port d'ecoute |
| `DEMO_NAMESPACE` | `neuvector-demo` | Namespace pour les demos |
| `NEUVECTOR_NAMESPACE` | `neuvector` | Namespace NeuVector |
| `KUBECONFIG` | In-cluster | Chemin kubeconfig |

## Securite

- Validation stricte des noms de pods (regex)
- Actions limitees aux namespaces autorises
- Commandes kubectl en whitelist uniquement
- Timeout sur toutes les commandes
