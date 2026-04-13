/**
 * NeuVector Demo Platform — Kiosk Mode
 *
 * Three components:
 * - BubbleEngine: Contextual tooltip bubbles pointing at UI elements
 * - KioskPlayer: Sequential step executor with section support
 * - ScenarioEditor: Drag & drop UI for composing scenarios
 */

// ============================================================
// BubbleEngine — contextual explanation bubbles
// ============================================================

class BubbleEngine {
    constructor() {
        this.container = null;
        this.activeBubbles = [];
    }

    init() {
        this.container = document.getElementById('kiosk-bubbles');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'kiosk-bubbles';
            document.body.appendChild(this.container);
        }
    }

    show(targetSelector, text, position = 'bottom', stepInfo = '') {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.warn(`[Kiosk] Bubble target not found: ${targetSelector}`);
            return;
        }

        const bubble = document.createElement('div');
        bubble.className = `kiosk-bubble kiosk-bubble-${position}`;
        bubble.innerHTML = `
            <div class="kiosk-bubble-arrow"></div>
            <div class="kiosk-bubble-content">
                <p>${text}</p>
                ${stepInfo ? `<div class="kiosk-bubble-step">${stepInfo}</div>` : ''}
            </div>
        `;

        this.container.appendChild(bubble);
        this.activeBubbles.push(bubble);
        this.positionBubble(bubble, target, position);

        const reposition = () => this.positionBubble(bubble, target, position);
        window.addEventListener('scroll', reposition, { passive: true });
        window.addEventListener('resize', reposition, { passive: true });
        bubble._cleanup = () => {
            window.removeEventListener('scroll', reposition);
            window.removeEventListener('resize', reposition);
        };

        requestAnimationFrame(() => bubble.classList.add('visible'));
        return bubble;
    }

    positionBubble(bubble, target, position) {
        const rect = target.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();
        const gap = 12;
        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - bubbleRect.height - gap;
                left = rect.left + (rect.width - bubbleRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + gap;
                left = rect.left + (rect.width - bubbleRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - bubbleRect.height) / 2;
                left = rect.left - bubbleRect.width - gap;
                break;
            case 'right':
                top = rect.top + (rect.height - bubbleRect.height) / 2;
                left = rect.right + gap;
                break;
        }

        left = Math.max(10, Math.min(left, window.innerWidth - bubbleRect.width - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - bubbleRect.height - 10));

        bubble.style.top = top + 'px';
        bubble.style.left = left + 'px';
    }

    hideAll() {
        this.activeBubbles.forEach(b => {
            b.classList.remove('visible');
            if (b._cleanup) b._cleanup();
            setTimeout(() => b.remove(), 300);
        });
        this.activeBubbles = [];
    }
}

// ============================================================
// KioskPlayer — step-by-step scenario executor with sections
// ============================================================

class KioskPlayer {
    constructor() {
        this.demoApp = null;
        this.bubbleEngine = new BubbleEngine();
        this.isPlaying = false;
        this.loopMode = false;
        this.manualMode = false;
        this._manualResolve = null;
        this.currentStep = 0;
        this.totalSteps = 0;
        this.scenario = null;
        this._abortController = null;
    }

    init(demoApp) {
        this.demoApp = demoApp;
        this.bubbleEngine.init();

        document.getElementById('btn-kiosk-play')?.addEventListener('click', () => this.onPlayClick());
        document.getElementById('btn-kiosk-editor')?.addEventListener('click', () => scenarioEditor.open());
    }

    /**
     * When play is clicked, show section picker if sections exist
     */
    onPlayClick() {
        if (this.isPlaying) {
            this.stop();
            return;
        }

        const saved = localStorage.getItem('neuvector_kiosk_scenario');
        this.scenario = saved ? JSON.parse(saved) : getDefaultScenario();

        if (!this.scenario || !this.scenario.steps || this.scenario.steps.length === 0) {
            alert(t('kiosk.noScenario'));
            return;
        }

        // Check if scenario has sections
        const sections = this.getSections();
        if (sections.length > 1) {
            this.showSectionPicker(sections);
        } else {
            this.start(null); // run all
        }
    }

