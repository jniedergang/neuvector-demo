/**
 * NeuVector Demo Platform — Kiosk Mode
 *
 * Three components:
 * - BubbleEngine: Contextual tooltip bubbles pointing at UI elements
 * - KioskPlayer: Sequential step executor for automated demos
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

    /**
     * Show a bubble pointing at a target element
     * @param {string} targetSelector - CSS selector for the target element
     * @param {string} text - Text to display (already translated)
     * @param {string} position - top, bottom, left, right
     * @param {string} stepInfo - e.g. "3/12"
     */
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

        // Position the bubble relative to target
        this.positionBubble(bubble, target, position);

        // Reposition on scroll/resize
        const reposition = () => this.positionBubble(bubble, target, position);
        window.addEventListener('scroll', reposition, { passive: true });
        window.addEventListener('resize', reposition, { passive: true });
        bubble._cleanup = () => {
            window.removeEventListener('scroll', reposition);
            window.removeEventListener('resize', reposition);
        };

        // Trigger animation
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

        // Keep within viewport
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
// KioskPlayer — step-by-step scenario executor
// ============================================================

class KioskPlayer {
    constructor() {
        this.demoApp = null;
        this.bubbleEngine = new BubbleEngine();
        this.isPlaying = false;
        this.isPaused = false;
        this.currentStep = 0;
        this.totalSteps = 0;
        this.scenario = null;
        this._abortController = null;
    }

    init(demoApp) {
        this.demoApp = demoApp;
        this.bubbleEngine.init();

        // Header buttons
        document.getElementById('btn-kiosk-play')?.addEventListener('click', () => this.toggle());
        document.getElementById('btn-kiosk-editor')?.addEventListener('click', () => scenarioEditor.open());
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    async start() {
        const saved = localStorage.getItem('neuvector_kiosk_scenario');
        this.scenario = saved ? JSON.parse(saved) : getDefaultScenario();

        if (!this.scenario || !this.scenario.steps || this.scenario.steps.length === 0) {
            alert(t('kiosk.noScenario'));
            return;
        }

        this.isPlaying = true;
        this.isPaused = false;
        this.currentStep = 0;
        this.totalSteps = this.scenario.steps.length;
        this._abortController = new AbortController();
        this.updateUI();

        try {
            for (let i = 0; i < this.scenario.steps.length; i++) {
                if (!this.isPlaying) break;
                this.currentStep = i + 1;
                this.updateProgress();
                await this.executeStep(this.scenario.steps[i]);
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('[Kiosk] Error:', e);
            }
        }

        this.stop();
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
        this.bubbleEngine.hideAll();
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
                    // Wait for NeuVector sync
                    await this.waitUntil(() => !this.demoApp.isSyncing, 15000);
                } else {
                    console.warn(`[Kiosk] Select not found: ${selectId}`);
                }
                await this.sleep(500);
                break;
            }

            case 'run_attack': {
                // For attack demos, click the attack button
                const btn = document.querySelector(`.attack-btn[data-attack="${step.attackType}"]`);
                if (btn) {
                    btn.click();
                } else {
                    // For DLP/connectivity, just run
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
                this.bubbleEngine.show(
                    step.targetSelector || 'header',
                    text,
                    step.position || 'bottom',
                    stepInfo
                );
                break;
            }

            case 'hide_bubbles':
                this.bubbleEngine.hideAll();
                break;

            case 'wait':
                await this.sleep((step.duration || 3) * 1000);
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

        if (bar) {
            bar.style.display = this.isPlaying ? 'flex' : 'none';
        }
    }

