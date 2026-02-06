import {App, Editor, MarkdownView, Modal, Notice, Plugin, ItemView, WorkspaceLeaf, setIcon} from 'obsidian';
import {DEFAULT_SETTINGS, GlobalTickerSettings, GlobalTickerSettingTab, TickerDirection, TickerSpeed} from "./settings";
import { applyTickerSpeed, initTicker } from "./ticker";
import { fetchCurrentsHeadlines } from "./api/news";
import { fetchFinnhubStockQuotes, normalizeStockSymbols, StockQuote } from "./api/stocks";

const VIEW_TYPE_MY_PANEL = "my-plugin-panel";
interface HeadlineItem {
  title: string;
  url?: string;
}

const HEADLINE_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // the cache lifetime is 24 hours
const STOCK_CACHE_TTL_MS = 60 * 1000;
const FALLBACK_HEADLINES: HeadlineItem[] = [
  { title: "Sample Headline 1: Please Add Your API Key" },
  { title: "Sample Headline 2: To Fetch Live News" },
  { title: "Sample Headline 3: And Actually Get News" },
  { title: "Sample Headline 4: These Are Just Placeholder!" },
];
const FALLBACK_STOCKS: Array<{
  symbol: string;
  priceText: string;
  changeText: string;
  isNegative: boolean;
}> = [
  { symbol: "ADD", priceText: "$YOUR.API", changeText: "+KEY%", isNegative: false },
  { symbol: "TO", priceText: "$SEE", changeText: "+STOCKS%", isNegative: false },
  { symbol: "GET", priceText: "$LIVE", changeText: "+DATA%", isNegative: false },
  { symbol: "STOCKS", priceText: "$HERE", changeText: "+NOW%", isNegative: false },
];

