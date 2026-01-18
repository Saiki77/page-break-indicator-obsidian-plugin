# Page Break Indicator Plugin for Obsidian

Visualize where page breaks will likely occur when exporting to PDF. This plugin shows accurate page break indicators in both edit and preview modes, helping you format your documents for professional printing or PDF export.

## Features

- **Page Break Visualization**: See where pages will break based on your document settings
- **Dual Mode Support**: Works in both edit mode (live preview) and reading/preview mode
- **Customizable Page Settings**: Configure page size, orientation, margins, and typography
- **Performance Optimized**: Smart caching and minimal recalculation for smooth experience
- **Visual Customization**: Adjust break line style, color, opacity, and page number display
- **Live Calibration**: Fine-tune break positions with calibration offset

## Installation

### Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to "Community plugins" and disable Safe Mode
3. Click "Browse" and search for "Page Break Indicator"
4. Install the plugin
5. Enable the plugin in your installed plugins list

### Manual Installation
1. Download the latest release from GitHub
2. Extract the files to your vault's plugins folder: `.obsidian/plugins/page-break-indicator/`
3. Reload Obsidian
4. Enable the plugin in Settings > Community plugins

## Usage

### Basic Usage
- Click the ribbon icon (horizontal line with page) to toggle visibility
- Use command palette: "Toggle page break indicators"
- Breaks automatically update as you edit your document

### Commands
- **Toggle page break indicators**: Show/hide all break indicators
- **Recalibrate page breaks**: Force a recalculation of all breaks

### Settings Configuration
Access settings via: Settings/Community plugins/Page Break Indicator

#### Page Layout
- **Page Size**: A4, Letter, or Legal
- **Orientation**: Portrait or Landscape
- **Margins**: Adjust top, bottom, left, and right margins (in mm)

#### Typography
- **Font Size**: Base font size in points
- **Line Height**: Line spacing multiplier
- **Font Family**: Metric adjustments for different font families

#### Visual Appearance
- **Line Color**: Color of break indicators (hex code)
- **Line Style**: Solid, dashed, or dotted
- **Line Opacity**: Transparency of break lines
- **Show Page Numbers**: Display page numbers at each break
- **Minimum Break Spacing**: Minimum pixels between consecutive breaks
- **Calibration Offset**: Fine-tune alignment (± pixels)

## How It Works

The plugin calculates page breaks based on:
1. **Physical Page Dimensions**: Converts mm/inches to pixels based on your screen DPI
2. **Typography Settings**: Adjusts for font size, line height, and font family metrics
3. **Margins**: Accounts for configured top/bottom margins
4. **Document Flow**: Analyzes the actual rendered content height

### Smart Performance Features
- **Break Caching**: Calculates breaks once per document version
- **Incremental Updates**: Only extends containers when document grows
- **Debounced Updates**: Prevents excessive recalculations during typing
- **Selective Observers**: Only monitors necessary elements for changes

## Known Considerations

- **Export Accuracy**: While accurate, final PDF export may vary by one or two lines per page, depending on your PDF generation settings
- **Theme Compatibility**: Works with most themes, but some custom themes may require CSS adjustments
- **Large Documents**: Performance optimized, but extremely long documents may see minor lag
- **Dynamic Content**: Content that changes height dynamically (toggles, callouts) may require recalibration

## Troubleshooting

### Breaks Not Showing
1. Ensure plugin is enabled in Community plugins
2. Check that document is in edit or preview mode
3. Try using the "Recalibrate page breaks" command
4. Verify your page settings are reasonable (e.g., margins not too large)

### Breaks Incorrectly Positioned
1. Adjust calibration offset in settings
2. Verify your font settings match your actual font usage
3. Check that page size and orientation match your intended export

### Performance Issues
1. Disable and re-enable the plugin
2. Use the recalibrate command to clear caches
3. Check console for errors (Ctrl+Shift+I)

## Support

- Report issues on GitHub
- For feature requests, please include detailed use cases
- Include theme name and Obsidian version when reporting display issues

## License

MIT License - See included LICENSE file for details

## Version History

### 1.0.0
- Initial release
- Support for A4, Letter, and Legal page sizes
- Dual mode support (edit and preview)
- Comprehensive customization options
- Performance-optimized architecture

---

**Tip**: For best results, configure the plugin settings to match your intended PDF export settings in Obsidian's export options.