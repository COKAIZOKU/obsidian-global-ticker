import { requestUrl } from "obsidian";

export const CURRENTS_API_BASE_URL = "https://api.currentsapi.services/v1";

export type CurrentsAuthMode = "query" | "header";

export interface CurrentsHeadline {
  id?: string;
  title?: string;
  description?: string;
  url?: string;
  author?: string;
  image?: string;
  language?: string;
  category?: string[] | string;
  published?: string;
  source?: string;
  country?: string;
}


interface CurrentsApiSuccessResponse { // for successful responses with status "ok"
  status: "ok";
  news: CurrentsHeadline[];
}

interface CurrentsApiErrorResponse { // for non-2xx responses or error status
  status: "error";
  message?: string;
  code?: string;
}

type CurrentsApiResponse = CurrentsApiSuccessResponse | CurrentsApiErrorResponse;

export interface FetchCurrentsHeadlinesOptions {
  apiKey: string;
  endpoint?: string;
  authMode?: CurrentsAuthMode;
  language?: string;
  category?: string | string[];
  country?: string | string[];
  params?: Record<string, string | number | boolean | Array<string | number>>;
  limit?: number;
}

const normalizeList = (value: string | string[]): string =>
  Array.isArray(value) ? value.filter(Boolean).join(",") : value;

const toQueryString = (
  params: Record<string, string | number | boolean | Array<string | number>>
): string => {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (entries.length === 0) {
    return "";
  }

  const query = entries
    .map(([key, value]) => {
      const raw = Array.isArray(value) ? value.join(",") : String(value);
      return `${encodeURIComponent(key)}=${encodeURIComponent(raw)}`;
    })
    .join("&");

  return `?${query}`;
};

const getPayloadMessageSuffix = (
  payload: CurrentsApiResponse | null | undefined
): string => {
  if (payload && "message" in payload && payload.message) {
    return `: ${payload.message}`;
  }

  return "";
};

const isSuccessPayload = (
  payload: CurrentsApiResponse | null | undefined
): payload is CurrentsApiSuccessResponse => {
  if (!payload || payload.status !== "ok") {
    return false;
  }

  return Array.isArray(payload.news);
};

export async function fetchCurrentsHeadlines(
  options: FetchCurrentsHeadlinesOptions
): Promise<CurrentsHeadline[]> {
  const {
    apiKey,
    endpoint = "latest-news",
    authMode = "query",
    language,
    category,
    country,
    params,
    limit,
  } = options;

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Currents API key is required.");
  }

  const queryParams: Record<
    string,
    string | number | boolean | Array<string | number>
  > = {
    ...(params ?? {}),
  };

  if (language) {
    queryParams.language = language;
  }
  if (category) {
    queryParams.category = normalizeList(category);
  }
  if (country) {
    queryParams.country = normalizeList(country);
  }
  if (authMode === "query") {
    queryParams.apiKey = trimmedKey;
  }

  const normalizedEndpoint = endpoint.replace(/^\//, "");
  const url = `${CURRENTS_API_BASE_URL}/${normalizedEndpoint}${toQueryString(
    queryParams
  )}`;

  const headers =
    authMode === "header"
      ? {
          Authorization: trimmedKey,
        }
      : undefined;

  const response = await requestUrl({
    url,
    headers,
    throw: false,
  });

  const payload = response.json as CurrentsApiResponse;

  if (response.status >= 400) {
    const message = getPayloadMessageSuffix(payload);
    throw new Error(`Currents API request failed (${response.status})${message}`);
  }

  if (!isSuccessPayload(payload)) {
    const details = getPayloadMessageSuffix(payload);
    throw new Error(`Unexpected Currents API response${details}`);
  }

  const headlines = payload.news;
  if (typeof limit === "number" && limit > 0) {
    return headlines.slice(0, limit);
  }

  return headlines;
}