    /**
     * Get list of sections from scenario
     */
    getSections() {
        const sections = [];
        let currentSection = null;

        for (const step of this.scenario.steps) {
            if (step.type === 'section') {
                currentSection = { id: step.id || step.name, name: step.name || step.id, steps: [] };
                sections.push(currentSection);
            } else if (currentSection) {
                currentSection.steps.push(step);
            } else {
                // Steps before first section go into an implicit "intro" section
                if (sections.length === 0 || sections[0].id !== '_intro') {
                    sections.unshift({ id: '_intro', name: t('kiosk.sectionIntro'), steps: [] });
                }
                sections[0].steps.push(step);
            }
        }

        return sections;
    }

    /**
     * Show a popup to select which sections to run
     */
    showSectionPicker(sections) {
        // Remove existing picker
        document.getElementById('kiosk-section-picker')?.remove();

        const picker = document.createElement('div');
        picker.id = 'kiosk-section-picker';
        picker.className = 'modal-overlay active';
        picker.innerHTML = `
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>${t('kiosk.selectSections')}</h3>
                    <button class="btn-close" id="btn-close-section-picker">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="kiosk-section-list">
                        ${sections.map((s, i) => `
                            <label class="kiosk-section-item">
                                <input type="checkbox" value="${s.id}" checked>
                                <span class="kiosk-section-name">${s.name}</span>
                                <span class="kiosk-section-count">${s.steps.length} ${t('kiosk.step').toLowerCase()}(s)</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="kiosk-options">
                        <label class="kiosk-option"><input type="checkbox" id="kiosk-opt-loop"> ${t('kiosk.loopInfinite')}</label>
                        <label class="kiosk-option"><input type="checkbox" id="kiosk-opt-manual"> ${t('kiosk.loopManual')}</label>
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button class="btn btn-outline" id="btn-section-cancel">${t('btn.clear')}</button>
                    <button class="btn btn-primary" id="btn-section-start">▶ ${t('kiosk.play')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(picker);

        // Events
        document.getElementById('btn-close-section-picker')?.addEventListener('click', () => picker.remove());
        document.getElementById('btn-section-cancel')?.addEventListener('click', () => picker.remove());
        picker.addEventListener('click', (e) => { if (e.target === picker) picker.remove(); });

        document.getElementById('btn-section-start')?.addEventListener('click', () => {
            const selected = new Set();
            picker.querySelectorAll('.kiosk-section-item input[type="checkbox"]:checked').forEach(cb => selected.add(cb.value));
            const loop = document.getElementById('kiosk-opt-loop')?.checked || false;
            const manual = document.getElementById('kiosk-opt-manual')?.checked || false;
            picker.remove();
            this.start(selected, { loop, manual });
        });
    }

    /**
     * Start playing the scenario
     * @param {Set|null} selectedSections - null = all, Set of section IDs to run
     * @param {Object} options - { loop: bool, manual: bool }
     */
    async start(selectedSections, options = {}) {
        this.loopMode = options.loop || false;
        this.manualMode = options.manual || false;

        // Build the flat step list from selected sections
        const steps = [];
        const sections = this.getSections();

        for (const section of sections) {
            if (!selectedSections || selectedSections.has(section.id)) {
                steps.push(...section.steps);
            }
        }

        if (steps.length === 0) {
            alert(t('kiosk.noScenario'));
            return;
        }

        this.isPlaying = true;
        this.totalSteps = steps.length;
        this._abortController = new AbortController();
        this.updateUI();

        try {
            do {
                for (let i = 0; i < steps.length; i++) {
                    if (!this.isPlaying) break;
                    this.currentStep = i + 1;
                    this.updateProgress();

                    // In manual mode, wait for user click before each step
                    if (this.manualMode) {
                        this.showNextStepButton(steps[i]);
                        await this.waitForManualNext();
                        this.hideNextStepButton();
                    }

                    await this.executeStep(steps[i]);
                }
            } while (this.loopMode && this.isPlaying);
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('[Kiosk] Error:', e);
            }
        }

        this.stop();
    }

