import {
    App,
    PluginSettingTab,
    Setting,
} from "obsidian";
import GlobalTicker from "./main";
import {addCurrentsSettings} from "./settings/currents";
import {addFinnhubSettings} from "./settings/finnhub";

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

        addCurrentsSettings(containerEl, this.app, this.plugin, () => this.display());
        addFinnhubSettings(containerEl, this.app, this.plugin, () => this.display());
    }
}
