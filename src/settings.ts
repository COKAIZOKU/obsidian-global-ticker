import {
    App,
    PluginSettingTab,
    Setting,
} from "obsidian";
import GlobalTicker from "./main";
import {addNewsSettings} from "./settings/news";
import {addStocksSettings} from "./settings/stocks";

export type TickerSpeed = "fast" | "slow" | "medium" | "very-slow";
export type TickerDirection = "left" | "right";
export type TickerDisplayMode = "both" | "news" | "stocks";

export interface GlobalTickerSettings {
    mySetting : string;
    newsTickerSpeed : TickerSpeed;
    stockTickerSpeed : TickerSpeed;
    newsTickerDirection : TickerDirection;
    stockTickerDirection : TickerDirection;
    showNewsFooter : boolean;
    showStockFooter : boolean;
    useUsDateFormat : boolean;
    refreshOnAppOpen : boolean;
    pauseOnHover : boolean;
    tickerDisplayMode : TickerDisplayMode;
    showHeadlineMeta : boolean;
    tickerSpeed?: TickerSpeed;
    newsTextColor : string;
    stockChangeColor : string;
    stockChangeNegativeColor : string;
    stockPriceColor : string;
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
    newsTickerSpeed: "slow",
    stockTickerSpeed: "slow",
    newsTickerDirection: "left",
    stockTickerDirection: "left",
    showNewsFooter: true,
    showStockFooter: true,
    useUsDateFormat: false,
    refreshOnAppOpen: false,
    pauseOnHover: true,
    tickerDisplayMode: "both",
    showHeadlineMeta: true,
    newsTextColor: "",
    stockChangeColor: "",
    stockChangeNegativeColor: "",
    stockPriceColor: "",
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

const createSettingGroup = (containerEl: HTMLElement, title: string): HTMLElement => {
    const groupEl = containerEl.createDiv({cls: "setting-group"});
    groupEl.createEl("div", {
        text: title,
        cls: "setting-item-name setting-section-header",
    });
    return groupEl.createDiv({cls: "setting-items"});
};

export class GlobalTickerSettingTab extends PluginSettingTab {
    plugin : GlobalTicker;

    constructor(app : App, plugin : GlobalTicker) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() : void {
        const {containerEl} = this;
        const saveSettingsOnly = async() => {
            await this.plugin.saveSettings();
        };
        const saveSettingsAndRefreshPanels = async() => {
            await this.plugin.saveSettings();
            await this.plugin.refreshPanels();
        };

        containerEl.empty();

		// Global Settings Section

        const globalGroupEl = createSettingGroup(containerEl, "Global settings");

        new Setting(globalGroupEl)
            .setName("Ticker display")
            .setDesc("Choose which tickers to show in the panel.")
            .addDropdown(dropdown => {
                dropdown.addOption("both", "Both");
                dropdown.addOption("news", "News only");
                dropdown.addOption("stocks", "Stocks only");
                dropdown
                    .setValue(this.plugin.settings.tickerDisplayMode)
                    .onChange((value) => {
                        void (async() => {
                            if (value !== "both" && value !== "news" && value !== "stocks") {
                                return;
                            }
                            this.plugin.settings.tickerDisplayMode = value;
                            await saveSettingsAndRefreshPanels();
                        })();
                    });
            });

        new Setting(globalGroupEl)
            .setName("Date format")
            .setDesc("Choose the date format used in the refresh footer.")
            .addDropdown(dropdown => {
                dropdown.addOption("dmy", "Day/month/year");
                dropdown.addOption("mdy", "Month/day/year");
                dropdown
                    .setValue(this.plugin.settings.useUsDateFormat
                    ? "mdy"
                    : "dmy")
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.useUsDateFormat = value === "mdy";
                            await saveSettingsAndRefreshPanels();
                        })();
                    });
            });

        new Setting(globalGroupEl)
            .setName("Refresh on app open")
            .setDesc("Refresh headlines and stocks when Obsidian starts.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.refreshOnAppOpen)
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.refreshOnAppOpen = value;
                            await saveSettingsOnly();
                        })();
                    });
            });
        new Setting(globalGroupEl)
            .setName("Pause on hover")
            .setDesc("Pause ticker scrolling while the pointer is over it.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.pauseOnHover)
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.pauseOnHover = value;
                            await saveSettingsAndRefreshPanels();
                        })();
                    });
            });

        addNewsSettings(containerEl, this.app, this.plugin, () => this.display());
        addStocksSettings(containerEl, this.app, this.plugin, () => this.display());
    }
}
