import {Notice, SecretComponent} from "obsidian";
import type {SettingDefinitionItem}
from "obsidian";
import type GlobalTicker from "../main";
import type {GlobalTickerSettings}
from "../settings";
import {getTextFaintHex} from "./color";

type SettingsKey = keyof GlobalTickerSettings;

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

const CURRENTS_REGIONS : Record < string,
    string > = {
        "": "All regions",
        EU: "Europe",
        ASIA: "Asia",
        INT: "International",
        AF: "Afghanistan",
        AR: "Argentina",
        AU: "Australia",
        AT: "Austria",
        BD: "Bangladesh",
        BE: "Belgium",
        BO: "Bolivia",
        BA: "Bosnia",
        BR: "Brazil",
        KH: "Cambodia",
        CA: "Canada",
        CL: "Chile",
        CN: "China",
        CO: "Colombia",
        CZ: "Czech Republic",
        DK: "Denmark",
        EC: "Ecuador",
        EG: "Egypt",
        EE: "Estonia",
        FI: "Finland",
        FR: "France",
        DE: "Germany",
        GH: "Ghana",
        GR: "Greece",
        HK: "Hong Kong",
        HU: "Hungary",
        IN: "India",
        ID: "Indonesia",
        IR: "Iran",
        IQ: "Iraq",
        IE: "Ireland",
        IL: "Israel",
        IT: "Italy",
        JP: "Japan",
        KE: "Kenya",
        KW: "Kuwait",
        LB: "Lebanon",
        LU: "Luxembourg",
        MY: "Malaysia",
        MX: "Mexico",
        MM: "Myanmar",
        NP: "Nepal",
        NL: "Netherlands",
        NZ: "New Zealand",
        NG: "Nigeria",
        NK: "North Korea",
        NO: "Norway",
        PK: "Pakistan",
        PS: "Palestine",
        PA: "Panama",
        PY: "Paraguay",
        PE: "Peru",
        PH: "Philippines",
        PL: "Poland",
        PT: "Portugal",
        QA: "Qatar",
        RO: "Romania",
        RU: "Russia",
        SA: "Saudi Arabia",
        RS: "Serbia",
        SG: "Singapore",
        SI: "Slovenia",
        KR: "South Korea",
        ES: "Spain",
        SE: "Sweden",
        CH: "Switzerland",
        TW: "Taiwan",
        TH: "Thailand",
        TR: "Turkey",
        AE: "United Arab Emirates",
        GB: "United Kingdom",
        US: "United States",
        UY: "Uruguay",
        VE: "Venezuela",
        VN: "Vietnam",
        ZW: "Zimbabwe"
    };

const CURRENTS_LANGUAGES : Record < string,
    string > = {
        "": "All languages",
        ar: "Arabic",
        zh: "Chinese",
        cs: "Czech",
        da: "Danish",
        nl: "Dutch",
        en: "English",
        fi: "Finnish",
        fr: "French",
        de: "German",
        el: "Greek",
        hi: "Hindi",
        hu: "Hungarian",
        it: "Italian",
        ja: "Japanese",
        ko: "Korean",
        msa: "Malay",
        pt: "Portuguese",
        ru: "Russian",
        sr: "Serbian",
        es: "Spanish",
        th: "Thai",
        tr: "Turkish",
        vi: "Vietnamese"
    };

