import {requestUrl} from "obsidian";

const HACKER_NEWS_RSS_BASE_URL = "https://hnrss.org";

export type HackerNewsFeed = "frontpage" | "newest" | "ask" | "show" | "jobs" | "active";

export interface HackerNewsHeadline {
    title: string;
    url: string;
}

export interface FetchHackerNewsHeadlinesOptions {
    feed: HackerNewsFeed;
    searchTerms: string;
    limit: number;
}

const normalizeSearchTerms = (searchTerms: string): string => searchTerms
    .split(",")
    .map(term => term.trim())
    .filter(Boolean)
    .join(" OR ");

const parseFeed = (xml: string, limit: number): HackerNewsHeadline[] => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) {
        throw new Error("Hacker News RSS response could not be parsed.");
    }

    return Array.from(document.querySelectorAll("item"))
        .map(item => {
            const title = item.querySelector("title")?.textContent?.trim() ?? "";
            const url = item.querySelector("link")?.textContent?.trim() ?? "";
            return title && url ? {title, url} : null;
        })
        .filter((item): item is HackerNewsHeadline => item !== null)
        .slice(0, limit);
};

export const fetchHackerNewsHeadlines = async (
    options: FetchHackerNewsHeadlinesOptions
): Promise<HackerNewsHeadline[]> => {
    const resolvedLimit = Math.min(20, Math.max(1, Math.floor(options.limit)));
    const searchQuery = normalizeSearchTerms(options.searchTerms);
    const params = [`count=${resolvedLimit}`];
    if (searchQuery) {
        params.push(`q=${encodeURIComponent(searchQuery)}`);
    }
    const url = `${HACKER_NEWS_RSS_BASE_URL}/${options.feed}?${params.join("&")}`;
    const response = await requestUrl({
        url,
        throw: false
    });
    if (response.status >= 400) {
        throw new Error(`Hacker News RSS request failed (${response.status}).`);
    }

    return parseFeed(response.text, resolvedLimit);
};