    /**
     * Show a "Next step" floating button for manual mode
     */
    showNextStepButton(step) {
        let btn = document.getElementById('kiosk-next-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'kiosk-next-btn';
            btn.className = 'kiosk-next-btn';
            document.body.appendChild(btn);
        }
        const icon = scenarioEditor.getStepIcon(step.type);
        const label = scenarioEditor.getStepLabel(step);
        btn.innerHTML = `<span class="kiosk-next-label">${t('kiosk.step')} ${this.currentStep}/${this.totalSteps}</span> ${icon} ${label.substring(0, 50)} <span class="kiosk-next-arrow">▶</span>`;
        btn.style.display = 'flex';
        btn.onclick = () => {
            if (this._manualResolve) this._manualResolve();
        };
    }

    hideNextStepButton() {
        const btn = document.getElementById('kiosk-next-btn');
        if (btn) btn.style.display = 'none';
    }

    /**
     * Wait for user to click the "Next" button
     */
    waitForManualNext() {
        return new Promise((resolve, reject) => {
            this._manualResolve = resolve;
            if (this._abortController) {
                this._abortController.signal.addEventListener('abort', () => {
                    this._manualResolve = null;
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            }
        });
    }

    stop() {
        this.isPlaying = false;
        this.loopMode = false;
        this.manualMode = false;
        this._manualResolve = null;
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        this.bubbleEngine.hideAll();
        this.hideNextStepButton();
        this.updateUI();
    }

    async executeStep(step) {
        if (!this.isPlaying) return;
        const stepInfo = `${t('kiosk.step')} ${this.currentStep}/${this.totalSteps}`;

        switch (step.type) {
            case 'select_demo':
                this.bubbleEngine.hideAll();
                this.demoApp.selectDemo(step.demoId);
                await this.sleep(2500);
                break;

            case 'set_mode': {
                const prefix = step.target === 'source' ? 'viz-src' : 'viz-tgt';
                const selectId = `${prefix}-${step.field.replace('_', '-')}`;
                const select = document.getElementById(selectId);
                if (select) {
                    select.value = step.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    await this.waitUntil(() => !this.demoApp.isSyncing, 15000);
                }
                await this.sleep(500);
                break;
            }

            case 'run_attack': {
                const btn = document.querySelector(`.attack-btn[data-attack="${step.attackType}"]`);
                if (btn) {
                    btn.click();
                } else {
                    this.demoApp.runCurrentDemo();
                }
                await this.sleep(500);
                break;
            }

            case 'wait_complete':
                await this.waitUntil(() => !this.demoApp.isRunning, 60000);
                await this.sleep(500);
                break;

            case 'show_bubble': {
                const text = step.textKey ? t(step.textKey) : (step.text || '');
                this.bubbleEngine.hideAll();
                this.bubbleEngine.show(step.targetSelector || '.header', text, step.position || 'bottom', stepInfo);
                break;
            }

            case 'hide_bubbles':
                this.bubbleEngine.hideAll();
                break;

            case 'wait':
                await this.sleep((step.duration || 3) * 1000);
                break;

            case 'reset_platform': {
                // Reset all pods to Discover mode via the existing Reset Rules button logic
                const credentials = settingsManager.getCredentials();
                if (credentials.password) {
                    try {
                        const response = await fetch('/api/neuvector/reset-demo-rules', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: credentials.username, password: credentials.password }),
                        });
                        await response.json();
                    } catch (e) {
                        console.warn('[Kiosk] Reset failed:', e);
                    }
                    await this.sleep(2000);
                }
                break;
            }

            case 'section':
                // Section markers are handled by getSections(), skip during execution
                break;
        }
    }

    sleep(ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);
            if (this._abortController) {
                this._abortController.signal.addEventListener('abort', () => {
                    clearTimeout(timer);
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            }
        });
    }

    async waitUntil(condition, timeout = 30000) {
        const start = Date.now();
        while (!condition() && Date.now() - start < timeout) {
            if (!this.isPlaying) return;
            await this.sleep(500);
        }
    }

    updateUI() {
        const playBtn = document.getElementById('btn-kiosk-play');
        const bar = document.getElementById('kiosk-bar');

        if (playBtn) {
            playBtn.innerHTML = this.isPlaying
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>';
            playBtn.title = this.isPlaying ? t('kiosk.stop') : t('kiosk.play');
            playBtn.classList.toggle('playing', this.isPlaying);
        }
        if (bar) bar.style.display = this.isPlaying ? 'flex' : 'none';
    }

    updateProgress() {
        const fill = document.getElementById('kiosk-progress-fill');
        const label = document.getElementById('kiosk-progress-label');
        if (fill) fill.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        if (label) label.textContent = `${this.currentStep}/${this.totalSteps}`;
    }
}

