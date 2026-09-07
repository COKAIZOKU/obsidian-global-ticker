import {requestUrl} from "obsidian";
import type {GlobalTickerSettings} from "../settings";

export interface XmlHeadline {
    title: string;
    url?: string;
    source: string;
    description: string;
    pubDate: string;
    guid: string;
}

const httpUrl = (value: string, base?: string): string | undefined => {
    if (!value.trim()) return undefined;
    try {
        const url = new URL(value, base);
        return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
    } catch {
        return undefined;
    }
};

export const parseXmlFeed = (xml: string, feedUrl: string): XmlHeadline[] => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    const channel = document.querySelector("rss > channel");
    if (document.querySelector("parsererror") || !channel) {
        throw new Error("Expected an RSS XML feed with a channel.");
    }
    const text = (element: Element, name: string): string =>
        Array.from(element.children).find(child => child.tagName === name)?.textContent?.trim() ?? "";
    const source = text(channel, "title") || new URL(feedUrl).hostname;
    return Array.from(channel.children)
        .filter(child => child.tagName === "item")
        .map(item => ({
            title: text(item, "title"),
            url: httpUrl(text(item, "link"), feedUrl),
            source,
            description: text(item, "description"),
            pubDate: text(item, "pubDate"),
            guid: text(item, "guid"),
        }))
        .filter(item => item.title.length > 0);
};

export const fetchXmlHeadlines = async (links: string, limit: number): Promise<XmlHeadline[]> => {
    const urls = [...new Set(links.split(",").map(link => link.trim()).filter(Boolean))];
    const results = await Promise.allSettled(urls.map(async link => {
        const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(link);
        const url = httpUrl(hasScheme ? link : `https://${link}`);
        if (!url) throw new Error("Enter a valid HTTP or HTTPS RSS feed URL.");
        const response = await requestUrl({url, throw: false});
        if (response.status >= 400) throw new Error(`RSS request failed (${response.status}).`);
        return parseXmlFeed(response.text, url);
    }));
    const feeds: XmlHeadline[][] = [];
    for (const result of results) {
        if (result.status === "fulfilled") feeds.push(result.value);
        else console.error("Failed to read XML feed", result.reason);
    }
    const resolvedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 10;
    const headlines: XmlHeadline[] = [];
    for (let index = 0; headlines.length < resolvedLimit; index++) {
        let added = false;
        for (const feed of feeds) {
            const headline = feed[index];
            if (headline) {
                headlines.push(headline);
                added = true;
                if (headlines.length === resolvedLimit) break;
            }
        }
        if (!added) break;
    }
    return headlines;
};

export const renderXmlTicker = async (section: HTMLElement, settings: GlobalTickerSettings): Promise<number | null> => {
    section.empty();
    const scroller = section.createDiv({cls: "scroller"});
    scroller.dataset.ticker = "xmlReaderTicker";
    scroller.dataset.speed = settings.xmlReaderTickerSpeed;
    scroller.dataset.direction = settings.xmlReaderTickerDirection;
    scroller.dataset.pauseOnHover = String(settings.pauseOnHover);
    const list = scroller.createEl("ul", {cls: ["tag-list", "scroller__inner"]});
    const headlines = await fetchXmlHeadlines(settings.xmlReaderLinks, settings.xmlReaderHeadlineLimit);
    for (const headline of headlines) {
        const item = list.createEl("li", {cls: "headline-item"});
        if (headline.url) {
            item.createEl("a", {text: headline.title, href: headline.url, cls: "headline-link",
                attr: {target: "_blank", rel: "noopener"}});
        } else {
            item.createSpan({text: headline.title, cls: "headline-text"});
        }
        if (settings.showHeadlineMeta) {
            item.createEl("ul", {cls: "headline-meta"}).createEl("li", {text: headline.source});
        }
    }
    if (!headlines.length) {
        list.createEl("li", {text: "No headlines available; check your feed links.", cls: "headline-item"});
    }
    return headlines.length ? Date.now() : null;
};
