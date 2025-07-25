// Background service worker for Console Watcher Pro
let devtoolsPort = null;
let contentScriptPorts = new Map();

// Handle DevTools panel connection
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools-panel') {
    devtoolsPort = port;
    
    port.onMessage.addListener((message) => {
      if (message.type === 'GET_LOGS') {
        // Forward to content script
        contentScriptPorts.forEach((contentPort) => {
          try {
            contentPort.postMessage({ type: 'GET_LOGS' });
          } catch (error) {
            console.warn('Console Watcher: Failed to send GET_LOGS to content script:', error);
          }
        });
      } else if (message.type === 'CLEAR_LOGS') {
        contentScriptPorts.forEach((contentPort) => {
          try {
            contentPort.postMessage({ type: 'CLEAR_LOGS' });
          } catch (error) {
            console.warn('Console Watcher: Failed to send CLEAR_LOGS to content script:', error);
          }
        });
      } else if (message.type === 'UPDATE_SETTINGS') {
        contentScriptPorts.forEach((contentPort) => {
          try {
            contentPort.postMessage({ type: 'UPDATE_SETTINGS', settings: message.settings });
          } catch (error) {
            console.warn('Console Watcher: Failed to send UPDATE_SETTINGS to content script:', error);
          }
        });
      }
    });

    port.onDisconnect.addListener(() => {
      devtoolsPort = null;
      console.log('Console Watcher: DevTools panel disconnected');
    });
  } else if (port.name === 'content-script') {
    const tabId = port.sender.tab.id;
    contentScriptPorts.set(tabId, port);
    
    console.log(`Console Watcher: Content script connected for tab ${tabId}`);
    
    port.onMessage.addListener((message) => {
      try {
        if (message.type === 'LOG_ENTRY' && devtoolsPort) {
          devtoolsPort.postMessage({
            type: 'LOG_ENTRY',
            log: message.log,
            tabId: tabId
          });
        } else if (message.type === 'LOGS_DATA' && devtoolsPort) {
          devtoolsPort.postMessage({
            type: 'LOGS_DATA',
            logs: message.logs,
            tabId: tabId
          });
        }
      } catch (error) {
        console.warn('Console Watcher: Error handling content script message:', error);
      }
    });

    port.onDisconnect.addListener(() => {
      contentScriptPorts.delete(tabId);
      console.log(`Console Watcher: Content script disconnected for tab ${tabId}`);
    });
  }
});

// Handle tab updates and ensure content script injection
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    // Inject content script
    injectContentScript(tabId);
  }
});

// Handle tab activation to ensure content script is injected
chrome.tabs.onActivated.addListener((activeInfo) => {
  injectContentScript(activeInfo.tabId);
});

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  // Inject content script into all existing tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      injectContentScript(tab.id);
    });
  });
});

// Function to inject content script
async function injectContentScript(tabId) {
  try {
    // Check if we can inject into this tab
    const tab = await chrome.tabs.get(tabId);
    
    // Skip chrome://, chrome-extension://, and other restricted URLs
    if (tab.url && (tab.url.startsWith('chrome://') || 
                   tab.url.startsWith('chrome-extension://') ||
                   tab.url.startsWith('moz-extension://') ||
                   tab.url.startsWith('edge://'))) {
      return;
    }

    // Check if content script is already injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          return window.consoleWatcher !== undefined;
        }
      });
    } catch (error) {
      // Content script not injected yet, proceed with injection
    }

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content-script.js']
    });
    
    console.log(`Console Watcher: Content script injected into tab ${tabId}`);
  } catch (error) {
    // Ignore errors for non-injectable pages
    console.warn(`Console Watcher: Could not inject content script into tab ${tabId}:`, error.message);
  }
}

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  contentScriptPorts.delete(tabId);
  console.log(`Console Watcher: Tab ${tabId} removed, cleaned up content script port`);
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  // Inject content script into all existing tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      injectContentScript(tab.id);
    });
  });
});

// Handle messages from DevTools panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_CONTENT_SCRIPT') {
    injectContentScript(sender.tab.id);
    sendResponse({ success: true });
  } else if (message.type === 'GET_CONTENT_SCRIPT_STATUS') {
    const tabId = sender.tab.id;
    const hasContentScript = contentScriptPorts.has(tabId);
    sendResponse({ hasContentScript, tabId });
  }
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Console Watcher: Background service worker started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Console Watcher: Extension installed/updated');
}); 