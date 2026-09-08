import {createLinkFragment} from "./function/create-link-fragment";
import type {SettingDefinitionItem}
from "obsidian";
import type {GlobalTickerSettings}
from "../settings";
import type GlobalTicker from "../main";

export const getXmlSettingDefinitions = (plugin : GlobalTicker) : SettingDefinitionItem < keyof GlobalTickerSettings > => ({
    type: "group",
    heading: "XML Reader settings",
    items: [
        {
            name: "Show XML ticker",
            desc: "Enable requests to your configured RSS websites to fetch and show their headline" +
                    "s.",
            control: {
                type: "toggle",
                key: "xmlReaderTicker"
            }
        }, {
            name: "XML ticker speed",
            desc: "Choose how fast the XML ticker scrolls.",
            control: {
                type: "dropdown",
                key: "xmlReaderTickerSpeed",
                options: {
                    "very-slow": "Very slow",
                    slow: "Slow",
                    medium: "Medium",
                    fast: "Fast"
                }
            }
        }, {
            name: "XML ticker direction",
            desc: "Choose the XML ticker direction.",
            control: {
                type: "dropdown",
                key: "xmlReaderTickerDirection",
                options: {
                    left: "Left",
                    right: "Right"
                }
            }
        }, {
            name: "RSS feed URLs",
            desc: createLinkFragment("Enter RSS XML feed URLs separated by commas. Links without a protocol use HTTPS." +
                    " Check for feeds ",
            "here", "https://rss.feedspot.com/world_news_rss_feeds/", "."),
            control: {
                type: "textarea",
                key: "xmlReaderLinks",
                placeholder: "https://example.com/rss.xml, https://example.org/feed.xml"
            }
        }, {
            name: "XML headline limit",
            desc: "Total headlines to show, alternating between feeds in URL order.",
            control: {
                type: "number",
                key: "xmlReaderHeadlineLimit",
                min: 1,
                max: 99,
                step: 1,
                placeholder: "10",
                validate: (value : number) => Number.isInteger(value) && value >= 1 && value <= 99
                    ? undefined
                    : "Enter a positive whole number."
            }
        }, {
            name: "Refresh XML headlines",
            desc: "Fetch fresh XML headlines.",
            render: setting => {
                setting.addButton(button => {
                    button
                        .setButtonText("Refresh")
                        .setCta()
                        .onClick(async() => {
                            button.setDisabled(true);
                            button.setButtonText("Refreshing...");
                            try {
                                await plugin.refreshPanels();
                            } catch (error) {
                                console.error("Failed to refresh XML headlines", error);
                            } finally {
                                button.setDisabled(false);
                                button.setButtonText("Refresh");
                            }
                        });
                });
            }
        }
    ]
});
