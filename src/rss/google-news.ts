import {requestUrl} from "obsidian";

const GOOGLE_NEWS_RSS_BASE_URL = "https://news.google.com/rss";

export type GoogleNewsTopic = "top-stories" | "WORLD" | "BUSINESS" | "TECHNOLOGY" | "SPORTS";

export interface GoogleNewsHeadline {
    title: string;
    url: string;
    source?: string;
}

export interface FetchGoogleNewsHeadlinesOptions {
    topic: GoogleNewsTopic;
    language: string;
    country: string;
    limit: number;
}

const getCeidLanguage = (language: string): string => {
    const match = /^([a-z]{2,3})-[A-Z]{2}$/.exec(language);
    return match?.[1] ?? language;
};

const parseFeed = (xml: string, limit: number): GoogleNewsHeadline[] => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) {
        throw new Error("Google News RSS response could not be parsed.");
    }

    return Array.from(document.querySelectorAll("item"))
        .map(item => {
            const title = item.querySelector("title")?.textContent?.trim() ?? "";
            const url = item.querySelector("link")?.textContent?.trim() ?? "";
            const source = item.querySelector("source")?.textContent?.trim() ?? "";
            if (!title || !url) {
                return null;
            }
            return source ? {title, url, source} : {title, url};
        })
        .filter((item): item is GoogleNewsHeadline => item !== null)
        .slice(0, limit);
};

export const fetchGoogleNewsHeadlines = async (
    options: FetchGoogleNewsHeadlinesOptions
): Promise<GoogleNewsHeadline[]> => {
    const resolvedLimit = Math.min(20, Math.max(1, Math.floor(options.limit)));
    const language = options.language.trim() || "en-US";
    const country = (options.country.trim() || "US").toUpperCase();
    const ceid = `${country}:${getCeidLanguage(language)}`;
    const endpoint = options.topic === "top-stories"
        ? GOOGLE_NEWS_RSS_BASE_URL
        : `${GOOGLE_NEWS_RSS_BASE_URL}/headlines/section/topic/${options.topic}`;
    const params = new URLSearchParams({
        hl: language,
        gl: country,
        ceid
    });
    const response = await requestUrl({
        url: `${endpoint}?${params.toString()}`,
        throw: false
    });
    if (response.status >= 400) {
        throw new Error(`Google News RSS request failed (${response.status}).`);
    }

    return parseFeed(response.text, resolvedLimit);
};
