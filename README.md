# NeuVector Demo Web Application

Application web interactive pour executer des demonstrations NeuVector sur un cluster Kubernetes.

**Version actuelle : 1.2.0**

## Fonctionnalites

### Actions Plateforme
- **Prepare** : Deploie le namespace `neuvector-demo` et les pods de test (utilise le registre configure)
- **Status** : Verifie l'etat de la plateforme et des pods
- **Reset** : Supprime le namespace et toutes les ressources de demo
- **Reset Rules** : Remet les groupes demo en mode Discover avec baseline zero-drift

### Configuration
- **Image Registry** : Configuration dynamique du registre d'images (localhost ou registre prive)
- **NeuVector API** : Credentials configurables avec test de connexion
- **Cosmetics** : Titre et logo personnalisables

### Demos Disponibles

| Demo | Description |
|------|-------------|
| **Interception de Process** | Test d'execution de commandes (curl) avec visualisation du blocage par NeuVector |
| **DLP Detection** | Test d'envoi de donnees sensibles (carte credit, SSN, passeport) avec blocage DLP |
| **Admission Control** | Test de creation de pods dans un namespace interdit avec blocage par admission control |

### Interface

- **Visualization interactive** : Diagramme Source → Target montrant l'etat de la connexion
- **Controles NeuVector** : Network Policy, Process Profile, Baseline configurables en direct
- **DLP Sensors** : Activation/desactivation des sensors avec mode Alert ou Block
- **Mode Icons** : Indicateurs visuels (cadenas/loupe) montrant l'etat Protect/Monitor
- **NeuVector Events** : Affichage des incidents et violations detectes en temps reel
- **Allowed Processes** : Gestion des regles de process (ajout/suppression)
- **Cluster Status** : Affichage de l'etat du cluster K8s et de l'API NeuVector
- **Diagnostics** : Verification complete de l'environnement (K8s, NeuVector, pods, DLP, admission)

## Visualization Interactive

### Etats Visuels

| Etat | Source | Fleche | Target | Description |
|------|--------|--------|--------|-------------|
| **Pending** | Gris | Gris pointille | Gris | Avant execution |
| **Running** | Bleu pulsant | Bleu anime | Bleu | En cours |
| **Success** | Vert | Vert plein | Vert | Communication OK |
| **Network Blocked** | Orange | Rouge barre | Rouge | Reseau bloque |
| **Process Intercepted** | Rouge barre | Rouge barre | Gris | Process bloque |

### Mode Icons (Source et Target)

- 🔒 **Cadenas** : Mode Protect actif
- 🔍 **Loupe** : Mode Monitor actif
- 👁️ **Oeil** : Mode Discover actif

### Controles Pod (Source et Target)

Pour chaque pod (source et target interne), les controles suivants sont disponibles :

- **Network Policy** : Discover / Monitor / Protect
- **Process Profile** : Discover / Monitor / Protect
- **Baseline** : Basic / Zero Drift / Shield

### DLP Sensors

Les sensors DLP peuvent etre actives/desactives avec deux modes :
- **Alert** : Detecte et journalise sans bloquer
- **Block** : Detecte, journalise et bloque le trafic

Sensors disponibles :
- Credit Card (sensor.creditcard)
- SSN (sensor.ssn)
- Passeport (sensor.passeport)
- Visa (sensor.visa)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Visualization  │  NeuVector Events  │  Allowed Processes │  │
│  │  [Source]──────►[Target]             │  - curl            │  │
│  │   🔒🔍 Status   │  Incidents/DLP     │  - wget            │  │
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
│ espion1       │  │ Controller    │  │ API Server    │
│ cible1        │  │ REST API      │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

## Structure du Projet

