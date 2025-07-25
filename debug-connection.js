// Debug script for Console Watcher Pro connection testing
// Run this in the browser console to test the connection

console.log('=== Console Watcher Pro - Connection Debug ===');

// Check if content script is loaded
if (window.consoleWatcher) {
  console.log('✅ Content script is loaded');
  console.log('Content script instance:', window.consoleWatcher);
  
  // Check connection status
  if (window.consoleWatcher.port) {
    console.log('✅ Content script is connected to background script');
  } else {
    console.log('❌ Content script is NOT connected to background script');
  }
  
  // Check logs
  console.log('Current logs count:', window.consoleWatcher.logs.length);
  
  // Test sending a log
  console.log('Testing log capture...');
  window.consoleWatcher.captureLog('debug', ['Test log from debug script']);
  
} else {
  console.log('❌ Content script is NOT loaded');
  console.log('Try refreshing the page or reloading the extension');
}

// Test console method overrides
console.log('Testing console method overrides...');
const originalMethods = ['log', 'warn', 'error', 'info', 'debug'];
originalMethods.forEach(method => {
  const methodStr = console[method].toString();
  if (methodStr.includes('captureLog')) {
    console.log(`✅ console.${method} is overridden`);
  } else {
    console.log(`❌ console.${method} is NOT overridden`);
  }
});

// Test connection to background script
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('✅ Chrome runtime is available');
  
  // Try to connect to background script
  try {
    const testPort = chrome.runtime.connect({ name: 'content-script' });
    console.log('✅ Successfully connected to background script');
    
    testPort.onMessage.addListener((message) => {
      console.log('Received message from background script:', message);
    });
    
    testPort.onDisconnect.addListener(() => {
      console.log('❌ Disconnected from background script');
    });
    
    // Send a test message
    testPort.postMessage({ type: 'TEST_MESSAGE', data: 'Hello from debug script' });
    
  } catch (error) {
    console.log('❌ Failed to connect to background script:', error);
  }
} else {
  console.log('❌ Chrome runtime is NOT available');
}

// Test console methods
console.log('=== Testing Console Methods ===');
console.log('This is a test log message');
console.warn('This is a test warning message');
console.error('This is a test error message');
console.info('This is a test info message');
console.debug('This is a test debug message');

// Test error throwing
console.log('=== Testing Error Capture ===');
setTimeout(() => {
  console.log('Throwing a test error in 2 seconds...');
  throw new Error('This is a test error from debug script');
}, 2000);

// Test promise rejection
setTimeout(() => {
  console.log('Creating a test promise rejection in 3 seconds...');
  Promise.reject(new Error('This is a test promise rejection from debug script'));
}, 3000);

console.log('=== Debug script completed ===');
console.log('Check the Console Logs tab in DevTools to see if logs are captured'); 