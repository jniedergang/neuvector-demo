# Déploiement Offline

Ce projet peut fonctionner sans accès internet une fois déployé.

## Image container pré-buildée

Le fichier `neuvector-demo-web-image.tar.gz` (130 Mo) contient l'image Docker/Podman prête à l'emploi.

### Import de l'image

```bash
# Avec Podman
podman load < neuvector-demo-web-image.tar.gz

# Avec Docker
docker load < neuvector-demo-web-image.tar.gz

# Avec containerd (Kubernetes RKE2/K3s)
gunzip -c neuvector-demo-web-image.tar.gz | ctr -n k8s.io images import -
```

### Déploiement Kubernetes

L'image sera disponible localement sous le nom `localhost/neuvector-demo-web:latest`.

Modifier le deployment pour utiliser `imagePullPolicy: Never` ou `IfNotPresent` :

```yaml
spec:
  containers:
  - name: neuvector-demo-web
    image: localhost/neuvector-demo-web:latest
    imagePullPolicy: Never
```

## Prérequis réseau interne

L'application nécessite un accès réseau **interne** au cluster vers :
- L'API NeuVector (port 10443)
- L'API Kubernetes (pour kubectl)

Aucun accès internet n'est requis.
