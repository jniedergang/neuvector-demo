/**
 * NeuVector Demo Platform - Main JavaScript
 *
 * This file contains the main UI logic for the NeuVector Demo Platform:
 * - SettingsManager: NeuVector API credentials, logo, and title management
 * - DemoManager: Demo selection, visualization, execution, and NeuVector integration
 *
 * Features:
 * - Interactive visualization with Source → Target diagram
 * - Real-time NeuVector Events display (incidents, violations, DLP)
 * - Pod settings management (Network Policy, Process Profile, Baseline)
 * - DLP Sensors configuration with Alert/Block modes
 * - Mode icons showing Protect/Monitor/Discover status
 * - Process rules management (add/delete)
 * - DLP ready state validation before execution
 */

/**
 * Settings Manager - handles NeuVector API credentials, logo and title
 * Stores settings in localStorage and provides API connectivity testing
 */
class SettingsManager {
    constructor() {
        this.STORAGE_KEY = 'neuvector_settings';
        this.LOGO_KEY = 'neuvector_logo';
        this.TITLE_KEY = 'neuvector_title';
        this.modal = document.getElementById('settings-modal');
        this.usernameInput = document.getElementById('settings-username');
        this.passwordInput = document.getElementById('settings-password');
        this.titleInput = document.getElementById('settings-title');
        this.apiUrlDisplay = document.getElementById('settings-api-url');
        this.statusDiv = document.getElementById('settings-status');
        this.apiStatusBox = document.getElementById('api-status-box');
        this.apiStatusValue = document.getElementById('api-status-value');
        this.logoFileInput = document.getElementById('logo-file-input');
        this.logoPreview = document.getElementById('logo-preview');
        this.removeLogo = document.getElementById('btn-remove-logo');
        this.headerLogo = document.getElementById('header-logo');
        this.headerTitle = document.getElementById('header-title');
    }

    init() {
        // Load saved settings
        this.loadSettings();

        // Load and display logo and title
        this.loadLogo();
        this.loadTitle();

        // Fetch API URL
        this.fetchApiUrl();

        // Check API status on load if credentials exist
        this.checkApiStatus();

        // Check cluster status
        this.checkClusterStatus();

        // Event listeners
        document.getElementById('btn-settings')?.addEventListener('click', () => this.openModal());
        document.getElementById('btn-close-settings')?.addEventListener('click', () => this.closeModal());
        document.getElementById('btn-test-connection')?.addEventListener('click', () => this.testConnection());
        document.getElementById('btn-save-settings')?.addEventListener('click', () => this.saveSettings());

        // Logo event listeners
        this.logoFileInput?.addEventListener('change', (e) => this.handleLogoUpload(e));
        this.removeLogo?.addEventListener('click', () => this.handleLogoRemove());

        // Close on overlay click
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal?.classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    async fetchApiUrl() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            // API URL is not exposed in config, will be shown after test
            this.apiUrlDisplay.textContent = 'Test connection to see API URL';
        } catch (error) {
            this.apiUrlDisplay.textContent = 'Unable to fetch';
        }
    }

    openModal() {
        this.loadSettings();
        this.clearStatus();
        // Refresh title
        const title = localStorage.getItem(this.TITLE_KEY) || 'NeuVector Demo Platform';
        if (this.titleInput) {
            this.titleInput.value = title;
        }
        // Refresh logo preview
        const logoData = localStorage.getItem(this.LOGO_KEY);
        if (logoData) {
            this.displayLogo(logoData);
        } else {
            if (this.logoPreview) {
                this.logoPreview.innerHTML = '<span class="logo-placeholder">No logo</span>';
            }
            if (this.removeLogo) {
                this.removeLogo.style.display = 'none';
            }
        }
        this.modal?.classList.add('active');
    }

    closeModal() {
        this.modal?.classList.remove('active');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                if (this.usernameInput) this.usernameInput.value = settings.username || 'admin';
                if (this.passwordInput) this.passwordInput.value = settings.password || '';
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    saveSettings() {
        const settings = {
            username: this.usernameInput?.value || 'admin',
            password: this.passwordInput?.value || '',
        };

        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
            this.saveTitle(); // Save title
            this.checkApiStatus(); // Refresh API status
            this.closeModal();
        } catch (error) {
            this.showStatus('Failed to save settings', 'error');
        }
    }

    async checkApiStatus() {
        const credentials = this.getCredentials();

        if (!credentials.password) {
            this.updateApiStatusDisplay('N/A', '');
            return;
        }

        this.updateApiStatusDisplay('...', 'checking');

        try {
            const response = await fetch('/api/neuvector/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
            });

            const result = await response.json();

            if (result.success) {
                this.updateApiStatusDisplay('OK', 'ok');
            } else {
                this.updateApiStatusDisplay('KO', 'error');
            }
        } catch (error) {
            this.updateApiStatusDisplay('KO', 'error');
        }
    }

    updateApiStatusDisplay(text, status) {
        if (this.apiStatusValue) {
            this.apiStatusValue.textContent = text;
        }
        if (this.apiStatusBox) {
            this.apiStatusBox.className = 'header-status-box' + (status ? ' ' + status : '');
        }
    }

    async checkClusterStatus() {
        const clusterStatusBox = document.getElementById('cluster-status-box');
        const clusterStatusValue = document.getElementById('cluster-status-value');

        if (!clusterStatusBox || !clusterStatusValue) return;

        clusterStatusBox.className = 'header-status-box checking';
        clusterStatusValue.textContent = '...';

        try {
            const response = await fetch('/api/cluster-info');
            const info = await response.json();

            if (info.connected) {
                // Extract short name from context (e.g., "downstream" from "downstream")
                const contextName = info.context || 'unknown';
                const shortName = contextName.split('/').pop().split('@').pop();
                clusterStatusValue.textContent = `${shortName} (${info.node_count}n)`;
                clusterStatusBox.className = 'header-status-box ok';
            } else {
                clusterStatusValue.textContent = 'Disconnected';
                clusterStatusBox.className = 'header-status-box error';
            }
        } catch (error) {
            clusterStatusValue.textContent = 'Error';
            clusterStatusBox.className = 'header-status-box error';
        }
    }

    getCredentials() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to get credentials:', error);
        }
        return { username: 'admin', password: '' };
    }

    async testConnection() {
        const username = this.usernameInput?.value || 'admin';
        const password = this.passwordInput?.value || '';

        if (!password) {
            this.showStatus('Please enter a password', 'error');
            return;
        }

        this.showStatus('Testing connection...', 'testing');

        try {
            const response = await fetch('/api/neuvector/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (result.success) {
                this.showStatus('Connection successful!', 'success');
                this.apiUrlDisplay.textContent = result.api_url;
            } else {
                this.showStatus(`Connection failed: ${result.message}`, 'error');
                this.apiUrlDisplay.textContent = result.api_url;
            }
        } catch (error) {
            this.showStatus(`Error: ${error.message}`, 'error');
        }
    }

    showStatus(message, type) {
        if (this.statusDiv) {
            this.statusDiv.textContent = message;
            this.statusDiv.className = 'settings-status ' + type;
        }
    }

    clearStatus() {
        if (this.statusDiv) {
            this.statusDiv.textContent = '';
            this.statusDiv.className = 'settings-status';
        }
    }

    /**
     * Load title from localStorage and display it
     */
    loadTitle() {
        try {
            const title = localStorage.getItem(this.TITLE_KEY);
            if (title) {
                if (this.headerTitle) {
                    this.headerTitle.textContent = title;
                }
                if (this.titleInput) {
                    this.titleInput.value = title;
                }
                document.title = title;
            }
        } catch (error) {
            console.error('Failed to load title:', error);
        }
    }

    /**
     * Save title to localStorage
     */
    saveTitle() {
        const title = this.titleInput?.value || 'NeuVector Demo Platform';
        try {
            localStorage.setItem(this.TITLE_KEY, title);
            if (this.headerTitle) {
                this.headerTitle.textContent = title;
            }
            document.title = title;
        } catch (error) {
            console.error('Failed to save title:', error);
        }
    }

    /**
     * Load logo from localStorage and display it
     */
    loadLogo() {
        try {
            const logoData = localStorage.getItem(this.LOGO_KEY);
            if (logoData) {
                this.displayLogo(logoData);
            }
        } catch (error) {
            console.error('Failed to load logo:', error);
        }
    }

    /**
     * Display logo in header and preview
     */
    displayLogo(dataUrl) {
        // Update header logo
        if (this.headerLogo) {
            this.headerLogo.src = dataUrl;
            this.headerLogo.style.display = 'inline';
        }

        // Update preview
        if (this.logoPreview) {
            this.logoPreview.innerHTML = `<img src="${dataUrl}" alt="Logo">`;
        }

        // Show remove button
        if (this.removeLogo) {
            this.removeLogo.style.display = 'inline-flex';
        }
    }

    /**
     * Handle logo file upload
     */
    handleLogoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Check file size (max 500KB)
        if (file.size > 500 * 1024) {
            alert('Image must be smaller than 500KB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result;
            if (dataUrl) {
                try {
                    localStorage.setItem(this.LOGO_KEY, dataUrl);
                    this.displayLogo(dataUrl);
                } catch (error) {
                    console.error('Failed to save logo:', error);
                    alert('Failed to save logo. The image may be too large.');
                }
            }
        };
        reader.readAsDataURL(file);
    }

    /**
     * Handle logo removal
     */
    handleLogoRemove() {
        try {
            localStorage.removeItem(this.LOGO_KEY);
        } catch (error) {
            console.error('Failed to remove logo:', error);
        }

        // Hide header logo
        if (this.headerLogo) {
            this.headerLogo.src = '';
            this.headerLogo.style.display = 'none';
        }

        // Reset preview
        if (this.logoPreview) {
            this.logoPreview.innerHTML = '<span class="logo-placeholder">No logo</span>';
        }

        // Hide remove button
        if (this.removeLogo) {
            this.removeLogo.style.display = 'none';
        }

        // Reset file input
        if (this.logoFileInput) {
            this.logoFileInput.value = '';
        }
    }

    async getGroupStatus(groupName) {
        const credentials = this.getCredentials();
        if (!credentials.password) {
            return null;
        }

        try {
            const response = await fetch('/api/neuvector/group-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                }),
            });

            const result = await response.json();
            if (result.success) {
                return result;
            }
        } catch (error) {
            console.error('Failed to get group status:', error);
        }
        return null;
    }
}

// Global settings manager
const settingsManager = new SettingsManager();

document.addEventListener('DOMContentLoaded', () => {
    const app = new DemoApp();
    app.init();
    settingsManager.init();

    // Sidebar toggle functionality
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    const closeBtn = document.getElementById('btn-sidebar-close');

    const openSidebar = () => {
        sidebar?.classList.add('open');
        backdrop?.classList.add('visible');
    };

    const closeSidebar = () => {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('visible');
    };

    toggleBtn?.addEventListener('click', openSidebar);
    closeBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);

    // Close sidebar when a demo is selected
    document.querySelectorAll('.demo-item').forEach(item => {
        item.addEventListener('click', closeSidebar);
    });

    // Close sidebar on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
            closeSidebar();
        }
    });
});

/**
 * DemoApp - Main application class for demo management
 *
 * Handles:
 * - Demo list loading and selection
 * - Interactive visualization (Source → Target diagram)
 * - Pod settings (Network Policy, Process Profile, Baseline)
 * - DLP sensors configuration and ready state validation
 * - Mode icons display (Protect/Monitor/Discover)
 * - Process rules management
 * - NeuVector Events display
 * - WebSocket communication for demo execution
 *
 * Visualization States:
 * - pending: Initial state before execution
 * - running: Demo is executing
 * - success: Communication successful
 * - blocked: Network blocked by NeuVector
 * - intercepted: Process intercepted by NeuVector
 */
