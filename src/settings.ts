import {App, Notice, PluginSettingTab, SecretComponent, Setting} from "obsidian";
import GlobalTicker from "./main";

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
    tickerDisplayMode : TickerDisplayMode;
    showHeadlineMeta : boolean;
    tickerSpeed?: TickerSpeed;
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
    tickerDisplayMode: "both",
    showHeadlineMeta: true,
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

const CURRENTS_REGIONS : Array < [string, string] > = [
    [
        "", "All regions"
    ],
    [
        "EU", "Europe"
    ],
    [
        "ASIA", "Asia"
    ],
    [
        "INT", "International"
    ],
    [
        "AF", "Afghanistan"
    ],
    [
        "AR", "Argentina"
    ],
    [
        "AU", "Australia"
    ],
    [
        "AT", "Austria"
    ],
    [
        "BD", "Bangladesh"
    ],
    [
        "BE", "Belgium"
    ],
    [
        "BO", "Bolivia"
    ],
    [
        "BA", "Bosnia"
    ],
    [
        "BR", "Brazil"
    ],
    [
        "KH", "Cambodia"
    ],
    [
        "CA", "Canada"
    ],
    [
        "CL", "Chile"
    ],
    [
        "CN", "China"
    ],
    [
        "CO", "Colombia"
    ],
    [
        "CZ", "Czech Republic"
    ],
    [
        "DK", "Denmark"
    ],
    [
        "EC", "Ecuador"
    ],
    [
        "EG", "Egypt"
    ],
    [
        "EE", "Estonia"
    ],
    [
        "FI", "Finland"
    ],
    [
        "FR", "France"
    ],
    [
        "DE", "Germany"
    ],
    [
        "GH", "Ghana"
    ],
    [
        "GR", "Greece"
    ],
    [
        "HK", "Hong Kong"
    ],
    [
        "HU", "Hungary"
    ],
    [
        "IN", "India"
    ],
    [
        "ID", "Indonesia"
    ],
    [
        "IR", "Iran"
    ],
    [
        "IQ", "Iraq"
    ],
    [
        "IE", "Ireland"
    ],
    [
        "IL", "Israel"
    ],
    [
        "IT", "Italy"
    ],
    [
        "JP", "Japan"
    ],
    [
        "KE", "Kenya"
    ],
    [
        "KW", "Kuwait"
    ],
    [
        "LB", "Lebanon"
    ],
    [
        "LU", "Luxembourg"
    ],
    [
        "MY", "Malaysia"
    ],
    [
        "MX", "Mexico"
    ],
    [
        "MM", "Myanmar"
    ],
    [
        "NP", "Nepal"
    ],
    [
        "NL", "Netherlands"
    ],
    [
        "NZ", "New Zealand"
    ],
    [
        "NG", "Nigeria"
    ],
    [
        "NK", "North Korea"
    ],
    [
        "NO", "Norway"
    ],
    [
        "PK", "Pakistan"
    ],
    [
        "PS", "Palestine"
    ],
    [
        "PA", "Panama"
    ],
    [
        "PY", "Paraguay"
    ],
    [
        "PE", "Peru"
    ],
    [
        "PH", "Philippines"
    ],
    [
        "PL", "Poland"
    ],
    [
        "PT", "Portugal"
    ],
    [
        "QA", "Qatar"
    ],
    [
        "RO", "Romania"
    ],
    [
        "RU", "Russia"
    ],
    [
        "SA", "Saudi Arabia"
    ],
    [
        "RS", "Serbia"
    ],
    [
        "SG", "Singapore"
    ],
    [
        "SI", "Slovenia"
    ],
    [
        "KR", "South Korea"
    ],
    [
        "ES", "Spain"
    ],
    [
        "SE", "Sweden"
    ],
    [
        "CH", "Switzerland"
    ],
    [
        "TW", "Taiwan"
    ],
    [
        "TH", "Thailand"
    ],
    [
        "TR", "Turkey"
    ],
    [
        "AE", "United Arab Emirates"
    ],
    [
        "GB", "United Kingdom"
    ],
    [
        "US", "United States"
    ],
    [
        "UY", "Uruguay"
    ],
    [
        "VE", "Venezuela"
    ],
    [
        "VN", "Vietnam"
    ],
    ["ZW", "Zimbabwe"]
];