```
neuvector-demo-web/
├── app/
│   ├── main.py              # Application FastAPI
│   ├── config.py            # Configuration (version, registre, etc.)
│   ├── api/
│   │   ├── routes.py        # Endpoints REST + NeuVector API + Registry
│   │   └── websocket.py     # WebSocket handlers
│   ├── core/
│   │   ├── kubectl.py       # Wrapper kubectl securise
│   │   ├── neuvector_api.py # Client API NeuVector
│   │   └── websocket_manager.py
│   ├── demos/               # Modules de demo
│   │   ├── base.py          # Classe abstraite
│   │   ├── connectivity.py  # Demo interception process
│   │   ├── dlp.py           # Demo DLP
│   │   ├── admission.py     # Demo Admission Control
│   │   └── registry.py      # Auto-registration
│   └── lifecycle/           # Actions prepare/reset/status
│       ├── prepare.py       # Deploiement dynamique avec registre configurable
│       ├── reset.py
│       └── status.py
├── static/
│   ├── css/style.css        # Styles (visualization, DLP, events)
│   └── js/
│       ├── main.js          # Logique UI + Settings + Registry
│       └── websocket.js     # Client WebSocket
├── templates/
│   └── index.html           # Interface avec onglets Preparation/Credentials/Troubleshoot/Cosmetics
├── manifests/
│   ├── deployment.yaml      # Deployment + Service
│   ├── deployment-registry.yaml  # Version avec registre prive
│   ├── rbac.yaml            # ServiceAccount + Roles
│   └── demo-pods.yaml       # Pods de test (reference)
├── scripts/
│   ├── deploy.sh            # Deploiement initial (import direct)
│   ├── deploy-registry.sh   # Deploiement avec registre prive
│   ├── redeploy.sh          # Mise a jour rapide
│   └── undeploy.sh          # Suppression complete
├── Dockerfile
└── requirements.txt
```

---

## Configuration du Registre d'Images

### Via l'Interface Web (Recommande)

1. Ouvrir les **Parametres** (icone ⚙️)
2. Aller dans l'onglet **Preparation**
3. Dans la section **Image Registry**, entrer l'URL du registre :
   - **localhost** : Pour images locales (imagePullPolicy: Never)
   - **registry.example.com/project** : Pour registre prive (imagePullPolicy: IfNotPresent)
4. Cliquer sur **Test Registry** pour verifier la connectivite
5. Cliquer sur **Save & Close**

Le registre configure sera utilise pour :
- Le deploiement des pods de demo (bouton **Prepare**)
- La demo Admission Control (creation de pods de test)

### Via Variable d'Environnement

```bash
export DEMO_IMAGE_REGISTRY="registry.example.com/myproject"
```

---

## Deploiement

### Prerequis

- Cluster Kubernetes (RKE2/K3s) avec NeuVector installe
- `kubectl` configure avec acces au cluster
- Docker ou Podman pour builder l'image

### Construction des Images de Demo

Les pods de demo (`espion1` et `cible1`) utilisent des images personnalisees qui doivent etre construites et importees dans le cluster.

#### Images requises

| Image | Description | Dockerfile |
|-------|-------------|------------|
| `demo-production1` | OpenSUSE avec outils reseau (curl, nmap, nc, ssh) | `images/production1/Dockerfile` |
| `demo-web1` | Nginx avec serveur SSH et outils reseau | `images/web1/Dockerfile` |

#### Build et Import des Images

```bash
# Variables
NODE_IP="172.16.3.21"
NODE_USER="rancher"

# Build des images
podman build -t demo-production1:latest images/production1/
podman build -t demo-web1:latest images/web1/

# Export en tar
podman save demo-production1:latest -o /tmp/demo-production1.tar
podman save demo-web1:latest -o /tmp/demo-web1.tar

# Copie vers le noeud
scp /tmp/demo-production1.tar /tmp/demo-web1.tar ${NODE_USER}@${NODE_IP}:/tmp/

# Import dans containerd (sur le noeud)
ssh ${NODE_USER}@${NODE_IP} "sudo /var/lib/rancher/rke2/bin/ctr \
  --address /run/k3s/containerd/containerd.sock \
  -n k8s.io images import /tmp/demo-production1.tar"

ssh ${NODE_USER}@${NODE_IP} "sudo /var/lib/rancher/rke2/bin/ctr \
  --address /run/k3s/containerd/containerd.sock \
  -n k8s.io images import /tmp/demo-web1.tar"
```

> **Note**: Ces images sont referenciees avec `imagePullPolicy: Never` dans les manifests quand le registre est "localhost", donc elles doivent etre presentes localement dans containerd sur chaque noeud.

---

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
export IMAGE_TAG="v1.2.0"
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

```bash
kubectl apply -f manifests/rbac.yaml
kubectl apply -f manifests/deployment-registry.yaml
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
| `http://<NODE_IP>:30080/api/version` | Version de l'application |
| `http://<NODE_IP>:30080/api/demos` | Liste des demos |

---

## Utilisation

### Workflow Standard

1. **Ouvrir l'interface** : `http://<NODE_IP>:30080`
2. **Configurer les parametres** : Cliquer sur l'icone ⚙️
   - **Preparation** : Configurer le registre d'images si necessaire
   - **Credentials** : Entrer les credentials NeuVector et tester la connexion