class DemoApp {
    constructor() {
        this.currentDemo = null;
        this.isRunning = false;
        this.console = null;
        this.vizState = 'pending';
        this.vizContainer = null;
        this.currentDemoType = null;  // 'connectivity', 'dlp', or other
        this.detectedResult = null;   // Store detected result until execution completes
    }

    init() {
        // Initialize WebSocket
        wsManager.connect();
        wsManager.onMessage(msg => this.handleMessage(msg));
        wsManager.onStatusChange(status => this.updateConnectionStatus(status));

        // Cache DOM elements
        this.console = document.getElementById('output-console');
        this.consoleBody = document.getElementById('console-body');
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');
        this.demoForm = document.getElementById('demo-form');
        this.demoParams = document.getElementById('demo-params');
        this.demoSelector = document.getElementById('demo-selector');
        this.demoDescription = document.getElementById('demo-description');
        this.runButton = document.getElementById('run-demo-btn');

        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Lifecycle buttons
        document.getElementById('btn-prepare')?.addEventListener('click', () => this.runAction('prepare'));
        document.getElementById('btn-reset')?.addEventListener('click', () => this.runAction('reset'));
        document.getElementById('btn-status')?.addEventListener('click', () => this.runAction('status'));
        document.getElementById('btn-clear')?.addEventListener('click', () => this.clearConsole());

        // Demo selector dropdown
        this.demoSelector?.addEventListener('change', (e) => {
            const demoId = e.target.value;
            if (demoId) {
                this.selectDemo(demoId);
            }
        });

        // Demo items in sidebar
        document.querySelectorAll('.demo-item').forEach(item => {
            item.addEventListener('click', () => this.selectDemo(item.dataset.demoId));
        });

        // Run button
        this.runButton?.addEventListener('click', () => this.runCurrentDemo());
    }

    /**
     * Handle WebSocket message
     */
    handleMessage(message) {
        switch (message.type) {
            case 'output':
                this.appendOutput(message.data, message.output_type);
                // Detect visualization state from output
                this.detectVizStateFromOutput(message.data);
                break;
            case 'status':
                this.updateRunStatus(message.status, message.message);
                // Update visualization on status change
                if (message.status === 'running') {
                    this.updateVisualization('running', 'Connecting...');
                }
                break;
            case 'error':
                this.appendOutput(message.data, 'error');
                break;
            case 'complete':
                this.onComplete(message.success, message.message);
                break;
        }
    }