const CURRENTS_LANGUAGES : Array < [string, string] > = [
    [
        "", "All languages"
    ],
    [
        "ar", "Arabic"
    ],
    [
        "zh", "Chinese"
    ],
    [
        "cs", "Czech"
    ],
    [
        "da", "Danish"
    ],
    [
        "nl", "Dutch"
    ],
    [
        "en", "English"
    ],
    [
        "fi", "Finnish"
    ],
    [
        "fr", "French"
    ],
    [
        "de", "German"
    ],
    [
        "el", "Greek"
    ],
    [
        "hi", "Hindi"
    ],
    [
        "hu", "Hungarian"
    ],
    [
        "it", "Italian"
    ],
    [
        "ja", "Japanese"
    ],
    [
        "ko", "Korean"
    ],
    [
        "msa", "Malay"
    ],
    [
        "pt", "Portuguese"
    ],
    [
        "ru", "Russian"
    ],
    [
        "sr", "Serbian"
    ],
    [
        "es", "Spanish"
    ],
    [
        "th", "Thai"
    ],
    [
        "tr", "Turkish"
    ],
    ["vi", "Vietnamese"]
];

export class GlobalTickerSettingTab extends PluginSettingTab {
    plugin : GlobalTicker;

    constructor(app : App, plugin : GlobalTicker) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() : void {
        const {containerEl} = this;

        containerEl.empty();

		// Global Settings Section

        containerEl.createEl('div', {
            text: 'Global Settings',
            cls: 'setting-item-name setting-section-header'
        });

        new Setting(containerEl)
            .setName("Ticker display")
            .setDesc("Choose which tickers to show in the panel.")
            .addDropdown(dropdown => {
                dropdown.addOption("both", "Both");
                dropdown.addOption("news", "News only");
                dropdown.addOption("stocks", "Stocks only");
                dropdown
                    .setValue(this.plugin.settings.tickerDisplayMode)
                    .onChange(async(value) => {
                        if (value !== "both" && value !== "news" && value !== "stocks") {
                            return;
                        }
                        this.plugin.settings.tickerDisplayMode = value;
                        await this
                            .plugin
                            .saveSettings();
                        await this
                            .plugin
                            .refreshPanels();
                    });
            });

        new Setting(containerEl)
            .setName("Date format")
            .setDesc("Choose the date format used in the refresh footer.")
            .addDropdown(dropdown => {
                dropdown.addOption("dmy", "DD/MM/YY");
                dropdown.addOption("mdy", "MM/DD/YY");
                dropdown
                    .setValue(this.plugin.settings.useUsDateFormat
                    ? "mdy"
                    : "dmy")
                    .onChange(async(value) => {
                        this.plugin.settings.useUsDateFormat = value === "mdy";
                        await this
                            .plugin
                            .saveSettings();
                        await this
                            .plugin
                            .refreshPanels();
                    });
            });

        new Setting(containerEl)
            .setName("Refresh on app open")
            .setDesc("Refresh headlines and stocks when Obsidian starts.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.refreshOnAppOpen)
                    .onChange(async(value) => {
                        this.plugin.settings.refreshOnAppOpen = value;
                        await this
                            .plugin
                            .saveSettings();
                    });
            });

		// News Settings Section

        containerEl.createEl('div', {
            text: 'News Settings',
            cls: 'setting-item-name setting-section-header setting-section-header-margin-top'
        });

        const descCurrentsKey = createFragment();
        descCurrentsKey.appendText('Used to fetch live headlines, without it you will only see placeholder headlines' +
                '. Select a secret from SecretStorage. Get the free Currents API key by creating an account ');
        descCurrentsKey.appendChild(createEl('a', {
            text: 'here',
            href: 'https://currentsapi.services/'
        }));
        descCurrentsKey.appendText('.');