3. **Preparer l'environnement** : Cliquer **Prepare** pour deployer les pods de test
4. **Selectionner une demo** : Choisir dans le menu lateral
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
   - Re-executer → **Process Intercepted** (exit code 137)

### Demo : DLP Detection

Cette demo teste la detection et le blocage de donnees sensibles :

1. **Configuration pour blocage DLP** (recommande) :
   - Network Policy en **Protect**
   - Process Profile en **Protect**
   - Baseline en **Zero Drift**
   - Au moins un DLP sensor active en mode **Block**

2. **Parametres** :
   - Selectionner le pod source (espion1)
   - Selectionner la cible (Internal Nginx Pod ou External Service)
   - Choisir le type de donnees sensibles (Credit Card, SSN, Passeport, Custom)

3. **Execution** :
   - Cliquer **Run DLP Test**
   - Le test envoie des donnees correspondant au sensor choisi
   - Si DLP est configure en mode Block, NeuVector bloque la requete

4. **Resultat** :
   - Si bloque : la visualization passe en rouge, timeout de connexion
   - Si non bloque : la visualization passe en vert, reponse recue
   - Les events DLP apparaissent dans le panel NeuVector Events

### Demo : Admission Control

Cette demo teste le blocage de creation de ressources par NeuVector Admission Control :

1. **Prerequis** :
   - Admission Control doit etre active dans NeuVector
   - Une regle d'admission doit exister pour bloquer le namespace `untrusted-namespace`

2. **Configuration du registre** :
   - Le registre configure dans les parametres sera utilise pour l'image du pod de test
   - Pour "localhost" : imagePullPolicy sera "Never"
   - Pour un registre distant : imagePullPolicy sera "IfNotPresent"

3. **Interface** :
   - Selecteur de namespace (allowed ou forbidden)
   - Champ de nom de pod personnalisable
   - Boutons d'action : Create Pod, Delete Pod, Check Status

4. **Test** :
   - Selectionner le namespace **Allowed** → creer un pod → succes
   - Selectionner le namespace **Forbidden** → creer un pod → bloque par Admission Control
   - Observer les evenements dans la console

5. **Resultat** :
   - Si autorise : le pod est cree avec succes
   - Si bloque : erreur "Admission control DENIED" affichee

---

## API Endpoints

### General

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/version` | GET | Version de l'application et info Git |
| `/api/demos` | GET | Liste des demos disponibles |
| `/api/config` | GET | Configuration actuelle |
| `/api/cluster-info` | GET | Info cluster Kubernetes |
| `/api/diagnostics` | POST | Diagnostics complets de l'environnement |

### Registry

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/registry/test` | POST | Test de connectivite au registre d'images |

### NeuVector Integration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/neuvector/test` | POST | Test de connexion API |
| `/api/neuvector/default-url` | GET | URL par defaut de l'API NeuVector |
| `/api/neuvector/group-status` | POST | Statut d'un groupe (modes, baseline) |
| `/api/neuvector/pod-info` | POST | Info combinee groupe + process profile |
| `/api/neuvector/update-group` | POST | Modifier policy_mode, profile_mode, baseline |
| `/api/neuvector/reset-demo-rules` | POST | Reset des regles demo (Discover + zero-drift) |
| `/api/neuvector/dlp-config` | POST | Configuration DLP d'un groupe |
| `/api/neuvector/update-dlp-sensor` | POST | Activer/desactiver un sensor DLP |
| `/api/neuvector/process-profile` | POST | Liste des process autorises |
| `/api/neuvector/delete-process-rule` | POST | Supprimer un process autorise |
| `/api/neuvector/recent-events` | POST | Evenements recents (incidents, violations, DLP) |
| `/api/neuvector/admission-state` | POST | Etat de l'Admission Control (enabled, mode) |
| `/api/neuvector/update-admission-state` | POST | Activer/desactiver l'Admission Control |
| `/api/neuvector/admission-rules` | POST | Liste des regles d'admission |
| `/api/neuvector/create-admission-rule` | POST | Creer une regle d'admission |
| `/api/neuvector/delete-admission-rule` | POST | Supprimer une regle d'admission |
| `/api/neuvector/admission-events` | POST | Evenements d'admission recents |

### DLP

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dlp/sensors` | POST | Liste des sensors DLP disponibles |

---

## Configuration

### Variables d'Environnement

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Adresse d'ecoute |
| `PORT` | `8080` | Port d'ecoute |
| `DEMO_NAMESPACE` | `neuvector-demo` | Namespace pour les demos |
| `NEUVECTOR_NAMESPACE` | `neuvector` | Namespace NeuVector |
| `NEUVECTOR_API_URL` | `https://neuvector-svc-controller.neuvector:10443` | URL API NeuVector |
| `DEMO_IMAGE_REGISTRY` | `localhost` | Registre pour les images de demo |
| `KUBECONFIG` | In-cluster | Chemin kubeconfig (dev only) |
| `KUBECTL_TIMEOUT` | `120` | Timeout kubectl en secondes |

