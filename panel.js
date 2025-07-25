// Console Watcher Pro - DevTools Panel Controller
class ConsoleWatcherPanel {
  constructor() {
    this.logs = [];
    this.filteredLogs = [];
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.selectedLog = null;
    this.settings = {
      maxLogs: 1000,
      autoScroll: true,
      captureThirdParty: true,
      theme: 'dark'
    };
    this.port = null;
    this.updateThrottle = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    
    this.init();
  }

  init() {
    this.connectToBackground();
    this.loadSettings();
    this.setupEventListeners();
    this.applyTheme();
    this.updateCounts();
    this.showEmptyState();
    
    // Show initial status
    this.updateStatus('Initializing...', false);
  }

  connectToBackground() {
    try {
      this.port = chrome.runtime.connect({ name: 'devtools-panel' });
      
      this.port.onMessage.addListener((message) => {
        switch (message.type) {
          case 'LOG_ENTRY':
            this.addLog(message.log);
            break;
          case 'LOGS_DATA':
            this.setLogs(message.logs);
            break;
        }
      });

      this.port.onDisconnect.addListener(() => {
        this.isConnected = false;
        this.updateStatus('Disconnected', false);
        
        // Try to reconnect
        if (this.connectionRetries < this.maxRetries) {
          this.connectionRetries++;
          setTimeout(() => {
            this.connectToBackground();
          }, 1000 * this.connectionRetries);
        }
      });

      // Request initial logs after a short delay
      setTimeout(() => {
        this.requestLogs();
      }, 500);
      
      this.isConnected = true;
      this.connectionRetries = 0;
      this.updateStatus('Connected', true);
      
      console.log('Console Watcher Pro: DevTools panel connected to background script');
    } catch (error) {
      console.error('Console Watcher Pro: Failed to connect to background script:', error);
      this.updateStatus('Connection Failed', false);
    }
  }

  requestLogs() {
    if (this.port && this.isConnected) {
      this.port.postMessage({ type: 'GET_LOGS' });
      console.log('Console Watcher Pro: Requested logs from content script');
    } else {
      console.warn('Console Watcher Pro: Cannot request logs - not connected');
    }
  }