const normalizeDomains = (input: string): string[] => {
  if (!input) {
    return [];
  }

  return input
    .split(",")
    .map((raw: string) => raw.trim())
    .filter((value): value is string => value.length > 0)
    .map((raw: string) => {
      const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)
        ? raw
        : `https://${raw}`;
      try {
        const hostname = new URL(withScheme).hostname.toLowerCase();
        return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
      } catch {
        const fallback = raw.split(/[/?#]/)[0] ?? "";
        const normalized = fallback.toLowerCase();
        return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
      }
    })
    .filter(Boolean);
};

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

const formatPrice = (value?: number): string =>
  value === undefined ? "N/A" : `$${value.toFixed(2)}`;

const formatChange = (value?: number): string => {
  if (value === undefined) {
    return "N/A";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

const formatLastRefreshed = (timestamp?: number | null): string => {
  if (!timestamp) {
    return "Last refreshed: ---";
  }
  return `Last refreshed: ${new Date(timestamp).toLocaleString()}`;
};

const toStockDisplayItem = (quote: StockQuote): {
  symbol: string;
  priceText: string;
  changeText: string;
  isNegative: boolean;
} => ({
  symbol: quote.symbol,
  priceText: formatPrice(quote.price),
  changeText: formatChange(quote.changePercent),
  isNegative: (quote.changePercent ?? 0) < 0,
});

interface HeadlinesCache {
  cacheKey: string;
  fetchedAt: number;
  headlines: HeadlineItem[];
}

interface PluginData {
  settings?: Partial<GlobalTickerSettings>;
  headlinesCache?: HeadlinesCache | null;
}

interface LegacyAlpacaSettings {
  alpacaApiKey?: string;
  alpacaApiSecret?: string;
  alpacaSymbols?: string;
}

class MyPanelView extends ItemView {
  private plugin: GlobalTicker;
  private newsSpeed: TickerSpeed;
  private stockSpeed: TickerSpeed;
  private newsDirection: TickerDirection;
  private stockDirection: TickerDirection;
  private stockChangeColor: string;
  private stockChangeNegativeColor: string;
  private stockPriceColor: string;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: GlobalTicker,
    newsSpeed: TickerSpeed,
    stockSpeed: TickerSpeed,
    newsDirection: TickerDirection,
    stockDirection: TickerDirection,
    stockPriceColor: string,
    stockChangeColor: string,
    stockChangeNegativeColor: string
  ) {
    super(leaf);
    this.plugin = plugin;
    this.newsSpeed = newsSpeed;
    this.stockSpeed = stockSpeed;
    this.newsDirection = newsDirection;
    this.stockDirection = stockDirection;
    this.stockPriceColor = stockPriceColor;
    this.stockChangeColor = stockChangeColor;
    this.stockChangeNegativeColor = stockChangeNegativeColor;
  }

  setTickerSettings(
    newsSpeed: TickerSpeed,
    stockSpeed: TickerSpeed,
    newsDirection: TickerDirection,
    stockDirection: TickerDirection
  ) {
    this.newsSpeed = newsSpeed;
    this.stockSpeed = stockSpeed;
    this.newsDirection = newsDirection;
    this.stockDirection = stockDirection;
    this.applyTickerSettings();
  }

  setStockColors(
    stockPriceColor: string,
    stockChangeColor: string,
    stockChangeNegativeColor: string
  ) {
    this.stockPriceColor = stockPriceColor;
    this.stockChangeColor = stockChangeColor;
    this.stockChangeNegativeColor = stockChangeNegativeColor;
    this.applyColorVars();
  }

  private applyTickerSettings() {
    const newsScroller = this.containerEl.querySelector<HTMLElement>(
      '.scroller[data-ticker="news"]'
    );
    if (newsScroller) {
      this.applyScrollerSettings(newsScroller, this.newsSpeed, this.newsDirection);
    }

    const stockScroller = this.containerEl.querySelector<HTMLElement>(
      '.scroller[data-ticker="stock"]'
    );
    if (stockScroller) {
      this.applyScrollerSettings(
        stockScroller,
        this.stockSpeed,
        this.stockDirection
      );
    }
  }

  private applyScrollerSettings(
    scroller: HTMLElement,
    speed: TickerSpeed,
    direction: TickerDirection
  ) {
    scroller.setAttribute("data-speed", speed);
    scroller.setAttribute("data-direction", direction);
    applyTickerSpeed(scroller);
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
    this.setColorVar(
      "--stock-change-negative-color",
      this.stockChangeNegativeColor
    );
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
    scroller.setAttribute("data-ticker", "news");
    scroller.setAttribute("data-speed", this.newsSpeed);
    scroller.setAttribute("data-direction", this.newsDirection);

    const list = scroller.createEl("ul", { cls: ["tag-list", "scroller__inner"] });
    await this.loadHeadlines(list);

    container.createDiv({ cls: "ticker-divider" });
    const newsFooter = container.createDiv({ cls: "ticker-footer" });
    newsFooter.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(this.plugin.getHeadlinesLastRefreshedAt()),
    });
    const refreshNewsButton = newsFooter.createEl("button", {
      cls: ["clickable-icon", "ticker-refresh-button"],
      attr: {
        "aria-label": "Refresh headlines",
        type: "button",
        title: "Refresh headlines",
      },
    });
    setIcon(refreshNewsButton, "refresh-cw");
    refreshNewsButton.addEventListener("click", async () => {
      refreshNewsButton.disabled = true;
      try {
        await this.plugin.refreshHeadlines();
      } finally {
        refreshNewsButton.disabled = false;
      }
    });

    container.createDiv({ cls: "ticker-divider" });
    const stockScroller = container.createDiv({ cls: "scroller" });
    stockScroller.setAttribute("data-ticker", "stock");
    stockScroller.setAttribute("data-speed", this.stockSpeed);
    stockScroller.setAttribute("data-direction", this.stockDirection);

    const stockList = stockScroller.createEl("ul", { cls: ["tag-list", "scroller__inner", "stock-list"] });
    const quotes = await this.plugin.getStockQuotes();
    const stocks = quotes.length > 0
      ? quotes.map(toStockDisplayItem)
      : FALLBACK_STOCKS;
    const lastRefreshedAt =
      quotes.length > 0 ? this.plugin.getStockLastRefreshedAt() : null;

    stocks.forEach(({ symbol, priceText, changeText, isNegative }) => {
      const item = stockList.createEl("li", { cls: "stock-item" });
      item.createSpan({ text: symbol });
      item.createSpan({ text: priceText, cls: "stock-price" });
      const changeSpan = item.createSpan({ text: changeText, cls: "stock-change" });
      if (isNegative) {
        changeSpan.addClass("is-negative");
      }
    });

    container.createDiv({ cls: "ticker-divider" });
    const stockFooter = container.createDiv({ cls: "ticker-footer" });
    stockFooter.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(lastRefreshedAt),
    });
    const refreshButton = stockFooter.createEl("button", {
      cls: ["clickable-icon", "ticker-refresh-button"],
      attr: {
        "aria-label": "Refresh stock quotes",
        type: "button",
        title: "Refresh stock quotes",
      },
    });
    setIcon(refreshButton, "refresh-cw");
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      try {
        await this.plugin.refreshStocks();
      } finally {
        refreshButton.disabled = false;
      }
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

