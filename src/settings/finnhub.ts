import {createLinkFragment} from "./function/create-link-fragment";
import {Notice, SecretComponent} from "obsidian";
import type {SettingDefinitionItem}
from "obsidian";
import type GlobalTicker from "../main";
import type {GlobalTickerSettings}
from "../settings";
import {getTextFaintHex} from "./function/color";

type SettingsKey = keyof GlobalTickerSettings;

export const getFinnhubSettingDefinitions = (plugin : GlobalTicker) : SettingDefinitionItem < SettingsKey > => ({
    type: "group",
    heading: "Finnhub Stocks settings",
    items: [
        {
            name: "Show Finnhub ticker",
            desc: "Fetch and show Finnhub stocks in the panel.",
            control: {
                type: "toggle",
                key: "showFinnhubTicker"
            }
        }, {
            name: "Finnhub API key",
            desc: createLinkFragment("Used to fetch stocks data. Get a free Finnhub API key by creating an account ", "here", "https://finnhub.io", "."),
            render: (setting) => {
                setting.addComponent(el => new SecretComponent(plugin.app, el).setValue(plugin.settings.finnhubApiKey).onChange((value) => {
                    plugin.settings.finnhubApiKey = (value ?? "").trim();
                    void plugin.saveSettings();
                }));
            }
        }, {
            name: "Stocks ticker speed",
            desc: "Choose how fast the stocks ticker scrolls.",
            control: {
                type: "dropdown",
                key: "finnhubTickerSpeed",
                options: {
                    "very-slow": "Very slow",
                    slow: "Slow",
                    medium: "Medium",
                    fast: "Fast"
                }
            }
        }, {
            name: "Stocks ticker direction",
            desc: "Choose the stocks ticker direction.",
            control: {
                type: "dropdown",
                key: "finnhubTickerDirection",
                options: {
                    left: "Left",
                    right: "Right"
                }
            }
        }, {
            name: "Stocks symbols",
            desc: "Comma-separated list of stocks ticker symbols to display.",
            control: {
                type: "textarea",
                key: "finnhubSymbols",
                placeholder: "Aapl, msft, tsla"
            }
        }, {
            name: "Stocks positive change color",
            desc: "Select any color.",
            control: {
                type: "color",
                key: "finnhubChangeColor",
                defaultValue: "#a68af6"
            }
        }, {
            name: "Stocks negative change color",
            desc: "Select any color.",
            control: {
                type: "color",
                key: "finnhubChangeNegativeColor",
                defaultValue: "#fb464c"
            }
        }, {
            name: "Stocks price color",
            desc: "Select any color.",
            control: {
                type: "color",
                key: "finnhubPriceColor",
                defaultValue: getTextFaintHex()
            }
        }, {
            name: "Refresh stocks data",
            desc: "Fetch the latest stocks quotes.",
            render: (setting) => {
                setting.addButton(button => {
                    button.setButtonText("Refresh").setCta().onClick(() => {
                        void(async() => {
                            button.setDisabled(true);
                            button.setButtonText("Refreshing...");
                            try {
                                const refreshed = await plugin.refreshFinnhub();
                                new Notice(refreshed
                                    ? "Stocks data refreshed."
                                    : "No stocks data refreshed. Check your API key, limit or connection.");
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
    ]
});
