import {
    App,
    Notice,
    PluginSettingTab,
    SecretComponent,
    Setting,
} from "obsidian";
import GlobalTicker from "./main";

export type TickerSpeed = "fast" | "slow" | "medium" | "very-slow";
export type TickerDirection = "left" | "right";
export type TickerDisplayMode = "both" | "news" | "stocks";

// Some ESLint rules are disabled because it's pointing at my texts that are separated to give it a link
// Also not sure if its necessary that the text placeholder for the text box is needed, is just based off 
// The example that is already in Obsidian, which is '.obsidian' on the Files and links settings

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

const createLinkFragment = (
    leadingText: string,
    linkText: string,
    href: string,
    trailingText: string
): DocumentFragment => {
    const fragment = document.createDocumentFragment();
    if (leadingText) {
        fragment.append(document.createTextNode(leadingText));
    }
    const link = document.createElement("a");
    link.textContent = linkText;
    link.href = href;
    fragment.append(link);
    if (trailingText) {
        fragment.append(document.createTextNode(trailingText));
    }
    return fragment;
};

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
            text: 'Global settings',
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
                    .onChange((value) => {
                        void (async() => {
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
                        })();
                    });
            });

        new Setting(containerEl)
            .setName("Date format")
            .setDesc("Choose the date format used in the refresh footer.")
            .addDropdown(dropdown => {
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                dropdown.addOption("dmy", "dd/mm/yy");
                // eslint-disable-next-line obsidianmd/ui/sentence-case
                dropdown.addOption("mdy", "mm/dd/yy");
                dropdown
                    .setValue(this.plugin.settings.useUsDateFormat
                    ? "mdy"
                    : "dmy")
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.useUsDateFormat = value === "mdy";
                            await this
                                .plugin
                                .saveSettings();
                            await this
                                .plugin
                                .refreshPanels();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName("Refresh on app open")
            .setDesc("Refresh headlines and stocks when Obsidian starts.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.refreshOnAppOpen)
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.refreshOnAppOpen = value;
                            await this
                                .plugin
                                .saveSettings();
                        })();
                    });
            });

		// News Settings Section

        containerEl.createEl('div', {
            text: 'News settings',
            cls: 'setting-item-name setting-section-header setting-section-header-margin-top'
        });

        const descCurrentsKey = createLinkFragment(
            "Used to fetch live headlines. Get a free Currents API key by creating an account ",
            "here",
            "https://currentsapi.services/",
            "."
        );

        new Setting(containerEl)
            .setName('Currents API key')
            .setDesc(descCurrentsKey)
            .addComponent(el => new SecretComponent(this.app, el)
                .setValue(this.plugin.settings.currentsApiKey)
                .onChange((value) => {
                    void (async() => {
                        const normalized = (value ?? "").trim();
                        this.plugin.settings.currentsApiKey = normalized;
                        await this
                            .plugin
                            .saveSettings();
                    })();
                }));

        const descCategory = createLinkFragment(
            "By default all categories are included. Some supported categories are: regional, business, science, sports, technology, general, entertainment, food, lifestyle, programming, world, health. For all categories available, visit the ",
            "documentation",
            "https://api.currentsapi.services/v1/available/categories",
            "."
        );

        new Setting(containerEl)
            .setName('Categories')
            .setDesc(descCategory)
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .addTextArea(text => text.setPlaceholder('e.g. science, food').setValue(this.plugin.settings.currentsCategory).onChange((value) => {
                void (async() => {
                    this.plugin.settings.currentsCategory = value.trim();
                    await this
                        .plugin
                        .saveSettings();
                })();
            }));
        const descDomains = createLinkFragment(
            "Filter headlines by source domains. To see if a domain is supported, search for it ",
            "here",
            "https://www.currentsapi.services/en/statistic/",
            ". "
        );

        new Setting(containerEl)
            .setName('Domains')
            .setDesc(descDomains)
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .addTextArea(text => text.setPlaceholder('e.g. bbc.com, nytimes.com').setValue(this.plugin.settings.currentsDomains).onChange((value) => {
                void (async() => {
                    this.plugin.settings.currentsDomains = value.trim();
                    await this
                        .plugin
                        .saveSettings();
                })();
            }));

        new Setting(containerEl)
            .setName('Exclude domains')
            .setDesc('Exclude headlines from specific domains. If a domain appears in both the included and excluded domains, it will be excluded.')
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .addTextArea(text => text.setPlaceholder('e.g. bbc.com, nytimes.com').setValue(this.plugin.settings.currentsExcludeDomains).onChange((value) => {
                void (async() => {
                    this.plugin.settings.currentsExcludeDomains = value.trim();
                    await this
                        .plugin
                        .saveSettings();
                })();
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
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.currentsRegion = value;
                            await this
                                .plugin
                                .saveSettings();
                        })();
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
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.currentsLanguage = value;
                            await this
                                .plugin
                                .saveSettings();
                        })();
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
                    .onChange((value) => {
                        void (async() => {
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
                        })();
                    });
            });

        const settingNewsDirectionSpeed = new Setting(containerEl)
            .setName("News ticker speed and direction")
            .setDesc("Choose how fast the news ticker scrolls and its direction.");
        settingNewsDirectionSpeed.addDropdown(dropdown => dropdown.addOption("very-slow", "Very slow").addOption("slow", "Slow").addOption("medium", "Medium").addOption("fast", "Fast").setValue(this.plugin.settings.newsTickerSpeed).onChange((value) => {
            if (value !== "very-slow" && value !== "slow" && value !== "fast" && value !== "medium") {
                return;
            }
            void (async() => {
                this.plugin.settings.newsTickerSpeed = value;
                await this
                    .plugin
                    .saveSettings();
                this
                    .plugin
                    .updateTickerSettings();
            })();
        })).addDropdown(dropdown => dropdown.addOption("left", "Left").addOption("right", "Right").setValue(this.plugin.settings.newsTickerDirection).onChange((value) => {
            if (value !== "left" && value !== "right") {
                return;
            }
            void (async() => {
                this.plugin.settings.newsTickerDirection = value;
                await this
                    .plugin
                    .saveSettings();
                this
                    .plugin
                    .updateTickerSettings();
            })();
        }));

        new Setting(containerEl)
            .setName("Show news footer")
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .setDesc("Toggle the last refreshed info and refresh button for news. Beware of the daily limit of 20 requests with the free Currents API key.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.showNewsFooter)
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.showNewsFooter = value;
                            await this
                                .plugin
                                .saveSettings();
                            await this
                                .plugin
                                .refreshPanels();
                        })();
                    });
            });
        new Setting(containerEl)
            .setName("Show headline underline")
            .setDesc("Toggle the source and category line under each headline.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.showHeadlineMeta)
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.showHeadlineMeta = value;
                            await this
                                .plugin
                                .saveSettings();
                            await this
                                .plugin
                                .refreshPanels();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName('Refresh headlines')
            .setDesc('Fetch fresh headlines. The limit is 20 requests daily with the free API key.')
            .addButton(button => {
                button
                    .setButtonText('Refresh')
                    .setCta()
                    .onClick(() => {
                        void (async() => {
                            button.setDisabled(true);
                            button.setButtonText("Refreshing...");
                            try {
                                const refreshed = await this
                                    .plugin
                                    .refreshHeadlines();
                                if (refreshed) {
                                    new Notice("Headlines refreshed.");
                                } else {
                                    new Notice("No headlines refreshed. Check your API key, limit or connection.");
                                }
                            } catch (error) {
                                console.error("Failed to refresh headlines", error);
                                new Notice("Failed to refresh headlines. Check your API key, limit or connection.");
                            } finally {
                                button.setDisabled(false);
                                button.setButtonText("Refresh");
                            }
                        })();
                    });
            });

		// Stocks Settings Section

        containerEl.createEl('div', {
            text: 'Stocks settings',
            cls: 'setting-item-name setting-section-header setting-section-header-margin-top'
        });

        const descFinnhubKey = createLinkFragment(
            "Used to fetch stocks data. Get a free Finnhub API key by creating an account ",
            "here",
            "https://finnhub.io",
            "."
        );

        new Setting(containerEl)
            .setName('Finnhub API key')
            .setDesc(descFinnhubKey)
            .addComponent(el => new SecretComponent(this.app, el)
                .setValue(this.plugin.settings.finnhubApiKey)
                .onChange((value) => {
                    void (async() => {
                        const normalized = (value ?? "").trim();
                        this.plugin.settings.finnhubApiKey = normalized;
                        await this
                            .plugin
                            .saveSettings();
                    })();
                }));

        const descStockSymbols = "Comma-separated list of stocks ticker symbols to display.";
        new Setting(containerEl)
            .setName('Stocks symbols')
            .setDesc(descStockSymbols)
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .addTextArea(text => text.setPlaceholder('e.g. AAPL, MSFT, TSLA').setValue(this.plugin.settings.finnhubSymbols).onChange((value) => {
                void (async() => {
                    this.plugin.settings.finnhubSymbols = value;
                    await this
                        .plugin
                        .saveSettings();
                })();
            }));

        const descHexColors = createLinkFragment(
            "Use any hex color, you can find hex colors ",
            "here",
            "https://htmlcolorcodes.com/",
            ". Leave blank to use the theme default."
        );

        new Setting(containerEl)
            .setName('Stocks positive change color')
            .setDesc(descHexColors)
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .addText(text => text.setPlaceholder('e.g. #a68af6').setValue(this.plugin.settings.stockChangeColor).onChange((value) => {
                void (async() => {
                    this.plugin.settings.stockChangeColor = value.trim();
                    await this
                        .plugin
                        .saveSettings();
                    this
                        .plugin
                        .updateTickerColors();
                })();
            }));

        new Setting(containerEl)
            .setName('Stocks negative change color')
            .setDesc('Use any hex color. Leave blank to use the theme default.')
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .addText(text => text.setPlaceholder('e.g. #fb464c').setValue(this.plugin.settings.stockChangeNegativeColor).onChange((value) => {
                void (async() => {
                    this.plugin.settings.stockChangeNegativeColor = value.trim();
                    await this
                        .plugin
                        .saveSettings();
                    this
                        .plugin
                        .updateTickerColors();
                })();
            }));

        new Setting(containerEl)
            .setName('Stocks price color')
            .setDesc('Use any hex color. Leave blank to use the theme default.')
            // eslint-disable-next-line obsidianmd/ui/sentence-case
            .addText(text => text.setPlaceholder('e.g. #666666').setValue(this.plugin.settings.stockPriceColor).onChange((value) => {
                void (async() => {
                    this.plugin.settings.stockPriceColor = value.trim();
                    await this
                        .plugin
                        .saveSettings();
                    this
                        .plugin
                        .updateTickerColors();
                })();
            }));
        const settingStockDirectionSpeed = new Setting(containerEl)
            .setName("Stocks ticker speed and direction")
            .setDesc("Choose how fast the stocks ticker scrolls and its direction.");

        settingStockDirectionSpeed.addDropdown(dropdown => dropdown.addOption("very-slow", "Very slow").addOption("slow", "Slow").addOption("medium", "Medium").addOption("fast", "Fast").setValue(this.plugin.settings.stockTickerSpeed).onChange((value) => {
            if (value !== "very-slow" && value !== "slow" && value !== "fast" && value !== "medium") {
                return;
            }
            void (async() => {
                this.plugin.settings.stockTickerSpeed = value;
                await this
                    .plugin
                    .saveSettings();
                this
                    .plugin
                    .updateTickerSettings();
            })();
        })).addDropdown(dropdown => dropdown.addOption("left", "Left").addOption("right", "Right").setValue(this.plugin.settings.stockTickerDirection).onChange((value) => {
            if (value !== "left" && value !== "right") {
                return;
            }
            void (async() => {
                this.plugin.settings.stockTickerDirection = value;
                await this
                    .plugin
                    .saveSettings();
                this
                    .plugin
                    .updateTickerSettings();
            })();
        }));

        new Setting(containerEl)
            .setName("Show stocks footer")
            .setDesc("Toggle the last refreshed info and refresh button for stocks.")
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.showStockFooter)
                    .onChange((value) => {
                        void (async() => {
                            this.plugin.settings.showStockFooter = value;
                            await this
                                .plugin
                                .saveSettings();
                            await this
                                .plugin
                                .refreshPanels();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName('Refresh stocks data')
            .setDesc('Fetch the latest stocks quotes.')
            .addButton(button => {
                button
                    .setButtonText('Refresh')
                    .setCta()
                    .onClick(() => {
                        void (async() => {
                            button.setDisabled(true);
                            button.setButtonText("Refreshing...");
                            try {
                                const refreshed = await this
                                    .plugin
                                    .refreshStocks();
                                if (refreshed) {
                                    new Notice("Stocks data refreshed.");
                                } else {
                                    new Notice("No stocks data refreshed. Check your API key, limit or connection.");
                                }
                            } catch (error) {
                                console.error("Failed to refresh stocks data", error);
                                new Notice("Failed to refresh stocks data. Check your API key, limit or connection.");
                            } finally {
                                button.setDisabled(false);
                                button.setButtonText("Refresh");
                            }
                        })();
                    });
            });
    }
}