import { requestUrl } from "obsidian";

export const ALPACA_DATA_BASE_URL = "https://data.alpaca.markets/v2";

export interface StockQuote {
  symbol: string;
  price?: number;
  changePercent?: number;
}

interface AlpacaTrade {
  p?: number;
}

interface AlpacaQuote {
  ap?: number;
  bp?: number;
}

interface AlpacaBar {
  c?: number;
}

interface AlpacaSnapshot {
  latestTrade?: AlpacaTrade;
  latestQuote?: AlpacaQuote;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

interface AlpacaErrorResponse {
  code?: number | string;
  message?: string;
}

export interface FetchAlpacaStockQuotesOptions {
  apiKey: string;
  apiSecret: string;
  symbols: string[];
  baseUrl?: string;
  feed?: string;
}

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

export const normalizeStockSymbols = (input: string): string[] => {
  if (!input) {
    return [];
  }

  const tokens = input
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.toUpperCase());

  const seen = new Set<string>();
  const unique: string[] = [];
  tokens.forEach((token) => {
    if (seen.has(token)) {
      return;
    }
    seen.add(token);
    unique.push(token);
  });
  return unique;
};

const normalizeBaseUrl = (input?: string): string => {
  const trimmed = (input ?? "").trim();
  if (/^http:\/\//i.test(trimmed)) {
    throw new Error("Alpaca base URL must use https.");
  }
  const base = trimmed.length > 0 ? trimmed : ALPACA_DATA_BASE_URL;
  return base.replace(/\/+$/, "");
};

const extractSnapshots = (
  payload: unknown
): Record<string, AlpacaSnapshot> => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as Record<string, unknown>;
  const candidate =
    record.snapshots && typeof record.snapshots === "object"
      ? (record.snapshots as Record<string, unknown>)
      : record;

  const snapshots: Record<string, AlpacaSnapshot> = {};
  Object.entries(candidate).forEach(([symbol, value]) => {
    if (!value || typeof value !== "object") {
      return;
    }
    const snapshot = value as AlpacaSnapshot;
    if (
      "latestTrade" in snapshot ||
      "latestQuote" in snapshot ||
      "dailyBar" in snapshot ||
      "prevDailyBar" in snapshot
    ) {
      snapshots[symbol] = snapshot;
    }
  });

  return snapshots;
};

const buildSnapshotUrl = (
  baseUrl: string,
  symbols: string[],
  feed?: string
): string => {
  const query = new URLSearchParams();
  query.set("symbols", symbols.join(","));
  if (feed && feed.trim().length > 0) {
    query.set("feed", feed.trim());
  }
  return `${baseUrl}/stocks/snapshots?${query.toString()}`;
};

const toStockQuote = (
  symbol: string,
  snapshot?: AlpacaSnapshot
): StockQuote => {
  if (!snapshot) {
    return { symbol };
  }

  const latestTradePrice = normalizeNumber(snapshot.latestTrade?.p);
  const dailyClose = normalizeNumber(snapshot.dailyBar?.c);
  const askPrice = normalizeNumber(snapshot.latestQuote?.ap);
  const bidPrice = normalizeNumber(snapshot.latestQuote?.bp);
  const latestPrice =
    latestTradePrice ?? dailyClose ?? askPrice ?? bidPrice;
  const prevClose = normalizeNumber(snapshot.prevDailyBar?.c);

  const changePercent =
    latestPrice !== undefined && prevClose !== undefined && prevClose !== 0
      ? ((latestPrice - prevClose) / prevClose) * 100
      : undefined;

  return {
    symbol,
    price: latestPrice,
    changePercent,
  };
};

export async function fetchAlpacaStockQuotes(
  options: FetchAlpacaStockQuotesOptions
): Promise<StockQuote[]> {
  const apiKey = options.apiKey.trim();
  const apiSecret = options.apiSecret.trim();
  if (!apiKey || !apiSecret) {
    throw new Error("Alpaca API key and secret are required.");
  }

  const symbols = options.symbols.map((symbol) => symbol.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return [];
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const url = buildSnapshotUrl(baseUrl, symbols, options.feed);

  const response = await requestUrl({
    url,
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
    },
    throw: false,
  });

  const payload = response.json as AlpacaErrorResponse | unknown;
  if (response.status >= 400) {
    const details =
      payload && typeof payload === "object" && "message" in payload
        ? `: ${String((payload as AlpacaErrorResponse).message)}`
        : "";
    throw new Error(`Alpaca API request failed (${response.status})${details}`);
  }

  const snapshots = extractSnapshots(payload);
  return symbols.map((symbol) => toStockQuote(symbol, snapshots[symbol]));
}
