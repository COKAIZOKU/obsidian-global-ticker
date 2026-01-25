import {App, Editor, MarkdownView, Modal, Notice, Plugin, ItemView, WorkspaceLeaf} from 'obsidian';
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab, TickerSpeed} from "./settings";
import { initTicker } from "./ticker";
import { fetchCurrentsHeadlines } from "./newsapi";

const VIEW_TYPE_MY_PANEL = "my-plugin-panel";
interface HeadlineItem {
  title: string;
  url?: string;
}

const HEADLINE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // the cache lifetime is 24 hours
const FALLBACK_HEADLINES: HeadlineItem[] = [
  { title: "Sample Headline 1: Please Add Your API Key" },
  { title: "Sample Headline 2: To Fetch Live News" },
  { title: "Sample Headline 3: And Actually Get News" },
  { title: "Sample Headline 4: These Are Just Placeholder!" },
];

const normalizeHeadlineItem = (item: unknown): HeadlineItem | null => {
  if (!item) {
    return null;
  }

  if (typeof item === "string") {
    const title = item.trim();
    return title ? { title } : null;
  }

  if (typeof item === "object") {
    const record = item as { title?: unknown; url?: unknown };
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) {
      return null;
    }
    const url = typeof record.url === "string" ? record.url.trim() : undefined;
    return url ? { title, url } : { title };
  }

  return null;
};

interface HeadlinesCache {
  cacheKey: string;
  fetchedAt: number;
  headlines: HeadlineItem[];
}

interface PluginData {
  settings?: Partial<MyPluginSettings>;
  headlinesCache?: HeadlinesCache | null;
}

class MyPanelView extends ItemView {
  private plugin: MyPlugin;
  private speed: TickerSpeed;
  private stockChangeColor: string;
  private stockPriceColor: string;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: MyPlugin,
    speed: TickerSpeed,
    stockPriceColor: string,
    stockChangeColor: string
  ) {
    super(leaf);
    this.plugin = plugin;
    this.speed = speed;
    this.stockPriceColor = stockPriceColor;
    this.stockChangeColor = stockChangeColor;
  }

  setSpeed(speed: TickerSpeed) {
    this.speed = speed;
    const scrollers = this.containerEl.querySelectorAll<HTMLElement>(".scroller");
    scrollers.forEach((scroller) => {
      scroller.setAttribute("data-speed", speed);
    });
  }

  setStockColors(stockPriceColor: string, stockChangeColor: string) {
    this.stockPriceColor = stockPriceColor;
    this.stockChangeColor = stockChangeColor;
    this.applyColorVars();
  }

  private async loadHeadlines(list: HTMLUListElement) {
    const headlines = await this.plugin.getHeadlines();
    list.empty();
    headlines.forEach((headline) => {
      const item = list.createEl("li", { cls: "headline-item" });
      const trimmedUrl = headline.url?.trim();
      if (trimmedUrl) {
        item.createEl("a", {
          text: headline.title,
          href: trimmedUrl,
          cls: "headline-link",
          attr: { target: "_blank", rel: "noopener" },
        });
      } else {
        item.setText(headline.title);
      }
    });
  }

  private applyColorVars() {
    this.setColorVar("--stock-price-color", this.stockPriceColor);
    this.setColorVar("--stock-change-color", this.stockChangeColor);
  }

  private setColorVar(name: string, value: string) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      this.containerEl.style.setProperty(name, trimmed);
    } else {
      this.containerEl.style.removeProperty(name);
    }
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

  private async render() {
    const container = this.containerEl; // main content area
    container.empty();
    const scroller = container.createDiv({ cls: "scroller" });
    scroller.setAttribute("data-speed", this.speed);

    const list = scroller.createEl("ul", { cls: ["tag-list", "scroller__inner"] });
    await this.loadHeadlines(list);

    const stockScroller = container.createDiv({ cls: "scroller" });
    stockScroller.setAttribute("data-speed", this.speed);

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
    this.applyColorVars();
    initTicker(container);
  }

  async onOpen() {
    await this.render();
  }

  async refresh() {
    await this.render();
  }

  async onClose() {
    // clean up if needed
  }
}

