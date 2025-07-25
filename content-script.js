// Content script for Console Watcher Pro
class ConsoleCapture {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.settings = {
      captureThirdParty: true,
      maxLogs: 1000
    };
    this.port = null;
    this.originalConsole = {};
    this.logHashes = new Set();
    this.isInitialized = false;
    this.connectionRetries = 0;
    this.maxRetries = 10;
    this.reconnectInterval = null;
    this.isCapturing = false; // Prevent recursive calls
    
    this.init();
  }

  init() {
    // Store original console methods before overriding
    // Use a more robust approach to get the original methods
    this.originalConsole = {};
    
    const methods = ['log', 'warn', 'error', 'info', 'debug'];
    methods.forEach(method => {
      try {
        if (console[method] && typeof console[method] === 'function') {
          this.originalConsole[method] = console[method];
        } else {
          // Create a fallback method if the original is not available
          this.originalConsole[method] = function(...args) {
            // Basic fallback implementation
            const timestamp = new Date().toISOString();
            const prefix = `[${method.toUpperCase()}]`;
            console.log(prefix, timestamp, ...args);
          };
        }
      } catch (error) {
        // If we can't access the original method, create a fallback
        this.originalConsole[method] = function(...args) {
          console.log(`[${method.toUpperCase()}]`, ...args);
        };
      }
    });

    // Hook console methods immediately
    this.hookConsole();
    
    // Hook into window errors
    this.hookWindowErrors();
    
    // Load settings
    this.loadSettings();
    
    // Connect to background script
    this.connectToBackground();
    
    this.isInitialized = true;
    
    // Send a test log to verify everything is working
    setTimeout(() => {
      this.sendTestLog();
    }, 1000);
  }

  connectToBackground() {
    try {
      // Clear any existing connection
      if (this.port) {
        this.port.disconnect();
        this.port = null;
      }

      // Clear any existing reconnect interval
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }

      this.port = chrome.runtime.connect({ name: 'content-script' });
      
      this.port.onMessage.addListener((message) => {
        try {
          if (message.type === 'GET_LOGS') {
            this.sendLogs();
          } else if (message.type === 'CLEAR_LOGS') {
            this.clearLogs();
          } else if (message.type === 'UPDATE_SETTINGS') {
            this.updateSettings(message.settings);
          }
        } catch (error) {
          console.warn('Console Watcher: Error handling message:', error);
        }
      });

      this.port.onDisconnect.addListener(() => {
        console.warn('Console Watcher: Disconnected from background script');
        this.port = null;
        
        // Try to reconnect with exponential backoff
        if (this.connectionRetries < this.maxRetries) {
          this.connectionRetries++;
          const delay = Math.min(1000 * Math.pow(2, this.connectionRetries - 1), 10000);
          
          console.log(`Console Watcher: Attempting to reconnect in ${delay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`);
          
          setTimeout(() => {
            this.connectToBackground();
          }, delay);
        } else {
          console.error('Console Watcher: Max reconnection attempts reached');
        }
      });
      
      this.connectionRetries = 0;
      console.log('Console Watcher: Content script connected to background script');
    } catch (error) {
      console.error('Console Watcher: Failed to connect to background script:', error);
      
      // Try to reconnect
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        setTimeout(() => {
          this.connectToBackground();
        }, 1000);
      }
    }
  }

  hookConsole() {
    const methods = ['log', 'warn', 'error', 'info', 'debug'];
    
    methods.forEach(method => {
      const originalMethod = this.originalConsole[method];
      
      // Create a new function that captures the context
      const capturedMethod = (...args) => {
        // Prevent recursive calls
        if (this.isCapturing) {
          // Use a safe fallback to avoid infinite recursion
          try {
            if (originalMethod && typeof originalMethod === 'function') {
              return originalMethod.apply(console, args);
            } else {
              // Fallback to basic console output
              return console.log(...args);
            }
          } catch (e) {
            // Last resort fallback
            return;
          }
        }
        
        this.isCapturing = true;
        
        try {
          // Call original method first to maintain normal console behavior
          if (originalMethod && typeof originalMethod === 'function') {
            originalMethod.apply(console, args);
          } else {
            // Fallback if original method is not available
            console.log(...args);
          }
          
          // Capture log entry
          this.captureLog(method, args);
        } catch (error) {
          // If original method fails, still try to capture
          try {
            this.captureLog(method, args);
          } catch (captureError) {
            // Don't use console.warn here to avoid recursion
            // Just silently fail
          }
        } finally {
          this.isCapturing = false;
        }
      };
      
      // Apply the new method
      console[method] = capturedMethod;
    });
  }

  hookWindowErrors() {
    // Hook into window.onerror for uncaught errors
    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (originalOnError) {
        try {
          originalOnError.apply(window, arguments);
        } catch (e) {
          // Ignore errors from original handler
        }
      }
      
      this.captureError(message, source, lineno, colno, error);
    };

    // Hook into unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.capturePromiseRejection(event);
    });
  }

  captureLog(type, args) {
    try {
      const stack = new Error().stack;
      const timestamp = new Date().toISOString();
      const url = window.location.href;
      
      // Parse stack trace
      const stackInfo = this.parseStack(stack);
      
      // Create log entry
      const logEntry = {
        id: this.generateId(),
        type: type,
        message: args.map(arg => this.stringifyArg(arg)).join(' '),
        args: args,
        timestamp: timestamp,
        url: url,
        stack: stack,
        stackInfo: stackInfo,
        file: stackInfo.file,
        line: stackInfo.line,
        column: stackInfo.column,
        context: this.getContext(stackInfo.file, stackInfo.line),
        hash: this.generateHash(type, args, stackInfo.file, stackInfo.line)
      };

      // Check for duplicates
      if (this.logHashes.has(logEntry.hash)) {
        return;
      }

      this.addLog(logEntry);
    } catch (error) {
      console.warn('Console Watcher: Error capturing log:', error);
    }
  }

  captureError(message, source, lineno, colno, error) {
    try {
      const timestamp = new Date().toISOString();
      const url = window.location.href;
      
      const logEntry = {
        id: this.generateId(),
        type: 'error',
        message: message,
        args: [message],
        timestamp: timestamp,
        url: url,
        stack: error ? error.stack : '',
        stackInfo: {
          file: source,
          line: lineno,
          column: colno
        },
        file: source,
        line: lineno,
        column: colno,
        context: this.getContext(source, lineno),
        hash: this.generateHash('error', [message], source, lineno)
      };

      this.addLog(logEntry);
    } catch (error) {
      console.warn('Console Watcher: Error capturing window error:', error);
    }
  }

  capturePromiseRejection(event) {
    try {
      const timestamp = new Date().toISOString();
      const url = window.location.href;
      
      const logEntry = {
        id: this.generateId(),
        type: 'error',
        message: 'Unhandled Promise Rejection: ' + event.reason,
        args: [event.reason],
        timestamp: timestamp,
        url: url,
        stack: event.reason && event.reason.stack ? event.reason.stack : '',
        stackInfo: this.parseStack(new Error().stack),
        file: this.parseStack(new Error().stack).file,
        line: this.parseStack(new Error().stack).line,
        column: this.parseStack(new Error().stack).column,
        context: this.getContext(this.parseStack(new Error().stack).file, this.parseStack(new Error().stack).line),
        hash: this.generateHash('error', [event.reason], this.parseStack(new Error().stack).file, this.parseStack(new Error().stack).line)
      };

      this.addLog(logEntry);
    } catch (error) {
      console.warn('Console Watcher: Error capturing promise rejection:', error);
    }
  }

  addLog(logEntry) {
    try {
      // Check third-party script filtering
      if (!this.settings.captureThirdParty && this.isThirdParty(logEntry.file)) {
        return;
      }

      this.logs.unshift(logEntry);
      this.logHashes.add(logEntry.hash);
      
      // Maintain max logs
      if (this.logs.length > this.settings.maxLogs) {
        const removed = this.logs.pop();
        this.logHashes.delete(removed.hash);
      }

      // Send to DevTools panel immediately
      if (this.port) {
        try {
          this.port.postMessage({
            type: 'LOG_ENTRY',
            log: logEntry
          });
        } catch (error) {
          console.warn('Console Watcher: Failed to send log to DevTools panel:', error);
          // Try to reconnect if sending failed
          this.connectToBackground();
        }
      }
    } catch (error) {
      console.warn('Console Watcher: Error adding log:', error);
    }
  }

  parseStack(stack) {
    try {
      const lines = stack.split('\n');
      // Skip first line (Error message) and second line (this function)
      const relevantLine = lines[2] || lines[1] || '';
      
      const match = relevantLine.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          file: match[2],
          line: parseInt(match[3]),
          column: parseInt(match[4])
        };
      }
      
      return {
        function: 'unknown',
        file: 'unknown',
        line: 0,
        column: 0
      };
    } catch (error) {
      return {
        function: 'unknown',
        file: 'unknown',
        line: 0,
        column: 0
      };
    }
  }

  getContext(file, line) {
    // This would require additional implementation to fetch source code
    // For now, return empty context
    return '';
  }

  isThirdParty(file) {
    if (!file || file === 'unknown') return false;
    
    const currentOrigin = window.location.origin;
    try {
      const fileUrl = new URL(file, window.location.href);
      return fileUrl.origin !== currentOrigin;
    } catch {
      return false;
    }
  }

  stringifyArg(arg) {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return arg.toString();
      }
    }
    return String(arg);
  }

  generateId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateHash(type, args, file, line) {
    const content = type + args.map(arg => this.stringifyArg(arg)).join('') + file + line;
    return btoa(content).replace(/[^a-zA-Z0-9]/g, '');
  }

  sendLogs() {
    if (this.port) {
      try {
        this.port.postMessage({
          type: 'LOGS_DATA',
          logs: this.logs
        });
      } catch (error) {
        console.warn('Console Watcher: Failed to send logs:', error);
      }
    }
  }

  clearLogs() {
    this.logs = [];
    this.logHashes.clear();
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this.maxLogs = settings.maxLogs || 1000;
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['consoleWatcherSettings']);
      if (result.consoleWatcherSettings) {
        this.updateSettings(result.consoleWatcherSettings);
      }
    } catch (error) {
      console.warn('Console Watcher: Failed to load settings:', error);
    }
  }

  sendTestLog() {
    // Send a test log to verify the system is working
    this.captureLog('log', ['Console Watcher Pro is active and capturing logs']);
  }
}

// Initialize console capture immediately when script loads
console.log('Console Watcher Pro: Content script loading...');

// Prevent multiple instances
if (window.consoleWatcher) {
  console.log('Console Watcher Pro: Content script already loaded, skipping initialization');
} else {
  // Wait for DOM to be ready, then initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!window.consoleWatcher) {
        window.consoleWatcher = new ConsoleCapture();
      }
    });
  } else {
    // DOM is already ready
    window.consoleWatcher = new ConsoleCapture();
  }

  // Also initialize on window load as a fallback
  window.addEventListener('load', () => {
    if (!window.consoleWatcher) {
      window.consoleWatcher = new ConsoleCapture();
    }
  });
}

// Make it globally accessible for debugging
if (!window.consoleWatcher) {
  window.consoleWatcher = null;
} 