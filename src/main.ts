import {App, Editor, MarkdownView, Modal, Notice, Plugin, ItemView, WorkspaceLeaf, setIcon} from 'obsidian';
import {
  DEFAULT_SETTINGS,
  GlobalTickerSettings,
  GlobalTickerSettingTab,
  TickerDirection,
  TickerDisplayMode,
  TickerSpeed,
} from "./settings";
import { applyTickerSpeed, initTicker } from "./ticker";
import { fetchCurrentsHeadlines } from "./api/news";
import { fetchFinnhubStockQuotes, normalizeStockSymbols, StockQuote } from "./api/stocks";

// Constants related to ticker cloning logic
const VIEW_TYPE_MY_PANEL = "global-ticker-panel";
interface HeadlineItem {
  title: string;
  url?: string;
  source?: string;
  category?: string | string[];
}

// Cache lifetime
const HEADLINE_CACHE_TTL_MS = 12 * 60 * 60 * 1000; 
const STOCK_CACHE_TTL_MS = 60 * 1000;

// Ticker fallbacks for fetch failures or missing API keys
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

// Cleans up and standarizes domains entered by the user, settings for news API requests
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

// Normalizes different headline and formats into a consistent structure used internally
const normalizeHeadlineItem = (item: unknown): HeadlineItem | null => {
  if (!item) {
    return null;
  }

  if (typeof item === "string") {
    const title = item.trim();
    return title ? { title } : null;
  }

  if (typeof item === "object") {
    const record = item as {
      title?: unknown;
      url?: unknown;
      source?: unknown;
      category?: unknown;
    };
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!title) {
      return null;
    }
    const url = typeof record.url === "string" ? record.url.trim() : undefined;
    const source =
      typeof record.source === "string" ? record.source.trim() : undefined;
    const category = Array.isArray(record.category)
      ? record.category
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
      : typeof record.category === "string"
        ? record.category.trim()
        : undefined;
    return {
      title,
      ...(url ? { url } : {}),
      ...(source ? { source } : {}),
      ...(category && (Array.isArray(category) ? category.length > 0 : category)
        ? { category }
        : {}),
    };
  }

  return null;
};

// Gets source field, if not available tries to extract domain from url, if that fails returns null
const getSourceLabel = (headline: HeadlineItem): string | null => {
  const source = headline.source?.trim();
  if (source) {
    return source;
  }
  const url = headline.url?.trim();
  if (!url) {
    return null;
  }
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname || null;
  } catch {
    return null;
  }
};