    /**
     * Detect visualization state from console output
     */
    detectVizStateFromOutput(text) {
        if (!this.vizContainer || !text) return;

        const lowerText = text.toLowerCase();

        // Store detected result but don't update visualization yet - wait for onComplete
        // This prevents premature green/red display before the command finishes

        // Detect process interception (check first - exit code 137 = SIGKILL from NeuVector)
        if (lowerText.includes('exit code 137') ||
            lowerText.includes('exit code 9') ||
            lowerText.includes('command terminated') ||
            lowerText.includes('killed') ||
            lowerText.includes('sigkill') ||
            lowerText.includes('permission denied') ||
            lowerText.includes('operation not permitted') ||
            (text.includes('[ERROR]') && (lowerText.includes('process') || lowerText.includes('terminated')))) {
            this.detectedResult = { state: 'intercepted', message: 'Process blocked by SUSE Security' };
            return;
        }

        // Detect success
        if (text.includes('[OK]') || lowerText.includes('success')) {
            this.detectedResult = { state: 'success', message: 'Command executed successfully' };
            return;
        }

        // Check if it's a curl success (contains HTTP status)
        if (text.includes('HTTP/1') || text.includes('HTTP/2') || text.includes(' 200 ') || text.includes(' 301 ') || text.includes(' 302 ')) {
            this.detectedResult = { state: 'success', message: 'HTTP request successful' };
            return;
        }

        // Detect ping success
        if (lowerText.includes('bytes from') || (lowerText.includes('time=') && lowerText.includes('ms'))) {
            this.detectedResult = { state: 'success', message: 'Ping successful' };
            return;
        }

        // Detect nmap success (open ports)
        if (lowerText.includes('/tcp') && lowerText.includes('open')) {
            this.detectedResult = { state: 'success', message: 'Port scan completed' };
            return;
        }

        // Detect network block / timeout
        if (lowerText.includes('connection refused') ||
            lowerText.includes('connection timed out') ||
            lowerText.includes('operation timed out') ||
            lowerText.includes('network unreachable') ||
            lowerText.includes('could not resolve') ||
            lowerText.includes('no route to host') ||
            lowerText.includes('exit code 28') ||
            (text.includes('[ERROR]') && lowerText.includes('curl'))) {
            this.detectedResult = { state: 'blocked', message: 'Network blocked by policy' };
            return;
        }

        // Detect running/connecting - only update if no result detected yet
        if (!this.detectedResult && (text.includes('[CMD]') || lowerText.includes('executing') || lowerText.includes('connecting'))) {
            this.updateVisualization('running', 'Connecting...');
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(status) {
        if (this.statusDot) {
            this.statusDot.className = 'status-dot ' + status;
        }
        if (this.statusText) {
            this.statusText.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
            this.statusText.className = 'status ' + status;
        }
    }

    /**
     * Update run status
     */
    updateRunStatus(status, message) {
        this.isRunning = status === 'running';
        this.updateButtonStates();

        if (this.statusDot && this.isRunning) {
            this.statusDot.className = 'status-dot running';
        }
    }

    /**
     * Update button states based on running status
     */
    updateButtonStates() {
        const buttons = document.querySelectorAll('.lifecycle-actions .btn, #run-demo-btn');
        buttons.forEach(btn => {
            btn.disabled = this.isRunning;
        });
    }

    /**
     * Append output to console
     */
    appendOutput(text, type = 'stdout') {
        if (!this.consoleBody) return;

        const line = document.createElement('div');
        line.className = 'console-line';

        // Determine line type based on content
        if (text.startsWith('[ERROR]')) {
            line.classList.add('error');
        } else if (text.startsWith('[OK]')) {
            line.classList.add('ok');
        } else if (text.startsWith('[WARNING]')) {
            line.classList.add('warning');
        } else if (text.startsWith('[INFO]')) {
            line.classList.add('info');
        } else if (text.startsWith('[CMD]')) {
            line.classList.add('cmd');
        } else if (text.startsWith('[STEP')) {
            line.classList.add('step');
        } else if (type === 'error') {
            line.classList.add('error');
        }

        line.textContent = text;
        this.consoleBody.appendChild(line);

        // Auto-scroll to bottom
        this.consoleBody.scrollTop = this.consoleBody.scrollHeight;
    }

    /**
     * Clear console output
     */
    clearConsole() {
        if (this.consoleBody) {
            this.consoleBody.innerHTML = '';
        }
    }

    /**
     * Handle completion
     */
    onComplete(success, message) {
        this.isRunning = false;
        this.updateButtonStates();

        if (this.statusDot) {
            this.statusDot.className = 'status-dot ' + (success ? 'connected' : 'error');
        }

        this.appendOutput('');
        this.appendOutput(success ? '[DONE] Operation completed successfully' : `[FAILED] ${message || 'Operation failed'}`, success ? 'info' : 'error');

        // Update visualization based on detected result or completion status
        if (this.vizContainer) {
            // Use detected result if available, otherwise infer from success/message
            if (this.detectedResult) {
                this.updateVisualization(this.detectedResult.state, this.detectedResult.message);
            } else if (success) {
                this.updateVisualization('success', 'Connection successful');
            } else {
                // Determine failure type from message
                const lowerMsg = (message || '').toLowerCase();
                if (lowerMsg.includes('137') ||
                    lowerMsg.includes('terminated') ||
                    lowerMsg.includes('killed') ||
                    lowerMsg.includes('sigkill') ||
                    lowerMsg.includes('process') ||
                    lowerMsg.includes('denied')) {
                    this.updateVisualization('intercepted', 'Process blocked by SUSE Security');
                } else if (lowerMsg.includes('28') || lowerMsg.includes('timeout')) {
                    this.updateVisualization('blocked', 'Connection blocked (timeout)');
                } else {
                    this.updateVisualization('blocked', message || 'Connection failed');
                }
            }
            // Reset detected result for next run
            this.detectedResult = null;
        }

        // Always fetch events and refresh process rules after demo completes
        if (this.vizContainer) {
            setTimeout(() => this.fetchNeuVectorEvents(), 1000);
            setTimeout(() => this.fetchNeuVectorEvents(), 3000);
            // Refresh process rules (new processes may have been learned)
            setTimeout(() => this.refreshAllProcessRules(), 2000);
        }
    }

    /**
     * Refresh all visible process rule lists
     */
    refreshAllProcessRules() {
        const srcSelect = document.getElementById('viz-source-select');
        const tgtPod = document.getElementById('viz-target-pod');
        const tgtType = document.getElementById('viz-target-type');

        if (srcSelect) {
            const srcPod = srcSelect.value;
            if (srcPod) {
                this.updateVizProcessRules('source', srcPod);
            }
        }

        // Refresh target process rules if target is a pod
        if (tgtType && tgtType.value === 'pod' && tgtPod && tgtPod.value) {
            this.updateVizProcessRules('target', tgtPod.value);
        }
    }

    /**
     * Run lifecycle action
     */
    runAction(action) {
        if (this.isRunning || !wsManager.isConnected()) return;

        this.clearConsole();
        this.appendOutput(`Starting ${action}...`, 'info');
        this.appendOutput('');

        wsManager.executeAction(action);
    }

    /**
     * Select a demo
     */
    selectDemo(demoId) {
        // Update active state in sidebar
        document.querySelectorAll('.demo-item').forEach(item => {
            item.classList.toggle('active', item.dataset.demoId === demoId);
        });

        // Update dropdown selector
        if (this.demoSelector && this.demoSelector.value !== demoId) {
            this.demoSelector.value = demoId;
        }

        // Close sidebar on mobile after selection
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar?.classList.contains('open')) {
            sidebar.classList.remove('open');
            backdrop?.classList.remove('visible');
        }

        // Load demo details
        this.loadDemo(demoId);
    }

    /**
     * Load demo details from API
     */
    async loadDemo(demoId) {
        try {
            const response = await fetch(`/api/demos/${demoId}`);
            if (!response.ok) throw new Error('Failed to load demo');

            const demo = await response.json();
            this.currentDemo = demo;
            this.renderDemoForm(demo);
        } catch (error) {
            console.error('Failed to load demo:', error);
        }
    }

    /**
     * Render demo form
     */
    renderDemoForm(demo) {
        // Dropdown is already updated in selectDemo()

        if (this.demoDescription) {
            this.demoDescription.innerHTML = `<p>${demo.description}</p>`;
        }

        // Check demo type for visualization
        const paramNames = demo.parameters.map(p => p.name);
        const isConnectivityDemo = paramNames.includes('pod_name') && paramNames.includes('target_type');
        const isDLPDemo = paramNames.includes('pod_name') && paramNames.includes('data_type') && paramNames.includes('target');
        const isAdmissionDemo = paramNames.includes('action') && paramNames.includes('namespace') && paramNames.includes('pod_name');
        const hasVisualization = isConnectivityDemo || isDLPDemo || isAdmissionDemo;

        if (this.demoParams) {
            if (isConnectivityDemo) {
                // Render compact layout for connectivity demos
                this.demoParams.innerHTML = this.renderCompactDemoParams(demo);
            } else if (isDLPDemo) {
                // Render compact layout for DLP demos
                this.demoParams.innerHTML = this.renderDLPDemoParams(demo);
            } else if (isAdmissionDemo) {
                // Render compact layout for admission demos
                this.demoParams.innerHTML = this.renderAdmissionDemoParams(demo);
            } else {
                // Standard layout for other demos
                this.demoParams.innerHTML = demo.parameters.map(param => this.renderParameter(param)).join('');
            }
        }

        if (this.runButton) {
            // Hide main run button for visualization demos (it's in the visualization)
            this.runButton.style.display = hasVisualization ? 'none' : 'inline-flex';
        }

        // Create visualization for supported demos
        this.createVisualization(demo);

        // Set up refresh button for events
        const refreshBtn = document.getElementById('btn-refresh-logs');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.fetchNeuVectorEvents());
        }
    }

    /**
     * Render compact demo parameters for connectivity demos
     */
    renderCompactDemoParams(demo) {
        const podParam = demo.parameters.find(p => p.name === 'pod_name');
        const targetTypeParam = demo.parameters.find(p => p.name === 'target_type');
        const targetPodParam = demo.parameters.find(p => p.name === 'target_pod');
        const targetPublicParam = demo.parameters.find(p => p.name === 'target_public');

        // Hidden form fields only - events panel moved to visualization row
        return `
            <!-- Hidden form fields synced from visualization -->
            <input type="hidden" name="pod_name" id="param-pod_name" value="${podParam.default}">
            <input type="hidden" name="target_type" id="param-target_type" value="${targetTypeParam.default}">
            <input type="hidden" name="target_pod" id="param-target_pod" value="${targetPodParam?.default || ''}">
            <input type="hidden" name="target_public" id="param-target_public" value="${targetPublicParam?.default || ''}">
            <input type="hidden" name="target_custom" id="param-target_custom" value="">
            <input type="hidden" name="command" id="param-command" value="curl">
        `;
    }

    /**
     * Render compact demo parameters for DLP demos
     */
    renderDLPDemoParams(demo) {
        const podParam = demo.parameters.find(p => p.name === 'pod_name');
        const targetParam = demo.parameters.find(p => p.name === 'target');
        const dataTypeParam = demo.parameters.find(p => p.name === 'data_type');

        // Hidden form fields only - synced from visualization
        return `
            <!-- Hidden form fields synced from visualization -->
            <input type="hidden" name="pod_name" id="param-pod_name" value="${podParam?.default || 'production1'}">
            <input type="hidden" name="target" id="param-target" value="${targetParam?.default || 'nginx'}">
            <input type="hidden" name="data_type" id="param-data_type" value="${dataTypeParam?.default || 'credit_card'}">
            <input type="hidden" name="custom_data" id="param-custom_data" value="">
        `;
    }

    /**
     * Render compact demo parameters for admission control demos
     */
    renderAdmissionDemoParams(demo) {
        const actionParam = demo.parameters.find(p => p.name === 'action');
        const namespaceParam = demo.parameters.find(p => p.name === 'namespace');
        const podNameParam = demo.parameters.find(p => p.name === 'pod_name');

        // Hidden form fields only - synced from visualization
        return `
            <!-- Hidden form fields synced from visualization -->
            <input type="hidden" name="action" id="param-action" value="${actionParam?.default || 'create'}">
            <input type="hidden" name="namespace" id="param-namespace" value="${namespaceParam?.default || 'neuvector-demo'}">
            <input type="hidden" name="pod_name" id="param-pod_name" value="${podNameParam?.default || 'test-admission-pod'}">
        `;
    }

    /**
     * Set up target type switching
     */
    setupTargetTypeSwitch() {
        const targetTypeSelect = document.getElementById('param-target_type');
        if (!targetTypeSelect) return;

        const updateTargetFields = () => {
            const type = targetTypeSelect.value;
            document.getElementById('target-pod-group').style.display = type === 'pod' ? 'block' : 'none';
            document.getElementById('target-public-group').style.display = type === 'public' ? 'block' : 'none';
            document.getElementById('target-custom-group').style.display = type === 'custom' ? 'block' : 'none';
            this.updateVizLabels();
        };

        targetTypeSelect.addEventListener('change', updateTargetFields);
        updateTargetFields(); // Initial state
    }

    /**
     * Get resolved target from form
     */
    getResolvedTarget() {
        const targetType = document.getElementById('param-target_type')?.value || 'public';

        if (targetType === 'pod') {
            const pod = document.getElementById('param-target_pod')?.value || 'web1';
            return `${pod}.neuvector-demo.svc.cluster.local`;
        } else if (targetType === 'public') {
            return document.getElementById('param-target_public')?.value || 'https://www.google.com';
        } else {
            return document.getElementById('param-target_custom')?.value || 'localhost';
        }
    }

    /**
     * Update a pod setting via API
     */
    async updatePodSetting(podName, selectElement) {
        const field = selectElement.dataset.field;
        const value = selectElement.value;
        const serviceName = podName.replace(/-test$/, '') + '.neuvector-demo';

        // Disable select during update
        selectElement.disabled = true;
        const originalClass = selectElement.className;
        selectElement.className = originalClass + ' updating';

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            selectElement.disabled = false;
            selectElement.className = originalClass;
            return;
        }

        try {
            const body = {
                username: credentials.username,
                password: credentials.password,
                service_name: serviceName,
            };
            body[field] = value;

            const response = await fetch('/api/neuvector/update-group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const result = await response.json();

            if (result.success) {
                // Flash green to indicate success
                selectElement.className = originalClass + ' success';
                setTimeout(() => {
                    selectElement.className = originalClass;
                }, 1000);
            } else {
                // Flash red and revert
                selectElement.className = originalClass + ' error';
                setTimeout(() => {
                    this.updatePodStatus(podName);
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to update setting:', error);
            selectElement.className = originalClass + ' error';
        }

        selectElement.disabled = false;
    }

    /**
     * Update pod policy status display
     */
    async updatePodStatus(podName) {
        const container = document.getElementById('pod-status-container');
        const policyMode = document.getElementById('pod-policy-mode');
        const profileMode = document.getElementById('pod-profile-mode');
        const baselineProfile = document.getElementById('pod-baseline-profile');

        if (!container || !policyMode || !profileMode || !baselineProfile) return;

        // Map pod name to NeuVector group name (remove -test suffix)
        const serviceName = podName.replace(/-test$/, '');
        const groupName = `nv.${serviceName}.neuvector-demo`;

        // Disable selects during load
        policyMode.disabled = true;
        profileMode.disabled = true;
        baselineProfile.disabled = true;
        container.className = 'pod-status-container checking';

        const result = await settingsManager.getGroupStatus(groupName);

        if (result) {
            const policy = result.policy_mode || 'Discover';
            const profile = result.profile_mode || 'Discover';
            const baseline = result.baseline_profile || 'zero-drift';

            policyMode.value = policy;
            policyMode.className = 'pod-status-select mode-' + policy.toLowerCase();

            profileMode.value = profile;
            profileMode.className = 'pod-status-select mode-' + profile.toLowerCase();

            baselineProfile.value = baseline;
            baselineProfile.className = 'pod-status-select';

            container.className = 'pod-status-container ok';

            // Enable selects
            policyMode.disabled = false;
            profileMode.disabled = false;
            baselineProfile.disabled = false;
        } else {
            container.className = 'pod-status-container error';
            // Keep disabled if error
        }
    }

    /**
     * Update process rules display
     */
    async updateProcessRules(podName) {
        const container = document.getElementById('process-rules-container');
        const list = document.getElementById('process-rules-list');
        const count = document.getElementById('process-rules-count');

        if (!container || !list) return;

        // Map pod name to NeuVector group name (remove -test suffix)
        const serviceName = podName.replace(/-test$/, '');
        const groupName = `nv.${serviceName}.neuvector-demo`;

        // Show loading state
        list.innerHTML = 'Loading...';
        list.className = 'process-rules-list loading';
        if (count) count.textContent = '';

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            list.innerHTML = 'Configure SUSE Security credentials first';
            list.className = 'process-rules-list empty';
            return;
        }

        try {
            const response = await fetch('/api/neuvector/process-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                }),
            });

            const result = await response.json();

            if (result.success && result.process_list.length > 0) {
                if (count) count.textContent = `(${result.process_list.length})`;

                // Store groupName for delete operations
                list.dataset.groupName = groupName;

                list.innerHTML = result.process_list.map(p => `
                    <div class="process-rule-item" data-name="${this.escapeHtml(p.name)}" data-path="${this.escapeHtml(p.path)}">
                        <div class="process-rule-info">
                            <span class="process-rule-name">${this.escapeHtml(p.name)}</span>
                            <span class="process-rule-path">${this.escapeHtml(p.path)}</span>
                        </div>
                        <span class="process-rule-type ${p.cfg_type}">${p.cfg_type}</span>
                        <button class="btn-delete-rule" title="Delete this rule">&times;</button>
                    </div>
                `).join('');
                list.className = 'process-rules-list';

                // Add event listeners for delete buttons
                list.querySelectorAll('.btn-delete-rule').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const item = e.target.closest('.process-rule-item');
                        if (item) {
                            this.deleteProcessRule(
                                groupName,
                                item.dataset.name,
                                item.dataset.path,
                                item
                            );
                        }
                    });
                });
            } else if (result.success) {
                list.innerHTML = 'No process rules';
                list.className = 'process-rules-list empty';
            } else {
                list.innerHTML = result.message || 'Failed to load';
                list.className = 'process-rules-list empty';
            }
        } catch (error) {
            console.error('Failed to get process rules:', error);
            list.innerHTML = 'Error loading rules';
            list.className = 'process-rules-list empty';
        }
    }

    /**
     * Delete a process rule
     */
    async deleteProcessRule(groupName, processName, processPath, itemElement) {
        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            return;
        }

        // Visual feedback - mark as deleting
        itemElement.classList.add('deleting');
        const deleteBtn = itemElement.querySelector('.btn-delete-rule');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '...';
        }

        try {
            const response = await fetch('/api/neuvector/delete-process-rule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                    process_name: processName,
                    process_path: processPath,
                }),
            });

            const result = await response.json();

            if (result.success) {
                // Animate removal then refresh full list
                itemElement.style.opacity = '0';
                itemElement.style.height = '0';
                itemElement.style.padding = '0';
                itemElement.style.margin = '0';
                itemElement.style.overflow = 'hidden';
                itemElement.style.transition = 'all 0.3s ease';

                setTimeout(() => {
                    // Refresh from API to get accurate state
                    const podSelect = document.getElementById('viz-source-select') || document.getElementById('param-pod_name');
                    const podName = podSelect?.value || 'production1';
                    this.updateProcessRules(podName);
                }, 400);
            } else {
                // Show error
                itemElement.classList.remove('deleting');
                itemElement.classList.add('delete-error');
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = '×';
                }
                setTimeout(() => itemElement.classList.remove('delete-error'), 2000);
                console.error('Failed to delete rule:', result.message);
            }
        } catch (error) {
            console.error('Failed to delete process rule:', error);
            itemElement.classList.remove('deleting');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = '×';
            }
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Create visualization HTML for a demo
     *
     * Creates the interactive Source → Target diagram with:
     * - Source pod selector with settings (Network Policy, Process Profile, Baseline)
     * - Source DLP sensors for DLP demo
     * - Target selector (pod, public URL, or custom)
     * - Target settings and DLP sensors for internal pods
     * - Mode icons showing Protect/Monitor/Discover status
     * - Process rules list
     * - NeuVector Events panel
     * - Command buttons (Run Demo / Run DLP Test)
     *
     * @param {Object} demo - Demo configuration object
     */
    createVisualization(demo) {
        if (!demo) {
            this.removeVisualization();
            return;
        }

        // Check if demo has the required parameters for visualization
        const paramNames = demo.parameters.map(p => p.name);
        const isConnectivityDemo = paramNames.includes('pod_name') && paramNames.includes('target_type');
        const isDLPDemo = paramNames.includes('pod_name') && paramNames.includes('data_type') && paramNames.includes('target');
        const isAdmissionDemo = paramNames.includes('action') && paramNames.includes('namespace') && paramNames.includes('pod_name');

        if (!isConnectivityDemo && !isDLPDemo && !isAdmissionDemo) {
            this.removeVisualization();
            return;
        }

        // Store demo type for later use
        this.currentDemoType = isAdmissionDemo ? 'admission' : (isDLPDemo ? 'dlp' : 'connectivity');

        // Handle admission demo separately
        if (isAdmissionDemo) {
            this.createAdmissionVisualization(demo);
            return;
        }

        // Get parameters for dropdowns
        const podParam = demo.parameters.find(p => p.name === 'pod_name');

        // Build source options
        const sourceOptions = podParam.options.map(opt =>
            `<option value="${opt.value}" ${opt.value === podParam.default ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        // Variables for connectivity demos
        let targetTypeOptions = '';
        let targetPodOptions = '';
        let targetPublicOptions = '';

        // Variables for DLP demos
        let dlpTargetOptions = '';
        let dataTypeOptions = '';

        if (isConnectivityDemo) {
            const targetTypeParam = demo.parameters.find(p => p.name === 'target_type');
            const targetPodParam = demo.parameters.find(p => p.name === 'target_pod');
            const targetPublicParam = demo.parameters.find(p => p.name === 'target_public');

            // Build target type options
            targetTypeOptions = targetTypeParam.options.map(opt =>
                `<option value="${opt.value}" ${opt.value === targetTypeParam.default ? 'selected' : ''}>${opt.label}</option>`
            ).join('');

            // Build target pod options
            targetPodOptions = targetPodParam ? targetPodParam.options.map(opt =>
                `<option value="${opt.value}" ${opt.value === targetPodParam.default ? 'selected' : ''}>${opt.label}</option>`
            ).join('') : '';

            // Build target public options
            targetPublicOptions = targetPublicParam ? targetPublicParam.options.map(opt => {
                let label = opt.label;
                try { label = new URL(opt.value).hostname; } catch(e) {}
                return `<option value="${opt.value}" ${opt.value === targetPublicParam.default ? 'selected' : ''}>${label}</option>`;
            }).join('') : '';
        } else if (isDLPDemo) {
            const targetParam = demo.parameters.find(p => p.name === 'target');
            const dataTypeParam = demo.parameters.find(p => p.name === 'data_type');

            // Build DLP target options
            dlpTargetOptions = targetParam ? targetParam.options.map(opt =>
                `<option value="${opt.value}" ${opt.value === targetParam.default ? 'selected' : ''}>${opt.label}</option>`
            ).join('') : '';

            // Build data type options
            dataTypeOptions = dataTypeParam ? dataTypeParam.options.map(opt =>
                `<option value="${opt.value}" ${opt.value === dataTypeParam.default ? 'selected' : ''}>${opt.label}</option>`
            ).join('') : '';
        }

        // Mode options for settings
        const modeOptions = `
            <option value="Discover">Discover</option>
            <option value="Monitor">Monitor</option>
            <option value="Protect">Protect</option>
        `;
        const baselineOptions = `
            <option value="basic">basic</option>
            <option value="zero-drift">zero-drift</option>
        `;

        // Build source extra content (for DLP demos)
        let sourceExtraContent = '';
        if (isDLPDemo) {
            sourceExtraContent = `
                <div class="viz-dlp-settings" id="viz-dlp-settings">
                    <div class="viz-setting-row">
                        <span class="viz-setting-label">Data Type</span>
                        <select class="viz-setting-select viz-dlp-select" id="viz-data-type" name="data_type">${dataTypeOptions}</select>
                    </div>
                    <div class="viz-setting-row" id="viz-custom-data-row" style="display:none;">
                        <span class="viz-setting-label">Custom Data</span>
                        <input type="text" class="viz-setting-input" id="viz-custom-data" name="custom_data" placeholder="Enter data...">
                    </div>
                </div>
                <div class="viz-dlp-sensors" id="viz-dlp-sensors">
                    <div class="viz-dlp-sensors-header">DLP Sensors</div>
                    <div class="viz-dlp-sensor-row">
                        <label class="viz-toggle">
                            <input type="checkbox" id="viz-sensor-creditcard" data-sensor="sensor.creditcard">
                            <span class="viz-toggle-slider"></span>
                        </label>
                        <span class="viz-dlp-sensor-name">Matricule</span>
                        <div class="viz-dlp-action-toggle" id="viz-action-creditcard" data-sensor="sensor.creditcard">
                            <button type="button" class="viz-action-btn active" data-action="allow">Alert</button>
                            <button type="button" class="viz-action-btn" data-action="deny">Block</button>
                        </div>
                    </div>
                    <div class="viz-dlp-sensor-row">
                        <label class="viz-toggle">
                            <input type="checkbox" id="viz-sensor-ssn" data-sensor="sensor.ssn">
                            <span class="viz-toggle-slider"></span>
                        </label>
                        <span class="viz-dlp-sensor-name">SSN</span>
                        <div class="viz-dlp-action-toggle" id="viz-action-ssn" data-sensor="sensor.ssn">
                            <button type="button" class="viz-action-btn active" data-action="allow">Alert</button>
                            <button type="button" class="viz-action-btn" data-action="deny">Block</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Build target content based on demo type
        let targetContent = '';
        if (isConnectivityDemo) {
            targetContent = `
                <select class="viz-select" id="viz-target-type" name="target_type">${targetTypeOptions}</select>
                <select class="viz-select" id="viz-target-pod" name="target_pod" style="display:none;">${targetPodOptions}</select>
                <select class="viz-select" id="viz-target-public" name="target_public">${targetPublicOptions}</select>
                <input type="text" class="viz-select" id="viz-target-custom" name="target_custom" placeholder="hostname/IP" style="display:none;">
                <div class="viz-pod-settings" id="viz-target-settings">
                    <div class="viz-setting-row">
                        <span class="viz-setting-label">Network Policy</span>
                        <select class="viz-setting-select" id="viz-tgt-policy-mode" data-field="policy_mode" data-target="target">${modeOptions}</select>
                    </div>
                    <div class="viz-setting-row">
                        <span class="viz-setting-label">Process Profile</span>
                        <select class="viz-setting-select" id="viz-tgt-profile-mode" data-field="profile_mode" data-target="target">${modeOptions}</select>
                    </div>
                    <div class="viz-setting-row">
                        <span class="viz-setting-label">Baseline</span>
                        <select class="viz-setting-select" id="viz-tgt-baseline" data-field="baseline_profile" data-target="target">${baselineOptions}</select>
                    </div>
                </div>
                <div class="viz-process-list" id="viz-target-processes">
                    <div class="viz-process-header">
                        <span>Allowed Processes</span>
                        <span id="viz-tgt-process-count"></span>
                    </div>
                    <div class="viz-process-items loading" id="viz-tgt-process-items">Loading...</div>
                </div>
            `;
        } else if (isDLPDemo) {
            targetContent = `
                <select class="viz-select" id="viz-dlp-target" name="target">${dlpTargetOptions}</select>
                <div class="viz-dlp-sensors" id="viz-tgt-dlp-sensors">
                    <div class="viz-dlp-sensors-header">DLP Sensors</div>
                    <div class="viz-dlp-sensor-row">
                        <label class="viz-toggle">
                            <input type="checkbox" id="viz-tgt-sensor-creditcard" data-sensor="sensor.creditcard" data-target="target">
                            <span class="viz-toggle-slider"></span>
                        </label>
                        <span class="viz-dlp-sensor-name">Matricule</span>
                        <div class="viz-dlp-action-toggle" id="viz-tgt-action-creditcard" data-sensor="sensor.creditcard" data-target="target">
                            <button type="button" class="viz-action-btn active" data-action="allow">Alert</button>
                            <button type="button" class="viz-action-btn" data-action="deny">Block</button>
                        </div>
                    </div>
                    <div class="viz-dlp-sensor-row">
                        <label class="viz-toggle">
                            <input type="checkbox" id="viz-tgt-sensor-ssn" data-sensor="sensor.ssn" data-target="target">
                            <span class="viz-toggle-slider"></span>
                        </label>
                        <span class="viz-dlp-sensor-name">SSN</span>
                        <div class="viz-dlp-action-toggle" id="viz-tgt-action-ssn" data-sensor="sensor.ssn" data-target="target">
                            <button type="button" class="viz-action-btn active" data-action="allow">Alert</button>
                            <button type="button" class="viz-action-btn" data-action="deny">Block</button>
                        </div>
                    </div>
                </div>
                <div class="viz-pod-settings" id="viz-target-settings">
                    <div class="viz-setting-row">
                        <span class="viz-setting-label">Network Policy</span>
                        <select class="viz-setting-select" id="viz-tgt-policy-mode" data-field="policy_mode" data-target="target">${modeOptions}</select>
                    </div>
                    <div class="viz-setting-row">
                        <span class="viz-setting-label">Process Profile</span>
                        <select class="viz-setting-select" id="viz-tgt-profile-mode" data-field="profile_mode" data-target="target">${modeOptions}</select>
                    </div>
                    <div class="viz-setting-row">
                        <span class="viz-setting-label">Baseline</span>
                        <select class="viz-setting-select" id="viz-tgt-baseline" data-field="baseline_profile" data-target="target">${baselineOptions}</select>
                    </div>
                </div>
                <div class="viz-process-list" id="viz-target-processes">
                    <div class="viz-process-header">
                        <span>Allowed Processes</span>
                        <span id="viz-tgt-process-count"></span>
                    </div>
                    <div class="viz-process-items loading" id="viz-tgt-process-items">Loading...</div>
                </div>
            `;
        }

        // Build commands section based on demo type
        let commandsSection = '';
        if (isConnectivityDemo) {
            commandsSection = `
                <div class="viz-commands" id="viz-commands">
                    <button type="button" class="btn btn-primary btn-cmd active" data-cmd="curl" title="HTTP request">curl</button>
                    <button type="button" class="btn btn-outline btn-cmd" data-cmd="ping" title="ICMP ping">ping</button>
                    <button type="button" class="btn btn-outline btn-cmd" data-cmd="ssh" title="SSH connection">ssh</button>
                    <button type="button" class="btn btn-outline btn-cmd" data-cmd="nmap" title="Port scan">nmap</button>
                </div>
            `;
        } else if (isDLPDemo) {
            commandsSection = `
                <div class="viz-commands" id="viz-commands">
                    <button type="button" class="btn btn-primary btn-run-demo" id="btn-viz-run-dlp" title="Send DLP test data">
                        Run DLP Test
                    </button>
                </div>
            `;
        }

        const vizHtml = `
            <div class="demo-viz-row">
                <div class="demo-visualization" id="demo-visualization">
                    <div class="viz-content">
                        <div class="viz-box viz-source pending" id="viz-source">
                            <div class="viz-box-header">
                                <div class="viz-icon">🐳</div>
                                <div class="viz-label">Source</div>
                                <div class="viz-mode-icons" id="viz-src-mode-icons">
                                    <span class="viz-mode-icon network" id="viz-src-icon-network" title="Network Policy">🔍</span>
                                    <span class="viz-mode-icon process" id="viz-src-icon-process" title="Process Profile">🔍</span>
                                </div>
                            </div>
                            <select class="viz-select" id="viz-source-select" name="pod_name">${sourceOptions}</select>
                            ${sourceExtraContent}
                            <div class="viz-pod-settings" id="viz-source-settings">
                                <div class="viz-setting-row">
                                    <span class="viz-setting-label">Network Policy</span>
                                    <select class="viz-setting-select" id="viz-src-policy-mode" data-field="policy_mode" data-target="source">${modeOptions}</select>
                                </div>
                                <div class="viz-setting-row">
                                    <span class="viz-setting-label">Process Profile</span>
                                    <select class="viz-setting-select" id="viz-src-profile-mode" data-field="profile_mode" data-target="source">${modeOptions}</select>
                                </div>
                                <div class="viz-setting-row">
                                    <span class="viz-setting-label">Baseline</span>
                                    <select class="viz-setting-select" id="viz-src-baseline" data-field="baseline_profile" data-target="source">${baselineOptions}</select>
                                </div>
                            </div>
                            <div class="viz-process-list" id="viz-source-processes">
                                <div class="viz-process-header">
                                    <span>Allowed Processes</span>
                                    <span id="viz-src-process-count"></span>
                                </div>
                                <div class="viz-process-items loading" id="viz-src-process-items">Loading...</div>
                            </div>
                        </div>
                        <div class="viz-arrow pending" id="viz-arrow">
                            <div class="viz-arrow-line"></div>
                            <div class="viz-arrow-label" id="viz-arrow-label">${isDLPDemo ? 'POST' : 'curl'}</div>
                        </div>
                        <div class="viz-box viz-target pending ${isDLPDemo ? '' : ''}" id="viz-target">
                            <div class="viz-box-header">
                                <div class="viz-icon" id="viz-target-icon">🌐</div>
                                <div class="viz-label">Target</div>
                                <div class="viz-mode-icons" id="viz-tgt-mode-icons">
                                    <span class="viz-mode-icon network" id="viz-tgt-icon-network" title="Network Policy">🔍</span>
                                    <span class="viz-mode-icon process" id="viz-tgt-icon-process" title="Process Profile">🔍</span>
                                </div>
                            </div>
                            ${targetContent}
                        </div>
                    </div>
                    <div class="viz-status pending" id="viz-status">
                        <span class="viz-status-dot"></span>
                        <span class="viz-status-text">Ready</span>
                    </div>
                    ${commandsSection}
                </div>
                <div class="nv-logs-container" id="nv-logs-container">
                    <div class="nv-logs-header">
                        <span>SUSE Security Events</span>
                        <button type="button" class="btn-refresh" id="btn-refresh-logs" title="Refresh events">↻</button>
                    </div>
                    <div class="nv-logs-list empty" id="nv-logs-list">
                        Click refresh to load events
                    </div>
                </div>
                ${isConnectivityDemo ? '<input type="hidden" id="param-command" name="command" value="curl">' : ''}
            </div>
        `;

        // Find the card-body to insert before
        const demoParams = document.getElementById('demo-params');
        if (!demoParams) return;

        // Remove existing visualization
        this.removeVisualization();

        // Insert visualization BEFORE the params (at the top)
        const vizWrapper = document.createElement('div');
        vizWrapper.id = 'viz-wrapper';
        vizWrapper.innerHTML = vizHtml;
        demoParams.parentNode.insertBefore(vizWrapper, demoParams);

        this.vizContainer = document.getElementById('demo-visualization');
        this.vizState = 'pending';

        // Set up target type switching in visualization
        this.setupVizTargetSwitch();

        // Set up source select listener
        const sourceSelect = document.getElementById('viz-source-select');
        if (sourceSelect) {
            sourceSelect.addEventListener('change', () => {
                this.syncFormFromViz();
                this.updateVizPodStatus('source', sourceSelect.value);
                this.updateVizProcessRules('source', sourceSelect.value);
                // Reload DLP sensors if this is a DLP demo
                if (this.currentDemoType === 'dlp') {
                    this.loadDLPSensors(sourceSelect.value);
                }
            });
        }

        // Set up target pod select listener
        const targetPodSelect = document.getElementById('viz-target-pod');
        if (targetPodSelect) {
            targetPodSelect.addEventListener('change', () => {
                this.syncFormFromViz();
                const targetType = document.getElementById('viz-target-type')?.value;
                if (targetType === 'pod') {
                    this.updateVizPodStatus('target', targetPodSelect.value);
                    this.updateVizProcessRules('target', targetPodSelect.value);
                }
            });
        }

        // Set up settings change listeners for source
        ['viz-src-policy-mode', 'viz-src-profile-mode', 'viz-src-baseline'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.addEventListener('change', () => {
                    const podName = document.getElementById('viz-source-select')?.value || 'production1';
                    this.updateVizPodSetting('source', podName, select);
                });
            }
        });

        // Set up settings change listeners for target
        ['viz-tgt-policy-mode', 'viz-tgt-profile-mode', 'viz-tgt-baseline'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.addEventListener('change', () => {
                    // For DLP demo, use web1 when target is nginx
                    const dlpTarget = document.getElementById('viz-dlp-target');
                    const podName = dlpTarget
                        ? (dlpTarget.value === 'nginx' ? 'web1' : null)
                        : (document.getElementById('viz-target-pod')?.value || 'web1');
                    if (podName) {
                        this.updateVizPodSetting('target', podName, select);
                    }
                });
            }
        });

        // Set up command buttons (connectivity demos)
        document.querySelectorAll('.btn-cmd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                this.setCommand(cmd);
                this.runCurrentDemo();
            });
        });

        // Set up DLP-specific listeners
        if (isDLPDemo) {
            // Data type change listener
            const dataTypeSelect = document.getElementById('viz-data-type');
            const customDataRow = document.getElementById('viz-custom-data-row');
            if (dataTypeSelect) {
                dataTypeSelect.addEventListener('change', () => {
                    // Show/hide custom data field
                    if (customDataRow) {
                        customDataRow.style.display = dataTypeSelect.value === 'custom' ? 'flex' : 'none';
                    }
                    this.syncFormFromViz();
                });
            }

            // Custom data input listener
            const customDataInput = document.getElementById('viz-custom-data');
            if (customDataInput) {
                customDataInput.addEventListener('input', () => this.syncFormFromViz());
            }

            // DLP target change listener
            const dlpTargetSelect = document.getElementById('viz-dlp-target');
            const targetBox = document.getElementById('viz-target');
            const targetModeIcons = document.getElementById('viz-tgt-mode-icons');
            if (dlpTargetSelect) {
                dlpTargetSelect.addEventListener('change', () => {
                    this.syncFormFromViz();
                    // Update target icon based on target
                    const targetIcon = document.getElementById('viz-target-icon');
                    if (targetIcon) {
                        targetIcon.textContent = dlpTargetSelect.value === 'nginx' ? '🐳' : '🌐';
                    }
                    // Show/hide target settings based on target type
                    const isInternalPod = dlpTargetSelect.value === 'nginx';
                    // Use class toggle for proper CSS display (shows settings, DLP sensors, process list)
                    if (targetBox) {
                        targetBox.classList.toggle('show-pod-settings', isInternalPod);
                    }
                    if (targetModeIcons) targetModeIcons.style.display = isInternalPod ? '' : 'none';
                    // Load target pod status if internal
                    if (isInternalPod) {
                        this.updateVizPodStatus('target', 'web1');
                        this.loadDLPSensors('web1', 'target');
                        this.updateVizProcessRules('target', 'web1');
                    }
                });
                // Trigger initial state
                const isInternalPod = dlpTargetSelect.value === 'nginx';
                // Use class toggle for proper CSS display (shows settings, DLP sensors, process list)
                if (targetBox) {
                    targetBox.classList.toggle('show-pod-settings', isInternalPod);
                }
                if (targetModeIcons) targetModeIcons.style.display = isInternalPod ? '' : 'none';
                // Load initial target data if internal pod
                if (isInternalPod) {
                    this.updateVizPodStatus('target', 'web1');
                    this.loadDLPSensors('web1', 'target');
                    this.updateVizProcessRules('target', 'web1');
                }
            }

            // DLP run button
            const runDlpBtn = document.getElementById('btn-viz-run-dlp');
            if (runDlpBtn) {
                runDlpBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.runCurrentDemo();
                });
            }

            // DLP sensor toggle listeners
            // DLP sensor enable/disable toggles (for both source and target)
            document.querySelectorAll('.viz-dlp-sensors input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    const sensorName = checkbox.dataset.sensor;
                    const enabled = checkbox.checked;
                    const isTarget = checkbox.dataset.target === 'target';
                    const podName = isTarget
                        ? 'web1'
                        : (document.getElementById('viz-source-select')?.value || 'production1');
                    // Get current action for this sensor (in the same container)
                    const container = checkbox.closest('.viz-dlp-sensors');
                    const actionToggle = container?.querySelector(`.viz-dlp-action-toggle[data-sensor="${sensorName}"]`);
                    const activeBtn = actionToggle?.querySelector('.viz-action-btn.active');
                    const action = activeBtn?.dataset.action || 'allow';
                    this.updateDLPSensor(podName, sensorName, enabled, action, checkbox);
                });
            });

            // DLP sensor action toggles (Alert/Block) for both source and target
            document.querySelectorAll('.viz-dlp-action-toggle').forEach(toggle => {
                toggle.querySelectorAll('.viz-action-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const sensorName = toggle.dataset.sensor;
                        const action = btn.dataset.action;
                        const isTarget = toggle.dataset.target === 'target';
                        const podName = isTarget
                            ? 'web1'
                            : (document.getElementById('viz-source-select')?.value || 'production1');

                        // Check if sensor is enabled (in the same container)
                        const container = toggle.closest('.viz-dlp-sensors');
                        const checkbox = container?.querySelector(`input[data-sensor="${sensorName}"]`);
                        if (!checkbox?.checked) {
                            return; // Don't change action if sensor is disabled
                        }

                        // Update button states
                        toggle.querySelectorAll('.viz-action-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        // Update sensor with new action
                        this.updateDLPSensor(podName, sensorName, true, action, checkbox);
                    });
                });
            });
        }

        // Initial load of source pod status
        const initialSourcePod = sourceSelect?.value || 'production1';
        this.updateVizPodStatus('source', initialSourcePod);
        this.updateVizProcessRules('source', initialSourcePod);

        // Load initial DLP sensor status for DLP demos
        if (isDLPDemo) {
            this.loadDLPSensors(initialSourcePod);
        }
    }

    /**
     * Set up target type switching in visualization
     */
    setupVizTargetSwitch() {
        const targetType = document.getElementById('viz-target-type');
        const targetPod = document.getElementById('viz-target-pod');
        const targetPublic = document.getElementById('viz-target-public');
        const targetCustom = document.getElementById('viz-target-custom');
        const targetIcon = document.getElementById('viz-target-icon');
        const targetBox = document.getElementById('viz-target');
        const targetModeIcons = document.getElementById('viz-tgt-mode-icons');

        if (!targetType) return;

        const updateTargetFields = () => {
            const type = targetType.value;
            if (targetPod) targetPod.style.display = type === 'pod' ? 'block' : 'none';
            if (targetPublic) targetPublic.style.display = type === 'public' ? 'block' : 'none';
            if (targetCustom) targetCustom.style.display = type === 'custom' ? 'block' : 'none';
            if (targetIcon) targetIcon.textContent = type === 'pod' ? '🐳' : '🌐';
            if (targetModeIcons) targetModeIcons.style.display = type === 'pod' ? '' : 'none';

            // Show/hide target pod settings
            if (targetBox) {
                if (type === 'pod') {
                    targetBox.classList.add('show-pod-settings');
                    // Load target pod status
                    const podName = targetPod?.value || 'web1';
                    this.updateVizPodStatus('target', podName);
                    this.updateVizProcessRules('target', podName);
                } else {
                    targetBox.classList.remove('show-pod-settings');
                }
            }

            this.syncFormFromViz();
        };

        targetType.addEventListener('change', updateTargetFields);
        if (targetPublic) targetPublic.addEventListener('change', () => this.syncFormFromViz());
        if (targetCustom) targetCustom.addEventListener('input', () => this.syncFormFromViz());

        updateTargetFields();
    }

    /**
     * Update pod status in visualization panel
     */
    async updateVizPodStatus(target, podName) {
        const prefix = target === 'source' ? 'viz-src' : 'viz-tgt';
        const policyMode = document.getElementById(`${prefix}-policy-mode`);
        const profileMode = document.getElementById(`${prefix}-profile-mode`);
        const baseline = document.getElementById(`${prefix}-baseline`);

        if (!policyMode || !profileMode || !baseline) return;

        // Map pod name to NeuVector group name
        const serviceName = podName.replace(/-test$/, '');
        const groupName = `nv.${serviceName}.neuvector-demo`;

        // Disable selects during load
        policyMode.disabled = true;
        profileMode.disabled = true;
        baseline.disabled = true;

        const result = await settingsManager.getGroupStatus(groupName);

        if (result) {
            const policy = result.policy_mode || 'Discover';
            const profile = result.profile_mode || 'Discover';
            const baselineVal = result.baseline_profile || 'zero-drift';

            policyMode.value = policy;
            policyMode.className = 'viz-setting-select mode-' + policy.toLowerCase();

            profileMode.value = profile;
            profileMode.className = 'viz-setting-select mode-' + profile.toLowerCase();

            baseline.value = baselineVal;
            baseline.className = 'viz-setting-select';

            // Enable selects
            policyMode.disabled = false;
            profileMode.disabled = false;
            baseline.disabled = false;

            // Update mode icons
            this.updateModeIcons(target, policy, profile);
        }
    }

    /**
     * Update mode icons in visualization header
     * Shows padlock for Protect, magnifying glass for Monitor, nothing for Discover
     */
    updateModeIcons(target, policyMode, profileMode) {
        const prefix = target === 'source' ? 'viz-src' : 'viz-tgt';
        const networkIcon = document.getElementById(`${prefix}-icon-network`);
        const processIcon = document.getElementById(`${prefix}-icon-process`);

        if (networkIcon) {
            if (policyMode === 'Protect') {
                networkIcon.textContent = '🔒';
                networkIcon.title = 'Network Policy: Protect';
                networkIcon.classList.remove('monitor', 'discover');
                networkIcon.classList.add('protect');
            } else if (policyMode === 'Monitor') {
                networkIcon.textContent = '🔍';
                networkIcon.title = 'Network Policy: Monitor';
                networkIcon.classList.remove('protect', 'discover');
                networkIcon.classList.add('monitor');
            } else {
                networkIcon.textContent = '👁️';
                networkIcon.title = 'Network Policy: Discover';
                networkIcon.classList.remove('protect', 'monitor');
                networkIcon.classList.add('discover');
            }
        }

        if (processIcon) {
            if (profileMode === 'Protect') {
                processIcon.textContent = '🔒';
                processIcon.title = 'Process Profile: Protect';
                processIcon.classList.remove('monitor', 'discover');
                processIcon.classList.add('protect');
            } else if (profileMode === 'Monitor') {
                processIcon.textContent = '🔍';
                processIcon.title = 'Process Profile: Monitor';
                processIcon.classList.remove('protect', 'discover');
                processIcon.classList.add('monitor');
            } else {
                processIcon.textContent = '👁️';
                processIcon.title = 'Process Profile: Discover';
                processIcon.classList.remove('protect', 'monitor');
                processIcon.classList.add('discover');
            }
        }
    }

    /**
     * Update process rules in visualization panel
     */
    async updateVizProcessRules(target, podName) {
        const prefix = target === 'source' ? 'viz-src' : 'viz-tgt';
        const list = document.getElementById(`${prefix}-process-items`);
        const count = document.getElementById(`${prefix}-process-count`);

        if (!list) return;

        // Map pod name to NeuVector group name
        const serviceName = podName.replace(/-test$/, '');
        const groupName = `nv.${serviceName}.neuvector-demo`;

        // Show loading state
        list.innerHTML = 'Loading...';
        list.className = 'viz-process-items loading';
        if (count) count.textContent = '';

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            list.innerHTML = 'Not configured';
            list.className = 'viz-process-items empty';
            return;
        }

        try {
            const response = await fetch('/api/neuvector/process-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                }),
            });

            const result = await response.json();

            if (result.success && result.process_list.length > 0) {
                if (count) count.textContent = `(${result.process_list.length})`;

                // Store groupName for delete operations
                list.dataset.groupName = groupName;
                list.dataset.target = target;
                list.dataset.podName = podName;

                list.innerHTML = result.process_list.map(p => `
                    <div class="viz-process-item" data-name="${this.escapeHtml(p.name)}" data-path="${this.escapeHtml(p.path)}">
                        <span class="viz-process-name">${this.escapeHtml(p.name)}</span>
                        <span class="viz-process-type ${p.cfg_type}">${p.cfg_type}</span>
                        <button type="button" class="viz-btn-delete" title="Delete">&times;</button>
                    </div>
                `).join('');
                list.className = 'viz-process-items';

                // Add event listeners for delete buttons
                list.querySelectorAll('.viz-btn-delete').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const item = e.target.closest('.viz-process-item');
                        if (item) {
                            this.deleteVizProcessRule(
                                groupName,
                                item.dataset.name,
                                item.dataset.path,
                                item,
                                target,
                                podName
                            );
                        }
                    });
                });
            } else if (result.success) {
                list.innerHTML = 'No rules';
                list.className = 'viz-process-items empty';
            } else {
                list.innerHTML = 'Error';
                list.className = 'viz-process-items empty';
            }
        } catch (error) {
            console.error('Failed to get process rules:', error);
            list.innerHTML = 'Error';
            list.className = 'viz-process-items empty';
        }
    }

    /**
     * Delete a process rule from visualization
     */
    async deleteVizProcessRule(groupName, processName, processPath, itemElement, target, podName) {
        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            return;
        }

        // Visual feedback
        itemElement.classList.add('deleting');
        const deleteBtn = itemElement.querySelector('.viz-btn-delete');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '...';
        }

        try {
            const response = await fetch('/api/neuvector/delete-process-rule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                    process_name: processName,
                    process_path: processPath,
                }),
            });

            const result = await response.json();

            if (result.success) {
                // Animate removal then refresh the full list
                itemElement.style.opacity = '0';
                itemElement.style.transform = 'translateX(-10px)';
                itemElement.style.transition = 'all 0.2s ease';

                setTimeout(() => {
                    // Refresh from API to get accurate state
                    this.updateVizProcessRules(target, podName);
                }, 300);
            } else {
                itemElement.classList.remove('deleting');
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.textContent = '×';
                }
                console.error('Failed to delete rule:', result.message);
            }
        } catch (error) {
            console.error('Failed to delete process rule:', error);
            itemElement.classList.remove('deleting');
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = '×';
            }
        }
    }

    /**
     * Load DLP sensor status for a pod
     * @param {string} podName - The pod name
     * @param {string} target - 'source' or 'target' to determine element IDs
     */
    async loadDLPSensors(podName, target = 'source') {
        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            return;
        }

        const groupName = `nv.${podName.replace(/-test$/, '')}.neuvector-demo`;
        const prefix = target === 'target' ? 'viz-tgt-' : 'viz-';

        try {
            const response = await fetch('/api/neuvector/dlp-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                }),
            });

            const result = await response.json();

            if (result.success) {
                // Update checkbox and action states
                for (const sensor of result.sensors) {
                    let sensorKey = '';
                    if (sensor.name === 'sensor.creditcard') {
                        sensorKey = 'creditcard';
                    } else if (sensor.name === 'sensor.ssn') {
                        sensorKey = 'ssn';
                    }

                    if (sensorKey) {
                        // Update checkbox
                        const checkbox = document.getElementById(`${prefix}sensor-${sensorKey}`);
                        if (checkbox) {
                            checkbox.checked = sensor.enabled;
                            checkbox.disabled = false;
                        }

                        // Update action buttons
                        const actionToggle = document.getElementById(`${prefix}action-${sensorKey}`);
                        if (actionToggle && sensor.action) {
                            actionToggle.querySelectorAll('.viz-action-btn').forEach(btn => {
                                btn.classList.toggle('active', btn.dataset.action === sensor.action);
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load DLP sensors:', error);
        }
    }

    /**
     * Update a DLP sensor for a pod
     */
    async updateDLPSensor(podName, sensorName, enabled, action, checkboxElement) {
        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            if (checkboxElement) checkboxElement.checked = !enabled; // Revert
            return;
        }

        const groupName = `nv.${podName.replace(/-test$/, '')}.neuvector-demo`;

        // Disable during update
        if (checkboxElement) checkboxElement.disabled = true;

        try {
            const response = await fetch('/api/neuvector/update-dlp-sensor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                    sensor_name: sensorName,
                    enabled: enabled,
                    action: action,
                }),
            });

            const result = await response.json();
            if (checkboxElement) checkboxElement.disabled = false;

            if (!result.success) {
                console.error('Failed to update DLP sensor:', result.message);
                if (checkboxElement) checkboxElement.checked = !enabled; // Revert on error
            }
        } catch (error) {
            console.error('Failed to update DLP sensor:', error);
            if (checkboxElement) {
                checkboxElement.disabled = false;
                checkboxElement.checked = !enabled; // Revert on error
            }
        }
    }

    /**
     * Update a pod setting via API from visualization
     */
    async updateVizPodSetting(target, podName, selectElement) {
        const field = selectElement.dataset.field;
        const value = selectElement.value;
        const serviceName = podName.replace(/-test$/, '') + '.neuvector-demo';

        // Disable select during update
        selectElement.disabled = true;
        const originalClass = selectElement.className;

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            selectElement.disabled = false;
            console.warn('No password configured for NeuVector API');
            return;
        }

        console.log(`Updating ${field} to ${value} for service ${serviceName}`);

        try {
            const body = {
                username: credentials.username,
                password: credentials.password,
                service_name: serviceName,
            };
            body[field] = value;

            const response = await fetch('/api/neuvector/update-group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const result = await response.json();
            console.log('Update result:', result);

            if (result.success) {
                // Update class based on mode
                if (field === 'policy_mode' || field === 'profile_mode') {
                    selectElement.className = 'viz-setting-select mode-' + value.toLowerCase();

                    // Update mode icons immediately
                    const prefix = target === 'source' ? 'viz-src' : 'viz-tgt';
                    const policySelect = document.getElementById(`${prefix}-policy-mode`);
                    const profileSelect = document.getElementById(`${prefix}-profile-mode`);
                    this.updateModeIcons(target, policySelect?.value || 'Discover', profileSelect?.value || 'Discover');
                }
                // Verify by reloading status and process rules after a short delay
                setTimeout(() => {
                    this.updateVizPodStatus(target, podName);
                    this.updateVizProcessRules(target, podName);
                }, 500);
            } else {
                console.error('Failed to update setting:', result.message);
                // Revert on error
                this.updateVizPodStatus(target, podName);
            }
        } catch (error) {
            console.error('Failed to update setting:', error);
        }

        selectElement.disabled = false;
    }

    /**
     * Sync hidden form fields from visualization selects
     */
    syncFormFromViz() {
        // Sync source
        const vizSource = document.getElementById('viz-source-select');
        const formSource = document.getElementById('param-pod_name');
        if (vizSource && formSource) formSource.value = vizSource.value;

        // Sync connectivity demo fields
        // Sync target type
        const vizTargetType = document.getElementById('viz-target-type');
        const formTargetType = document.getElementById('param-target_type');
        if (vizTargetType && formTargetType) formTargetType.value = vizTargetType.value;

        // Sync target pod
        const vizTargetPod = document.getElementById('viz-target-pod');
        const formTargetPod = document.getElementById('param-target_pod');
        if (vizTargetPod && formTargetPod) formTargetPod.value = vizTargetPod.value;

        // Sync target public
        const vizTargetPublic = document.getElementById('viz-target-public');
        const formTargetPublic = document.getElementById('param-target_public');
        if (vizTargetPublic && formTargetPublic) formTargetPublic.value = vizTargetPublic.value;

        // Sync target custom
        const vizTargetCustom = document.getElementById('viz-target-custom');
        const formTargetCustom = document.getElementById('param-target_custom');
        if (vizTargetCustom && formTargetCustom) formTargetCustom.value = vizTargetCustom.value;

        // Sync DLP demo fields
        // Sync DLP target
        const vizDlpTarget = document.getElementById('viz-dlp-target');
        const formDlpTarget = document.getElementById('param-target');
        if (vizDlpTarget && formDlpTarget) formDlpTarget.value = vizDlpTarget.value;

        // Sync data type
        const vizDataType = document.getElementById('viz-data-type');
        const formDataType = document.getElementById('param-data_type');
        if (vizDataType && formDataType) formDataType.value = vizDataType.value;

        // Sync custom data
        const vizCustomData = document.getElementById('viz-custom-data');
        const formCustomData = document.getElementById('param-custom_data');
        if (vizCustomData && formCustomData) formCustomData.value = vizCustomData.value;
    }

    /**
     * Set the command and update UI
     */
    setCommand(cmd) {
        // Update hidden input
        const cmdInput = document.getElementById('param-command');
        if (cmdInput) cmdInput.value = cmd;

        // Update button states
        document.querySelectorAll('.btn-cmd').forEach(btn => {
            if (btn.dataset.cmd === cmd) {
                btn.classList.remove('btn-outline');
                btn.classList.add('btn-primary', 'active');
            } else {
                btn.classList.remove('btn-primary', 'active');
                btn.classList.add('btn-outline');
            }
        });

        // Update arrow label
        const arrowLabel = document.getElementById('viz-arrow-label');
        if (arrowLabel) arrowLabel.textContent = cmd;
    }

    /**
     * Get target label for display
     */
    getTargetLabel() {
        const targetType = document.getElementById('param-target_type')?.value || 'public';

        if (targetType === 'pod') {
            const podSelect = document.getElementById('param-target_pod');
            return podSelect ? podSelect.options[podSelect.selectedIndex]?.text || 'Pod' : 'Pod';
        } else if (targetType === 'public') {
            const publicSelect = document.getElementById('param-target_public');
            if (publicSelect) {
                const url = publicSelect.value || '';
                try {
                    return new URL(url).hostname;
                } catch (e) {
                    return publicSelect.options[publicSelect.selectedIndex]?.text || 'Website';
                }
            }
            return 'Website';
        } else {
            const custom = document.getElementById('param-target_custom')?.value || 'Custom';
            // Extract hostname from custom value
            try {
                if (custom.includes('://')) {
                    return new URL(custom).hostname;
                }
                return custom.split('/')[0].split(':')[0].substring(0, 20);
            } catch (e) {
                return custom.substring(0, 20);
            }
        }
    }

    /**
     * Create visualization for Admission Control demo
     */
    createAdmissionVisualization(demo) {
        const namespaceParam = demo.parameters.find(p => p.name === 'namespace');
        const podNameParam = demo.parameters.find(p => p.name === 'pod_name');

        // Build namespace options
        const namespaceOptions = namespaceParam.options.map(opt =>
            `<option value="${opt.value}" ${opt.value === namespaceParam.default ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        const vizHtml = `
            <div class="demo-viz-row">
                <div class="demo-visualization admission-viz" id="demo-visualization">
                    <div class="viz-content admission-content">
                        <div class="admission-panel">
                            <div class="admission-section">
                                <div class="admission-header">
                                    <span class="admission-icon">🚫</span>
                                    <span>Admission Control Test</span>
                                </div>
                                <div class="admission-controls">
                                    <div class="admission-row">
                                        <label class="admission-label">Target Namespace</label>
                                        <select class="viz-select" id="viz-admission-namespace" name="namespace">${namespaceOptions}</select>
                                    </div>
                                    <div class="admission-row">
                                        <label class="admission-label">Pod Name</label>
                                        <input type="text" class="viz-select" id="viz-admission-pod" name="pod_name" value="${podNameParam?.default || 'test-admission-pod'}">
                                    </div>
                                </div>
                                <div class="admission-actions">
                                    <button type="button" class="btn btn-primary btn-admission" data-action="create" title="Create a test pod in the selected namespace">
                                        <span class="btn-icon">➕</span> Create Pod
                                    </button>
                                    <button type="button" class="btn btn-outline btn-admission" data-action="delete" title="Delete the test pod">
                                        <span class="btn-icon">🗑️</span> Delete Pod
                                    </button>
                                    <button type="button" class="btn btn-outline btn-admission" data-action="status" title="Check pod status">
                                        <span class="btn-icon">🔍</span> Check Status
                                    </button>
                                </div>
                            </div>
                            <div class="admission-section admission-state">
                                <div class="admission-header">
                                    <span class="admission-icon">🛡️</span>
                                    <span>Admission Control State</span>
                                    <button type="button" class="btn-refresh" id="btn-refresh-admission" title="Refresh state">↻</button>
                                </div>
                                <div class="admission-state-content" id="admission-state-content">
                                    <div class="admission-state-row">
                                        <span class="admission-state-label">Status</span>
                                        <span class="admission-state-value" id="admission-state-enabled">Loading...</span>
                                    </div>
                                    <div class="admission-state-row">
                                        <span class="admission-state-label">Mode</span>
                                        <span class="admission-state-value" id="admission-state-mode">-</span>
                                    </div>
                                </div>
                            </div>
                            <div class="admission-section admission-rules">
                                <div class="admission-header">
                                    <span class="admission-icon">📋</span>
                                    <span>Admission Rules</span>
                                    <span id="admission-rules-count"></span>
                                </div>
                                <div class="admission-rules-list" id="admission-rules-list">
                                    Loading...
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="viz-status pending" id="viz-status">
                        <span class="viz-status-dot"></span>
                        <span class="viz-status-text">Ready</span>
                    </div>
                </div>
                <div class="nv-logs-container" id="nv-logs-container">
                    <div class="nv-logs-header">
                        <span>Admission Events</span>
                        <button type="button" class="btn-refresh" id="btn-refresh-logs" title="Refresh events">↻</button>
                    </div>
                    <div class="nv-logs-list empty" id="nv-logs-list">
                        Click refresh to load events
                    </div>
                </div>
            </div>
        `;

        // Find the card-body to insert before
        const demoParams = document.getElementById('demo-params');
        if (!demoParams) return;

        // Remove existing visualization
        this.removeVisualization();

        // Insert visualization BEFORE the params (at the top)
        const vizWrapper = document.createElement('div');
        vizWrapper.id = 'viz-wrapper';
        vizWrapper.innerHTML = vizHtml;
        demoParams.parentNode.insertBefore(vizWrapper, demoParams);

        this.vizContainer = document.getElementById('demo-visualization');
        this.vizState = 'pending';

        // Set up namespace change listener
        const namespaceSelect = document.getElementById('viz-admission-namespace');
        if (namespaceSelect) {
            namespaceSelect.addEventListener('change', () => {
                this.syncAdmissionFormFromViz();
                this.updateAdmissionNamespaceStyle();
            });
            // Initial style update
            this.updateAdmissionNamespaceStyle();
        }

        // Set up pod name input listener
        const podNameInput = document.getElementById('viz-admission-pod');
        if (podNameInput) {
            podNameInput.addEventListener('input', () => this.syncAdmissionFormFromViz());
        }

        // Set up action buttons
        document.querySelectorAll('.btn-admission').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                this.runAdmissionAction(action);
            });
        });

        // Set up refresh buttons
        document.getElementById('btn-refresh-admission')?.addEventListener('click', () => this.loadAdmissionState());
        document.getElementById('btn-refresh-logs')?.addEventListener('click', () => this.fetchAdmissionEvents());

        // Initial load
        this.loadAdmissionState();
        this.loadAdmissionRules();
    }

    /**
     * Sync admission form from visualization
     */
    syncAdmissionFormFromViz() {
        const namespaceSelect = document.getElementById('viz-admission-namespace');
        const podNameInput = document.getElementById('viz-admission-pod');
        const hiddenNamespace = document.getElementById('param-namespace');
        const hiddenPodName = document.getElementById('param-pod_name');

        if (namespaceSelect && hiddenNamespace) {
            hiddenNamespace.value = namespaceSelect.value;
        }
        if (podNameInput && hiddenPodName) {
            hiddenPodName.value = podNameInput.value;
        }
    }

    /**
     * Update namespace select styling based on value
     */
    updateAdmissionNamespaceStyle() {
        const namespaceSelect = document.getElementById('viz-admission-namespace');
        if (!namespaceSelect) return;

        const isForbidden = namespaceSelect.value.includes('forbidden');
        namespaceSelect.classList.toggle('forbidden', isForbidden);
        namespaceSelect.classList.toggle('allowed', !isForbidden);
    }

    /**
     * Run admission action
     */
    runAdmissionAction(action) {
        if (this.isRunning || !wsManager.isConnected()) return;

        // Update hidden action field
        const hiddenAction = document.getElementById('param-action');
        if (hiddenAction) {
            hiddenAction.value = action;
        }

        // Sync form values
        this.syncAdmissionFormFromViz();

        // Update visualization to running state
        this.updateVisualization('running', `${action === 'create' ? 'Creating' : action === 'delete' ? 'Deleting' : 'Checking'} pod...`);

        // Run the demo
        this.runCurrentDemo();
    }

    /**
     * Load admission control state
     */
    async loadAdmissionState() {
        const enabledEl = document.getElementById('admission-state-enabled');
        const modeEl = document.getElementById('admission-state-mode');

        if (!enabledEl || !modeEl) return;

        enabledEl.textContent = 'Loading...';
        modeEl.textContent = '-';

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            enabledEl.textContent = 'Not configured';
            return;
        }

        try {
            const response = await fetch('/api/neuvector/admission-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                }),
            });

            const result = await response.json();

            if (result.success) {
                const enabled = result.enabled;
                const mode = result.mode || 'monitor';
                enabledEl.textContent = enabled ? 'Enabled' : 'Disabled';
                enabledEl.className = 'admission-state-value ' + (enabled ? 'enabled' : 'disabled');
                modeEl.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
                modeEl.className = 'admission-state-value mode-' + mode;
            } else {
                enabledEl.textContent = 'Error';
                modeEl.textContent = result.message || 'Failed';
            }
        } catch (error) {
            console.error('Failed to get admission state:', error);
            enabledEl.textContent = 'Error';
        }
    }

    /**
     * Load admission rules
     */
    async loadAdmissionRules() {
        const listEl = document.getElementById('admission-rules-list');
        const countEl = document.getElementById('admission-rules-count');

        if (!listEl) return;

        listEl.innerHTML = 'Loading...';
        listEl.className = 'admission-rules-list loading';
        if (countEl) countEl.textContent = '';

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            listEl.innerHTML = 'Configure SUSE Security credentials first';
            listEl.className = 'admission-rules-list empty';
            return;
        }

        try {
            const response = await fetch('/api/neuvector/admission-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                }),
            });

            const result = await response.json();

            if (result.success && result.rules.length > 0) {
                if (countEl) countEl.textContent = `(${result.rules.length})`;

                listEl.innerHTML = result.rules.map(rule => {
                    const criteria = rule.criteria.map(c => `${c.name} ${c.op} ${c.value}`).join(', ');
                    return `
                        <div class="admission-rule-item ${rule.disable ? 'disabled' : ''} ${rule.rule_type}">
                            <div class="admission-rule-type">${rule.rule_type.toUpperCase()}</div>
                            <div class="admission-rule-info">
                                <span class="admission-rule-comment">${this.escapeHtml(rule.comment || 'No description')}</span>
                                <span class="admission-rule-criteria">${this.escapeHtml(criteria)}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                listEl.className = 'admission-rules-list';
            } else if (result.success) {
                listEl.innerHTML = 'No admission rules';
                listEl.className = 'admission-rules-list empty';
            } else {
                listEl.innerHTML = result.message || 'Failed to load';
                listEl.className = 'admission-rules-list empty';
            }
        } catch (error) {
            console.error('Failed to get admission rules:', error);
            listEl.innerHTML = 'Error loading rules';
            listEl.className = 'admission-rules-list empty';
        }
    }

    /**
     * Fetch admission events
     */
    async fetchAdmissionEvents() {
        const logsList = document.getElementById('nv-logs-list');
        if (!logsList) return;

        logsList.innerHTML = 'Loading...';
        logsList.className = 'nv-logs-list loading';

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            logsList.innerHTML = 'Configure SUSE Security credentials first';
            logsList.className = 'nv-logs-list empty';
            return;
        }

        try {
            const response = await fetch('/api/neuvector/admission-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    limit: 20,
                }),
            });

            const result = await response.json();

            if (result.success && result.events.length > 0) {
                logsList.innerHTML = result.events.map(event => {
                    const time = event.reported_at ? new Date(event.reported_at).toLocaleTimeString() : '';
                    const levelClass = event.level?.toLowerCase() || 'info';
                    return `
                        <div class="nv-log-item ${levelClass}">
                            <div class="nv-log-header">
                                <span class="nv-log-type admission">${event.name}</span>
                                <span class="nv-log-time">${time}</span>
                            </div>
                            <div class="nv-log-message">${this.escapeHtml(event.message)}</div>
                            <div class="nv-log-details">${this.escapeHtml(event.workload)} in ${this.escapeHtml(event.namespace)}</div>
                        </div>
                    `;
                }).join('');
                logsList.className = 'nv-logs-list';
            } else if (result.success) {
                logsList.innerHTML = 'No admission events';
                logsList.className = 'nv-logs-list empty';
            } else {
                logsList.innerHTML = result.message || 'Failed to load events';
                logsList.className = 'nv-logs-list empty';
            }
        } catch (error) {
            console.error('Failed to fetch admission events:', error);
            logsList.innerHTML = 'Error loading events';
            logsList.className = 'nv-logs-list empty';
        }
    }

    /**
     * Remove visualization
     */
    removeVisualization() {
        const existing = document.getElementById('viz-wrapper');
        if (existing) {
            existing.remove();
        }
        this.vizContainer = null;
    }

    /**
     * Update visualization labels from current form values
     */
    updateVizLabels() {
        const podSelect = document.getElementById('param-pod_name');
        const sourceLabel = document.getElementById('viz-source-label');
        const targetLabelEl = document.getElementById('viz-target-label');
        const targetIcon = document.querySelector('#viz-target .viz-icon');

        if (podSelect && sourceLabel) {
            sourceLabel.textContent = podSelect.options[podSelect.selectedIndex]?.text || 'Source';
        }

        if (targetLabelEl) {
            targetLabelEl.textContent = this.getTargetLabel();
        }

        // Update target icon based on type
        if (targetIcon) {
            const targetType = document.getElementById('param-target_type')?.value || 'public';
            targetIcon.textContent = targetType === 'pod' ? '📦' : '🌐';
        }
    }

    /**
     * Update visualization state
     * @param {string} state - pending, running, success, blocked, intercepted
     * @param {string} message - Status message to display
     */
    updateVisualization(state, message = '') {
        if (!this.vizContainer) return;

        this.vizState = state;

        const source = document.getElementById('viz-source');
        const arrow = document.getElementById('viz-arrow');
        const target = document.getElementById('viz-target');
        const status = document.getElementById('viz-status');
        const statusText = status?.querySelector('.viz-status-text');

        // Remove all state classes
        const states = ['pending', 'running', 'success', 'blocked', 'intercepted'];
        [source, arrow, target, status].forEach(el => {
            if (el) states.forEach(s => el.classList.remove(s));
        });

        // Apply new state
        if (source) source.classList.add(state);
        if (status) status.classList.add(state);

        // Arrow and target states depend on the scenario
        if (state === 'pending' || state === 'running') {
            if (arrow) arrow.classList.add(state);
            if (target) target.classList.add(state);
        } else if (state === 'success') {
            if (arrow) arrow.classList.add('success');
            if (target) target.classList.add('success');
        } else if (state === 'blocked') {
            // Network blocked - arrow shows X, target red
            if (arrow) arrow.classList.add('blocked');
            if (target) target.classList.add('blocked');
        } else if (state === 'intercepted') {
            // Process intercepted - source shows strikethrough, arrow blocked
            if (arrow) arrow.classList.add('blocked');
            if (target) target.classList.add('pending');
        }

        // Update status text
        if (statusText) {
            const messages = {
                'pending': 'Ready',
                'running': 'Connecting...',
                'success': 'Connection successful',
                'blocked': 'Network blocked by policy',
                'intercepted': 'Process blocked by SUSE Security',
            };
            statusText.textContent = message || messages[state] || state;
        }
    }

    /**
     * Fetch NeuVector events for current pod
     */
    async fetchNeuVectorEvents() {
        console.log('[NV Events] fetchNeuVectorEvents called');
        const logsList = document.getElementById('nv-logs-list');
        const refreshBtn = document.getElementById('btn-refresh-logs');
        // Try viz select first, then hidden input
        const podSelect = document.getElementById('viz-source-select') || document.getElementById('param-pod_name');

        if (!logsList) {
            console.log('[NV Events] No logs list element found');
            return;
        }

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            logsList.innerHTML = 'Configure SUSE Security credentials first';
            logsList.className = 'nv-logs-list empty';
            return;
        }

        // Get group name from pod selection - use null to fetch all events
        let groupName = null;
        if (podSelect) {
            const podName = podSelect.value || 'production1';
            const serviceName = podName.replace(/-test$/, '');
            groupName = `nv.${serviceName}.neuvector-demo`;
        }
        console.log('[NV Events] Fetching events for group:', groupName || 'all');

        // Show loading
        logsList.innerHTML = 'Loading...';
        logsList.className = 'nv-logs-list loading';
        if (refreshBtn) refreshBtn.classList.add('loading');

        try {
            const response = await fetch('/api/neuvector/recent-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: credentials.username,
                    password: credentials.password,
                    group_name: groupName,
                    limit: 10,
                }),
            });

            const result = await response.json();
            console.log('[NV Events] API response:', result);

            if (result.success && result.events.length > 0) {
                logsList.innerHTML = result.events.map(event => {
                    const timeStr = event.reported_at ? this.formatEventTime(event.reported_at) : '';
                    return `
                        <div class="nv-log-item">
                            <span class="nv-log-type ${event.event_type}">${event.event_type}</span>
                            <div class="nv-log-info">
                                <div class="nv-log-message">${this.escapeHtml(event.message)}</div>
                                <div class="nv-log-details">${this.escapeHtml(event.details)}</div>
                            </div>
                            <span class="nv-log-time">${timeStr}</span>
                        </div>
                    `;
                }).join('');
                logsList.className = 'nv-logs-list';
            } else if (result.success) {
                logsList.innerHTML = 'No recent events';
                logsList.className = 'nv-logs-list empty';
            } else {
                console.error('[NV Events] API error:', result.message);
                logsList.innerHTML = result.message || 'Failed to load events';
                logsList.className = 'nv-logs-list empty';
            }
        } catch (error) {
            console.error('[NV Events] Failed to fetch events:', error);
            logsList.innerHTML = 'Error loading events';
            logsList.className = 'nv-logs-list empty';
        }

        if (refreshBtn) refreshBtn.classList.remove('loading');
    }

    /**
     * Format event timestamp for display (precise with seconds)
     */
    formatEventTime(timestamp) {
        try {
            const date = new Date(timestamp);
            const now = new Date();

            // Always show time with seconds (HH:MM:SS)
            const timeStr = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            // If today, show time only
            if (date.toDateString() === now.toDateString()) {
                return timeStr;
            }
            // Otherwise show date + time
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return `${dateStr} ${timeStr}`;
        } catch (e) {
            return '';
        }
    }

    /**
     * Render parameter input
     */
    renderParameter(param) {
        let input = '';
        let value = param.default || '';

        // Pre-fill NeuVector credentials from settings
        const credentials = settingsManager.getCredentials();
        if (param.name === 'nv_username' && credentials.username) {
            value = credentials.username;
        } else if (param.name === 'nv_password' && credentials.password) {
            value = credentials.password;
        }

        // Add status display for pod_name parameter
        let statusDisplay = '';
        if (param.name === 'pod_name') {
            const modeOptions = `
                <option value="Discover">Discover</option>
                <option value="Monitor">Monitor</option>
                <option value="Protect">Protect</option>
            `;
            const baselineOptions = `
                <option value="basic">basic</option>
                <option value="zero-drift">zero-drift</option>
            `;
            statusDisplay = `<div class="pod-status-container" id="pod-status-container">
                <div class="pod-status-row">
                    <span class="pod-status-label">Network Policy:</span>
                    <select class="pod-status-select" id="pod-policy-mode" data-field="policy_mode">${modeOptions}</select>
                </div>
                <div class="pod-status-row">
                    <span class="pod-status-label">Process Profile:</span>
                    <select class="pod-status-select" id="pod-profile-mode" data-field="profile_mode">${modeOptions}</select>
                </div>
                <div class="pod-status-row">
                    <span class="pod-status-label">Baseline Profile:</span>
                    <select class="pod-status-select" id="pod-baseline-profile" data-field="baseline_profile">${baselineOptions}</select>
                </div>
            </div>
            <div class="process-rules-container" id="process-rules-container">
                <div class="process-rules-header">
                    <span>Allowed Processes</span>
                    <span class="process-rules-count" id="process-rules-count"></span>
                </div>
                <div class="process-rules-list loading" id="process-rules-list">Loading...</div>
            </div>`;
        }

        switch (param.type) {
            case 'select':
                const options = param.options.map(opt =>
                    `<option value="${opt.value}" ${opt.value === param.default ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                input = `<select class="form-control" name="${param.name}" id="param-${param.name}" ${param.required ? 'required' : ''}>${options}</select>${statusDisplay}`;
                break;

            case 'checkbox':
                input = `<input type="checkbox" name="${param.name}" id="param-${param.name}" ${param.default ? 'checked' : ''}>`;
                break;

            case 'number':
                input = `<input type="number" class="form-control" name="${param.name}" id="param-${param.name}" value="${value}" placeholder="${param.placeholder || ''}" ${param.required ? 'required' : ''}>`;
                break;

            case 'password':
                input = `<input type="password" class="form-control" name="${param.name}" id="param-${param.name}" value="${value}" placeholder="${param.placeholder || ''}" ${param.required ? 'required' : ''}>`;
                break;

            default: // text
                input = `<input type="text" class="form-control" name="${param.name}" id="param-${param.name}" value="${value}" placeholder="${param.placeholder || ''}" ${param.required ? 'required' : ''}>`;
        }

        return `
            <div class="form-group">
                <label for="param-${param.name}">${param.label}${param.required ? ' *' : ''}</label>
                ${input}
                ${param.help_text ? `<div class="help-text">${param.help_text}</div>` : ''}
            </div>
        `;
    }

    /**
     * Run current demo
     */
    runCurrentDemo() {
        if (this.isRunning || !wsManager.isConnected() || !this.currentDemo) return;

        // Reset detected result for new run
        this.detectedResult = null;

        // Collect parameters
        const params = {};
        this.currentDemo.parameters.forEach(param => {
            const input = document.getElementById(`param-${param.name}`);
            if (input) {
                if (param.type === 'checkbox') {
                    params[param.name] = input.checked;
                } else {
                    params[param.name] = input.value;
                }
            }
        });

        this.clearConsole();
        this.appendOutput(`Running demo: ${this.currentDemo.name}`, 'info');
        this.appendOutput('');

        // Reset visualization to pending then running
        if (this.vizContainer) {
            this.updateVisualization('pending');
            setTimeout(() => this.updateVisualization('running', 'Connecting...'), 100);
        }

        wsManager.executeDemo(this.currentDemo.id, params);
    }
}
