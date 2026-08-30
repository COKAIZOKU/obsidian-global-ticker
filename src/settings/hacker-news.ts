import {Notice} from "obsidian";
import type {SettingDefinitionItem} from "obsidian";
import type GlobalTicker from "../main";
import type {GlobalTickerSettings} from "../settings";

type SettingsKey = keyof GlobalTickerSettings;

export const getHackerNewsSettingDefinitions = (plugin: GlobalTicker): SettingDefinitionItem<SettingsKey> => ({
    type: "group",
    heading: "Hacker News settings",
    items: [
        {
            name: "Show Hacker News ticker",
            desc: "Fetch and show Hacker News headlines in the panel.",
            control: {
                type: "toggle",
                key: "showHackerNewsTicker"
            }
        }, {
            name: "Show Hacker News footer",
            desc: "Show the last refreshed time and refresh button for Hacker News.",
            control: {
                type: "toggle",
                key: "showHackerNewsFooter"
            }
        }, {
            name: "Hacker News ticker speed",
            desc: "Choose how fast the Hacker News ticker scrolls.",
            control: {
                type: "dropdown",
                key: "hackerNewsTickerSpeed",
                options: {
                    "very-slow": "Very slow",
                    slow: "Slow",
                    medium: "Medium",
                    fast: "Fast"
                }
            }
        }, {
            name: "Hacker News ticker direction",
            desc: "Choose the Hacker News ticker direction.",
            control: {
                type: "dropdown",
                key: "hackerNewsTickerDirection",
                options: {
                    left: "Left",
                    right: "Right"
                }
            }
        }, {
            name: "Hacker News feed",
            desc: "Choose which Hacker News feed to fetch.",
            control: {
                type: "dropdown",
                key: "hackerNewsFeed",
                options: {
                    frontpage: "Front page",
                    newest: "Newest",
                    ask: "Ask HN",
                    show: "Show HN",
                    jobs: "Jobs",
                    active: "Active"
                }
            }
        }, {
            name: "Hacker News search terms",
            desc: "Filter headlines by comma-separated search terms. Terms are matched with OR.",
            control: {
                type: "text",
                key: "hackerNewsSearchTerms",
                placeholder: "android, cybersecurity"
            }
        }, {
            name: "Hacker News headline limit",
            desc: "Number of Hacker News headlines to fetch. Maximum 20.",
            control: {
                type: "number",
                key: "hackerNewsHeadlineLimit",
                min: 1,
                max: 20,
                step: 1,
                placeholder: "10",
                validate: (value: number) => Number.isInteger(value) && value >= 1 && value <= 20
                    ? undefined
                    : "Enter a whole number from 1 to 20."
            }
        }, {
            name: "Refresh Hacker News headlines",
            desc: "Fetch fresh Hacker News headlines.",
            render: setting => {
                setting.addButton(button => {
                    button.setButtonText("Refresh").setCta().onClick(() => {
                        void(async() => {
                            button.setDisabled(true);
                            button.setButtonText("Refreshing...");
                            try {
                                const refreshed = await plugin.refreshHackerNews();
                                new Notice(refreshed
                                    ? "Hacker News headlines refreshed."
                                    : "No Hacker News headlines refreshed. Check your connection.");
                            } catch (error) {
                                console.error("Failed to refresh Hacker News headlines", error);
                                new Notice("Failed to refresh hacker news headlines. Check your connection.");
                            } finally {
                                button.setDisabled(false);
                                button.setButtonText("Refresh");
                            }
                        })();
                    });
                });
            }
        }
    ]
});