// Gets category field, if it's an array returns the first non-empty value
// If it's a string returns it if non-empty, otherwise returns null
const getCategoryLabel = (headline: HeadlineItem): string | null => {
  const { category } = headline;
  if (!category) {
    return null;
  }
  if (Array.isArray(category)) {
    const first = category.find((value) => value.trim().length > 0);
    return first ?? null;
  }
  const trimmed = category.trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Formats a number as a price string, or "N/A" if undefined
const formatPrice = (value?: number): string =>
  value === undefined ? "N/A" : `$${value.toFixed(2)}`;

const formatChange = (value?: number): string => {
  if (value === undefined) {
    return "N/A";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

// Formats the timestamp of the footer
const formatLastRefreshed = (
  timestamp?: number | null,
  useUsDateFormat?: boolean
): string => {
  if (!timestamp) {
    return "Last refreshed: ---";
  }
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const formatted = useUsDateFormat
    ? `${month}/${day}/${year}`
    : `${day}/${month}/${year}`;
  return `Last refreshed: ${formatted} ${hours}:${minutes}`;
};

// Transforms a StockQuote into the format needed for display in the ticker
// Also determines if the change is negative for coloring purposes
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

// Cache for headlines
interface HeadlinesCache {
  cacheKey: string;
  fetchedAt: number;
  headlines: HeadlineItem[];
}

// Data structure for plugin storage, currently stores settings and headlines cache
interface PluginData {
  settings?: Partial<GlobalTickerSettings>;
  headlinesCache?: HeadlinesCache | null;
}

// The main view class for the panel
class MyPanelView extends ItemView {

  private plugin: GlobalTicker;

  private newsSpeed: TickerSpeed;
  private stockSpeed: TickerSpeed;

  private newsDirection: TickerDirection;
  private stockDirection: TickerDirection;

  private stockPriceColor: string;
  private stockChangeColor: string;
  private stockChangeNegativeColor: string;
  
  private stockSectionEl?: HTMLElement;
  private newsSectionEl?: HTMLElement;
  
  private stockFooterGroupEl?: HTMLElement;
  private newsFooterGroupEl?: HTMLElement;

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

  // Update ticker settings
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

  // Update stock color settings
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
  
  // Apply ticker settings to the scrollers
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
  
  // Apply settings to a single scroller element
  private applyScrollerSettings(
    scroller: HTMLElement,
    speed: TickerSpeed,
    direction: TickerDirection
  ) {
    scroller.setAttribute("data-speed", speed);
    scroller.setAttribute("data-direction", direction);
    applyTickerSpeed(scroller);
  }

  // Load headlines into the provided list element
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
        item.createSpan({ text: headline.title, cls: "headline-text" });
      }
      if (this.plugin.settings.showHeadlineMeta) {
        const metaItems = [
          getSourceLabel(headline),
          getCategoryLabel(headline),
        ].filter((value): value is string => Boolean(value));

        if (metaItems.length > 0) {
          const metaList = item.createEl("ul", { cls: "headline-meta" });
          metaItems.forEach((meta) => {
            metaList.createEl("li", { text: meta });
          });
        }
      }
    });
  }

  // Apply stock color variables to the stock ticker
  private applyColorVars() {
    this.setColorVar("--stock-price-color", this.stockPriceColor);
    this.setColorVar("--stock-change-color", this.stockChangeColor);
    this.setColorVar(
      "--stock-change-negative-color",
      this.stockChangeNegativeColor
    );
  }
  
  // Set a CSS variable for stock colors
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

  // Icon for the sidebar/panel
  getIcon() {
	return "rss";
  }

  // Title that appears on the panel
  getDisplayText() {
    return "Global Ticker";
  }

  // Render the news ticker section
  // Applies headlines, speed and direction settings
  private async renderNewsSection(section: HTMLElement) {
    section.empty();
    const scroller = section.createDiv({ cls: "scroller" });
    scroller.setAttribute("data-ticker", "news");
    scroller.setAttribute("data-speed", this.newsSpeed);
    scroller.setAttribute("data-direction", this.newsDirection);

    const list = scroller.createEl("ul", { cls: ["tag-list", "scroller__inner"] });
    await this.loadHeadlines(list);
  }

  // Render the stocks ticker section
  // Applies stock data, speed, direction and color settings
  private async renderStocksSection(section: HTMLElement): Promise<number | null> {
    section.empty();
    const stockScroller = section.createDiv({ cls: "scroller" });
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

    this.applyColorVars();
    return lastRefreshedAt;
  }

  // Footers, both have the same logic but are separated to allow independent toggling
  // Render the footer for the news ticker
  private renderNewsFooter(group: HTMLElement) {
    group.empty();
    group.createDiv({ cls: "ticker-divider" });

    if (!this.plugin.settings.showNewsFooter) {
      return;
    }

    const newsFooter = group.createDiv({ cls: "ticker-footer" });
    newsFooter.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(
        this.plugin.getHeadlinesLastRefreshedAt(),
        this.plugin.settings.useUsDateFormat
      ),
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

    group.createDiv({ cls: "ticker-divider" });
  }

  // Render the footer for the stocks ticker
  private renderStockFooter(group: HTMLElement, lastRefreshedAt: number | null) {
    group.empty();

    if (!this.plugin.settings.showStockFooter) {
      return;
    }

    group.createDiv({ cls: "ticker-divider" });
    const stockFooter = group.createDiv({ cls: "ticker-footer" });
    stockFooter.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(
        lastRefreshedAt,
        this.plugin.settings.useUsDateFormat
      ),
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
  }

  // Main render function that sets up the sections based on display mode
  // Display mode can be news only, stocks only or both, and the layout adjusts accordingly
  private async render() {
    const container = this.containerEl; // main content area
    container.empty();
    const displayMode: TickerDisplayMode =
      this.plugin.settings.tickerDisplayMode ?? "both";
    const showNews = displayMode !== "stocks";
    const showStocks = displayMode !== "news";

    this.newsSectionEl = showNews
      ? container.createDiv({ cls: "news-section" })
      : undefined;
    this.newsFooterGroupEl = showNews
      ? container.createDiv({ cls: "ticker-footer-group" })
      : undefined;
    this.stockSectionEl = showStocks
      ? container.createDiv({ cls: "stock-section" })
      : undefined;
    this.stockFooterGroupEl = showStocks
      ? container.createDiv({ cls: "ticker-footer-group" })
      : undefined;

    if (showNews && this.newsSectionEl && this.newsFooterGroupEl) {
      await this.renderNewsSection(this.newsSectionEl);
      this.renderNewsFooter(this.newsFooterGroupEl);
    }

    if (showStocks && this.stockSectionEl && this.stockFooterGroupEl) {
      const stockLastRefreshedAt = await this.renderStocksSection(
        this.stockSectionEl
      );
      this.renderStockFooter(this.stockFooterGroupEl, stockLastRefreshedAt);
    }
    initTicker(container);
  }

  async onOpen() {
    await this.render();
  }

  async refresh() {
    await this.render();
  }

  // Refresh headlines section, re-fetches headlines and updates the section
  async refreshHeadlines() {
    const displayMode: TickerDisplayMode =
      this.plugin.settings.tickerDisplayMode ?? "both";
    if (displayMode === "stocks") {
      return;
    }
    if (!this.newsSectionEl) {
      await this.render();
      return;
    }
    await this.renderNewsSection(this.newsSectionEl);
    if (this.newsFooterGroupEl) {
      this.renderNewsFooter(this.newsFooterGroupEl);
    }
    initTicker(this.newsSectionEl);
  }

  // Refresh stocks section, re-fetches stock quotes and updates the section
  async refreshStocks() {
    const displayMode: TickerDisplayMode =
      this.plugin.settings.tickerDisplayMode ?? "both";
    if (displayMode === "news") {
      return;
    }
    if (!this.stockSectionEl) {
      await this.render();
      return;
    }
    const stockLastRefreshedAt = await this.renderStocksSection(this.stockSectionEl);
    if (this.stockFooterGroupEl) {
      this.renderStockFooter(this.stockFooterGroupEl, stockLastRefreshedAt);
    }
    initTicker(this.stockSectionEl);
  }
}