### Stockage Local (Browser)

Les parametres suivants sont stockes dans le localStorage du navigateur :

| Cle | Description |
|-----|-------------|
| `neuvector_settings` | Credentials NeuVector (username, password) |
| `neuvector_api_url` | URL personnalisee de l'API NeuVector |
| `neuvector_registry` | URL du registre d'images |
| `neuvector_title` | Titre personnalise de l'application |
| `neuvector_logo` | Logo personnalise (base64) |

---

## Ajout d'une Nouvelle Demo

1. Creer un fichier dans `app/demos/` :

```python
from typing import Any, AsyncGenerator
from app.core.kubectl import Kubectl
from app.config import NAMESPACE, DEMO_IMAGE_REGISTRY
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
        # Recuperer le registre dynamique si fourni
        image_registry = params.get("image_registry") or DEMO_IMAGE_REGISTRY

        yield "[INFO] Execution de la demo..."
        yield f"[INFO] Registre: {image_registry}"

        async for line in kubectl.exec_in_pod(
            pod_name="espion1",
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
- **Namespaces restreints** : seul `neuvector-demo` et namespaces autorises sont accessibles
- **Timeout** sur toutes les commandes (120s par defaut)
- **RBAC** : ServiceAccount avec permissions minimales
- **TLS** : Verification SSL desactivable pour registres internes

---

## Troubleshooting

### Onglet Diagnostics

L'onglet **Troubleshoot** dans les parametres permet de verifier :
- Connectivite Kubernetes
- API NeuVector
- Namespace de demo
- Pods de demo
- Groupes NeuVector
- Profiles de process
- Sensors DLP
- Admission Control

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

### Test Registry echoue

1. Verifier que l'URL du registre est correcte
2. Pour un registre distant, verifier la connectivite reseau
3. Pour "localhost", verifier que les images sont importees sur les noeuds
4. Verifier les certificats TLS si le registre utilise HTTPS

### NeuVector API "Not configured"

1. Cliquer sur ⚙️ Settings
2. Aller dans l'onglet **Credentials**
3. Entrer le username/password NeuVector
4. Cliquer "Test Connection"
5. Si OK, cliquer "Save & Close"

### K8s Cluster "Disconnected"

Verifier que le ServiceAccount a les permissions :
```bash
kubectl auth can-i get pods -n neuvector-demo --as=system:serviceaccount:neuvector-demo:demo-web-sa
```

### DLP ne bloque pas

1. Verifier que Network Policy est en **Protect**
2. Verifier qu'un sensor DLP est active en mode **Block** (pas Alert)
3. Le pattern de carte credit doit etre non-repetitif (ex: 4532-0151-1283-0366)
4. Les patterns repetitifs (4242-4242-4242-4242) sont exclus par le regex NeuVector

### Pods de demo ne demarrent pas

1. Verifier le registre configure dans les parametres
2. Pour "localhost", verifier que les images sont importees :
   ```bash
   ssh rancher@<NODE_IP> "sudo /var/lib/rancher/rke2/bin/ctr \
     -a /run/k3s/containerd/containerd.sock \
     -n k8s.io images ls | grep demo-"
   ```
3. Pour un registre distant, verifier les credentials et la connectivite

---

## Developpement Local

```bash
# Installer les dependances
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Lancer l'application (necessite kubeconfig)
export KUBECONFIG=~/.kube/config-downstream
export DEMO_IMAGE_REGISTRY=localhost
python run.py
```

---

## Changelog

### Version 1.2.0
- Ajout de la configuration dynamique du registre d'images dans l'interface
- Bouton "Test Registry" pour verifier la connectivite au registre
- Le registre est utilise pour Prepare et Admission Control demo
- Generation dynamique des manifests de pods avec le registre configure
- Support de imagePullPolicy dynamique (Never pour localhost, IfNotPresent pour distant)

### Version 1.1.0
- Ajout de la demo Admission Control
- Diagnostics complets de l'environnement
- Reset des regles NeuVector (Discover + zero-drift)
- Ameliorations de l'interface utilisateur

### Version 1.0.0
- Version initiale
- Demos: Interception de Process, DLP Detection
- Integration NeuVector API
- Visualization interactive

---

## Licence

MIT
