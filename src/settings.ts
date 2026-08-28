import {
    App,
    PluginSettingTab,
} from "obsidian";
import type {SettingDefinitionItem} from "obsidian";
import GlobalTicker from "./main";
import {getCurrentsSettingDefinitions} from "./settings/currents";
import {getFinnhubSettingDefinitions} from "./settings/finnhub";
import {getTextFaintHex} from "./settings/color";

export type TickerSpeed = "fast" | "slow" | "medium" | "very-slow";
export type TickerDirection = "left" | "right";

export interface GlobalTickerSettings {
    mySetting : string;
    currentsTickerSpeed : TickerSpeed;
    finnhubTickerSpeed : TickerSpeed;
    currentsTickerDirection : TickerDirection;
    finnhubTickerDirection : TickerDirection;
    showCurrentsFooter : boolean;
    showFinnhubFooter : boolean;
    useUsDateFormat : boolean;
    refreshOnAppOpen : boolean;
    pauseOnHover : boolean;
    showCurrentsTicker : boolean;
    showFinnhubTicker : boolean;
    showHeadlineMeta : boolean;
    tickerSpeed?: TickerSpeed;
    currentsTextColor : string;
    finnhubChangeColor : string;
    finnhubChangeNegativeColor : string;
    finnhubPriceColor : string;
    finnhubApiKey : string;
    finnhubSymbols : string;
    currentsApiKey : string;
    currentsCategory : string;
    currentsLimit : number;
    currentsRegion : string;
    currentsLanguage : string;
    currentsDomains : string;
    currentsExcludeDomains : string;
}

export const DEFAULT_SETTINGS : GlobalTickerSettings = {
    mySetting: 'default',
    currentsTickerSpeed: "slow",
    finnhubTickerSpeed: "slow",
    currentsTickerDirection: "left",
    finnhubTickerDirection: "left",
    showCurrentsFooter: true,
    showFinnhubFooter: true,
    useUsDateFormat: false,
    refreshOnAppOpen: false,
    pauseOnHover: true,
    showCurrentsTicker: true,
    showFinnhubTicker: true,
    showHeadlineMeta: true,
    currentsTextColor: "",
    finnhubChangeColor: "",
    finnhubChangeNegativeColor: "",
    finnhubPriceColor: "",
    finnhubApiKey: "",
    finnhubSymbols: "AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META",
    currentsApiKey: "",
    currentsCategory: "",
    currentsLimit: 10,
    currentsRegion: "",
    currentsLanguage: "",
    currentsDomains: "",
    currentsExcludeDomains: ""
}

export class GlobalTickerSettingTab extends PluginSettingTab {
    plugin : GlobalTicker;

    constructor(app : App, plugin : GlobalTicker) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions() : SettingDefinitionItem < keyof GlobalTickerSettings > [] {
        return [
            {
                type: "group",
                heading: "Global settings",
                items: [
                    {
                        name: "Date format",
                        desc: "Choose the date format used in the refresh footer.",
                        render: (setting) => {
                            setting.addDropdown(dropdown => dropdown
                                .addOption("dmy", "Day/month/year")
                                .addOption("mdy", "Month/day/year")
                                .setValue(this.plugin.settings.useUsDateFormat ? "mdy" : "dmy")
                                .onChange((value) => {
                                    void(async() => {
                                        this.plugin.settings.useUsDateFormat = value === "mdy";
                                        await this.plugin.saveSettings();
                                        await this.plugin.refreshPanels();
                                    })();
                                }));
                        },
                    },
                    {
                        name: "Refresh on app open",
                        desc: "Refresh headlines and stocks when Obsidian starts.",
                        control: {type: "toggle", key: "refreshOnAppOpen"},
                    },
                    {
                        name: "Pause on hover",
                        desc: "Pause ticker scrolling while the pointer is over it.",
                        control: {type: "toggle", key: "pauseOnHover"},
                    },
                ],
            },
            getCurrentsSettingDefinitions(this.plugin),
            getFinnhubSettingDefinitions(this.plugin),
        ];
    }

    getControlValue(key : string) : unknown {
        if ((key === "currentsTextColor" || key === "finnhubPriceColor") && !this.plugin.settings[key]) {
            return getTextFaintHex();
        }
        return super.getControlValue(key);
    }

    async setControlValue(key : string, value : unknown) : Promise < void > {
        const trimmedKeys = new Set([
            "currentsCategory",
            "currentsDomains",
            "currentsExcludeDomains",
        ]);
        let normalizedValue = typeof value === "string" && trimmedKeys.has(key)
            ? value.trim()
            : value;
        if ((key === "currentsTextColor" || key === "finnhubPriceColor") &&
            typeof normalizedValue === "string" &&
            normalizedValue.toLowerCase() === getTextFaintHex().toLowerCase()) {
            normalizedValue = "";
        }

        await super.setControlValue(key, normalizedValue);

        const panelKeys = new Set([
            "useUsDateFormat",
            "pauseOnHover",
            "showCurrentsTicker",
            "showFinnhubTicker",
            "showCurrentsFooter",
            "showFinnhubFooter",
            "showHeadlineMeta",
        ]);
        if (panelKeys.has(key)) {
            await this.plugin.refreshPanels();
            return;
        }

        const tickerKeys = new Set([
            "currentsTickerSpeed",
            "currentsTickerDirection",
            "finnhubTickerSpeed",
            "finnhubTickerDirection",
        ]);
        if (tickerKeys.has(key)) {
            this.plugin.updateTickerSettings();
            return;
        }

        const colorKeys = new Set([
            "currentsTextColor",
            "finnhubChangeColor",
            "finnhubChangeNegativeColor",
            "finnhubPriceColor",
        ]);
        if (colorKeys.has(key)) {
            this.plugin.updateTickerColors();
        }
    }
}
