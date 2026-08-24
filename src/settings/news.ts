import {
    App,
    Notice,
    SecretComponent,
    Setting,
} from "obsidian";
import type GlobalTicker from "../main";
import type {TickerDirection, TickerSpeed} from "../settings";

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

const createSettingGroup = (containerEl: HTMLElement, title: string): HTMLElement => {
    const groupEl = containerEl.createDiv({cls: "setting-group"});
    groupEl.createEl("div", {
        text: title,
        cls: "setting-item-name setting-section-header",
    });
    return groupEl.createDiv({cls: "setting-items"});
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

const addTickerSpeedAndDirectionSetting = (
    groupEl: HTMLElement,
    name: string,
    desc: string,
    speedValue: TickerSpeed,
    directionValue: TickerDirection,
    onSpeedChange: (value: TickerSpeed) => Promise<void>,
    onDirectionChange: (value: TickerDirection) => Promise<void>
) => {
    const setting = new Setting(groupEl)
        .setName(name)
        .setDesc(desc);

    setting
        .addDropdown(dropdown => dropdown
            .addOption("very-slow", "Very slow")
            .addOption("slow", "Slow")
            .addOption("medium", "Medium")
            .addOption("fast", "Fast")
            .setValue(speedValue)
            .onChange((value) => {
                if (value !== "very-slow" && value !== "slow" && value !== "medium" && value !== "fast") {
                    return;
                }
                void onSpeedChange(value);
            }))
        .addDropdown(dropdown => dropdown
            .addOption("left", "Left")
            .addOption("right", "Right")
            .setValue(directionValue)
            .onChange((value) => {
                if (value !== "left" && value !== "right") {
                    return;
                }
                void onDirectionChange(value);
            }));
};

export const addNewsSettings = (
    containerEl: HTMLElement,
    app: App,
    plugin: GlobalTicker,
    redisplay: () => void
): void => {
    const saveSettingsOnly = async() => {
        await plugin.saveSettings();
    };
    const saveSettingsAndRefreshPanels = async() => {
        await plugin.saveSettings();
        await plugin.refreshPanels();
    };
    const saveSettingsAndUpdateTickerSettings = async() => {
        await plugin.saveSettings();
        plugin.updateTickerSettings();
    };
    const saveSettingsAndUpdateTickerColors = async() => {
        await plugin.saveSettings();
        plugin.updateTickerColors();
    };

	// News Settings Section

    const newsGroupEl = createSettingGroup(containerEl, "News settings");

    const descCurrentsKey = createLinkFragment(
        "Used to fetch live headlines. Get a free Currents API key by creating an account ",
        "here",
        "https://currentsapi.services/",
        "."
    );

    new Setting(newsGroupEl)
        .setName('Currents API key')
        .setDesc(descCurrentsKey)
        .addComponent(el => new SecretComponent(app, el)
            .setValue(plugin.settings.currentsApiKey)
            .onChange((value) => {
                void (async() => {
                    const normalized = (value ?? "").trim();
                    plugin.settings.currentsApiKey = normalized;
                    await saveSettingsOnly();
                })();
            }));

    const descCategory = createLinkFragment(
        "By default all categories are included. Some supported categories are: regional, business, science, sports, technology, general, entertainment, food, lifestyle, programming, world, health. For all categories available, visit the ",
        "documentation",
        "https://api.currentsapi.services/v1/available/categories",
        "."
    );

    new Setting(newsGroupEl)
        .setName('Categories')
        .setDesc(descCategory)
        .addTextArea(text => text.setPlaceholder('Science, food').setValue(plugin.settings.currentsCategory).onChange((value) => {
            void (async() => {
                plugin.settings.currentsCategory = value.trim();
                await saveSettingsOnly();
            })();
        }));

    const descDomains = createLinkFragment(
        "Filter headlines by source domains. To see if a domain is supported, search for it ",
        "here",
        "https://www.currentsapi.services/en/statistic/",
        ". "
    );

    new Setting(newsGroupEl)
        .setName('Domains')
        .setDesc(descDomains)
        .addTextArea(text => text.setPlaceholder('Bbc.com, nytimes.com').setValue(plugin.settings.currentsDomains).onChange((value) => {
            void (async() => {
                plugin.settings.currentsDomains = value.trim();
                await saveSettingsOnly();
            })();
        }));

    new Setting(newsGroupEl)
        .setName('Exclude domains')
        .setDesc('Exclude headlines from specific domains. If a domain appears in both the included and excluded domains, it will be excluded.')
        .addTextArea(text => text.setPlaceholder('Bbc.com, nytimes.com').setValue(plugin.settings.currentsExcludeDomains).onChange((value) => {
            void (async() => {
                plugin.settings.currentsExcludeDomains = value.trim();
                await saveSettingsOnly();
            })();
        }));

    new Setting(newsGroupEl)
        .setName('Region')
        .setDesc('Filter headlines by region.')
        .addDropdown(dropdown => {
            CURRENTS_REGIONS.forEach(([value, label]) => {
                dropdown.addOption(value, label);
            });
            dropdown
                .setValue(plugin.settings.currentsRegion)
                .onChange((value) => {
                    void (async() => {
                        plugin.settings.currentsRegion = value;
                        await saveSettingsOnly();
                    })();
                });
        });

    new Setting(newsGroupEl)
        .setName('Language')
        .setDesc('Filter headlines by language.')
        .addDropdown(dropdown => {
            CURRENTS_LANGUAGES.forEach(([value, label]) => {
                dropdown.addOption(value, label);
            });
            dropdown
                .setValue(plugin.settings.currentsLanguage)
                .onChange((value) => {
                    void (async() => {
                        plugin.settings.currentsLanguage = value;
                        await saveSettingsOnly();
                    })();
                });
        });

    new Setting(newsGroupEl)
        .setName('Headline limit')
        .setDesc('Number of headlines to fetch. The limit is 10 with the free API key. Beware the ' +
                'amount of headlines displayed depends on the available headlines. For example, i' +
                'f you set the limit to 10 but only 5 headlines are available for your specified ' +
                'settings, only 5 will be shown.')
        .addText(text => {
            text.inputEl.type = "number";
            text
                .setPlaceholder('5')
                .setValue(String(plugin.settings.currentsLimit))
                .onChange((value) => {
                    void (async() => {
                        const parsed = Number.parseInt(value, 10);
                        if (Number.isNaN(parsed)) {
                            return;
                        }
                        const clamped = Math.min(10, Math.max(1, parsed));
                        plugin.settings.currentsLimit = clamped;
                        text.setValue(String(clamped));
                        await saveSettingsOnly();
                    })();
                });
        });

    addTickerSpeedAndDirectionSetting(
        newsGroupEl,
        "News ticker speed and direction",
        "Choose how fast the news ticker scrolls and its direction.",
        plugin.settings.newsTickerSpeed,
        plugin.settings.newsTickerDirection,
        async(value) => {
            plugin.settings.newsTickerSpeed = value;
            await saveSettingsAndUpdateTickerSettings();
        },
        async(value) => {
            plugin.settings.newsTickerDirection = value;
            await saveSettingsAndUpdateTickerSettings();
        }
    );

    new Setting(newsGroupEl)
        .setName("Show news footer")
        .setDesc("Toggle the last refreshed info and refresh button for news. Beware of the daily limit of 20 requests with the free API key.")
        .addToggle(toggle => {
            toggle
                .setValue(plugin.settings.showNewsFooter)
                .onChange((value) => {
                    void (async() => {
                        plugin.settings.showNewsFooter = value;
                        await saveSettingsAndRefreshPanels();
                    })();
                });
        });

    new Setting(newsGroupEl)
        .setName("Show headline underline")
        .setDesc("Toggle the source and category line under each headline.")
        .addToggle(toggle => {
            toggle
                .setValue(plugin.settings.showHeadlineMeta)
                .onChange((value) => {
                    void (async() => {
                        plugin.settings.showHeadlineMeta = value;
                        await saveSettingsAndRefreshPanels();
                    })();
                });
        });

    new Setting(newsGroupEl)
        .setName('Headline underline text color')
        .setDesc('Select any color.')
        .addColorPicker(color => color.setValue(plugin.settings.newsTextColor || '#ffffff').onChange((value) => {
            void (async() => {
                plugin.settings.newsTextColor = value.trim();
                await saveSettingsAndUpdateTickerColors();
            })();
        }))
        .addExtraButton(button => {
            button
                .setIcon('reset')
                .setTooltip('Use theme default')
                .onClick(() => {
                    void (async() => {
                        plugin.settings.newsTextColor = "";
                        await saveSettingsAndUpdateTickerColors();
                        redisplay();
                    })();
                });
        });

    new Setting(newsGroupEl)
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
                            const refreshed = await plugin.refreshHeadlines();
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
};