// Main plugin class that Obsidian interacts with, handles loading, settings, commands and data fetching/caching
export default class GlobalTicker extends Plugin {

	settings: GlobalTickerSettings;
	private headlinesCache: HeadlinesCache | null = null; 
	private stockQuotesCache: { cacheKey: string; fetchedAt: number; quotes: StockQuote[] } | null = null;
  private missingSecretNotices = new Set<string>(); 

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('rss', 'Open Global Ticker', () => {
			// Called when the user clicks the icon.
			const leaf = this.app.workspace.getLeaf(true);
			leaf.setViewState({type: VIEW_TYPE_MY_PANEL, active: true});
			this.app.workspace.revealLeaf(leaf);
		});

		// This adds a view to the workspace, which can be opened via the command palette, ribbon icon, or programmatically.
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
			id: 'open-global-ticker-panel',
			name: 'Open Global Ticker Panel',
			callback: () => {
				const leaf = this.app.workspace.getLeaf(true);
				leaf.setViewState({type: VIEW_TYPE_MY_PANEL, active: true});
				this.app.workspace.revealLeaf(leaf);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GlobalTickerSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.refreshOnAppOpen) {
				void this.refreshOnAppOpen();
			}
		});
	}

	onunload() {
	}
  // Fetches the value of a secret from Obsidian's SecretStorage
  private async getSecretValue(secretName: string): Promise<string> {
    const trimmed = secretName.trim();
    if (!trimmed) {
      return "";
    }
    const storage =
      this.app.secretStorage ??
      (this.app as unknown as { secrets?: { get?: unknown } }).secrets ??
      (this.app as unknown as { vault?: { secretStorage?: { get?: unknown } } })
        .vault?.secretStorage ??
      (this.app as unknown as { vault?: { secrets?: { get?: unknown } } }).vault
        ?.secrets;
    const storageWithGet = storage as {
      get?: (key: string) => unknown;
      getSecret?: (key: string) => unknown;
    };
    const getter = storageWithGet.get ?? storageWithGet.getSecret;
    if (!getter) {
      return "";
    }
    const value = getter.call(storage, trimmed) as
      | string
      | null
      | Promise<string | null>;
    const resolved =
      value && typeof (value as Promise<string | null>).then === "function"
        ? await value
        : value;
    if (typeof resolved === "string") {
      return resolved.trim();
    }
    if (resolved && typeof resolved === "object") {
      const record = resolved as { value?: unknown; secret?: unknown };
      if (typeof record.value === "string") {
        return record.value.trim();
      }
      if (typeof record.secret === "string") {
        return record.secret.trim();
      }
    }
    return "";
  }
  
  // Fetches the API keys from secret storage
  private async getCurrentsApiKey(): Promise<string> {
    return this.getSecretValue(this.settings.currentsApiKey);
  }

  private async getFinnhubApiKey(): Promise<string> {
    return this.getSecretValue(this.settings.finnhubApiKey);
  }

  // Notifies the user if a secret is missing, but only once per secret to avoid spamming
  private notifyMissingSecret(
    providerLabel: "Currents" | "Finnhub",
    secretName: string
  ) {
    const trimmed = secretName.trim();
    if (!trimmed) {
      return;
    }
    const noticeKey = `${providerLabel}:${trimmed}`;
    if (this.missingSecretNotices.has(noticeKey)) {
      return;
    }
    this.missingSecretNotices.add(noticeKey);
    new Notice(
      `${providerLabel} secret "${trimmed}" not found. Re-select it in Settings.`
    );
  }

  // Builds a cache key for the headlines based on the current settings, used to determine if cached data can be reused
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

  // Fetches headlines from the Currents API based on the current settings and resolved limit
  // The settings here are used to build the request parameters
  private async fetchHeadlinesFromApi(resolvedLimit: number): Promise<HeadlineItem[]> {
    const apiKey = await this.getCurrentsApiKey();
    if (!apiKey) {
      this.notifyMissingSecret("Currents", this.settings.currentsApiKey);
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

    // Handle multiple domains by fetching separately and merging results
		if (domains.length > 0) {
			const startDate = new Date(Date.now() - HEADLINE_CACHE_TTL_MS).toISOString();
			const collected: HeadlineItem[] = [];
			const seen = new Set<string>();

      // Merge results from multiple domain requests
      // Respects the overall limit and avoids duplicates based on title and url
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
						source: item.source,
						category: item.category,
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

    // Get headlines without domain filtering if no domains specified
		const results = await fetchCurrentsHeadlines({
			...baseOptions,
			endpoint: "latest-news",
		});

    // Normalize and filter results into the consistent internal format, also filter out any items that don't have a valid title after normalization
		const headlines = results
			.map((item) =>
					normalizeHeadlineItem({
						title: item.title,
						url: item.url,
						source: item.source,
						category: item.category,
					})
			)
			.filter((item): item is HeadlineItem => Boolean(item));

		return headlines;
  }

  // Saves plugin data: settings and headlines cache
	private async savePluginData() {
		await this.saveData({
			settings: this.settings,
			headlinesCache: this.headlinesCache,
		});
	}

  // Builds a cache key for stock quotes based on the list of symbols
  // Used to determine if cached data can be reused
	private buildStockCacheKey(symbols: string[]) {
		return JSON.stringify({ symbols });
	}

	private async fetchStockQuotesFromApi(symbols: string[]): Promise<StockQuote[]> {
		const apiKey = await this.getFinnhubApiKey();
		if (!apiKey) {
      this.notifyMissingSecret("Finnhub", this.settings.finnhubApiKey);
			return [];
		}

		console.log("Fetching stock quotes from Finnhub");

		return fetchFinnhubStockQuotes({
			apiKey,
			symbols,
		});
	}

  // Main function to get headlines, handles caching logic and fallback scenarios
  // The fallback scenario occurs if no API key is provided or if the fetch fails
  async getHeadlines(
    options?: { forceRefresh?: boolean; showNotice?: boolean }
  ): Promise<HeadlineItem[]> {
    const resolvedLimit = Number.isFinite(this.settings.currentsLimit)
      ? Math.min(50, Math.max(1, Math.floor(this.settings.currentsLimit)))
      : 3;
    const currentsApiKey = await this.getCurrentsApiKey();
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
      (cacheHasUrls || !currentsApiKey);
    if (!forceRefresh && cacheUsable && cache?.headlines.length) {
      return cache.headlines.slice(0, resolvedLimit);
    }

    if (!currentsApiKey) {
      this.notifyMissingSecret("Currents", this.settings.currentsApiKey);
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

  // Refresh headlines section, clears cache and re-fetches data, then updates all open panels
	async refreshHeadlines() {
    const resolvedLimit = Number.isFinite(this.settings.currentsLimit)
      ? Math.min(50, Math.max(1, Math.floor(this.settings.currentsLimit)))
      : 3;
    const cacheKey = this.buildHeadlinesCacheKey(resolvedLimit);
    let refreshed = false;

    try {
      const headlines = await this.fetchHeadlinesFromApi(resolvedLimit);
      if (headlines.length > 0) {
        this.headlinesCache = {
          cacheKey,
          fetchedAt: Date.now(),
          headlines,
        };
        await this.savePluginData();
        refreshed = true;
      }
    } catch (error) {
      console.error("Failed to fetch Currents headlines", error);
      new Notice("Failed to fetch Currents headlines. Showing cached items.");
    }
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		await Promise.all(
			leaves.map(async (leaf) => {
				const view = leaf.view;
				if (view instanceof MyPanelView) {
					await view.refreshHeadlines();
				}
			})
		);
    return refreshed;
	}

  // Main function to get stock quotes, handles caching logic and fallback scenarios
  // The fallback scenario occurs if no API key is provided or if the fetch fails
	async getStockQuotes(options?: { forceRefresh?: boolean }): Promise<StockQuote[]> {
		const symbols = normalizeStockSymbols(this.settings.finnhubSymbols);
		if (symbols.length === 0) {
			return [];
		}

		const apiKey = await this.getFinnhubApiKey();
		if (!apiKey) {
      this.notifyMissingSecret("Finnhub", this.settings.finnhubApiKey);
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

  // Refresh stocks section, clears cache and re-fetches data, then updates all open panels
	async refreshStocks() {
		this.stockQuotesCache = null;
    const symbols = normalizeStockSymbols(this.settings.finnhubSymbols);
    if (symbols.length === 0) {
      return false;
    }

    const cacheKey = this.buildStockCacheKey(symbols);
    let refreshed = false;
    try {
      const quotes = await this.fetchStockQuotesFromApi(symbols);
      if (quotes.length > 0) {
        this.stockQuotesCache = {
          cacheKey,
          fetchedAt: Date.now(),
          quotes,
        };
        refreshed = true;
      }
    } catch (error) {
      console.error("Failed to fetch Finnhub stock quotes", error);
    }
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		await Promise.all(
			leaves.map(async (leaf) => {
				const view = leaf.view;
				if (view instanceof MyPanelView) {
					await view.refreshStocks();
				}
			})
		);
    return refreshed;
	}

  // Refreshes all open panels, re-rendering their content
	async refreshPanels() {
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

  // If the setting is enabled, refreshes headlines and stocks when the app is opened
	private async refreshOnAppOpen() {
		try {
			await this.getHeadlines({ forceRefresh: true, showNotice: false });
		} catch (error) {
			console.error("Failed to refresh headlines on app open", error);
		}

		try {
			await this.getStockQuotes({ forceRefresh: true });
		} catch (error) {
			console.error("Failed to refresh stocks on app open", error);
		}

		await this.refreshPanels();
	}

  // Gets the timestamp of the last successful headlines fetch, or null if no data
	getHeadlinesLastRefreshedAt(): number | null {
		return this.headlinesCache?.fetchedAt ?? null;
	}

 // Gets the timestamp of the last successful stock quotes fetch, or null if no data
	getStockLastRefreshedAt(): number | null {
		return this.stockQuotesCache?.fetchedAt ?? null;
	}

  // Updates ticker settings (speed and direction) for all open panels
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

  // Updates ticker color settings for all open panels
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

  // Loads settings and headlines cache from plugin data storage
	async loadSettings() {
		const data = await this.loadData();
		if (data && typeof data === "object" && "settings" in data) {
			const typedData = data as PluginData;
			const mergedSettings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				typedData.settings ?? {}
			);
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
		this.settings = mergedSettings;
		this.headlinesCache = null;
	}

	async saveSettings() {
		await this.savePluginData();
	}
}
