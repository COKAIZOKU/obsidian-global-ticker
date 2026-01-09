import {App, Editor, MarkdownView, Modal, Notice, Plugin, ItemView, WorkspaceLeaf} from 'obsidian';
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab} from "./settings";
import { initTicker } from "./ticker";

const VIEW_TYPE_MY_PANEL = "my-plugin-panel";

class MyPanelView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_MY_PANEL;
  }

  getIcon() {
	return "rss";
  }

  getDisplayText() {
    return "News";
  }

  async onOpen() {
    const container = this.containerEl; // main content area
    container.empty();
    const scroller = container.createDiv({ cls: "scroller" });
    scroller.setAttribute("data-speed", "slow");

    const list = scroller.createEl("ul", { cls: ["tag-list", "scroller__inner"] });
    const headlines = ["Fourth Slice of Pizza Consumed Without Facial Expression", "Man's Mouth All Dry From Complaining", "Play Within A Play Also Boring", "Amazing Psychic Bends Truth With Minds"];
    headlines.forEach((headline) => {
      list.createEl("li", { text: headline });
    });

    const stockScroller = container.createDiv({ cls: "scroller" });
    stockScroller.setAttribute("data-speed", "slow");

    const stockList = stockScroller.createEl("ul", { cls: ["tag-list", "scroller__inner", "stock-list"] });
    const stocks: Array<[string, string, string]> = [
      ["AAPL", "$196.58" , "+1.24%"],
      ["MSFT", "$330.72", "-0.72%"],
      ["GOOGL", "$135.58", "+0.58%"],
      ["AMZN", "$310.31", "+0.31%"],
      ["TSLA", "$705.05", "-1.05%"],
      ["NVDA", "$220.11", "+2.11%"],
      ["META", "$250.00", "-0.44%"],
    ];
    stocks.forEach(([symbol, price, change]) => {
      const item = stockList.createEl("li", { cls: "stock-item" });
      item.createSpan({ text: symbol });
      item.createSpan({ text: price, cls: "stock-price" });
      item.createSpan({ text: change, cls: "stock-change" });
    });
    initTicker(container);
  }

  async onClose() {
    // clean up if needed
  }
}

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('rss', 'Open my Panel', () => {
			// Called when the user clicks the icon.
			const leaf = this.app.workspace.getLeaf(true);
			leaf.setViewState({type: VIEW_TYPE_MY_PANEL, active: true});
			this.app.workspace.revealLeaf(leaf);
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');
		this.registerView(VIEW_TYPE_MY_PANEL, (leaf) => new MyPanelView(leaf));

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-my-panel',
			name: 'Open my Panel',
			callback: () => {
				const leaf = this.app.workspace.getLeaf(true);
				leaf.setViewState({type: VIEW_TYPE_MY_PANEL, active: true});
				this.app.workspace.revealLeaf(leaf);
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample editor command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new MyPanelView(this.app.workspace.getLeaf(true));
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			new Notice("Click");
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