export const getCurrentsSettingDefinitions = (plugin : GlobalTicker) : SettingDefinitionItem < SettingsKey > => ({
    type: "group",
    heading: "Currents news settings",
    items: [
        {
            name: "Show Currents ticker",
            desc: "Fetch and show Currents news headlines in the panel.",
            control: {
                type: "toggle",
                key: "showCurrentsTicker"
            }
        }, {
            name: "Currents API key",
            desc: createLinkFragment("Used to fetch live headlines. Get a free Currents API key by creating an account" +
                    " ",
            "here", "https://currentsapi.services/", "."),
            render: (setting) => {
                setting.addComponent(el => new SecretComponent(plugin.app, el).setValue(plugin.settings.currentsApiKey).onChange((value) => {
                    plugin.settings.currentsApiKey = (value ?? "").trim();
                    void plugin.saveSettings();
                }));
            }
        }, {
            name: "News ticker speed",
            desc: "Choose how fast the news ticker scrolls.",
            control: {
                type: "dropdown",
                key: "currentsTickerSpeed",
                options: {
                    "very-slow": "Very slow",
                    slow: "Slow",
                    medium: "Medium",
                    fast: "Fast"
                }
            }
        }, {
            name: "News ticker direction",
            desc: "Choose the news ticker direction.",
            control: {
                type: "dropdown",
                key: "currentsTickerDirection",
                options: {
                    left: "Left",
                    right: "Right"
                }
            }
        }, {
            name: "Categories",
            desc: createLinkFragment("By default all categories are included. For all categories available, visit the ", "documentation", "https://api.currentsapi.services/v1/available/categories", "."),
            control: {
                type: "textarea",
                key: "currentsCategory",
                placeholder: "Science, food"
            }
        }, {
            name: "Domains",
            desc: createLinkFragment("Filter headlines by source domains. To see if a domain is supported, search for " +
                    "it ",
            "here", "https://www.currentsapi.services/en/statistic/", "."),
            control: {
                type: "textarea",
                key: "currentsDomains",
                placeholder: "Bbc.com, nytimes.com"
            }
        }, {
            name: "Exclude domains",
            desc: "Exclude headlines from specific domains. If a domain appears in both the include" +
                    "d and excluded domains, it will be excluded.",
            control: {
                type: "textarea",
                key: "currentsExcludeDomains",
                placeholder: "Bbc.com, nytimes.com"
            }
        }, {
            name: "Region",
            desc: "Filter headlines by region.",
            control: {
                type: "dropdown",
                key: "currentsRegion",
                options: CURRENTS_REGIONS
            }
        }, {
            name: "Language",
            desc: "Filter headlines by language.",
            control: {
                type: "dropdown",
                key: "currentsLanguage",
                options: CURRENTS_LANGUAGES
            }
        }, {
            name: "Headline limit",
            desc: "Number of headlines to fetch. The limit is 10 with the free API key.",
            control: {
                type: "number",
                key: "currentsLimit",
                min: 1,
                max: 10,
                step: 1,
                placeholder: "5",
                validate: (value : number) => Number.isInteger(value) && value >= 1 && value <= 10
                    ? undefined
                    : "Enter a whole number from 1 to 10."
            }
        }, {
            name: "Headline underline text color",
            desc: "Select any color.",
            control: {
                type: "color",
                key: "currentsTextColor",
                defaultValue: getTextFaintHex()
            }
        }, {
            name: "Show headline underline",
            desc: "Toggle the source and category line under each headline.",
            control: {
                type: "toggle",
                key: "showHeadlineMeta"
            }
        }, {
            name: "Show news footer",
            desc: "Toggle the last refreshed info and refresh button for news. Beware of the daily " +
                    "limit of 20 requests with the free API key.",
            control: {
                type: "toggle",
                key: "showCurrentsFooter"
            }
        }, {
            name: "Refresh headlines",
            desc: "Fetch fresh headlines. The limit is 20 requests daily with the free API key.",
            render: (setting) => {
                setting.addButton(button => button.setButtonText("Refresh").setCta().onClick(() => {
                    void(async() => {
                        button.setDisabled(true);
                        button.setButtonText("Refreshing...");
                        try {
                            const refreshed = await plugin.refreshHeadlines();
                            new Notice(refreshed
                                ? "Headlines refreshed."
                                : "No headlines refreshed. Check your API key, limit or connection.");
                        } catch (error) {
                            console.error("Failed to refresh headlines", error);
                            new Notice("Failed to refresh headlines. Check your API key, limit or connection.");
                        } finally {
                            button.setDisabled(false);
                            button.setButtonText("Refresh");
                        }
                    })();
                }));
            }
        }
    ]
});