        new Setting(containerEl)
            .setName('Currents API key')
            .setDesc(descCurrentsKey)
            .addComponent(el => new SecretComponent(this.app, el)
                .setValue(this.plugin.settings.currentsApiKey)
                .onChange(async(value) => {
                    const normalized = (value ?? "").trim();
                    this.plugin.settings.currentsApiKey = normalized;
                    await this
                        .plugin
                        .saveSettings();
                }));

        const descCategory = createFragment();
        descCategory.appendText('By default all categories are included. Some supported categories are: regional,' +
                ' business, science, sports, technology, general, entertainment, food, lifestyle,' +
                ' programming, world, health. For all categories available, visit the ');
        descCategory.appendChild(createEl('a', {
            text: 'documentation',
            href: 'https://api.currentsapi.services/v1/available/categories'
        }));
        descCategory.appendText('.');

        new Setting(containerEl)
            .setName('Categories')
            .setDesc(descCategory)
            .addTextArea(text => text.setPlaceholder('e.g. science, food').setValue(this.plugin.settings.currentsCategory).onChange(async(value) => {
                this.plugin.settings.currentsCategory = value.trim();
                await this
                    .plugin
                    .saveSettings();
            }));
        const descDomains = createFragment();
        descDomains.appendText('Filter headlines by source domains. To see if a domain is supported, search for ' +
                'it ');
        descDomains.appendChild(createEl('a', {
            text: 'here',
            href: 'https://www.currentsapi.services/en/statistic/'
        }));
        descDomains.appendText('. ');

        new Setting(containerEl)
            .setName('Domains')
            .setDesc(descDomains)
            .addTextArea(text => text.setPlaceholder('e.g. bbc.com, nytimes.com').setValue(this.plugin.settings.currentsDomains).onChange(async(value) => {
                this.plugin.settings.currentsDomains = value.trim();
                await this
                    .plugin
                    .saveSettings();
            }));

        new Setting(containerEl)
            .setName('Exclude domains')
            .setDesc('Exclude headlines from specific domains. If a domain appears in both the included and excluded domains, it will be excluded.')
            .addTextArea(text => text.setPlaceholder('e.g. bbc.com, nytimes.com').setValue(this.plugin.settings.currentsExcludeDomains).onChange(async(value) => {
                this.plugin.settings.currentsExcludeDomains = value.trim();
                await this
                    .plugin
                    .saveSettings();
            }));