    updateProgress() {
        const fill = document.getElementById('kiosk-progress-fill');
        const label = document.getElementById('kiosk-progress-label');
        if (fill) {
            fill.style.width = `${(this.currentStep / this.totalSteps) * 100}%`;
        }
        if (label) {
            label.textContent = `${this.currentStep}/${this.totalSteps}`;
        }
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

    close() {
        this.modal?.classList.remove('active');
    }

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
            <div class="kiosk-step-item" draggable="true" data-index="${i}">
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
            select_demo: '📌', set_mode: '🔄', run_attack: '⚔️',
            show_bubble: '💬', hide_bubbles: '🚫', wait_complete: '⏳', wait: '⏱'
        };
        return icons[type] || '❓';
    }

    getStepLabel(step) {
        switch (step.type) {
            case 'select_demo': return `${t('kiosk.stepType.select_demo')}: ${step.demoId}`;
            case 'set_mode': return `${t('kiosk.stepType.set_mode')}: ${step.target} → ${step.value}`;
            case 'run_attack': return `${t('kiosk.stepType.run_attack')}: ${step.attackType || 'auto'}`;
            case 'show_bubble': return `${t('kiosk.stepType.show_bubble')}: ${(step.textKey ? t(step.textKey) : step.text || '').substring(0, 40)}...`;
            case 'hide_bubbles': return t('kiosk.stepType.hide_bubbles');
            case 'wait_complete': return t('kiosk.stepType.wait_complete');
            case 'wait': return `${t('kiosk.stepType.wait')}: ${step.duration}s`;
            default: return step.type;
        }
    }

    renderStepConfig(step, index) {
        switch (step.type) {
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
        // Delete buttons
        timeline.querySelectorAll('.kiosk-step-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                this.scenario.steps.splice(idx, 1);
                this.render();
            });
        });

        // Parameter changes
        timeline.querySelectorAll('.kiosk-step-param').forEach(input => {
            input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.index);
                const field = input.dataset.field;
                this.scenario.steps[idx][field] = input.value;
            });
        });

        // Drag & drop reordering
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
                timeline.querySelectorAll('.kiosk-step-item').forEach(el => el.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (this.draggedItem && this.draggedItem !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

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
            select_demo: { type: 'select_demo', demoId: 'attack' },
            set_mode: { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Protect' },
            run_attack: { type: 'run_attack', attackType: 'scp_transfer' },
            show_bubble: { type: 'show_bubble', textKey: '', targetSelector: '#demo-visualization', position: 'bottom' },
            hide_bubbles: { type: 'hide_bubbles' },
            wait_complete: { type: 'wait_complete' },
            wait: { type: 'wait', duration: 5 },
        };

        this.scenario.steps.push(defaults[type] || { type });
        this.render();
    }
}

// ============================================================
// Default scenario
// ============================================================

function getDefaultScenario() {
    return {
        name: 'Default Demo Scenario',
        steps: [
            // ========== INTRO ==========
            { type: 'select_demo', demoId: 'attack' },
            { type: 'wait', duration: 3 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.welcome', targetSelector: '.header', position: 'bottom' },
            { type: 'wait', duration: 6 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.discoverExplain', targetSelector: '#viz-source', position: 'right' },
            { type: 'wait', duration: 5 },

            // ========== ATTACK 1: SCP Transfer (Network Policy) ==========
            { type: 'show_bubble', textKey: 'kiosk.bubble.scpExplain', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 5 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'scp_transfer' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.scpSuccess', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 5 },

            // Switch to Protect and retry SCP
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

            // ========== ATTACK 2: DoS Ping Flood (Network Policy) ==========
            { type: 'show_bubble', textKey: 'kiosk.bubble.nextAttack', targetSelector: '#viz-commands', position: 'top' },
            { type: 'wait', duration: 3 },
            // Reset to Discover first
            { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Discover' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.floodExplain', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 5 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'dos_ping' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.floodSuccess', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 4 },

            // Switch to Protect and retry flood
            { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Protect' },
            { type: 'wait', duration: 3 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'dos_ping' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.floodBlocked', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 6 },

            // ========== ATTACK 3: NC Backdoor (Process Profile) ==========
            { type: 'show_bubble', textKey: 'kiosk.bubble.nextAttack', targetSelector: '#viz-commands', position: 'top' },
            { type: 'wait', duration: 3 },
            // Reset network to Discover, switch process profile to Protect
            { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Discover' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.processProtect', targetSelector: '#viz-src-profile-mode', position: 'bottom' },
            { type: 'wait', duration: 4 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.backdoorExplain', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 5 },

            // Run in Discover first (process profile still Discover)
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'nc_backdoor' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.backdoorSuccess', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 5 },

            // Switch process profile to Protect and retry
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Protect' },
            { type: 'wait', duration: 3 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'nc_backdoor' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.backdoorBlocked', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 6 },

            // ========== ATTACK 4: Reverse Shell (Process Profile) ==========
            { type: 'show_bubble', textKey: 'kiosk.bubble.nextAttack', targetSelector: '#viz-commands', position: 'top' },
            { type: 'wait', duration: 3 },
            // Reset process to Discover
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Discover' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.shellExplain', targetSelector: '#viz-arrow', position: 'bottom' },
            { type: 'wait', duration: 5 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'reverse_shell' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.shellSuccess', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 5 },

            // Switch process profile to Protect and retry
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Protect' },
            { type: 'wait', duration: 3 },
            { type: 'hide_bubbles' },
            { type: 'run_attack', attackType: 'reverse_shell' },
            { type: 'wait_complete' },
            { type: 'wait', duration: 2 },
            { type: 'show_bubble', textKey: 'kiosk.bubble.shellBlocked', targetSelector: '#viz-status', position: 'top' },
            { type: 'wait', duration: 6 },

            // ========== CLEANUP & END ==========
            { type: 'hide_bubbles' },
            { type: 'set_mode', target: 'source', field: 'policy_mode', value: 'Discover' },
            { type: 'set_mode', target: 'source', field: 'profile_mode', value: 'Discover' },
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
