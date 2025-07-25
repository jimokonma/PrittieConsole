# Console Watcher Pro

A professional Chrome DevTools extension that captures console logs with advanced filtering, search capabilities, and detailed stack trace analysis.

## 🚀 Features

### Core Functionality
- **Real-time Console Capture**: Hooks into `console.log`, `console.warn`, `console.error`, `console.info`, and `console.debug`
- **Uncaught Error Detection**: Captures window errors and unhandled promise rejections
- **Stack Trace Analysis**: Detailed call stack information with file, line, and column numbers
- **Deduplication**: Prevents duplicate log entries using content-based hashing

### Advanced UI
- **Filter Tabs**: Filter by log type (All, Errors, Warnings, Success) with live counts
- **Search Functionality**: Search across messages, file names, URLs, and stack traces
- **Details Pane**: Expandable log details with full context information
- **Responsive Design**: Works on different screen sizes with mobile-friendly layout

### Professional Features
- **Dark/Light Theme**: Toggle between themes with persistent settings
- **Settings Panel**: Configure max logs, auto-scroll, third-party capture, and theme
- **Action Buttons**: Copy details, open in Sources panel, and report feedback
- **Performance Optimized**: Throttled updates and virtualized rendering for smooth performance

### Developer Experience
- **Keyboard Shortcuts**: Ctrl+F for search, Ctrl+K for settings
- **Status Indicators**: Real-time connection status and log counts
- **Export Capabilities**: Copy detailed log information to clipboard
- **Accessibility**: High contrast support and reduced motion preferences

## 📁 File Structure

```
console-watcher-extension/
├── manifest.json           # Extension configuration and permissions
├── background.js           # Service worker for messaging
├── content-script.js       # Console method hooks and log capture
├── devtools.html          # DevTools page loader
├── devtools.js            # DevTools panel registration
├── panel.html             # Main UI structure
├── panel.js               # Panel controller and UI logic
├── styles.css             # Comprehensive styling with themes
└── README.md              # This documentation
```

## 🛠️ Installation

### Prerequisites
- Google Chrome browser
- Developer mode enabled

### Steps
1. **Download/Clone** this repository
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top right)
4. **Click "Load unpacked"** and select the extension folder
5. **Open DevTools** on any webpage (F12)
6. **Click the "Console Logs" tab** in DevTools

## 🎯 Usage

### Basic Usage
1. **Open DevTools** on any webpage
2. **Navigate to "Console Logs" tab**
3. **Generate console logs** in the main console:
   ```javascript
   console.log("This is a log message");
   console.warn("This is a warning");
   console.error("This is an error");
   ```
4. **View captured logs** in the extension panel

### Advanced Features

#### Filtering
- Click filter tabs to view specific log types
- Live counts show number of logs per type
- "All" tab shows complete log history

#### Search
- Use the search bar to find specific logs
- Searches across message content, file names, URLs, and stack traces
- Clear button (×) to reset search

#### Details Pane
- Click any log row to view detailed information
- Includes full message, timestamp, source location, URL, and stack trace
- Action buttons for copying, opening in Sources, and reporting

#### Settings
- Click the settings gear icon (⚙️) to open configuration
- Configure maximum log entries (100-10,000)
- Toggle auto-scroll behavior
- Enable/disable third-party script capture
- Switch between dark and light themes

### Keyboard Shortcuts
- `Ctrl+F` (or `Cmd+F`): Focus search input
- `Ctrl+K` (or `Cmd+K`): Open settings panel
- `Escape`: Close details pane or settings modal

## 🔧 Architecture

### Messaging System
The extension uses Chrome's messaging API for communication between components:

```
Content Script ←→ Background Script ←→ DevTools Panel
```

- **Content Script**: Hooks console methods and captures logs
- **Background Script**: Routes messages between content script and DevTools panel
- **DevTools Panel**: Displays logs and handles user interactions

### Data Flow
1. **Console Method Hook**: Content script overrides console methods
2. **Log Capture**: Creates detailed log entries with stack traces
3. **Deduplication**: Prevents duplicate entries using content hashing
4. **Messaging**: Sends logs to DevTools panel via background script
5. **Display**: Renders logs in filtered, searchable table
6. **Details**: Shows expanded information in side panel

### Performance Optimizations
- **Throttled Updates**: UI updates limited to 200ms intervals during bursts
- **Ring Buffer**: In-memory storage with configurable max entries
- **Virtual Rendering**: Efficient table rendering for large log sets
- **Lazy Loading**: Details pane content loaded on demand

## 🎨 Customization

### Themes
The extension supports both dark and light themes with CSS custom properties:

```css
:root {
  --bg-primary: #1e1e1e;
  --text-primary: #ffffff;
  --accent-color: #007acc;
  /* ... more variables */
}
```

### Styling
All UI components use CSS Grid and Flexbox for responsive layouts:
- Modular component structure
- Accessible font sizes and contrast ratios
- Smooth animations and transitions
- Custom scrollbar styling

## 🔍 Troubleshooting

### Common Issues

#### Extension Not Loading
- Ensure Developer mode is enabled
- Check for manifest.json syntax errors
- Reload the extension from chrome://extensions/

#### No Logs Appearing
- Verify the extension is loaded in the correct tab
- Check browser console for error messages
- Ensure content script is injected (refresh the page)

#### Performance Issues
- Reduce max log entries in settings
- Disable auto-scroll for large log sets
- Clear logs periodically to free memory

#### Connection Issues
- Status indicator shows "Disconnected"
- Reload the extension and refresh the page
- Check for conflicting extensions

### Debug Mode
Enable debug logging by opening the browser console and running:
```javascript
localStorage.setItem('consoleWatcherDebug', 'true');
```

## 🚀 Development

### Building from Source
1. Clone the repository
2. Make changes to source files
3. Reload extension in Chrome
4. Test functionality in DevTools

### Adding Features
- **New Log Types**: Modify `content-script.js` console hooks
- **UI Components**: Add to `panel.html` and style in `styles.css`
- **Settings**: Extend settings object in `panel.js`
- **Messaging**: Add message types in `background.js`

### Testing
- Test on various websites with different console usage patterns
- Verify performance with large log volumes
- Check accessibility with screen readers
- Test responsive design on different screen sizes

## 📋 Requirements

### Browser Support
- Chrome 88+ (Manifest V3)
- Chromium-based browsers (Edge, Brave, etc.)

### Permissions
- `scripting`: Inject content scripts
- `activeTab`: Access current tab
- `storage`: Persist settings
- `host_permissions`: Work on all URLs

## 🤝 Contributing

### Code Style
- Use ES6+ features
- Follow Chrome extension best practices
- Maintain accessibility standards
- Add comments for complex logic

### Pull Requests
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Chrome DevTools API documentation
- VS Code theme inspiration for dark/light modes
- Community feedback and testing

## 📞 Support

For issues, feature requests, or questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the documentation

---

**Console Watcher Pro** - Professional console log monitoring for developers.