        new Setting(containerEl)
            .setName('Region')
            .setDesc('Filter headlines by region.')
            .addDropdown(dropdown => {
                CURRENTS_REGIONS.forEach(([value, label]) => {
                    dropdown.addOption(value, label);
                });
                dropdown
                    .setValue(this.plugin.settings.currentsRegion)
                    .onChange(async(value) => {
                        this.plugin.settings.currentsRegion = value;
                        await this
                            .plugin
                            .saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Language')
            .setDesc('Filter headlines by language.')
            .addDropdown(dropdown => {
                CURRENTS_LANGUAGES.forEach(([value, label]) => {
                    dropdown.addOption(value, label);
                });
                dropdown
                    .setValue(this.plugin.settings.currentsLanguage)
                    .onChange(async(value) => {
                        this.plugin.settings.currentsLanguage = value;
                        await this
                            .plugin
                            .saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Headline limit')
            .setDesc('Number of headlines to fetch. The limit is 10 with the free API key. Beware the ' +
                    'amount of headlines displayed depends on the available headlines. For example, i' +
                    'f you set the limit to 10 but only 5 headlines are available for your specified ' +
                    'settings, only 5 will be shown.')
            .addText(text => {
                text.inputEl.type = "number";
                text
                    .setPlaceholder('5')
                    .setValue(String(this.plugin.settings.currentsLimit))
                    .onChange(async(value) => {
                        const parsed = Number.parseInt(value, 10);
                        if (Number.isNaN(parsed)) {
                            return;
                        }
                        const clamped = Math.min(10, Math.max(1, parsed));
                        this.plugin.settings.currentsLimit = clamped;
                        text.setValue(String(clamped));
                        await this
                            .plugin
                            .saveSettings();
                    });
            });

        const settingNewsDirectionSpeed = new Setting(containerEl)
            .setName("News ticker speed and direction")
            .setDesc("Choose how fast the news ticker scrolls and its direction.");

        settingNewsDirectionSpeed.addDropdown(dropdown => dropdown.addOption("very-slow", "Very Slow").addOption("slow", "Slow").addOption("medium", "Medium").addOption("fast", "Fast").setValue(this.plugin.settings.newsTickerSpeed).onChange(async(value) => {
            if (value !== "very-slow" && value !== "slow" && value !== "fast" && value !== "medium") {
                return;
            }
            this.plugin.settings.newsTickerSpeed = value;
            await this
                .plugin
                .saveSettings();
            this
                .plugin
                .updateTickerSettings();
        })).addDropdown(dropdown => dropdown.addOption("left", "Left").addOption("right", "Right").setValue(this.plugin.settings.newsTickerDirection).onChange(async(value) => {
            if (value !== "left" && value !== "right") {
                return;
            }
            this.plugin.settings.newsTickerDirection = value;
            await this
                .plugin
                .saveSettings();
            this
                .plugin
                .updateTickerSettings();
        }));

        new Setting(containerEl)
            .setName("Show news footer")
            .setDesc("Toggle the last refreshed info and refresh button for news. Beware of the daily limit of 20 requests with the free Currents API key.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.showNewsFooter)
                    .onChange(async(value) => {
                        this.plugin.settings.showNewsFooter = value;
                        await this
                            .plugin
                            .saveSettings();
                        await this
                            .plugin
                            .refreshPanels();
                    });
            });
        new Setting(containerEl)
            .setName("Show headline underline")
            .setDesc("Toggle the source and category line under each headline.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.showHeadlineMeta)
                    .onChange(async(value) => {
                        this.plugin.settings.showHeadlineMeta = value;
                        await this
                            .plugin
                            .saveSettings();
                        await this
                            .plugin
                            .refreshPanels();
                    });
            });

        new Setting(containerEl)
            .setName('Refresh headlines')
            .setDesc('Fetch fresh headlines. The limit is 20 requests daily with the free API key.')
            .addButton(button => {
                button
                    .setButtonText('Refresh')
                    .setCta()
                    .onClick(async() => {
                        button.setDisabled(true);
                        button.setButtonText("Refreshing...");
                        try {
                            await this
                                .plugin
                                .refreshHeadlines();
                            new Notice("Headlines refreshed.");
                        } catch (error) {
                            console.error("Failed to refresh headlines", error);
                            new Notice("Failed to refresh headlines. Check your API key and connection.");
                        } finally {
                            button.setDisabled(false);
                            button.setButtonText("Refresh");
                        }
                    });
            });

		// Stocks Settings Section

        containerEl.createEl('div', {
            text: 'Stocks Settings',
            cls: 'setting-item-name setting-section-header setting-section-header-margin-top'
        });

        const descFinnhubKey = createFragment();
        descFinnhubKey.appendText('Used to fetch stocks data. without it you will only see placeholder stocks data.' +
                ' Select a secret from SecretStorage. Get the free Finnhub API key by creating an account ');
        descFinnhubKey.appendChild(createEl('a', {
            text: 'here',
            href: 'https://finnhub.io'
        }));
        descFinnhubKey.appendText('.');

        new Setting(containerEl)
            .setName('Finnhub API key')
            .setDesc(descFinnhubKey)
            .addComponent(el => new SecretComponent(this.app, el)
                .setValue(this.plugin.settings.finnhubApiKey)
                .onChange(async(value) => {
                    const normalized = (value ?? "").trim();
                    this.plugin.settings.finnhubApiKey = normalized;
                    await this
                        .plugin
                        .saveSettings();
                }));

        const descStockSymbols = createFragment();
        descStockSymbols.appendText('Comma-separated list of stocks ticker symbols to display.');
        new Setting(containerEl)
            .setName('Stocks symbols')
            .setDesc(descStockSymbols)
            .addTextArea(text => text.setPlaceholder('e.g. AAPL, MSFT, TSLA').setValue(this.plugin.settings.finnhubSymbols).onChange(async(value) => {
                this.plugin.settings.finnhubSymbols = value;
                await this
                    .plugin
                    .saveSettings();
            }));

        const descHexColors = createFragment();
        descHexColors.appendText('Use any hex color, you can find hex colors ');
        descHexColors.appendChild(createEl('a', {
            text: 'here',
            href: 'https://htmlcolorcodes.com/'
        }));
        descHexColors.appendText('. Leave blank to use the theme default.');

        new Setting(containerEl)
            .setName('Stocks positive change color')
            .setDesc(descHexColors)
            .addText(text => text.setPlaceholder('e.g. #a68af6').setValue(this.plugin.settings.stockChangeColor).onChange(async(value) => {
                this.plugin.settings.stockChangeColor = value.trim();
                await this
                    .plugin
                    .saveSettings();
                this
                    .plugin
                    .updateTickerColors();
            }));

        new Setting(containerEl)
            .setName('Stocks negative change color')
            .setDesc('Use any hex color. Leave blank to use the theme default.')
            .addText(text => text.setPlaceholder('e.g. #fb464c').setValue(this.plugin.settings.stockChangeNegativeColor).onChange(async(value) => {
                this.plugin.settings.stockChangeNegativeColor = value.trim();
                await this
                    .plugin
                    .saveSettings();
                this
                    .plugin
                    .updateTickerColors();
            }));

        new Setting(containerEl)
            .setName('Stocks price color')
            .setDesc('Use any hex color. Leave blank to use the theme default.')
            .addText(text => text.setPlaceholder('e.g. #666666').setValue(this.plugin.settings.stockPriceColor).onChange(async(value) => {
                this.plugin.settings.stockPriceColor = value.trim();
                await this
                    .plugin
                    .saveSettings();
                this
                    .plugin
                    .updateTickerColors();
            }));
        const settingStockDirectionSpeed = new Setting(containerEl)
            .setName("Stocks ticker speed and direction")
            .setDesc("Choose how fast the stocks ticker scrolls and its direction.");

        settingStockDirectionSpeed.addDropdown(dropdown => dropdown.addOption("very-slow", "Very Slow").addOption("slow", "Slow").addOption("medium", "Medium").addOption("fast", "Fast").setValue(this.plugin.settings.stockTickerSpeed).onChange(async(value) => {
            if (value !== "very-slow" && value !== "slow" && value !== "fast" && value !== "medium") {
                return;
            }
            this.plugin.settings.stockTickerSpeed = value;
            await this
                .plugin
                .saveSettings();
            this
                .plugin
                .updateTickerSettings();
        })).addDropdown(dropdown => dropdown.addOption("left", "Left").addOption("right", "Right").setValue(this.plugin.settings.stockTickerDirection).onChange(async(value) => {
            if (value !== "left" && value !== "right") {
                return;
            }
            this.plugin.settings.stockTickerDirection = value;
            await this
                .plugin
                .saveSettings();
            this
                .plugin
                .updateTickerSettings();
        }));

        new Setting(containerEl)
            .setName("Show stocks footer")
            .setDesc("Toggle the last refreshed info and refresh button for stocks.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.showStockFooter)
                    .onChange(async(value) => {
                        this.plugin.settings.showStockFooter = value;
                        await this
                            .plugin
                            .saveSettings();
                        await this
                            .plugin
                            .refreshPanels();
                    });
            });

        new Setting(containerEl)
            .setName('Refresh stocks data')
            .setDesc('Fetch the latest stocks quotes.')
            .addButton(button => {
                button
                    .setButtonText('Refresh')
                    .setCta()
                    .onClick(async() => {
                        button.setDisabled(true);
                        button.setButtonText("Refreshing...");
                        try {
                            await this
                                .plugin
                                .refreshStocks();
                            new Notice("Stocks data refreshed.");
                        } catch (error) {
                            console.error("Failed to refresh stocks data", error);
                            new Notice("Failed to refresh stocks data. Check your Finnhub API key and connection.");
                        } finally {
                            button.setDisabled(false);
                            button.setButtonText("Refresh");
                        }
                    });
            });
    }
}
