const { Plugin, PluginSettingTab, Setting, debounce } = require('obsidian');

const DEFAULT_SETTINGS = {
    pageSize: 'A4',
    orientation: 'portrait',
    marginTop: 25.4,
    marginBottom: 25.4,
    marginLeft: 25.4,
    marginRight: 25.4,
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'default',
    showPageNumbers: true,
    breakLineColor: '#3b82f6',
    breakLineStyle: 'solid',
    breakLineOpacity: 0.5,
    minBreakSpacing: 50,
    calibrationOffset: 0,
};

const PAGE_DIMENSIONS = {
    A4: { width: 210, height: 297 },
    Letter: { width: 215.9, height: 279.4 },
    Legal: { width: 215.9, height: 355.6 },
};

const FONT_METRICS = {
    'default': 1.0,
    'serif': 1.02,
    'sans-serif': 0.98,
    'monospace': 1.05,
};

class PageBreakPlugin extends Plugin {
    async onload() {
        console.log('Loading Page Break Plugin - Stable Full Document Mode');
        await this.loadSettings();
        
        this.breakContainers = new Map();
        this.calculatedBreaks = new Map(); // Cache breaks per container
        this.observers = new Map();
        
        // Very aggressive debouncing - only recalc when really necessary
        this.debouncedUpdate = debounce(() => this.updateAllViews(), 500, true);

        this.addRibbonIcon('separator-horizontal', 'Toggle Page Breaks', () => {
            this.togglePageBreaks();
        });

        this.addCommand({
            id: 'toggle-page-breaks',
            name: 'Toggle page break indicators',
            callback: () => this.togglePageBreaks(),
        });

        this.addCommand({
            id: 'recalibrate-breaks',
            name: 'Recalibrate page breaks',
            callback: () => this.recalibrate(),
        });

        this.addSettingTab(new PageBreakSettingTab(this.app, this));

        // Register events - but minimize recalculations
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                console.log('Layout changed - recalculating');
                this.calculatedBreaks.clear();
                this.debouncedUpdate();
            })
        );

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                setTimeout(() => this.updateAllViews(), 150);
            })
        );

        // On editor change, only extend container if needed - DON'T recalculate
        this.registerEvent(
            this.app.workspace.on('editor-change', () => {
                this.extendContainersIfNeeded();
            })
        );
                // Listen specifically for preview mode changes
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                setTimeout(() => this.updateAllViews(), 300);
            })
        );

        // Listen for mode changes specifically
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                // Clear caches when layout might have changed modes
                this.calculatedBreaks.clear();
                setTimeout(() => this.updateAllViews(), 200);
            })
        );

        // Initial update
        setTimeout(() => {
            console.log('=== INITIAL CALCULATION ===');
            this.updateAllViews();
        }, 500);
    }

    onunload() {
        console.log('Unloading Page Break Plugin');
        this.removeAllPageBreaks();
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        this.breakContainers.clear();
        this.calculatedBreaks.clear();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.calculatedBreaks.clear();
        this.updateAllViews();
    }

    togglePageBreaks() {
        document.body.classList.toggle('page-breaks-hidden');
    }

    recalibrate() {
        console.log('=== MANUAL RECALIBRATION ===');
        this.calculatedBreaks.clear();
        this.removeAllPageBreaks();
        setTimeout(() => this.updateAllViews(), 100);
    }

    // NEW: Only extend containers, don't recalculate breaks
    extendContainersIfNeeded() {
        this.breakContainers.forEach((container, targetEl) => {
            const currentHeight = parseInt(container.style.height) || 0;
            const newHeight = targetEl.scrollHeight;
            
            // Only extend if document grew significantly
            if (newHeight > currentHeight + 100) {
                console.log(`Extending container from ${currentHeight}px to ${newHeight}px - NOT recalculating breaks`);
                container.style.height = `${newHeight}px`;
                
                // Add more breaks if needed
                const pageHeight = this.getPageHeight();
                const existingBreaks = this.calculatedBreaks.get(targetEl) || [];
                const lastBreakPosition = existingBreaks.length > 0 ? 
                    existingBreaks[existingBreaks.length - 1] : 0;
                
                const newBreaks = this.createAdditionalBreaks(
                    lastBreakPosition, 
                    currentHeight, 
                    newHeight, 
                    pageHeight
                );
                
                if (newBreaks.length > 0) {
                    console.log(`Adding ${newBreaks.length} new breaks`);
                    this.renderAdditionalBreaks(container, newBreaks, existingBreaks.length + 2);
                    this.calculatedBreaks.set(targetEl, [...existingBreaks, ...newBreaks]);
                }
            }
        });
    }

    createAdditionalBreaks(lastBreak, oldHeight, newHeight, pageHeight) {
        const breaks = [];
        let currentPage = Math.floor(lastBreak / pageHeight) + 1;
        let lastBreakY = lastBreak;
        
        while (currentPage * pageHeight < newHeight) {
            const breakY = currentPage * pageHeight + this.settings.calibrationOffset;
            if (breakY - lastBreakY >= this.settings.minBreakSpacing && breakY > oldHeight) {
                breaks.push(breakY);
                lastBreakY = breakY;
            }
            currentPage++;
        }
        
        return breaks;
    }

    renderAdditionalBreaks(container, breaks, startingPageNumber) {
        const fragment = document.createDocumentFragment();
        
        breaks.forEach((breakY, index) => {
            const indicator = this.createBreakIndicator(breakY, startingPageNumber + index);
            fragment.appendChild(indicator);
        });
        
        container.appendChild(fragment);
    }

    updateAllViews() {
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        console.log(`Updating ${leaves.length} markdown views`);
        
        // ALWAYS clear caches - less efficient but more reliable
        this.calculatedBreaks.clear();
        
        leaves.forEach(leaf => {
            const view = leaf.view;
            if (view.contentEl) {
                this.updatePageBreaks(view.contentEl);
            }
        });
    }

    removeAllPageBreaks() {
        document.querySelectorAll('.page-break-container').forEach(el => el.remove());
        this.breakContainers.clear();
    }

    updatePageBreaks(element) {
        try {
            // Find the appropriate container
            const previewEl = element.querySelector('.markdown-preview-view');
            const editorContainer = element.querySelector('.cm-editor');
            const scroller = editorContainer?.querySelector('.cm-scroller');
            
            let targetEl = null;
            let isEditMode = false;

            if (scroller) {
                targetEl = scroller;
                isEditMode = true;
            } else if (previewEl) {
                targetEl = previewEl;
                isEditMode = false;
            }

            if (!targetEl) {
                console.log('No target element found');
                return;
            }

            // Check if we already have breaks calculated for this container
            if (this.calculatedBreaks.has(targetEl)) {
                console.log('Using cached breaks - NOT recalculating');
                return;
            }

            console.log(`CALCULATING BREAKS FOR ${isEditMode ? 'EDIT' : 'PREVIEW'} MODE `);

            // Remove old breaks
            const existingContainer = this.breakContainers.get(targetEl);
            if (existingContainer) {
                existingContainer.remove();
                this.breakContainers.delete(targetEl);
            }

            // Create container
            const breakContainer = this.createBreakContainer(targetEl);
            this.breakContainers.set(targetEl, breakContainer);

            // Calculate breaks - ONCE
            const breaks = this.calculateSimpleBreaks(targetEl);
            console.log(`Calculated ${breaks.length} breaks at positions:`, breaks.map(b => Math.round(b)));

            // Store breaks
            this.calculatedBreaks.set(targetEl, breaks);

            // Render breaks
            if (breaks.length > 0) {
                this.renderPageBreaks(breakContainer, breaks);
            }

            // Setup observer for height changes only
            this.setupHeightObserver(targetEl);

        } catch (error) {
            console.error('Error updating page breaks:', error);
        }
    }

    createBreakContainer(targetEl) {
        const container = document.createElement('div');
        container.className = 'page-break-container';
        
        const height = targetEl.scrollHeight;
        container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: ${height}px;
            pointer-events: none;
            z-index: 100;
            overflow: visible;
        `;

        const targetPosition = window.getComputedStyle(targetEl).position;
        if (targetPosition === 'static') {
            targetEl.style.position = 'relative';
        }

        targetEl.appendChild(container);
        console.log(`Created container with height: ${height}px`);
        
        return container;
    }

    setupHeightObserver(targetEl) {
        const oldObserver = this.observers.get(targetEl);
        if (oldObserver) {
            oldObserver.disconnect();
        }

        const resizeObserver = new ResizeObserver(() => {
            this.extendContainersIfNeeded();
        });
        
        resizeObserver.observe(targetEl);
        this.observers.set(targetEl, resizeObserver);
    }

    // SIMPLIFIED: Just create breaks at regular intervals
    calculateSimpleBreaks(container) {
        const breaks = [];
        const pageHeight = this.getPageHeight();
        const totalHeight = container.scrollHeight;
        
        console.log(`Document height: ${totalHeight}px, Page height: ${pageHeight}px`);
        
        let currentPage = 1;
        let lastBreakY = 0;
        
        // Create breaks at regular intervals based on page height
        while (currentPage * pageHeight < totalHeight) {
            const breakY = currentPage * pageHeight + this.settings.calibrationOffset;
            
            if (breakY - lastBreakY >= this.settings.minBreakSpacing) {
                breaks.push(breakY);
                lastBreakY = breakY;
            }
            
            currentPage++;
        }
        
        return breaks;
    }

    getPageHeight() {
        const dims = PAGE_DIMENSIONS[this.settings.pageSize];
        let height = this.settings.orientation === 'portrait' ? dims.height : dims.width;
        
        height -= (this.settings.marginTop + this.settings.marginBottom);
        
        const pixelsPerMm = 96 / 25.4;
        let heightInPixels = height * pixelsPerMm;
        
        const fontMetric = FONT_METRICS[this.settings.fontFamily] || 1.0;
        heightInPixels *= fontMetric;
        
        heightInPixels *= 0.985;
        
        return heightInPixels;
    }

    renderPageBreaks(container, breaks) {
        const fragment = document.createDocumentFragment();

        breaks.forEach((breakY, index) => {
            const indicator = this.createBreakIndicator(breakY, index + 2);
            fragment.appendChild(indicator);
        });

        container.appendChild(fragment);
        console.log(`Rendered ${breaks.length} indicators`);
    }

    createBreakIndicator(position, pageNumber) {
        const indicator = document.createElement('div');
        indicator.className = 'page-break-indicator';
        indicator.setAttribute('data-page', pageNumber);
        indicator.setAttribute('data-position', Math.round(position));
        
        indicator.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            top: ${position}px;
            height: 2px;
            z-index: 101;
            pointer-events: none;
        `;

        const line = document.createElement('div');
        line.className = 'page-break-line';
        line.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 2px;
            background: ${this.settings.breakLineColor};
            opacity: ${this.settings.breakLineOpacity};
            ${this.settings.breakLineStyle === 'dashed' ? 'border-top: 2px dashed ' + this.settings.breakLineColor + '; background: none;' : ''}
            ${this.settings.breakLineStyle === 'dotted' ? 'border-top: 2px dotted ' + this.settings.breakLineColor + '; background: none;' : ''}
        `;
        indicator.appendChild(line);

        if (this.settings.showPageNumbers) {
            const badge = document.createElement('div');
            badge.className = 'page-break-number';
            badge.textContent = `Page ${pageNumber}`;
            
            badge.style.cssText = `
                position: absolute;
                right: 4%;
                
                top: -30px;
                font-size: 11px;
                font-weight: 600;
                color: ${this.settings.breakLineColor};
                background: var(--background-primary);
                padding: 4px 10px;
                border-radius: 4px;
                
                white-space: nowrap;
                z-index: 102;
                 opacity: 0.6;
                
            `;
            indicator.appendChild(badge);
        }

        return indicator;
    }
}

class PageBreakSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Page Break Indicator Settings' });

        new Setting(containerEl)
            .setName('Page size')
            .setDesc('Standard paper size for page break calculation')
            .addDropdown(dropdown =>
                dropdown
                    .addOption('A4', 'A4 (210 × 297 mm)')
                    .addOption('Letter', 'Letter (8.5 × 11 in)')
                    .addOption('Legal', 'Legal (8.5 × 14 in)')
                    .setValue(this.plugin.settings.pageSize)
                    .onChange(async (value) => {
                        this.plugin.settings.pageSize = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Orientation')
            .setDesc('Page orientation')
            .addDropdown(dropdown =>
                dropdown
                    .addOption('portrait', 'Portrait')
                    .addOption('landscape', 'Landscape')
                    .setValue(this.plugin.settings.orientation)
                    .onChange(async (value) => {
                        this.plugin.settings.orientation = value;
                        await this.plugin.saveSettings();
                    })
            );

        containerEl.createEl('h3', { text: 'Margins (mm)' });

        new Setting(containerEl)
            .setName('Top margin')
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.marginTop))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0) {
                            this.plugin.settings.marginTop = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Bottom margin')
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.marginBottom))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0) {
                            this.plugin.settings.marginBottom = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Left margin')
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.marginLeft))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0) {
                            this.plugin.settings.marginLeft = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Right margin')
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.marginRight))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0) {
                            this.plugin.settings.marginRight = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        containerEl.createEl('h3', { text: 'Typography' });

        new Setting(containerEl)
            .setName('Font size')
            .setDesc('Base font size in points (pt)')
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.fontSize))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.fontSize = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Line height')
            .setDesc('Line height multiplier (1.5 = 150%)')
            .addText(text =>
                text
                    .setValue(String(this.plugin.settings.lineHeight))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.lineHeight = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Font family')
            .setDesc('Font family metric adjustment')
            .addDropdown(dropdown =>
                dropdown
                    .addOption('default', 'Default')
                    .addOption('serif', 'Serif')
                    .addOption('sans-serif', 'Sans-serif')
                    .addOption('monospace', 'Monospace')
                    .setValue(this.plugin.settings.fontFamily)
                    .onChange(async (value) => {
                        this.plugin.settings.fontFamily = value;
                        await this.plugin.saveSettings();
                    })
            );

        containerEl.createEl('h3', { text: 'Fine-tuning' });

        new Setting(containerEl)
            .setName('Calibration offset')
            .setDesc('Fine-tune alignment in pixels (positive = move down, negative = move up)')
            .addText(text =>
                text
                    .setPlaceholder('0')
                    .setValue(String(this.plugin.settings.calibrationOffset))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                            this.plugin.settings.calibrationOffset = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Minimum break spacing')
            .setDesc('Minimum pixels between consecutive breaks')
            .addText(text =>
                text
                    .setPlaceholder('50')
                    .setValue(String(this.plugin.settings.minBreakSpacing))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0) {
                            this.plugin.settings.minBreakSpacing = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        containerEl.createEl('h3', { text: 'Visual Appearance' });

        new Setting(containerEl)
            .setName('Line color')
            .setDesc('Color of the page break indicator (hex code)')
            .addText(text =>
                text
                    .setPlaceholder('#3b82f6')
                    .setValue(this.plugin.settings.breakLineColor)
                    .onChange(async (value) => {
                        if (/^#[0-9A-F]{6}$/i.test(value)) {
                            this.plugin.settings.breakLineColor = value;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Line style')
            .addDropdown(dropdown =>
                dropdown
                    .addOption('solid', 'Solid')
                    .addOption('dashed', 'Dashed')
                    .addOption('dotted', 'Dotted')
                    .setValue(this.plugin.settings.breakLineStyle)
                    .onChange(async (value) => {
                        this.plugin.settings.breakLineStyle = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Line opacity')
            .setDesc('Opacity of the page break line (0-1)')
            .addText(text =>
                text
                    .setPlaceholder('0.5')
                    .setValue(String(this.plugin.settings.breakLineOpacity))
                    .onChange(async (value) => {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0 && num <= 1) {
                            this.plugin.settings.breakLineOpacity = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Show page numbers')
            .setDesc('Display page numbers at each break')
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.showPageNumbers)
                    .onChange(async (value) => {
                        this.plugin.settings.showPageNumbers = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}

module.exports = PageBreakPlugin;