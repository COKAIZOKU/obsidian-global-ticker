import type {SettingDefinitionItem} from "obsidian";
import type {GlobalTickerSettings} from "../settings";
import type GlobalTicker from "../main";

export const getXmlSettingDefinitions = (plugin: GlobalTicker): SettingDefinitionItem<keyof GlobalTickerSettings> => ({
    type: "group",
    heading: "XML reader settings",
    items: [
        {
            name: "Show XML reader ticker",
            desc: "Enable requests to your configured RSS websites and show their headlines. No vault contents are sent.",
            control: {type: "toggle", key: "xmlReaderTicker"},
        },
        {
            name: "XML reader ticker speed",
            control: {type: "dropdown", key: "xmlReaderTickerSpeed", options: {
                "very-slow": "Very slow", slow: "Slow", medium: "Medium", fast: "Fast",
            }},
        },
        {
            name: "XML reader ticker direction",
            control: {type: "dropdown", key: "xmlReaderTickerDirection", options: {left: "Left", right: "Right"}},
        },
        {
            name: "RSS feed URLs",
            desc: "Enter RSS XML feed URLs separated by commas. Links without a protocol use HTTPS.",
            control: {type: "textarea", key: "xmlReaderLinks", placeholder: "https://example.com/rss.xml, https://example.org/feed.xml"},
        },
        {
            name: "XML reader headline limit",
            desc: "Total headlines to show, alternating between feeds in URL order.",
            control: {type: "number", key: "xmlReaderHeadlineLimit", min: 1, step: 1, placeholder: "10",
                validate: (value: number) => Number.isSafeInteger(value) && value >= 1
                    ? undefined : "Enter a positive whole number."},
        },
        {
            name: "Refresh XML headlines",
            desc: "Fetch fresh headlines for the enabled XML reader ticker in the open panel.",
            render: setting => {
                setting.addButton(button => {
                    button.setButtonText("Refresh").setCta().onClick(async () => {
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
            },
        },
    ],
});