  setupEventListeners() {
    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.setFilter(e.currentTarget.dataset.filter);
      });
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', (e) => {
      this.setSearch(e.target.value);
    });

    clearSearch.addEventListener('click', () => {
      searchInput.value = '';
      this.setSearch('');
    });

    // Clear all
    document.getElementById('clearBtn').addEventListener('click', () => {
      this.clearLogs();
    });

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    document.getElementById('closeSettings').addEventListener('click', () => {
      this.closeSettings();
    });

    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetSettings();
    });

    // Details pane
    document.getElementById('closeDetails').addEventListener('click', () => {
      this.closeDetails();
    });

    document.getElementById('copyDetails').addEventListener('click', () => {
      this.copyDetails();
    });

    document.getElementById('openInSources').addEventListener('click', () => {
      this.openInSources();
    });

    document.getElementById('reportFeedback').addEventListener('click', () => {
      this.reportFeedback();
    });

    // Modal overlay
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.closeSettings();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            document.getElementById('searchInput').focus();
            break;
          case 'k':
            e.preventDefault();
            this.openSettings();
            break;
        }
      }
    });

    // Add a manual refresh button event listener
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';
    refreshBtn.className = 'btn btn-secondary';
    refreshBtn.style.marginLeft = '8px';
    refreshBtn.onclick = () => {
      this.requestLogs();
      this.updateStatus('Refreshing...', true);
    };
    
    document.querySelector('.header-right').insertBefore(refreshBtn, document.getElementById('clearBtn'));
  }

  addLog(log) {
    this.logs.unshift(log);
    
    // Maintain max logs
    if (this.logs.length > this.settings.maxLogs) {
      this.logs.pop();
    }

    this.throttledUpdate();
  }

  setLogs(logs) {
    this.logs = logs || [];
    this.updateDisplay();
    console.log(`Console Watcher Pro: Received ${this.logs.length} logs from content script`);
  }

  setFilter(filter) {
    this.currentFilter = filter;
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === filter);
    });

    this.updateDisplay();
  }

  setSearch(query) {
    this.searchQuery = query.toLowerCase();
    
    // Show/hide clear button
    const clearSearch = document.getElementById('clearSearch');
    clearSearch.style.display = query ? 'block' : 'none';

    this.updateDisplay();
  }

  updateDisplay() {
    this.filterLogs();
    this.renderTable();
    this.updateCounts();
  }

  filterLogs() {
    this.filteredLogs = this.logs.filter(log => {
      // Apply type filter
      if (this.currentFilter !== 'all' && log.type !== this.currentFilter) {
        return false;
      }

      // Apply search filter
      if (this.searchQuery) {
        const searchText = [
          log.message,
          log.file,
          log.url,
          log.stack
        ].join(' ').toLowerCase();
        
        if (!searchText.includes(this.searchQuery)) {
          return false;
        }
      }

      return true;
    });
  }

  renderTable() {
    const tbody = document.getElementById('logTableBody');
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('logTable');

    if (this.filteredLogs.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      emptyState.style.display = 'flex';
      
      // Update empty state message based on filters
      const emptyStateTitle = document.querySelector('.empty-state h3');
      const emptyStateText = document.querySelector('.empty-state p');
      
      if (this.logs.length === 0) {
        emptyStateTitle.textContent = 'No logs captured yet';
        emptyStateText.textContent = 'Try running some console commands to see them here';
      } else if (this.searchQuery) {
        emptyStateTitle.textContent = 'No matching logs found';
        emptyStateText.textContent = 'Try adjusting your search terms';
      } else {
        emptyStateTitle.textContent = `No ${this.currentFilter} logs found`;
        emptyStateText.textContent = `Try generating some ${this.currentFilter} logs in the console`;
      }
      
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = this.filteredLogs.map(log => this.createLogRow(log)).join('');

    // Add click listeners to rows
    tbody.querySelectorAll('tr').forEach((row, index) => {
      row.addEventListener('click', () => {
        this.selectLog(this.filteredLogs[index]);
      });
    });

    // Auto-scroll to top if enabled
    if (this.settings.autoScroll && this.filteredLogs.length > 0) {
      tbody.scrollTop = 0;
    }
  }

  createLogRow(log) {
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    const message = this.truncateMessage(log.message, 50);
    const source = this.formatSource(log.file, log.line, log.column);
    const typeClass = `log-type ${log.type}`;

    return `
      <tr data-log-id="${log.id}">
        <td class="col-timestamp">${timestamp}</td>
        <td class="col-type">
          <span class="${typeClass}">${log.type}</span>
        </td>
        <td class="col-message message-cell" title="${this.escapeHtml(log.message)}">${this.escapeHtml(message)}</td>
        <td class="col-source source-cell">${this.escapeHtml(source)}</td>
      </tr>
    `;
  }

  selectLog(log) {
    this.selectedLog = log;
    
    // Update row selection
    document.querySelectorAll('#logTableBody tr').forEach(row => {
      row.classList.remove('selected');
    });
    
    const selectedRow = document.querySelector(`[data-log-id="${log.id}"]`);
    if (selectedRow) {
      selectedRow.classList.add('selected');
    }

    this.showDetails(log);
  }

  showDetails(log) {
    const detailsPane = document.getElementById('detailsPane');
    const detailsContent = document.getElementById('detailsContent');

    detailsContent.innerHTML = this.createDetailsContent(log);
    detailsPane.style.display = 'flex';
    detailsPane.classList.add('slide-in');
  }

  createDetailsContent(log) {
    const timestamp = new Date(log.timestamp).toLocaleString();
    const source = this.formatSource(log.file, log.line, log.column);
    const stackTrace = this.formatStackTrace(log.stack);

    return `
      <div class="detail-section">
        <h4>Message</h4>
        <p>${this.escapeHtml(log.message)}</p>
      </div>
      
      <div class="detail-section">
        <h4>Timestamp</h4>
        <p>${timestamp}</p>
      </div>
      
      <div class="detail-section">
        <h4>Source</h4>
        <p>${this.escapeHtml(source)}</p>
      </div>
      
      <div class="detail-section">
        <h4>URL</h4>
        <p>${this.escapeHtml(log.url)}</p>
      </div>
      
      <div class="detail-section">
        <h4>Stack Trace</h4>
        <pre>${this.escapeHtml(stackTrace)}</pre>
      </div>
      
      ${log.context ? `
        <div class="detail-section">
          <h4>Context</h4>
          <pre>${this.escapeHtml(log.context)}</pre>
        </div>
      ` : ''}
    `;
  }

  closeDetails() {
    const detailsPane = document.getElementById('detailsPane');
    detailsPane.style.display = 'none';
    detailsPane.classList.remove('slide-in');
    
    // Clear selection
    document.querySelectorAll('#logTableBody tr').forEach(row => {
      row.classList.remove('selected');
    });
    
    this.selectedLog = null;
  }

  updateCounts() {
    const counts = {
      all: this.logs.length,
      error: this.logs.filter(log => log.type === 'error').length,
      warn: this.logs.filter(log => log.type === 'warn').length,
      log: this.logs.filter(log => log.type === 'log').length
    };

    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countError').textContent = counts.error;
    document.getElementById('countWarn').textContent = counts.warn;
    document.getElementById('countLog').textContent = counts.log;
  }

  updateStatus(text, isConnected) {
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    statusText.textContent = text;
    statusDot.style.background = isConnected ? 'var(--success-color)' : 'var(--error-color)';
  }

  showEmptyState() {
    const emptyState = document.getElementById('emptyState');
    const table = document.getElementById('logTable');
    
    if (this.logs.length === 0) {
      table.style.display = 'none';
      emptyState.style.display = 'flex';
    } else {
      table.style.display = 'table';
      emptyState.style.display = 'none';
    }
  }

  clearLogs() {
    this.logs = [];
    this.filteredLogs = [];
    this.selectedLog = null;
    
    if (this.port) {
      this.port.postMessage({ type: 'CLEAR_LOGS' });
    }
    
    this.updateDisplay();
    this.closeDetails();
  }

  // Utility methods
  truncateMessage(message, maxLength) {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  }

  formatSource(file, line, column) {
    if (!file || file === 'unknown') return 'Unknown';
    const fileName = file.split('/').pop();
    return `${fileName} @ ${line}:${column}`;
  }

  formatStackTrace(stack) {
    if (!stack) return 'No stack trace available';
    return stack.split('\n').slice(1).join('\n'); // Remove first line (Error message)
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Settings methods
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['consoleWatcherSettings']);
      if (result.consoleWatcherSettings) {
        this.settings = { ...this.settings, ...result.consoleWatcherSettings };
      }
    } catch (error) {
      console.warn('Console Watcher Pro: Failed to load settings:', error);
    }
  }

  openSettings() {
    const modal = document.getElementById('settingsModal');
    
    // Populate form with current settings
    document.getElementById('maxLogs').value = this.settings.maxLogs;
    document.getElementById('autoScroll').checked = this.settings.autoScroll;
    document.getElementById('captureThirdParty').checked = this.settings.captureThirdParty;
    document.getElementById('theme').value = this.settings.theme;
    
    modal.style.display = 'flex';
  }

  closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  async saveSettings() {
    const newSettings = {
      maxLogs: parseInt(document.getElementById('maxLogs').value),
      autoScroll: document.getElementById('autoScroll').checked,
      captureThirdParty: document.getElementById('captureThirdParty').checked,
      theme: document.getElementById('theme').value
    };

    this.settings = { ...this.settings, ...newSettings };
    
    try {
      await chrome.storage.sync.set({ consoleWatcherSettings: this.settings });
      
      // Update content script settings
      if (this.port) {
        this.port.postMessage({ 
          type: 'UPDATE_SETTINGS', 
          settings: this.settings 
        });
      }
      
      this.applyTheme();
      this.closeSettings();
    } catch (error) {
      console.error('Console Watcher Pro: Failed to save settings:', error);
    }
  }

  resetSettings() {
    const defaultSettings = {
      maxLogs: 1000,
      autoScroll: true,
      captureThirdParty: true,
      theme: 'dark'
    };

    document.getElementById('maxLogs').value = defaultSettings.maxLogs;
    document.getElementById('autoScroll').checked = defaultSettings.autoScroll;
    document.getElementById('captureThirdParty').checked = defaultSettings.captureThirdParty;
    document.getElementById('theme').value = defaultSettings.theme;
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
  }

  // Action methods
  copyDetails() {
    if (!this.selectedLog) return;
    
    const details = `
Console Log Details:
===================
Type: ${this.selectedLog.type}
Message: ${this.selectedLog.message}
Timestamp: ${new Date(this.selectedLog.timestamp).toLocaleString()}
Source: ${this.formatSource(this.selectedLog.file, this.selectedLog.line, this.selectedLog.column)}
URL: ${this.selectedLog.url}
Stack Trace:
${this.formatStackTrace(this.selectedLog.stack)}
    `.trim();

    navigator.clipboard.writeText(details).then(() => {
      // Show feedback
      const btn = document.getElementById('copyDetails');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Copied!';
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2000);
    });
  }

  openInSources() {
    if (!this.selectedLog) return;
    
    // Use DevTools API to open in Sources panel
    chrome.devtools.inspectedWindow.eval(`
      console.log('Opening source: ${this.selectedLog.file}:${this.selectedLog.line}');
    `);
  }

  reportFeedback() {
    if (!this.selectedLog) return;
    
    const feedback = {
      log: this.selectedLog,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    };
    
    // In a real implementation, this would send to a feedback endpoint
    console.log('Console Watcher Pro: Feedback report:', feedback);
    
    // Show feedback
    const btn = document.getElementById('reportFeedback');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Reported!';
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  }

  // Performance optimization
  throttledUpdate() {
    if (this.updateThrottle) {
      clearTimeout(this.updateThrottle);
    }
    
    this.updateThrottle = setTimeout(() => {
      this.updateDisplay();
      this.updateThrottle = null;
    }, 200);
  }
}

// Initialize the panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ConsoleWatcherPanel();
}); 