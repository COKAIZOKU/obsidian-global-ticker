import {App, Notice, SecretComponent, Setting} from "obsidian";
import type GlobalTicker from "../main";
import type {TickerDirection, TickerSpeed}
from "../settings";

const createLinkFragment = (leadingText : string, linkText : string, href : string, trailingText : string) : DocumentFragment => {
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

const createSettingGroup = (containerEl : HTMLElement, title : string) : HTMLElement => {
    const groupEl = containerEl.createDiv({cls: "setting-group"});
    groupEl.createEl("div", {
        text: title,
        cls: "setting-item-name setting-section-header"
    });
    return groupEl.createDiv({cls: "setting-items"});
};

const addTickerSpeedAndDirectionSetting = (groupEl : HTMLElement, name : string, desc : string, speedValue : TickerSpeed, directionValue : TickerDirection, onSpeedChange : (value : TickerSpeed) => Promise < void >, onDirectionChange : (value : TickerDirection) => Promise < void >) => {
    const setting = new Setting(groupEl)
        .setName(name)
        .setDesc(desc);

    setting.addDropdown(dropdown => dropdown.addOption("very-slow", "Very slow").addOption("slow", "Slow").addOption("medium", "Medium").addOption("fast", "Fast").setValue(speedValue).onChange((value) => {
        if (value !== "very-slow" && value !== "slow" && value !== "medium" && value !== "fast") {
            return;
        }
        void onSpeedChange(value);
    })).addDropdown(dropdown => dropdown.addOption("left", "Left").addOption("right", "Right").setValue(directionValue).onChange((value) => {
        if (value !== "left" && value !== "right") {
            return;
        }
        void onDirectionChange(value);
    }));
};

export const addFinnhubSettings = (containerEl : HTMLElement, app : App, plugin : GlobalTicker, redisplay : () => void) : void => {
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

    // Stocks Settings Section

    const finnhubGroupEl = createSettingGroup(containerEl, "Finnhub stocks settings");

    const descFinnhubKey = createLinkFragment("Used to fetch stocks data. Get a free Finnhub API key by creating an account ", "here", "https://finnhub.io", ".");

    new Setting(finnhubGroupEl)
        .setName('Finnhub API key')
        .setDesc(descFinnhubKey)
        .addComponent(el => new SecretComponent(app, el).setValue(plugin.settings.finnhubApiKey).onChange((value) => {
            void(async() => {
                const normalized = (value ?? "").trim();
                plugin.settings.finnhubApiKey = normalized;
                await saveSettingsOnly();
            })();
        }));

    const descStockSymbols = "Comma-separated list of stocks ticker symbols to display.";
    new Setting(finnhubGroupEl)
        .setName('Stocks symbols')
        .setDesc(descStockSymbols)
        .addTextArea(text => text.setPlaceholder('Aapl, msft, tsla').setValue(plugin.settings.finnhubSymbols).onChange((value) => {
            void(async() => {
                plugin.settings.finnhubSymbols = value;
                await saveSettingsOnly();
            })();
        }));

    new Setting(finnhubGroupEl)
        .setName('Stocks positive change color')
        .setDesc('Select any color.')
        .addColorPicker(color => color.setValue(plugin.settings.finnhubChangeColor || '#a68af6').onChange((value) => {
            void(async() => {
                plugin.settings.finnhubChangeColor = value.trim();
                await saveSettingsAndUpdateTickerColors();
            })();
        }))
        .addExtraButton(button => {
            button
                .setIcon('reset')
                .setTooltip('Use theme default')
                .onClick(() => {
                    void(async() => {
                        plugin.settings.finnhubChangeColor = "";
                        await saveSettingsAndUpdateTickerColors();
                        redisplay();
                    })();
                });
        });

    new Setting(finnhubGroupEl)
        .setName('Stocks negative change color')
        .setDesc('Select any color.')
        .addColorPicker(color => color.setValue(plugin.settings.finnhubChangeNegativeColor || '#fb464c').onChange((value) => {
            void(async() => {
                plugin.settings.finnhubChangeNegativeColor = value.trim();
                await saveSettingsAndUpdateTickerColors();
            })();
        }))
        .addExtraButton(button => {
            button
                .setIcon('reset')
                .setTooltip('Use theme default')
                .onClick(() => {
                    void(async() => {
                        plugin.settings.finnhubChangeNegativeColor = "";
                        await saveSettingsAndUpdateTickerColors();
                        redisplay();
                    })();
                });
        });

    new Setting(finnhubGroupEl)
        .setName('Stocks price color')
        .setDesc('Select any color.')
        .addColorPicker(color => color.setValue(plugin.settings.finnhubPriceColor || '#666666').onChange((value) => {
            void(async() => {
                plugin.settings.finnhubPriceColor = value.trim();
                await saveSettingsAndUpdateTickerColors();
            })();
        }))
        .addExtraButton(button => {
            button
                .setIcon('reset')
                .setTooltip('Use theme default')
                .onClick(() => {
                    void(async() => {
                        plugin.settings.finnhubPriceColor = "";
                        await saveSettingsAndUpdateTickerColors();
                        redisplay();
                    })();
                });
        });

    addTickerSpeedAndDirectionSetting(finnhubGroupEl, "Stocks ticker speed and direction", "Choose how fast the stocks ticker scrolls and its direction.", plugin.settings.finnhubTickerSpeed, plugin.settings.finnhubTickerDirection, async(value) => {
        plugin.settings.finnhubTickerSpeed = value;
        await saveSettingsAndUpdateTickerSettings();
    }, async(value) => {
        plugin.settings.finnhubTickerDirection = value;
        await saveSettingsAndUpdateTickerSettings();
    });

    new Setting(finnhubGroupEl)
        .setName("Show stocks footer")
        .setDesc("Toggle the last refreshed info and refresh button for stocks.")
        .addToggle(toggle => {
            toggle
                .setValue(plugin.settings.showFinnhubFooter)
                .onChange((value) => {
                    void(async() => {
                        plugin.settings.showFinnhubFooter = value;
                        await saveSettingsAndRefreshPanels();
                    })();
                });
        });

    new Setting(finnhubGroupEl)
        .setName('Refresh stocks data')
        .setDesc('Fetch the latest stocks quotes.')
        .addButton(button => {
            button
                .setButtonText('Refresh')
                .setCta()
                .onClick(() => {
                    void(async() => {
                        button.setDisabled(true);
                        button.setButtonText("Refreshing...");
                        try {
                            const refreshed = await plugin.refreshFinnhub();
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
};