// ============================================================
// ScenarioEditor — drag & drop scenario builder
// ============================================================

class ScenarioEditor {
    constructor() {
        this.scenario = null;
        this.modal = null;
        this.draggedItem = null;
    }

    open() {
        this.loadScenario();
        this.modal = document.getElementById('kiosk-editor-modal');
        if (!this.modal) return;
        this.render();
        this.modal.classList.add('active');
    }

    close() { this.modal?.classList.remove('active'); }

    loadScenario() {
        const saved = localStorage.getItem('neuvector_kiosk_scenario');
        this.scenario = saved ? JSON.parse(saved) : getDefaultScenario();
    }

    save() {
        localStorage.setItem('neuvector_kiosk_scenario', JSON.stringify(this.scenario));
        this.close();
    }

    loadDefault() {
        this.scenario = getDefaultScenario();
        this.render();
    }

    render() {
        const timeline = document.getElementById('kiosk-editor-timeline');
        if (!timeline) return;

        timeline.innerHTML = this.scenario.steps.map((step, i) => `
            <div class="kiosk-step-item ${step.type === 'section' ? 'kiosk-step-section' : ''}" draggable="true" data-index="${i}">
                <span class="kiosk-step-handle">☰</span>
                <span class="kiosk-step-icon">${this.getStepIcon(step.type)}</span>
                <div class="kiosk-step-info">
                    <div class="kiosk-step-title">${this.getStepLabel(step)}</div>
                    ${this.renderStepConfig(step, i)}
                </div>
                <button class="kiosk-step-delete" data-index="${i}">&times;</button>
            </div>
        `).join('');

        this.attachTimelineEvents(timeline);
    }

    getStepIcon(type) {
        const icons = {
            section: '📂', select_demo: '📌', set_mode: '🔄', run_attack: '⚔️',
            show_bubble: '💬', hide_bubbles: '🚫', wait_complete: '⏳', wait: '⏱',
            reset_platform: '🔃',
        };
        return icons[type] || '❓';
    }

    getStepLabel(step) {
        switch (step.type) {
            case 'section': return `── ${step.name || t('kiosk.stepType.section')} ──`;
            case 'select_demo': return `${t('kiosk.stepType.select_demo')}: ${step.demoId}`;
            case 'set_mode': return `${t('kiosk.stepType.set_mode')}: ${step.target} → ${step.value}`;
            case 'run_attack': return `${t('kiosk.stepType.run_attack')}: ${step.attackType || 'auto'}`;
            case 'show_bubble': return `${t('kiosk.stepType.show_bubble')}: ${(step.textKey ? t(step.textKey) : step.text || '').substring(0, 40)}...`;
            case 'hide_bubbles': return t('kiosk.stepType.hide_bubbles');
            case 'wait_complete': return t('kiosk.stepType.wait_complete');
            case 'wait': return `${t('kiosk.stepType.wait')}: ${step.duration}s`;
            case 'reset_platform': return t('kiosk.stepType.reset_platform');
            default: return step.type;
        }
    }

