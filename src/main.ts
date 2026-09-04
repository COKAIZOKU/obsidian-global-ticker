import {Notice, Plugin, ItemView, WorkspaceLeaf, setIcon} from 'obsidian';
import {
  DEFAULT_SETTINGS,
  GlobalTickerSettings,
  GlobalTickerSettingTab,
  TickerDirection,
  TickerSpeed,
} from "./settings";
import { applyTickerSpeed, initTicker } from "./ticker";
import { fetchCurrentsHeadlines } from "./api/currents";
import { fetchFinnhubStockQuotes, normalizeStockSymbols, StockQuote } from "./api/finnhub";
import { fetchHackerNewsHeadlines } from "./rss/hacker-news";
import { fetchGoogleNewsHeadlines } from "./rss/google-news";

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

const toNonEmptyTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeHeadlineCategory = (value: unknown): string | string[] | undefined => {
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  return toNonEmptyTrimmedString(value);
};

// Normalizes different headline and formats into a consistent structure used internally
const normalizeHeadlineItem = (item: unknown): HeadlineItem | null => {
  if (!item) {
    return null;
  }

  if (typeof item === "string") {
    const title = toNonEmptyTrimmedString(item);
    return title ? { title } : null;
  }

  if (typeof item !== "object") {
    return null;
  }

  const record = item as {
    title?: unknown;
    url?: unknown;
    source?: unknown;
    category?: unknown;
  };

  const title = toNonEmptyTrimmedString(record.title);
  if (!title) {
    return null;
  }

  const normalized: HeadlineItem = { title };
  const url = toNonEmptyTrimmedString(record.url);
  const source = toNonEmptyTrimmedString(record.source);
  const category = normalizeHeadlineCategory(record.category);

  if (url) {
    normalized.url = url;
  }
  if (source) {
    normalized.source = source;
  }
  if (category) {
    normalized.category = category;
  }

  return normalized;
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

const pad2 = (value: number): string => (value < 10 ? `0${value}` : String(value));

// Formats the timestamp of the footer
const formatLastRefreshed = (
  timestamp?: number | null,
  useUsDateFormat?: boolean
): string => {
  if (!timestamp) {
    return "Last refreshed: ---";
  }
  const date = new Date(timestamp);
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = String(date.getFullYear()).slice(-2);
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
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

const normalizeStockQuoteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeStockQuoteItem = (item: unknown): StockQuote | null => {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as {
    symbol?: unknown;
    price?: unknown;
    changePercent?: unknown;
  };
  const symbol = typeof record.symbol === "string" ? record.symbol.trim() : "";
  if (!symbol) {
    return null;
  }
  const price = normalizeStockQuoteNumber(record.price);
  const changePercent = normalizeStockQuoteNumber(record.changePercent);
  const normalized: StockQuote = { symbol };
  if (price !== undefined) {
    normalized.price = price;
  }
  if (changePercent !== undefined) {
    normalized.changePercent = changePercent;
  }
  return normalized;
};

// Cache for headlines
interface HeadlinesCache {
  cacheKey: string;
  fetchedAt: number;
  headlines: HeadlineItem[];
}

interface StockQuotesCache {
	cacheKey: string;
	fetchedAt: number;
	quotes: StockQuote[];
}

interface HackerNewsCache {
  cacheKey: string;
  fetchedAt: number;
  headlines: HeadlineItem[];
}

interface GoogleNewsCache {
  cacheKey: string;
  fetchedAt: number;
  headlines: HeadlineItem[];
}

// Data structure for plugin storage, currently stores settings and headlines cache
interface PluginData {
  settings?: Partial<GlobalTickerSettings>;
  headlinesCache?: HeadlinesCache | null;
  stockQuotesCache?: StockQuotesCache | null;
}

interface LegacyTickerSettings {
  newsTickerSpeed?: TickerSpeed;
  stockTickerSpeed?: TickerSpeed;
  newsTickerDirection?: TickerDirection;
  stockTickerDirection?: TickerDirection;
  newsTextColor?: string;
  stockChangeColor?: string;
  stockChangeNegativeColor?: string;
  stockPriceColor?: string;
  tickerDisplayMode?: "both" | "news" | "stocks" | "currents" | "finnhub";
}

const normalizeSettings = (rawSettings: unknown): GlobalTickerSettings => {
  const raw = rawSettings && typeof rawSettings === "object"
    ? rawSettings as Record<string, unknown>
    : {};
  const legacy = raw as LegacyTickerSettings;
  const settings = Object.assign({}, DEFAULT_SETTINGS, raw) as GlobalTickerSettings;

  if (!("currentsTickerSpeed" in raw) && legacy.newsTickerSpeed) {
    settings.currentsTickerSpeed = legacy.newsTickerSpeed;
  }
  if (!("finnhubTickerSpeed" in raw) && legacy.stockTickerSpeed) {
    settings.finnhubTickerSpeed = legacy.stockTickerSpeed;
  }
  if (!("currentsTickerDirection" in raw) && legacy.newsTickerDirection) {
    settings.currentsTickerDirection = legacy.newsTickerDirection;
  }
  if (!("finnhubTickerDirection" in raw) && legacy.stockTickerDirection) {
    settings.finnhubTickerDirection = legacy.stockTickerDirection;
  }
  if (!("currentsTextColor" in raw) && legacy.newsTextColor !== undefined) {
    settings.currentsTextColor = legacy.newsTextColor;
  }
  if (!("finnhubChangeColor" in raw) && legacy.stockChangeColor !== undefined) {
    settings.finnhubChangeColor = legacy.stockChangeColor;
  }
  if (!("finnhubChangeNegativeColor" in raw) && legacy.stockChangeNegativeColor !== undefined) {
    settings.finnhubChangeNegativeColor = legacy.stockChangeNegativeColor;
  }
  if (!("finnhubPriceColor" in raw) && legacy.stockPriceColor !== undefined) {
    settings.finnhubPriceColor = legacy.stockPriceColor;
  }
  if (!("showCurrentsTicker" in raw)) {
    settings.showCurrentsTicker = legacy.tickerDisplayMode !== "stocks"
      && legacy.tickerDisplayMode !== "finnhub";
  }
  if (!("showFinnhubTicker" in raw)) {
    settings.showFinnhubTicker = legacy.tickerDisplayMode !== "news"
      && legacy.tickerDisplayMode !== "currents";
  }

  return settings;
};

// The main view class for the panel
class MyPanelView extends ItemView {

  private readonly plugin: GlobalTicker;

  private currentsSpeed: TickerSpeed;
  private finnhubSpeed: TickerSpeed;
  private hackerNewsSpeed: TickerSpeed;
  private googleNewsSpeed: TickerSpeed;

  private currentsDirection: TickerDirection;
  private finnhubDirection: TickerDirection;
  private hackerNewsDirection: TickerDirection;
  private googleNewsDirection: TickerDirection;

  private currentsTextColor: string;
  private finnhubPriceColor: string;
  private finnhubChangeColor: string;
  private finnhubChangeNegativeColor: string;
  
  private finnhubSectionEl?: HTMLElement;
  private currentsSectionEl?: HTMLElement;
  private hackerNewsSectionEl?: HTMLElement;
  private googleNewsSectionEl?: HTMLElement;
  
  private finnhubFooterGroupEl?: HTMLElement;
  private currentsFooterGroupEl?: HTMLElement;
  private hackerNewsFooterGroupEl?: HTMLElement;
  private googleNewsFooterGroupEl?: HTMLElement;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: GlobalTicker,
    currentsSpeed: TickerSpeed,
    finnhubSpeed: TickerSpeed,
    hackerNewsSpeed: TickerSpeed,
    googleNewsSpeed: TickerSpeed,
    currentsDirection: TickerDirection,
    finnhubDirection: TickerDirection,
    hackerNewsDirection: TickerDirection,
    googleNewsDirection: TickerDirection,
    currentsTextColor: string,
    finnhubPriceColor: string,
    finnhubChangeColor: string,
    finnhubChangeNegativeColor: string
  ) {
    super(leaf);
    this.plugin = plugin;
    this.currentsSpeed = currentsSpeed;
    this.finnhubSpeed = finnhubSpeed;
    this.hackerNewsSpeed = hackerNewsSpeed;
    this.googleNewsSpeed = googleNewsSpeed;
    this.currentsDirection = currentsDirection;
    this.finnhubDirection = finnhubDirection;
    this.hackerNewsDirection = hackerNewsDirection;
    this.googleNewsDirection = googleNewsDirection;
    this.currentsTextColor = currentsTextColor;
    this.finnhubPriceColor = finnhubPriceColor;
    this.finnhubChangeColor = finnhubChangeColor;
    this.finnhubChangeNegativeColor = finnhubChangeNegativeColor;
  }

  // Update ticker settings
  setTickerSettings(
    currentsSpeed: TickerSpeed,
    finnhubSpeed: TickerSpeed,
    hackerNewsSpeed: TickerSpeed,
    googleNewsSpeed: TickerSpeed,
    currentsDirection: TickerDirection,
    finnhubDirection: TickerDirection,
    hackerNewsDirection: TickerDirection,
    googleNewsDirection: TickerDirection
  ) {
    this.currentsSpeed = currentsSpeed;
    this.finnhubSpeed = finnhubSpeed;
    this.hackerNewsSpeed = hackerNewsSpeed;
    this.googleNewsSpeed = googleNewsSpeed;
    this.currentsDirection = currentsDirection;
    this.finnhubDirection = finnhubDirection;
    this.hackerNewsDirection = hackerNewsDirection;
    this.googleNewsDirection = googleNewsDirection;
    this.applyTickerSettings();
  }

  // Update stock color settings
  setTickerColors(
    currentsTextColor: string,
    finnhubPriceColor: string,
    finnhubChangeColor: string,
    finnhubChangeNegativeColor: string
  ) {
    this.currentsTextColor = currentsTextColor;
    this.finnhubPriceColor = finnhubPriceColor;
    this.finnhubChangeColor = finnhubChangeColor;
    this.finnhubChangeNegativeColor = finnhubChangeNegativeColor;
    this.applyColorVars();
  }
  
  // Apply ticker settings to the scrollers
  private applyTickerSettings() {
    const currentsScroller = this.containerEl.querySelector<HTMLElement>(
      '.scroller[data-ticker="currents"]'
    );
    if (currentsScroller) {
      this.applyScrollerSettings(currentsScroller, this.currentsSpeed, this.currentsDirection);
    }

    const finnhubScroller = this.containerEl.querySelector<HTMLElement>(
      '.scroller[data-ticker="finnhub"]'
    );
    if (finnhubScroller) {
      this.applyScrollerSettings(
        finnhubScroller,
        this.finnhubSpeed,
        this.finnhubDirection
      );
    }

    const hackerNewsScroller = this.containerEl.querySelector<HTMLElement>(
      '.scroller[data-ticker="hacker-news"]'
    );
    if (hackerNewsScroller) {
      this.applyScrollerSettings(
        hackerNewsScroller,
        this.hackerNewsSpeed,
        this.hackerNewsDirection
      );
    }

    const googleNewsScroller = this.containerEl.querySelector<HTMLElement>(
      '.scroller[data-ticker="google-news"]'
    );
    if (googleNewsScroller) {
      this.applyScrollerSettings(
        googleNewsScroller,
        this.googleNewsSpeed,
        this.googleNewsDirection
      );
    }
  }
  
  // Apply settings to a single scroller element
  private applyScrollerSettings(
    scroller: HTMLElement,
    speed: TickerSpeed,
    direction: TickerDirection
  ) {
    scroller.dataset.speed = speed;
    scroller.dataset.direction = direction;
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

  private async loadHackerNewsHeadlines(list: HTMLUListElement) {
    const headlines = await this.plugin.getHackerNewsHeadlines();
    const feedLabels = {
      frontpage: "front page",
      newest: "newest",
      ask: "ask hn",
      show: "show hn",
      jobs: "jobs",
      active: "active",
    };
    const feedLabel = feedLabels[this.plugin.settings.hackerNewsFeed];
    list.empty();
    headlines.forEach((headline) => {
      const item = list.createEl("li", { cls: "headline-item" });
      item.createEl("a", {
        text: headline.title,
        href: headline.url,
        cls: "headline-link",
        attr: { target: "_blank", rel: "noopener" },
      });
      const sourceLabel = getSourceLabel(headline);
      if (this.plugin.settings.showHeadlineMeta && sourceLabel) {
        const metaList = item.createEl("ul", { cls: "headline-meta" });
        metaList.createEl("li", { text: sourceLabel });
        metaList.createEl("li", { text: feedLabel });
      }
    });
  }

  private async loadGoogleNewsHeadlines(list: HTMLUListElement) {
    const headlines = await this.plugin.getGoogleNewsHeadlines();
    const topicLabel = this.plugin.settings.googleNewsTopic
      .toLowerCase()
      .replace("-", " ");
    list.empty();
    headlines.forEach(headline => {
      const item = list.createEl("li", { cls: "headline-item" });
      item.createEl("a", {
        text: headline.title,
        href: headline.url,
        cls: "headline-link",
        attr: { target: "_blank", rel: "noopener" },
      });
      if (this.plugin.settings.showHeadlineMeta && headline.source) {
        const metaList = item.createEl("ul", { cls: "headline-meta" });
        metaList.createEl("li", { text: headline.source.toLowerCase() });
        metaList.createEl("li", { text: topicLabel });
      }
    });
  }

  // Apply stock color variables to the stock ticker
  private applyColorVars() {
    this.setColorVar("--currents-text-color", this.currentsTextColor);
    this.setColorVar("--finnhub-price-color", this.finnhubPriceColor);
    this.setColorVar("--finnhub-change-color", this.finnhubChangeColor);
    this.setColorVar(
      "--finnhub-change-negative-color",
      this.finnhubChangeNegativeColor
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
    return "Global ticker";
  }

  // Render the news ticker section
  // Applies headlines, speed and direction settings
  private async renderCurrentsSection(section: HTMLElement) {
    section.empty();
    const scroller = section.createDiv({ cls: "scroller" });
    scroller.dataset.ticker = "currents";
    scroller.dataset.speed = this.currentsSpeed;
    scroller.dataset.direction = this.currentsDirection;
    scroller.dataset.pauseOnHover = String(this.plugin.settings.pauseOnHover);

    const list = scroller.createEl("ul", { cls: ["tag-list", "scroller__inner"] });
    this.applyColorVars();
    await this.loadHeadlines(list);
  }

  private async renderHackerNewsSection(section: HTMLElement) {
    section.empty();
    const scroller = section.createDiv({ cls: "scroller" });
    scroller.dataset.ticker = "hacker-news";
    scroller.dataset.speed = this.hackerNewsSpeed;
    scroller.dataset.direction = this.hackerNewsDirection;
    scroller.dataset.pauseOnHover = String(this.plugin.settings.pauseOnHover);

    const list = scroller.createEl("ul", { cls: ["tag-list", "scroller__inner"] });
    await this.loadHackerNewsHeadlines(list);
  }

  private async renderGoogleNewsSection(section: HTMLElement) {
    section.empty();
    const scroller = section.createDiv({ cls: "scroller" });
    scroller.dataset.ticker = "google-news";
    scroller.dataset.speed = this.googleNewsSpeed;
    scroller.dataset.direction = this.googleNewsDirection;
    scroller.dataset.pauseOnHover = String(this.plugin.settings.pauseOnHover);

    const list = scroller.createEl("ul", { cls: ["tag-list", "scroller__inner"] });
    await this.loadGoogleNewsHeadlines(list);
  }

  // Render the stocks ticker section
  // Applies stock data, speed, direction and color settings
  private async renderFinnhubSection(section: HTMLElement): Promise<number | null> {
    section.empty();
    const finnhubScroller = section.createDiv({ cls: "scroller" });
    finnhubScroller.dataset.ticker = "finnhub";
    finnhubScroller.dataset.speed = this.finnhubSpeed;
    finnhubScroller.dataset.direction = this.finnhubDirection;
    finnhubScroller.dataset.pauseOnHover = String(this.plugin.settings.pauseOnHover);

    const finnhubList = finnhubScroller.createEl("ul", { cls: ["tag-list", "scroller__inner", "finnhub-list"] });
    const quotes = await this.plugin.getStockQuotes();
    const finnhubQuotes = quotes.length > 0
      ? quotes.map(toStockDisplayItem)
      : FALLBACK_STOCKS;
    const lastRefreshedAt =
      quotes.length > 0 ? this.plugin.getStockLastRefreshedAt() : null;

    finnhubQuotes.forEach(({ symbol, priceText, changeText, isNegative }) => {
      const item = finnhubList.createEl("li", { cls: "finnhub-item" });
      item.createSpan({ text: symbol });
      item.createSpan({ text: priceText, cls: "finnhub-price" });
      const changeSpan = item.createSpan({ text: changeText, cls: "finnhub-change" });
      if (isNegative) {
        changeSpan.addClass("is-negative");
      }
    });

    this.applyColorVars();
    return lastRefreshedAt;
  }

  // Footers, both have the same logic but are separated to allow independent toggling
  // Render the footer for the news ticker
  private renderCurrentsFooter(group: HTMLElement) {
    group.empty();

    if (!this.plugin.settings.showTickerFooters) {
      return;
    }

    const currentsFooter = group.createDiv({ cls: "ticker-footer" });
    currentsFooter.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(
        this.plugin.getHeadlinesLastRefreshedAt(),
        this.plugin.settings.useUsDateFormat
      ),
    });
    const refreshCurrentsButton = currentsFooter.createEl("button", {
      cls: ["clickable-icon", "ticker-refresh-button"],
      attr: {
        "aria-label": "Refresh headlines",
        type: "button",
        title: "Refresh headlines",
      },
    });
    setIcon(refreshCurrentsButton, "refresh-cw");
    refreshCurrentsButton.addEventListener("click", () => {
      void (async () => {
        refreshCurrentsButton.disabled = true;
        try {
          await this.plugin.refreshHeadlines();
        } finally {
          refreshCurrentsButton.disabled = false;
        }
      })();
    });
    group.createDiv({ cls: "ticker-divider" });
  }

  // Render the footer for the stocks ticker
  private renderFinnhubFooter(group: HTMLElement, lastRefreshedAt: number | null) {
    group.empty();

    if (!this.plugin.settings.showTickerFooters) {
      return;
    }

    const finnhubFooter = group.createDiv({ cls: "ticker-footer" });
    finnhubFooter.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(
        lastRefreshedAt,
        this.plugin.settings.useUsDateFormat
      ),
    });
    const refreshFinnhubButton = finnhubFooter.createEl("button", {
      cls: ["clickable-icon", "ticker-refresh-button"],
      attr: {
        "aria-label": "Refresh stock quotes",
        type: "button",
        title: "Refresh stock quotes",
      },
    });
    setIcon(refreshFinnhubButton, "refresh-cw");
    refreshFinnhubButton.addEventListener("click", () => {
      void (async () => {
        refreshFinnhubButton.disabled = true;
        try {
          await this.plugin.refreshFinnhub();
        } finally {
          refreshFinnhubButton.disabled = false;
        }
      })();
    });
    group.createDiv({ cls: "ticker-divider" });
  }

  private renderHackerNewsFooter(group: HTMLElement) {
    group.empty();
    if (!this.plugin.settings.showTickerFooters) {
      return;
    }

    const footer = group.createDiv({ cls: "ticker-footer" });
    footer.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(
        this.plugin.getHackerNewsLastRefreshedAt(),
        this.plugin.settings.useUsDateFormat
      ),
    });
    const refreshButton = footer.createEl("button", {
      cls: ["clickable-icon", "ticker-refresh-button"],
      attr: {
        "aria-label": "Refresh hacker news headlines.",
        type: "button",
        title: "Refresh hacker news headlines",
      },
    });
    setIcon(refreshButton, "refresh-cw");
    refreshButton.addEventListener("click", () => {
      void (async () => {
        refreshButton.disabled = true;
        try {
          await this.plugin.refreshHackerNews();
        } finally {
          refreshButton.disabled = false;
        }
      })();
    });
    group.createDiv({ cls: "ticker-divider" });
  }

  private renderGoogleNewsFooter(group: HTMLElement) {
    group.empty();
    if (!this.plugin.settings.showTickerFooters) {
      return;
    }

    const footer = group.createDiv({ cls: "ticker-footer" });
    footer.createSpan({
      cls: "ticker-refresh-time",
      text: formatLastRefreshed(
        this.plugin.getGoogleNewsLastRefreshedAt(),
        this.plugin.settings.useUsDateFormat
      ),
    });
    const refreshButton = footer.createEl("button", {
      cls: ["clickable-icon", "ticker-refresh-button"],
      attr: {
        "aria-label": "Refresh google news headlines",
        type: "button",
        title: "Refresh google news headlines",
      },
    });
    setIcon(refreshButton, "refresh-cw");
    refreshButton.addEventListener("click", () => {
      void (async () => {
        refreshButton.disabled = true;
        try {
          await this.plugin.refreshGoogleNews();
        } finally {
          refreshButton.disabled = false;
        }
      })();
    });
    group.createDiv({ cls: "ticker-divider" });
  }

  // Main render function that sets up the enabled ticker sections
  private async render() {
    const container = this.containerEl; // main content area
    container.empty();
    const showCurrents = this.plugin.settings.showCurrentsTicker;
    const showFinnhub = this.plugin.settings.showFinnhubTicker;
    const showHackerNews = this.plugin.settings.showHackerNewsTicker;
    const showGoogleNews = this.plugin.settings.showGoogleNewsTicker;

    this.hackerNewsSectionEl = showHackerNews
      ? container.createDiv({ cls: "hacker-news-section" })
      : undefined;
    if (showHackerNews) {
      container.createDiv({ cls: "ticker-divider" });
    }
    this.hackerNewsFooterGroupEl = showHackerNews
      ? container.createDiv({ cls: "ticker-footer-group" })
      : undefined;
    this.googleNewsSectionEl = showGoogleNews
      ? container.createDiv({ cls: "google-news-section" })
      : undefined;
    if (showGoogleNews) {
      container.createDiv({ cls: "ticker-divider" });
    }
    this.googleNewsFooterGroupEl = showGoogleNews
      ? container.createDiv({ cls: "ticker-footer-group" })
      : undefined;
    this.currentsSectionEl = showCurrents
      ? container.createDiv({ cls: "currents-section" })
      : undefined;
    if (showCurrents) {
      container.createDiv({ cls: "ticker-divider" });
    }
    this.currentsFooterGroupEl = showCurrents
      ? container.createDiv({ cls: "ticker-footer-group" })
      : undefined;
    this.finnhubSectionEl = showFinnhub
      ? container.createDiv({ cls: "finnhub-section" })
      : undefined;
    if (showFinnhub) {
      container.createDiv({ cls: "ticker-divider" });
    }
    this.finnhubFooterGroupEl = showFinnhub
      ? container.createDiv({ cls: "ticker-footer-group" })
      : undefined;

    if (showHackerNews && this.hackerNewsSectionEl && this.hackerNewsFooterGroupEl) {
      await this.renderHackerNewsSection(this.hackerNewsSectionEl);
      this.renderHackerNewsFooter(this.hackerNewsFooterGroupEl);
    }

    if (showGoogleNews && this.googleNewsSectionEl && this.googleNewsFooterGroupEl) {
      await this.renderGoogleNewsSection(this.googleNewsSectionEl);
      this.renderGoogleNewsFooter(this.googleNewsFooterGroupEl);
    }

    if (showCurrents && this.currentsSectionEl && this.currentsFooterGroupEl) {
      await this.renderCurrentsSection(this.currentsSectionEl);
      this.renderCurrentsFooter(this.currentsFooterGroupEl);
    }

    if (showFinnhub && this.finnhubSectionEl && this.finnhubFooterGroupEl) {
      const finnhubLastRefreshedAt = await this.renderFinnhubSection(
        this.finnhubSectionEl
      );
      this.renderFinnhubFooter(this.finnhubFooterGroupEl, finnhubLastRefreshedAt);
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
    if (!this.plugin.settings.showCurrentsTicker) {
      return;
    }
    if (!this.currentsSectionEl) {
      await this.render();
      return;
    }
    await this.renderCurrentsSection(this.currentsSectionEl);
    if (this.currentsFooterGroupEl) {
      this.renderCurrentsFooter(this.currentsFooterGroupEl);
    }
    initTicker(this.currentsSectionEl);
  }

  // Refresh stocks section, re-fetches stock quotes and updates the section
  async refreshFinnhub() {
    if (!this.plugin.settings.showFinnhubTicker) {
      return;
    }
    if (!this.finnhubSectionEl) {
      await this.render();
      return;
    }
    const finnhubLastRefreshedAt = await this.renderFinnhubSection(this.finnhubSectionEl);
    if (this.finnhubFooterGroupEl) {
      this.renderFinnhubFooter(this.finnhubFooterGroupEl, finnhubLastRefreshedAt);
    }
    initTicker(this.finnhubSectionEl);
  }

  async refreshHackerNews() {
    if (!this.plugin.settings.showHackerNewsTicker) {
      return;
    }
    if (!this.hackerNewsSectionEl) {
      await this.render();
      return;
    }
    await this.renderHackerNewsSection(this.hackerNewsSectionEl);
    if (this.hackerNewsFooterGroupEl) {
      this.renderHackerNewsFooter(this.hackerNewsFooterGroupEl);
    }
    initTicker(this.hackerNewsSectionEl);
  }

  async refreshGoogleNews() {
    if (!this.plugin.settings.showGoogleNewsTicker) {
      return;
    }
    if (!this.googleNewsSectionEl) {
      await this.render();
      return;
    }
    await this.renderGoogleNewsSection(this.googleNewsSectionEl);
    if (this.googleNewsFooterGroupEl) {
      this.renderGoogleNewsFooter(this.googleNewsFooterGroupEl);
    }
    initTicker(this.googleNewsSectionEl);
  }
}

