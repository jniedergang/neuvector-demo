/**
 * NeuVector Demo Platform - Main JavaScript
 */

/**
 * Settings Manager - handles NeuVector API credentials
 */
class SettingsManager {
    constructor() {
        this.STORAGE_KEY = 'neuvector_settings';
        this.modal = document.getElementById('settings-modal');
        this.usernameInput = document.getElementById('settings-username');
        this.passwordInput = document.getElementById('settings-password');
        this.apiUrlDisplay = document.getElementById('settings-api-url');
        this.statusDiv = document.getElementById('settings-status');
        this.apiStatusBox = document.getElementById('api-status-box');
        this.apiStatusValue = document.getElementById('api-status-value');
    }

    init() {
        // Load saved settings
        this.loadSettings();

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
        this.modal?.classList.add('active');
        this.usernameInput?.focus();
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
            this.showStatus('Settings saved', 'success');
            this.checkApiStatus(); // Refresh API status
            setTimeout(() => this.closeModal(), 1000);
        } catch (error) {
            this.showStatus('Failed to save settings', 'error');
        }
    }

    async checkApiStatus() {
        const credentials = this.getCredentials();

        if (!credentials.password) {
            this.updateApiStatusDisplay('Not configured', '');
            return;
        }

        this.updateApiStatusDisplay('Checking...', 'checking');

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
            this.apiStatusBox.className = 'api-status-box' + (status ? ' ' + status : '');
        }
    }

    async checkClusterStatus() {
        const clusterStatusBox = document.getElementById('cluster-status-box');
        const clusterStatusValue = document.getElementById('cluster-status-value');

        if (!clusterStatusBox || !clusterStatusValue) return;

        clusterStatusBox.className = 'api-status-box checking';
        clusterStatusValue.textContent = 'Checking...';

        try {
            const response = await fetch('/api/cluster-info');
            const info = await response.json();

            if (info.connected) {
                // Extract short name from context (e.g., "downstream" from "downstream")
                const contextName = info.context || 'unknown';
                const shortName = contextName.split('/').pop().split('@').pop();
                clusterStatusValue.textContent = `${shortName} (${info.node_count} nodes)`;
                clusterStatusBox.className = 'api-status-box ok';
            } else {
                clusterStatusValue.textContent = 'Disconnected';
                clusterStatusBox.className = 'api-status-box error';
            }
        } catch (error) {
            clusterStatusValue.textContent = 'Error';
            clusterStatusBox.className = 'api-status-box error';
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
});