// Remember to rename these classes and interfaces!

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private headlinesCache: HeadlinesCache | null = null;

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
		this.registerView(
			VIEW_TYPE_MY_PANEL,
			(leaf) =>
				new MyPanelView(
					leaf,
					this,
					this.settings.tickerSpeed,
					this.settings.stockPriceColor,
					this.settings.stockChangeColor
				)
		);

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
						new MyPanelView(
							this.app.workspace.getLeaf(true),
							this,
							this.settings.tickerSpeed,
							this.settings.stockPriceColor,
							this.settings.stockChangeColor
						);
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	private buildHeadlinesCacheKey(resolvedLimit: number) {
		return JSON.stringify({
			category: this.settings.currentsCategory.trim(),
			region: this.settings.currentsRegion.trim(),
			language: this.settings.currentsLanguage.trim(),
			limit: resolvedLimit,
		});
	}

  private async fetchHeadlinesFromApi(resolvedLimit: number): Promise<HeadlineItem[]> {
    const apiKey = this.settings.currentsApiKey.trim();
    if (!apiKey) {
      return [];
		}

		const category = this.settings.currentsCategory.trim();
		const region = this.settings.currentsRegion.trim();
		const language = this.settings.currentsLanguage.trim();

		const results = await fetchCurrentsHeadlines({
			apiKey,
			endpoint: "latest-news",
			limit: resolvedLimit,
			category: category.length > 0 ? category : undefined,
			country: region.length > 0 ? region : undefined,
			language: language.length > 0 ? language : undefined,
		});

    const headlines = results
      .map((item) => normalizeHeadlineItem({ title: item.title, url: item.url }))
      .filter((item): item is HeadlineItem => Boolean(item));

    return headlines;
  }

	private async savePluginData() {
		await this.saveData({
			settings: this.settings,
			headlinesCache: this.headlinesCache,
		});
	}

  async getHeadlines(
    options?: { forceRefresh?: boolean; showNotice?: boolean }
  ): Promise<HeadlineItem[]> {
    const resolvedLimit = Number.isFinite(this.settings.currentsLimit)
      ? Math.min(50, Math.max(1, Math.floor(this.settings.currentsLimit)))
      : 3;
		const cacheKey = this.buildHeadlinesCacheKey(resolvedLimit);
		const cache = this.headlinesCache;
		const cacheMatches = cache?.cacheKey === cacheKey;
		const cacheAge = cache ? Date.now() - cache.fetchedAt : Number.POSITIVE_INFINITY;
		const cacheFresh = cacheMatches && cacheAge < HEADLINE_CACHE_TTL_MS;
		const forceRefresh = options?.forceRefresh ?? false;
		const showNotice = options?.showNotice ?? true;
    const cacheHasUrls = Boolean(
      cache?.headlines?.some(
        (headline) => headline.url && headline.url.trim().length > 0
      )
    );
    const cacheUsable =
      cacheFresh &&
      Boolean(cache?.headlines.length) &&
      (cacheHasUrls || !this.settings.currentsApiKey.trim());
    if (!forceRefresh && cacheUsable && cache?.headlines.length) {
      return cache.headlines.slice(0, resolvedLimit);
    }

    if (!this.settings.currentsApiKey.trim()) {
      return FALLBACK_HEADLINES.slice(0, resolvedLimit);
		}

    try {
      const headlines = await this.fetchHeadlinesFromApi(resolvedLimit);
      if (headlines.length > 0) {
        this.headlinesCache = {
          cacheKey,
          fetchedAt: Date.now(),
          headlines,
        };
        await this.savePluginData();
        return headlines.slice(0, resolvedLimit);
      }
		} catch (error) {
			console.error("Failed to fetch Currents headlines", error);
			if (showNotice) {
				new Notice("Failed to fetch Currents headlines. Showing cached items.");
			}
		}

		if (cacheMatches && cache?.headlines.length) {
			return cache.headlines.slice(0, resolvedLimit);
		}

		if (showNotice) {
			new Notice("No cached headlines available. Showing sample items.");
		}
		return FALLBACK_HEADLINES.slice(0, resolvedLimit);
	}

	async refreshHeadlines() {
		await this.getHeadlines({ forceRefresh: true, showNotice: true });
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		await Promise.all(
			leaves.map(async (leaf) => {
				const view = leaf.view;
				if (view instanceof MyPanelView) {
					await view.refresh();
				}
			})
		);
	}

	updateTickerSpeed() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		leaves.forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof MyPanelView) {
				view.setSpeed(this.settings.tickerSpeed);
			}
		});
	}

	updateTickerColors() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		leaves.forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof MyPanelView) {
				view.setStockColors(
					this.settings.stockPriceColor,
					this.settings.stockChangeColor
				);
			}
		});
	}

	async loadSettings() {
		const data = await this.loadData();
		if (data && typeof data === "object" && "settings" in data) {
			const typedData = data as PluginData;
			this.settings = Object.assign({}, DEFAULT_SETTINGS, typedData.settings ?? {});
			this.headlinesCache = typedData.headlinesCache ?? null;
      if (this.headlinesCache && Array.isArray(this.headlinesCache.headlines)) {
        const normalized = this.headlinesCache.headlines
          .map((item) => normalizeHeadlineItem(item))
          .filter((item): item is HeadlineItem => Boolean(item));
        const { cacheKey, fetchedAt } = this.headlinesCache;
        this.headlinesCache = {
          cacheKey,
          fetchedAt,
          headlines: normalized,
        };
      }
			return;
		}

		this.settings = Object.assign({}, DEFAULT_SETTINGS, data as Partial<MyPluginSettings>);
		this.headlinesCache = null;
	}

	async saveSettings() {
		await this.savePluginData();
	}
}
