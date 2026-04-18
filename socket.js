// Socket.IO Client Service for Real-time Messaging
class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket) return;

    // Load Socket.IO client library dynamically if not available
    if (typeof io === 'undefined') {
      console.error('Socket.IO client library not loaded');
      return;
    }

    this.socket = io('http://localhost:5000');

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
      
      // Join user's room
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.id) {
        this.socket.emit('join', user.id);
      }
      
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
      this.emit('disconnected');
    });

    this.socket.on('receive_message', (message) => {
      console.log('New message received:', message);
      this.emit('new_message', message);
    });

    this.socket.on('message_sent', (message) => {
      this.emit('message_sent', message);
    });

    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Send message via Socket.IO
  sendMessage(recipientId, message) {
    if (!this.isConnected) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('send_message', {
      recipientId,
      message
    });
    return true;
  }

  // Send typing indicator
  sendTyping(recipientId, isTyping) {
    if (!this.isConnected) return;

    this.socket.emit('typing', {
      recipientId,
      isTyping
    });
  }

  // Event listener management
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    });
  }
}

// Create singleton instance
window.socketService = new SocketService();