class DemoApp {
    constructor() {
        this.currentDemo = null;
        this.isRunning = false;
        this.console = null;
        this.vizState = 'pending';
        this.vizContainer = null;
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
        this.demoTitle = document.getElementById('demo-title');
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

        // Demo items
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

        // Detect process interception (check first - exit code 137 = SIGKILL from NeuVector)
        if (lowerText.includes('exit code 137') ||
            lowerText.includes('exit code 9') ||
            lowerText.includes('command terminated') ||
            lowerText.includes('killed') ||
            lowerText.includes('sigkill') ||
            lowerText.includes('permission denied') ||
            lowerText.includes('operation not permitted') ||
            (text.includes('[ERROR]') && (lowerText.includes('process') || lowerText.includes('terminated')))) {
            this.updateVisualization('intercepted', 'Process blocked by NeuVector');
            setTimeout(() => this.fetchNeuVectorEvents(), 1000);
            return;
        }

        // Detect success
        if (text.includes('[OK]') || text.includes('HTTP/') || lowerText.includes('success')) {
            // Check if it's a curl success (contains HTTP status)
            if (text.includes('HTTP/1') || text.includes('HTTP/2') || text.includes('200')) {
                this.updateVisualization('success', 'Connection successful');
                setTimeout(() => this.fetchNeuVectorEvents(), 1000);
                return;
            }
        }

        // Detect network block
        if (lowerText.includes('connection refused') ||
            lowerText.includes('connection timed out') ||
            lowerText.includes('network unreachable') ||
            lowerText.includes('could not resolve') ||
            lowerText.includes('no route to host') ||
            (text.includes('[ERROR]') && lowerText.includes('curl'))) {
            this.updateVisualization('blocked', 'Network blocked by policy');
            setTimeout(() => this.fetchNeuVectorEvents(), 1000);
            return;
        }

        // Detect running/connecting
        if (text.includes('[CMD]') || lowerText.includes('executing') || lowerText.includes('connecting')) {
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

        // Update visualization if still in running state
        if (this.vizContainer && this.vizState === 'running') {
            if (success) {
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
                    this.updateVisualization('intercepted', 'Process blocked by NeuVector');
                } else {
                    this.updateVisualization('blocked', message || 'Connection failed');
                }
            }
            // Fetch events after demo completes
            setTimeout(() => this.fetchNeuVectorEvents(), 1000);
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
        // Update active state
        document.querySelectorAll('.demo-item').forEach(item => {
            item.classList.toggle('active', item.dataset.demoId === demoId);
        });

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
        if (this.demoTitle) {
            this.demoTitle.textContent = `${demo.icon} ${demo.name}`;
        }

        if (this.demoDescription) {
            this.demoDescription.innerHTML = `<p>${demo.description}</p>`;
        }

        // Check if this is a connectivity-type demo (has pod_name and target_url)
        const paramNames = demo.parameters.map(p => p.name);
        const isConnectivityDemo = paramNames.includes('pod_name') && paramNames.includes('target_url');

        if (this.demoParams) {
            if (isConnectivityDemo) {
                // Render compact layout for connectivity demos
                this.demoParams.innerHTML = this.renderCompactDemoParams(demo);
            } else {
                // Standard layout for other demos
                this.demoParams.innerHTML = demo.parameters.map(param => this.renderParameter(param)).join('');
            }
        }

        if (this.runButton) {
            // Hide main run button for connectivity demos (it's in the visualization)
            this.runButton.style.display = isConnectivityDemo ? 'none' : 'inline-flex';
        }

        // Create visualization for connectivity demos
        this.createVisualization(demo);

        // Set up pod status listener for connectivity demo
        const podSelect = document.getElementById('param-pod_name');
        if (podSelect) {
            podSelect.addEventListener('change', () => {
                this.updatePodStatus(podSelect.value);
                this.updateProcessRules(podSelect.value);
                this.updateVizLabels();
            });
            // Trigger initial fetch
            this.updatePodStatus(podSelect.value);
            this.updateProcessRules(podSelect.value);

            // Set up change listeners for policy selects
            ['pod-policy-mode', 'pod-profile-mode', 'pod-baseline-profile'].forEach(id => {
                const select = document.getElementById(id);
                if (select) {
                    select.addEventListener('change', () => this.updatePodSetting(podSelect.value, select));
                }
            });
        }
    }

    /**
     * Render compact demo parameters for connectivity demos
     */
    renderCompactDemoParams(demo) {
        const podParam = demo.parameters.find(p => p.name === 'pod_name');
        const targetParam = demo.parameters.find(p => p.name === 'target_url');
        const methodParam = demo.parameters.find(p => p.name === 'method');

        const modeOptions = `
            <option value="Discover">Discover</option>
            <option value="Monitor">Monitor</option>
            <option value="Protect">Protect</option>
        `;
        const baselineOptions = `
            <option value="basic">basic</option>
            <option value="zero-drift">zero-drift</option>
        `;

        const podOptions = podParam.options.map(opt =>
            `<option value="${opt.value}" ${opt.value === podParam.default ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        const methodOptions = methodParam ? methodParam.options.map(opt =>
            `<option value="${opt.value}" ${opt.value === methodParam.default ? 'selected' : ''}>${opt.label}</option>`
        ).join('') : '';

        return `
            <div class="demo-compact-row">
                <div class="demo-config-left">
                    <div class="form-group">
                        <label for="param-pod_name">Source Pod *</label>
                        <select class="form-control" name="pod_name" id="param-pod_name" required>${podOptions}</select>
                    </div>
                    <div class="pod-status-container" id="pod-status-container">
                        <div class="pod-status-row">
                            <span class="pod-status-label">Network Policy:</span>
                            <select class="pod-status-select" id="pod-policy-mode" data-field="policy_mode">${modeOptions}</select>
                        </div>
                        <div class="pod-status-row">
                            <span class="pod-status-label">Process Profile:</span>
                            <select class="pod-status-select" id="pod-profile-mode" data-field="profile_mode">${modeOptions}</select>
                        </div>
                        <div class="pod-status-row">
                            <span class="pod-status-label">Baseline:</span>
                            <select class="pod-status-select" id="pod-baseline-profile" data-field="baseline_profile">${baselineOptions}</select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="param-target_url">Target URL *</label>
                        <input type="text" class="form-control" name="target_url" id="param-target_url"
                               value="${targetParam.default || ''}" placeholder="${targetParam.placeholder || ''}" required>
                    </div>
                    ${methodParam ? `
                    <div class="form-group">
                        <label for="param-method">HTTP Method</label>
                        <select class="form-control" name="method" id="param-method">${methodOptions}</select>
                    </div>
                    ` : ''}
                </div>
                <div class="demo-config-right">
                    <div class="process-rules-container" id="process-rules-container">
                        <div class="process-rules-header">
                            <span>Allowed Processes</span>
                            <span class="process-rules-count" id="process-rules-count"></span>
                        </div>
                        <div class="process-rules-list loading" id="process-rules-list">Loading...</div>
                    </div>
                </div>
            </div>
        `;
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
            list.innerHTML = 'Configure NeuVector credentials first';
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
                // Animate removal
                itemElement.style.opacity = '0';
                itemElement.style.height = '0';
                itemElement.style.padding = '0';
                itemElement.style.margin = '0';
                itemElement.style.overflow = 'hidden';
                itemElement.style.transition = 'all 0.3s ease';

                setTimeout(() => {
                    itemElement.remove();
                    // Update count
                    const count = document.getElementById('process-rules-count');
                    const list = document.getElementById('process-rules-list');
                    if (count && list) {
                        const remaining = list.querySelectorAll('.process-rule-item').length;
                        count.textContent = remaining > 0 ? `(${remaining})` : '';
                        if (remaining === 0) {
                            list.innerHTML = 'No process rules';
                            list.className = 'process-rules-list empty';
                        }
                    }
                }, 300);
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
     */
    createVisualization(demo) {
        // Only create visualization for demos with pod_name and target_url parameters
        if (!demo) {
            this.removeVisualization();
            return;
        }

        // Check if demo has the required parameters for visualization
        const paramNames = demo.parameters.map(p => p.name);
        const hasConnectivityParams = paramNames.includes('pod_name') && paramNames.includes('target_url');

        if (!hasConnectivityParams) {
            this.removeVisualization();
            return;
        }

        // Get parameter values for display
        const podSelect = document.getElementById('param-pod_name');
        const targetInput = document.getElementById('param-target_url');
        const sourceName = podSelect ? podSelect.options[podSelect.selectedIndex]?.text || 'Source' : 'Source';
        const targetUrl = targetInput ? targetInput.value || 'Target' : 'Target';

        // Extract domain from URL for display
        let targetLabel = targetUrl;
        try {
            const url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
            targetLabel = url.hostname;
        } catch (e) {
            targetLabel = targetUrl.substring(0, 20);
        }

        const vizHtml = `
            <div class="demo-viz-row">
                <div class="demo-visualization" id="demo-visualization">
                    <div class="viz-header">
                        <span>Visualization</span>
                    </div>
                    <div class="viz-content">
                        <div class="viz-box viz-source pending" id="viz-source">
                            <div class="viz-icon">📦</div>
                            <div class="viz-label" id="viz-source-label">${this.escapeHtml(sourceName)}</div>
                        </div>
                        <div class="viz-arrow pending" id="viz-arrow">
                            <div class="viz-arrow-line"></div>
                            <div class="viz-arrow-label" id="viz-arrow-label">curl</div>
                        </div>
                        <div class="viz-box viz-target pending" id="viz-target">
                            <div class="viz-icon">🌐</div>
                            <div class="viz-label" id="viz-target-label">${this.escapeHtml(targetLabel)}</div>
                        </div>
                    </div>
                    <div class="viz-status pending" id="viz-status">
                        <span class="viz-status-dot"></span>
                        <span class="viz-status-text">Ready</span>
                        <button type="button" class="btn btn-primary btn-viz-run" id="btn-viz-run">Run Demo</button>
                    </div>
                </div>
                <div class="nv-logs-container" id="nv-logs-container">
                    <div class="nv-logs-header">
                        <span>NeuVector Events</span>
                        <button class="btn-refresh" id="btn-refresh-logs" title="Refresh events">↻</button>
                    </div>
                    <div class="nv-logs-list empty" id="nv-logs-list">
                        Click refresh to load events
                    </div>
                </div>
            </div>
        `;

        // Find or create container after demo-params
        const demoParams = document.getElementById('demo-params');
        if (!demoParams) return;

        // Remove existing visualization
        this.removeVisualization();

        // Insert visualization after the params
        const vizWrapper = document.createElement('div');
        vizWrapper.id = 'viz-wrapper';
        vizWrapper.innerHTML = vizHtml;
        demoParams.parentNode.insertBefore(vizWrapper, demoParams.nextSibling);

        this.vizContainer = document.getElementById('demo-visualization');
        this.vizState = 'pending';

        // Set up event listeners for parameter changes
        if (podSelect) {
            podSelect.addEventListener('change', () => this.updateVizLabels());
        }
        if (targetInput) {
            targetInput.addEventListener('input', () => this.updateVizLabels());
        }

        // Set up refresh button
        const refreshBtn = document.getElementById('btn-refresh-logs');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.fetchNeuVectorEvents());
        }

        // Set up viz run button
        const vizRunBtn = document.getElementById('btn-viz-run');
        if (vizRunBtn) {
            vizRunBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.runCurrentDemo();
            });
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
        const targetInput = document.getElementById('param-target_url');
        const sourceLabel = document.getElementById('viz-source-label');
        const targetLabel = document.getElementById('viz-target-label');

        if (podSelect && sourceLabel) {
            sourceLabel.textContent = podSelect.options[podSelect.selectedIndex]?.text || 'Source';
        }

        if (targetInput && targetLabel) {
            let label = targetInput.value || 'Target';
            try {
                const url = new URL(label.startsWith('http') ? label : `https://${label}`);
                label = url.hostname;
            } catch (e) {
                label = label.substring(0, 20);
            }
            targetLabel.textContent = label;
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
                'intercepted': 'Process blocked by NeuVector',
            };
            statusText.textContent = message || messages[state] || state;
        }
    }

    /**
     * Fetch NeuVector events for current pod
     */
    async fetchNeuVectorEvents() {
        const logsList = document.getElementById('nv-logs-list');
        const refreshBtn = document.getElementById('btn-refresh-logs');
        const podSelect = document.getElementById('param-pod_name');

        if (!logsList) return;

        const credentials = settingsManager.getCredentials();
        if (!credentials.password) {
            logsList.innerHTML = 'Configure NeuVector credentials first';
            logsList.className = 'nv-logs-list empty';
            return;
        }

        // Get group name from pod selection
        let groupName = null;
        if (podSelect) {
            const podName = podSelect.value;
            const serviceName = podName.replace(/-test$/, '');
            groupName = `nv.${serviceName}.neuvector-demo`;
        }

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
                logsList.innerHTML = result.message || 'Failed to load events';
                logsList.className = 'nv-logs-list empty';
            }
        } catch (error) {
            console.error('Failed to fetch events:', error);
            logsList.innerHTML = 'Error loading events';
            logsList.className = 'nv-logs-list empty';
        }

        if (refreshBtn) refreshBtn.classList.remove('loading');
    }

    /**
     * Format event timestamp for display
     */
    formatEventTime(timestamp) {
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;

            // If less than 1 hour, show minutes ago
            if (diff < 3600000) {
                const mins = Math.floor(diff / 60000);
                return mins <= 1 ? 'just now' : `${mins}m ago`;
            }
            // If today, show time only
            if (date.toDateString() === now.toDateString()) {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            // Otherwise show date
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