export default class GlobalTicker extends Plugin {
	settings: GlobalTickerSettings;
	private headlinesCache: HeadlinesCache | null = null;
	private stockQuotesCache: { cacheKey: string; fetchedAt: number; quotes: StockQuote[] } | null = null;

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
					this.settings.newsTickerSpeed,
					this.settings.stockTickerSpeed,
					this.settings.newsTickerDirection,
					this.settings.stockTickerDirection,
					this.settings.stockPriceColor,
					this.settings.stockChangeColor,
					this.settings.stockChangeNegativeColor
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
							this.settings.newsTickerSpeed,
							this.settings.stockTickerSpeed,
							this.settings.newsTickerDirection,
							this.settings.stockTickerDirection,
							this.settings.stockPriceColor,
							this.settings.stockChangeColor,
							this.settings.stockChangeNegativeColor
						);
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GlobalTickerSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

	}

	onunload() {
	}

	private buildHeadlinesCacheKey(resolvedLimit: number) {
		const domains = normalizeDomains(this.settings.currentsDomains).join(",");
		const excludedDomains = normalizeDomains(this.settings.currentsExcludeDomains).join(",");
		return JSON.stringify({
			category: this.settings.currentsCategory.trim(),
			region: this.settings.currentsRegion.trim(),
			language: this.settings.currentsLanguage.trim(),
			domains,
			excludedDomains,
			limit: resolvedLimit,
		});
	}

  private async fetchHeadlinesFromApi(resolvedLimit: number): Promise<HeadlineItem[]> {
    const apiKey = this.settings.currentsApiKey.trim();
    if (!apiKey) {
      return [];
		}

		console.log("Fetching news headlines from Currents API");

		const category = this.settings.currentsCategory.trim();
		const region = this.settings.currentsRegion.trim();
		const language = this.settings.currentsLanguage.trim();
		const domains = normalizeDomains(this.settings.currentsDomains);
		const excludedDomains = normalizeDomains(this.settings.currentsExcludeDomains);

		const baseOptions = {
			apiKey,
			limit: resolvedLimit,
			category: category.length > 0 ? category : undefined,
			country: region.length > 0 ? region : undefined,
			language: language.length > 0 ? language : undefined,
			params: excludedDomains.length > 0 ? { domain_not: excludedDomains } : undefined,
		};

		if (domains.length > 0) {
			const startDate = new Date(Date.now() - HEADLINE_CACHE_TTL_MS).toISOString();
			const collected: HeadlineItem[] = [];
			const seen = new Set<string>();

			for (const domain of domains) {
				const domainResults = await fetchCurrentsHeadlines({
					...baseOptions,
					endpoint: "search",
					params: {
						domain,
						start_date: startDate,
						limit: resolvedLimit,
						...(excludedDomains.length > 0 ? { domain_not: excludedDomains } : {}),
					},
				});

				domainResults.forEach((item) => {
					const normalized = normalizeHeadlineItem({
						title: item.title,
						url: item.url,
					});
					if (!normalized) {
						return;
					}
					const key = normalized.url ?? normalized.title;
					if (seen.has(key)) {
						return;
					}
					seen.add(key);
					collected.push(normalized);
				});

				if (collected.length >= resolvedLimit) {
					break;
				}
			}

			return collected.slice(0, resolvedLimit);
		}

		const results = await fetchCurrentsHeadlines({
			...baseOptions,
			endpoint: "latest-news",
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

	private buildStockCacheKey(symbols: string[]) {
		return JSON.stringify({ symbols });
	}

	private async fetchStockQuotesFromApi(symbols: string[]): Promise<StockQuote[]> {
		const apiKey = this.settings.finnhubApiKey.trim();
		if (!apiKey) {
			return [];
		}

		console.log("Fetching stock quotes from Finnhub");

		return fetchFinnhubStockQuotes({
			apiKey,
			symbols,
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

	async getStockQuotes(options?: { forceRefresh?: boolean }): Promise<StockQuote[]> {
		const symbols = normalizeStockSymbols(this.settings.finnhubSymbols);
		if (symbols.length === 0) {
			return [];
		}

		const apiKey = this.settings.finnhubApiKey.trim();
		if (!apiKey) {
			return [];
		}

		const cacheKey = this.buildStockCacheKey(symbols);
		const cache = this.stockQuotesCache;
		const cacheMatches = cache?.cacheKey === cacheKey;
		const cacheAge = cache ? Date.now() - cache.fetchedAt : Number.POSITIVE_INFINITY;
		const cacheFresh = cacheMatches && cacheAge < STOCK_CACHE_TTL_MS;
		const forceRefresh = options?.forceRefresh ?? false;

		if (!forceRefresh && cacheFresh && cache?.quotes.length) {
			return cache.quotes.slice(0, symbols.length);
		}

		try {
			const quotes = await this.fetchStockQuotesFromApi(symbols);
			if (quotes.length > 0) {
				this.stockQuotesCache = {
					cacheKey,
					fetchedAt: Date.now(),
					quotes,
				};
				return quotes.slice(0, symbols.length);
			}
		} catch (error) {
			console.error("Failed to fetch Finnhub stock quotes", error);
		}

		if (cacheMatches && cache?.quotes.length) {
			return cache.quotes.slice(0, symbols.length);
		}

		return [];
	}

	async refreshStocks() {
		this.stockQuotesCache = null;
		await this.getStockQuotes({ forceRefresh: true });
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

	getHeadlinesLastRefreshedAt(): number | null {
		return this.headlinesCache?.fetchedAt ?? null;
	}

	getStockLastRefreshedAt(): number | null {
		return this.stockQuotesCache?.fetchedAt ?? null;
	}

	updateTickerSettings() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		leaves.forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof MyPanelView) {
				view.setTickerSettings(
					this.settings.newsTickerSpeed,
					this.settings.stockTickerSpeed,
					this.settings.newsTickerDirection,
					this.settings.stockTickerDirection
				);
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
					this.settings.stockChangeColor,
					this.settings.stockChangeNegativeColor
				);
			}
		});
	}

	async loadSettings() {
		const data = await this.loadData();
		if (data && typeof data === "object" && "settings" in data) {
			const typedData = data as PluginData;
			const mergedSettings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				typedData.settings ?? {}
			);
			const legacyAlpaca = typedData.settings as LegacyAlpacaSettings | undefined;
			if (!mergedSettings.finnhubApiKey && legacyAlpaca?.alpacaApiKey) {
				mergedSettings.finnhubApiKey = legacyAlpaca.alpacaApiKey;
			}
			if (!mergedSettings.finnhubSymbols && legacyAlpaca?.alpacaSymbols) {
				mergedSettings.finnhubSymbols = legacyAlpaca.alpacaSymbols;
			}
			const legacyTickerSpeed = typedData.settings?.tickerSpeed;
			if (!typedData.settings?.newsTickerSpeed && legacyTickerSpeed) {
				mergedSettings.newsTickerSpeed = legacyTickerSpeed;
			}
			if (!typedData.settings?.stockTickerSpeed && legacyTickerSpeed) {
				mergedSettings.stockTickerSpeed = legacyTickerSpeed;
			}
			this.settings = mergedSettings;
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

		const rawSettings = data as Partial<GlobalTickerSettings>;
		const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, rawSettings);
		const legacyAlpaca = rawSettings as LegacyAlpacaSettings | undefined;
		if (!mergedSettings.finnhubApiKey && legacyAlpaca?.alpacaApiKey) {
			mergedSettings.finnhubApiKey = legacyAlpaca.alpacaApiKey;
		}
		if (!mergedSettings.finnhubSymbols && legacyAlpaca?.alpacaSymbols) {
			mergedSettings.finnhubSymbols = legacyAlpaca.alpacaSymbols;
		}
		const legacyTickerSpeed = rawSettings?.tickerSpeed;
		if (!rawSettings?.newsTickerSpeed && legacyTickerSpeed) {
			mergedSettings.newsTickerSpeed = legacyTickerSpeed;
		}
		if (!rawSettings?.stockTickerSpeed && legacyTickerSpeed) {
			mergedSettings.stockTickerSpeed = legacyTickerSpeed;
		}
		this.settings = mergedSettings;
		this.headlinesCache = null;
	}

	async saveSettings() {
		await this.savePluginData();
	}
}
