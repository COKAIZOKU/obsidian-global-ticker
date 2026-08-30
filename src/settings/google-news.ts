import {Notice} from "obsidian";
import type {SettingDefinitionItem} from "obsidian";
import type GlobalTicker from "../main";
import type {GlobalTickerSettings} from "../settings";

type SettingsKey = keyof GlobalTickerSettings;

export const getGoogleNewsSettingDefinitions = (plugin: GlobalTicker): SettingDefinitionItem<SettingsKey> => ({
    type: "group",
    heading: "Google News settings",
    items: [
        {
            name: "Show Google News ticker",
            desc: "Fetch and show Google News headlines in the panel.",
            control: {
                type: "toggle",
                key: "showGoogleNewsTicker"
            }
        }, {
            name: "Google News ticker speed",
            desc: "Choose how fast the Google News ticker scrolls.",
            control: {
                type: "dropdown",
                key: "googleNewsTickerSpeed",
                options: {
                    "very-slow": "Very slow",
                    slow: "Slow",
                    medium: "Medium",
                    fast: "Fast"
                }
            }
        }, {
            name: "Google News ticker direction",
            desc: "Choose the Google News ticker direction.",
            control: {
                type: "dropdown",
                key: "googleNewsTickerDirection",
                options: {
                    left: "Left",
                    right: "Right"
                }
            }
        }, {
            name: "Google News topic",
            desc: "Choose which Google News topic to fetch.",
            control: {
                type: "dropdown",
                key: "googleNewsTopic",
                options: {
                    "top-stories": "Top stories",
                    WORLD: "World",
                    BUSINESS: "Business",
                    TECHNOLOGY: "Technology",
                    SPORTS: "Sports"
                }
            }
        }, {
            name: "Google News language",
            desc: "Set the Google News interface language.",
            control: {
                type: "text",
                key: "googleNewsLanguage",
                placeholder: "en-US"
            }
        }, {
            name: "Google News country",
            desc: "Set the two-letter Google News country code.",
            control: {
                type: "text",
                key: "googleNewsCountry",
                placeholder: "US"
            }
        }, {
            name: "Google News headline limit",
            desc: "Number of Google News headlines to show. Maximum 20.",
            control: {
                type: "number",
                key: "googleNewsHeadlineLimit",
                min: 1,
                max: 20,
                step: 1,
                placeholder: "10",
                validate: (value: number) => Number.isInteger(value) && value >= 1 && value <= 20
                    ? undefined
                    : "Enter a whole number from 1 to 20."
            }
        }, {
            name: "Refresh Google News headlines",
            desc: "Fetch fresh Google News headlines.",
            render: setting => {
                setting.addButton(button => {
                    button.setButtonText("Refresh").setCta().onClick(() => {
                        void(async() => {
                            button.setDisabled(true);
                            button.setButtonText("Refreshing...");
                            try {
                                const refreshed = await plugin.refreshGoogleNews();
                                new Notice(refreshed
                                    ? "Google News headlines refreshed."
                                    : "No Google News headlines refreshed. Check your connection and locale settings.");
                            } catch (error) {
                                console.error("Failed to refresh Google News headlines", error);
                                new Notice("Failed to refresh google news headlines. Check your connection and locale settings.");
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
