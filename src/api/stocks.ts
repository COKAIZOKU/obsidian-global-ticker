import { requestUrl } from "obsidian";

export const FINNHUB_API_BASE_URL = "https://finnhub.io/api/v1";

export interface StockQuote {
  symbol: string;
  price?: number;
  changePercent?: number;
}

interface FinnhubQuoteResponse { // for successful quote responses
  c?: number | string;
  pc?: number | string;
}

interface FinnhubErrorResponse { // for error responses
  error?: string;
}

export interface FetchFinnhubStockQuotesOptions {
  apiKey: string;
  symbols: string[];
}

// Normalizes a value to a finite number if possible, otherwise returns undefined
const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
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

// Builds the URL for fetching a stock quote from Finnhub based on the symbol and API key
const buildQuoteUrl = (symbol: string, apiKey: string): string => {
  const query = new URLSearchParams();
  query.set("symbol", symbol);
  query.set("token", apiKey);
  return `${FINNHUB_API_BASE_URL}/quote?${query.toString()}`;
};

const toStockQuoteFromQuote = (
  symbol: string,
  quote?: FinnhubQuoteResponse
): StockQuote => {
  if (!quote) {
    return { symbol };
  }

  const currentPrice = normalizeNumber(quote.c);
  const previousClose = normalizeNumber(quote.pc);
  const changePercent =
    currentPrice !== undefined &&
    previousClose !== undefined &&
    previousClose !== 0
      ? ((currentPrice - previousClose) / previousClose) * 100
      : undefined;

  return {
    symbol,
    price: currentPrice,
    changePercent,
  };
};

// Fetches stock quotes for the given symbols using the Finnhub API and returns an array of StockQuote objects
export async function fetchFinnhubStockQuotes(
  options: FetchFinnhubStockQuotesOptions
): Promise<StockQuote[]> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("Finnhub API key is required.");
  }

  const symbols = options.symbols.map((symbol) => symbol.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return [];
  }

  const requestQuote = async (symbol: string): Promise<StockQuote> => {
    const url = buildQuoteUrl(symbol, apiKey);
    const response = await requestUrl({
      url,
      throw: false,
    });

    const payload = response.json as FinnhubQuoteResponse | FinnhubErrorResponse | unknown;
    if (response.status >= 400) {
      const details =
        payload && typeof payload === "object" && "error" in payload
          ? `: ${String((payload as FinnhubErrorResponse).error)}`
          : "";
      throw new Error(
        `Finnhub API request failed (${response.status})${details}`
      );
    }

    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      (payload as FinnhubErrorResponse).error
    ) {
      throw new Error(
        `Finnhub API error: ${String(
          (payload as FinnhubErrorResponse).error
        )}`
      );
    }

    return toStockQuoteFromQuote(symbol, payload as FinnhubQuoteResponse);
  };

  const results = await Promise.allSettled(
    symbols.map((symbol) => requestQuote(symbol))
  );

  return results.map((result, index) => {
    const symbol = symbols[index] ?? "";
    if (result.status === "fulfilled") {
      return result.value;
    }
    console.warn("Failed to fetch Finnhub quote.", {
      symbol,
      error: result.reason,
    });
    return { symbol };
  });
}