    renderStepConfig(step, index) {
        switch (step.type) {
            case 'section':
                return `<input type="text" class="kiosk-step-param" data-index="${index}" data-field="name" value="${step.name || ''}" placeholder="Section name">`;
            case 'select_demo':
                return `<select class="kiosk-step-param" data-index="${index}" data-field="demoId">
                    <option value="attack" ${step.demoId === 'attack' ? 'selected' : ''}>Attack Simulation</option>
                    <option value="dlp" ${step.demoId === 'dlp' ? 'selected' : ''}>DLP Detection</option>
                    <option value="admission" ${step.demoId === 'admission' ? 'selected' : ''}>Admission Control</option>
                </select>`;
            case 'set_mode':
                return `<select class="kiosk-step-param" data-index="${index}" data-field="target">
                    <option value="source" ${step.target === 'source' ? 'selected' : ''}>Source</option>
                    <option value="target" ${step.target === 'target' ? 'selected' : ''}>Target</option>
                </select>
                <select class="kiosk-step-param" data-index="${index}" data-field="field">
                    <option value="policy_mode" ${step.field === 'policy_mode' ? 'selected' : ''}>Network Policy</option>
                    <option value="profile_mode" ${step.field === 'profile_mode' ? 'selected' : ''}>Process Profile</option>
                </select>
                <select class="kiosk-step-param" data-index="${index}" data-field="value">
                    <option value="Discover" ${step.value === 'Discover' ? 'selected' : ''}>Discover</option>
                    <option value="Monitor" ${step.value === 'Monitor' ? 'selected' : ''}>Monitor</option>
                    <option value="Protect" ${step.value === 'Protect' ? 'selected' : ''}>Protect</option>
                </select>`;
            case 'run_attack':
                return `<select class="kiosk-step-param" data-index="${index}" data-field="attackType">
                    <option value="dos_ping" ${step.attackType === 'dos_ping' ? 'selected' : ''}>DoS Flood</option>
                    <option value="nc_backdoor" ${step.attackType === 'nc_backdoor' ? 'selected' : ''}>NC Backdoor</option>
                    <option value="scp_transfer" ${step.attackType === 'scp_transfer' ? 'selected' : ''}>SCP Transfer</option>
                    <option value="reverse_shell" ${step.attackType === 'reverse_shell' ? 'selected' : ''}>Reverse Shell</option>
                </select>`;
            case 'show_bubble':
                return `<input type="text" class="kiosk-step-param" data-index="${index}" data-field="textKey" value="${step.textKey || ''}" placeholder="i18n key">
                <input type="text" class="kiosk-step-param" data-index="${index}" data-field="targetSelector" value="${step.targetSelector || ''}" placeholder="#element">
                <select class="kiosk-step-param" data-index="${index}" data-field="position">
                    <option value="top" ${step.position === 'top' ? 'selected' : ''}>Top</option>
                    <option value="bottom" ${step.position === 'bottom' ? 'selected' : ''}>Bottom</option>
                    <option value="left" ${step.position === 'left' ? 'selected' : ''}>Left</option>
                    <option value="right" ${step.position === 'right' ? 'selected' : ''}>Right</option>
                </select>`;
            case 'wait':
                return `<input type="number" class="kiosk-step-param" data-index="${index}" data-field="duration" value="${step.duration || 3}" min="1" max="60"> s`;
            default:
                return '';
        }
    }

    attachTimelineEvents(timeline) {
        timeline.querySelectorAll('.kiosk-step-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                this.scenario.steps.splice(parseInt(btn.dataset.index), 1);
                this.render();
            });
        });

        timeline.querySelectorAll('.kiosk-step-param').forEach(input => {
            input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.index);
                this.scenario.steps[idx][input.dataset.field] = input.value;
            });
        });

        // Drag & drop
        const items = timeline.querySelectorAll('.kiosk-step-item');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.draggedItem = null;
                items.forEach(el => el.classList.remove('drag-over'));
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.draggedItem && this.draggedItem !== item) item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (!this.draggedItem || this.draggedItem === item) return;
                const fromIdx = parseInt(this.draggedItem.dataset.index);
                const toIdx = parseInt(item.dataset.index);
                const [moved] = this.scenario.steps.splice(fromIdx, 1);
                this.scenario.steps.splice(toIdx, 0, moved);
                this.render();
            });
        });
    }

    addStep(type) {
        const defaults = {
            section: { type: 'section', name: 'New Section', id: 'section_' + Date.now() },
            select_demo: { type: 'select_demo', demoId: 'attack' },
            set_mode: { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Protect' },
            run_attack: { type: 'run_attack', attackType: 'scp_transfer' },
            show_bubble: { type: 'show_bubble', textKey: '', targetSelector: '#demo-visualization', position: 'bottom' },
            hide_bubbles: { type: 'hide_bubbles' },
            wait_complete: { type: 'wait_complete' },
            wait: { type: 'wait', duration: 5 },
            reset_platform: { type: 'reset_platform' },
        };
        this.scenario.steps.push(defaults[type] || { type });
        this.render();
    }
}