// Main plugin class that Obsidian interacts with, handles loading, settings, commands and data fetching/caching
export default class GlobalTicker extends Plugin {

	settings!: GlobalTickerSettings;
	private headlinesCache: HeadlinesCache | null = null; 
	private stockQuotesCache: StockQuotesCache | null = null;
  private hackerNewsCache: HackerNewsCache | null = null;
  private googleNewsCache: GoogleNewsCache | null = null;
  private readonly missingSecretNotices = new Set<string>(); 

	async onload() {
		await this.loadSettings();

		// This adds a view to the workspace, which can be opened via the command palette, ribbon icon, or programmatically.
		this.registerView(
			VIEW_TYPE_MY_PANEL,
			(leaf) =>
				new MyPanelView(
					leaf,
					this,
					this.settings.currentsTickerSpeed,
					this.settings.finnhubTickerSpeed,
					this.settings.hackerNewsTickerSpeed,
					this.settings.googleNewsTickerSpeed,
					this.settings.currentsTickerDirection,
					this.settings.finnhubTickerDirection,
					this.settings.hackerNewsTickerDirection,
					this.settings.googleNewsTickerDirection,
					this.settings.currentsTextColor,
					this.settings.finnhubPriceColor,
					this.settings.finnhubChangeColor,
					this.settings.finnhubChangeNegativeColor
				)
		);

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-panel',
			name: 'Open panel',
			callback: async () => {
				const leaf = this.app.workspace.getLeaf(true);
				await leaf.setViewState({type: VIEW_TYPE_MY_PANEL, active: true});
				await this.app.workspace.revealLeaf(leaf);
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GlobalTickerSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		this.app.workspace.onLayoutReady(async () => {
			if (this.settings.refreshOnAppOpen) {
				await this.refreshOnAppOpen();
			}
		});
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

		// console.log("Fetching news headlines from Currents API");

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
			stockQuotesCache: this.stockQuotesCache,
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

		// console.log("Fetching stock quotes from Finnhub");

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
			console.error("Failed to fetch headlines", error);
			if (showNotice) {
				new Notice("Failed to fetch headlines. Showing cached items.");
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

  async getHackerNewsHeadlines(
    options?: { forceRefresh?: boolean }
  ): Promise<HeadlineItem[]> {
    const resolvedLimit = Number.isFinite(this.settings.hackerNewsHeadlineLimit)
      ? Math.min(20, Math.max(1, Math.floor(this.settings.hackerNewsHeadlineLimit)))
      : 10;
    const cacheKey = JSON.stringify({
      feed: this.settings.hackerNewsFeed,
      searchTerms: this.settings.hackerNewsSearchTerms,
      limit: resolvedLimit,
    });
    const cacheMatches = this.hackerNewsCache?.cacheKey === cacheKey;
    if (!options?.forceRefresh && cacheMatches && this.hackerNewsCache) {
      return this.hackerNewsCache.headlines.slice(0, resolvedLimit);
    }
    try {
      const headlines = await fetchHackerNewsHeadlines({
        feed: this.settings.hackerNewsFeed,
        searchTerms: this.settings.hackerNewsSearchTerms,
        limit: resolvedLimit,
      });
      const normalized = headlines.map((headline) => ({
        title: headline.title,
        url: headline.url,
      }));
      this.hackerNewsCache = {
        cacheKey,
        fetchedAt: Date.now(),
        headlines: normalized,
      };
      return normalized;
    } catch (error) {
      console.error("Failed to fetch Hacker News headlines", error);
      if (cacheMatches && this.hackerNewsCache) {
        return this.hackerNewsCache.headlines.slice(0, resolvedLimit);
      }
      return [];
    }
  }

  async refreshHackerNews(): Promise<boolean> {
    const previousFetchedAt = this.hackerNewsCache?.fetchedAt ?? null;
    await this.getHackerNewsHeadlines({ forceRefresh: true });
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
    await Promise.all(
      leaves.map(async leaf => {
        const view = leaf.view;
        if (view instanceof MyPanelView) {
          await view.refreshHackerNews();
        }
      })
    );
    return this.hackerNewsCache?.fetchedAt !== previousFetchedAt;
  }

  async getGoogleNewsHeadlines(
    options?: { forceRefresh?: boolean }
  ): Promise<HeadlineItem[]> {
    const resolvedLimit = Number.isFinite(this.settings.googleNewsHeadlineLimit)
      ? Math.min(20, Math.max(1, Math.floor(this.settings.googleNewsHeadlineLimit)))
      : 10;
    const cacheKey = JSON.stringify({
      topic: this.settings.googleNewsTopic,
      language: this.settings.googleNewsLanguage,
      country: this.settings.googleNewsCountry,
      limit: resolvedLimit,
    });
    const cacheMatches = this.googleNewsCache?.cacheKey === cacheKey;
    if (!options?.forceRefresh && cacheMatches && this.googleNewsCache) {
      return this.googleNewsCache.headlines.slice(0, resolvedLimit);
    }
    try {
      const headlines = await fetchGoogleNewsHeadlines({
        topic: this.settings.googleNewsTopic,
        language: this.settings.googleNewsLanguage,
        country: this.settings.googleNewsCountry,
        limit: resolvedLimit,
      });
      const normalized = headlines.map(headline => ({
        title: headline.title,
        url: headline.url,
        source: headline.source,
      }));
      this.googleNewsCache = {
        cacheKey,
        fetchedAt: Date.now(),
        headlines: normalized,
      };
      return normalized;
    } catch (error) {
      console.error("Failed to fetch Google News headlines", error);
      if (cacheMatches && this.googleNewsCache) {
        return this.googleNewsCache.headlines.slice(0, resolvedLimit);
      }
      return [];
    }
  }

  async refreshGoogleNews(): Promise<boolean> {
    const previousFetchedAt = this.googleNewsCache?.fetchedAt ?? null;
    await this.getGoogleNewsHeadlines({ forceRefresh: true });
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
    await Promise.all(
      leaves.map(async leaf => {
        const view = leaf.view;
        if (view instanceof MyPanelView) {
          await view.refreshGoogleNews();
        }
      })
    );
    return this.googleNewsCache?.fetchedAt !== previousFetchedAt;
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
      console.error("Failed to fetch headlines", error);
      new Notice("Failed to fetch headlines. Showing cached items.");
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

		const cacheKey = this.buildStockCacheKey(symbols);
		const cache = this.stockQuotesCache;
		const cacheMatches = cache?.cacheKey === cacheKey;
		const cacheAge = cache ? Date.now() - cache.fetchedAt : Number.POSITIVE_INFINITY;
		const cacheFresh = cacheMatches && cacheAge < STOCK_CACHE_TTL_MS;
		const forceRefresh = options?.forceRefresh ?? false;
		const cacheUsable = cacheFresh && Boolean(cache?.quotes.length);

		if (!forceRefresh && cacheUsable && cache?.quotes.length) {
			return cache.quotes.slice(0, symbols.length);
		}

		const apiKey = await this.getFinnhubApiKey();
		if (!apiKey) {
      this.notifyMissingSecret("Finnhub", this.settings.finnhubApiKey);
			if (cacheMatches && cache?.quotes.length) {
				return cache.quotes.slice(0, symbols.length);
			}
			return [];
		}

		try {
			const quotes = await this.fetchStockQuotesFromApi(symbols);
			if (quotes.length > 0) {
				this.stockQuotesCache = {
					cacheKey,
					fetchedAt: Date.now(),
					quotes,
				};
				await this.savePluginData();
				return quotes.slice(0, symbols.length);
			}
		} catch (error) {
			console.error("Failed to fetch stock quotes", error);
		}

		if (cacheMatches && cache?.quotes.length) {
			return cache.quotes.slice(0, symbols.length);
		}

		return [];
	}

  // Refresh stocks section, clears cache and re-fetches data, then updates all open panels
	async refreshFinnhub() {
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
        await this.savePluginData();
        refreshed = true;
      }
    } catch (error) {
      console.error("Failed to fetch stock quotes", error);
    }
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		await Promise.all(
			leaves.map(async (leaf) => {
				const view = leaf.view;
				if (view instanceof MyPanelView) {
					await view.refreshFinnhub();
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

  getHackerNewsLastRefreshedAt(): number | null {
    return this.hackerNewsCache?.fetchedAt ?? null;
  }

  getGoogleNewsLastRefreshedAt(): number | null {
    return this.googleNewsCache?.fetchedAt ?? null;
  }

  // Updates ticker settings (speed and direction) for all open panels
	updateTickerSettings() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MY_PANEL);
		leaves.forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof MyPanelView) {
				view.setTickerSettings(
					this.settings.currentsTickerSpeed,
					this.settings.finnhubTickerSpeed,
					this.settings.hackerNewsTickerSpeed,
					this.settings.googleNewsTickerSpeed,
					this.settings.currentsTickerDirection,
					this.settings.finnhubTickerDirection,
					this.settings.hackerNewsTickerDirection,
					this.settings.googleNewsTickerDirection
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
				view.setTickerColors(
					this.settings.currentsTextColor,
					this.settings.finnhubPriceColor,
					this.settings.finnhubChangeColor,
					this.settings.finnhubChangeNegativeColor
				);
			}
		});
	}

  // Loads settings and headlines cache from plugin data storage
	async loadSettings() {
		const data: unknown = await this.loadData();
		if (data && typeof data === "object" && "settings" in data) {
			const typedData = data as PluginData;
			this.settings = normalizeSettings(typedData.settings);
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
			this.stockQuotesCache = typedData.stockQuotesCache ?? null;
			if (this.stockQuotesCache && Array.isArray(this.stockQuotesCache.quotes)) {
				const normalizedQuotes = this.stockQuotesCache.quotes
					.map((item) => normalizeStockQuoteItem(item))
					.filter((item): item is StockQuote => Boolean(item));
				const { cacheKey, fetchedAt } = this.stockQuotesCache;
				this.stockQuotesCache = {
					cacheKey,
					fetchedAt,
					quotes: normalizedQuotes,
				};
			}
			return;
		}
    
		this.settings = normalizeSettings(data);
		this.headlinesCache = null;
		this.stockQuotesCache = null;
	}

	async saveSettings() {
		await this.savePluginData();
	}
}
