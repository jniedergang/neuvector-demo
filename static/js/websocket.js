/**
 * WebSocket Manager for NeuVector Demo Platform
 */

class WebSocketManager {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.onMessageCallbacks = [];
        this.onStatusChangeCallbacks = [];
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        try {
            this.ws = new WebSocket(wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.notifyStatusChange('connected');
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.connected = false;
            this.notifyStatusChange('disconnected');
            this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.notifyStatusChange('error');
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };
    }

    /**
     * Handle incoming message
     */
    handleMessage(message) {
        this.onMessageCallbacks.forEach(callback => {
            try {
                callback(message);
            } catch (error) {
                console.error('Message callback error:', error);
            }
        });
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
    }

    /**
     * Send message to server
     */
    send(data) {
        if (!this.connected) {
            console.error('WebSocket not connected');
            return false;
        }

        try {
            this.ws.send(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }

    /**
     * Execute a lifecycle action
     */
    executeAction(action) {
        return this.send({ action });
    }

    /**
     * Execute a demo
     */
    executeDemo(demoId, params = {}) {
        return this.send({
            action: 'demo',
            demo_id: demoId,
            params
        });
    }

    /**
     * Register message callback
     */
    onMessage(callback) {
        this.onMessageCallbacks.push(callback);
    }

    /**
     * Register status change callback
     */
    onStatusChange(callback) {
        this.onStatusChangeCallbacks.push(callback);
    }

    /**
     * Notify status change
     */
    notifyStatusChange(status) {
        this.onStatusChangeCallbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Status callback error:', error);
            }
        });
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Export global instance
window.wsManager = new WebSocketManager();