// ============================================================
// Default scenario — all 4 attacks with sections
// ============================================================

function getDefaultScenario() {
    return {
        name: 'Default Demo Scenario',
        steps: [
            // ========== SECTION: Setup & Intro ==========
            { type: 'section', id: 'intro', name: 'Introduction' },
            { type: 'reset_platform' },
            { type: 'select_demo', demoId: 'attack' },
            { type: 'wait', duration: 3 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.welcome', targetSelector: '.header', position: 'bottom' },
            { type: 'wait', duration: 6 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.discoverExplain', targetSelector: '#viz-source', position: 'right' },
            { type: 'wait', duration: 5 },
            { type: 'hide_bubbles' },

            // ========== SECTION: SCP Transfer ==========
            { type: 'section', id: 'scp', name: 'SCP Transfer (Network Policy)' },
            { type: 'select_demo', demoId: 'attack' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.scpExplain', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 5 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'scp_transfer' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.scpSuccess', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 5 },
            // Switch to Protect
            { type: 'show_bubble', textKey: 'kiosk.bubble.switchProtect', targetSelector: '#viz-src-policy-mode', position: 'bottom' },
            { type: 'wait', duration: 3 },
            { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Protect' },
            { type: 'wait', duration: 3 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.retryAttack', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 3 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'scp_transfer' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.scpBlocked', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 6 },
            { type: 'hide_bubbles' },
            { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Discover' },
            { type: 'wait', duration: 2 },

            // ========== SECTION: NC Backdoor ==========
            { type: 'section', id: 'backdoor', name: 'NC Backdoor (Process Profile)' },
            { type: 'show_bubble', textKey: 'kiosk.bubble.backdoorExplain', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 5 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'nc_backdoor' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.backdoorSuccess', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 5 },
            // Switch process to Protect
            { type: 'show_bubble', textKey: 'kiosk.bubble.processProtect', targetSelector: '#viz-src-profile-mode', position: 'bottom' },
            { type: 'wait', duration: 3 },
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Protect' },
            { type: 'wait', duration: 3 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'nc_backdoor' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.backdoorBlocked', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 6 },
            { type: 'hide_bubbles' },
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Discover' },
            { type: 'wait', duration: 2 },

            // ========== SECTION: Reverse Shell ==========
            { type: 'section', id: 'shell', name: 'Reverse Shell (Process Profile)' },
            { type: 'show_bubble', textKey: 'kiosk.bubble.shellExplain', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 5 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'reverse_shell' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.shellSuccess', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 5 },
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Protect' },
            { type: 'wait', duration: 3 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'reverse_shell' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.shellBlocked', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 6 },
            { type: 'hide_bubbles' },
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Discover' },
            { type: 'wait', duration: 2 },

            // ========== SECTION: Conclusion ==========
            { type: 'section', id: 'end', name: 'Conclusion' },
            { type: 'show_bubble', textKey: 'kiosk.bubble.demoEnd', targetSelector: '.header', position: 'bottom' },
            { type: 'wait', duration: 8 },
            { type: 'hide_bubbles' },
        ]
    };
}

// ============================================================
// Global instances
// ============================================================

const kioskPlayer = new KioskPlayer();
const scenarioEditor = new ScenarioEditor();
