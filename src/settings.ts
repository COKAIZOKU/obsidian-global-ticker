import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";

export type TickerSpeed = "fast" | "slow" | "medium";

export interface MyPluginSettings {
	mySetting: string;
	tickerSpeed: TickerSpeed;
	stockChangeColor: string;
	stockPriceColor: string;
	currentsApiKey: string;
	currentsCategory: string;
	currentsLimit: number;
	currentsRegion: string;
	currentsLanguage: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	tickerSpeed: "slow",
	stockChangeColor: "",
	stockPriceColor: "",
	currentsApiKey: "",
	currentsCategory: "",
	currentsLimit: 5,
	currentsRegion: "",
	currentsLanguage: ""
}

const CURRENTS_REGIONS: Array<[string, string]> = [
	["", "All regions"],
	["EU", "Europe"],
	["ASIA", "Asia"],
	["INT", "International"],
	["AF", "Afghanistan"],
	["AR", "Argentina"],
	["AU", "Australia"],
	["AT", "Austria"],
	["BD", "Bangladesh"],
	["BE", "Belgium"],
	["BO", "Bolivia"],
	["BA", "Bosnia"],
	["BR", "Brazil"],
	["KH", "Cambodia"],
	["CA", "Canada"],
	["CL", "Chile"],
	["CN", "China"],
	["CO", "Colombia"],
	["CZ", "Czech Republic"],
	["DK", "Denmark"],
	["EC", "Ecuador"],
	["EG", "Egypt"],
	["EE", "Estonia"],
	["FI", "Finland"],
	["FR", "France"],
	["DE", "Germany"],
	["GH", "Ghana"],
	["GR", "Greece"],
	["HK", "Hong Kong"],
	["HU", "Hungary"],
	["IN", "India"],
	["ID", "Indonesia"],
	["IR", "Iran"],
	["IQ", "Iraq"],
	["IE", "Ireland"],
	["IL", "Israel"],
	["IT", "Italy"],
	["JP", "Japan"],
	["KE", "Kenya"],
	["KW", "Kuwait"],
	["LB", "Lebanon"],
	["LU", "Luxembourg"],
	["MY", "Malaysia"],
	["MX", "Mexico"],
	["MM", "Myanmar"],
	["NP", "Nepal"],
	["NL", "Netherlands"],
	["NZ", "New Zealand"],
	["NG", "Nigeria"],
	["NK", "North Korea"],
	["NO", "Norway"],
	["PK", "Pakistan"],
	["PS", "Palestine"],
	["PA", "Panama"],
	["PY", "Paraguay"],
	["PE", "Peru"],
	["PH", "Philippines"],
	["PL", "Poland"],
	["PT", "Portugal"],
	["QA", "Qatar"],
	["RO", "Romania"],
	["RU", "Russia"],
	["SA", "Saudi Arabia"],
	["RS", "Serbia"],
	["SG", "Singapore"],
	["SI", "Slovenia"],
	["KR", "South Korea"],
	["ES", "Spain"],
	["SE", "Sweden"],
	["CH", "Switzerland"],
	["TW", "Taiwan"],
	["TH", "Thailand"],
	["TR", "Turkey"],
	["AE", "United Arab Emirates"],
	["GB", "United Kingdom"],
	["US", "United States"],
	["UY", "Uruguay"],
	["VE", "Venezuela"],
	["VN", "Vietnam"],
	["ZW", "Zimbabwe"],
];

const CURRENTS_LANGUAGES: Array<[string, string]> = [
	["", "All languages"],
	["ar", "Arabic"],
	["zh", "Chinese"],
	["cs", "Czech"],
	["da", "Danish"],
	["nl", "Dutch"],
	["en", "English"],
	["fi", "Finnish"],
	["fr", "French"],
	["de", "German"],
	["el", "Greek"],
	["hi", "Hindi"],
	["hu", "Hungarian"],
	["it", "Italian"],
	["ja", "Japanese"],
	["ko", "Korean"],
	["msa", "Malay"],
	["pt", "Portuguese"],
	["ru", "Russian"],
	["sr", "Serbian"],
	["es", "Spanish"],
	["th", "Thai"],
	["tr", "Turkish"],
	["vi", "Vietnamise"],
];

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Ticker speed')
			.setDesc('Choose how fast the ticker scrolls. The speed depends on the element width, the longer the width, the faster it looks.')
			.addDropdown(dropdown => dropdown
				.addOption("slow", "Slow")
				.addOption("medium", "Medium")
				.addOption("fast", "Fast")
				.setValue(this.plugin.settings.tickerSpeed)
				.onChange(async (value) => {
					if (value !== "slow" && value !== "fast" && value !== "medium") {
						return;
					}
					this.plugin.settings.tickerSpeed = value;
					await this.plugin.saveSettings();
					this.plugin.updateTickerSpeed();
				}));
		
		containerEl.createEl('div', {text: 'News Settings', cls: 'setting-item-name setting-section-header'});
		containerEl.createEl('div', {
			text: 'These settings are for the news ticker. The news are fetched from the Currents News API. Beware the amount of headlines displayed depends on the available headlines.',
			cls: 'setting-item-description setting-section-description'
		});

		const descApi = createFragment();
		descApi.appendText('Used to fetch live headlines. Get the free API key ');
		descApi.appendChild(createEl('a', {text: 'here', href: 'https://currentsapi.services/'}));
		descApi.appendText('.');
		
		new Setting(containerEl)
			.setName('API Key')
			.setDesc(descApi)
			.addText(text => text
				.setPlaceholder('Enter your Currents API key')
				.setValue(this.plugin.settings.currentsApiKey)
				.onChange(async (value) => {
					this.plugin.settings.currentsApiKey = value.trim();
					await this.plugin.saveSettings();
				}));
		
		const descCategory = createFragment();
		descCategory.appendText('By default all categories are included. Some supported categories are: regional, business, science, sports, technology, general, entertainment, food, lifestyle, programming, world, health. For all categories available, visit the ');
		descCategory.appendChild(createEl('a', {text: 'documentation', href: 'https://api.currentsapi.services/v1/available/categories'}));
		descCategory.appendText('.');

		new Setting(containerEl)
			.setName('Categories')
			.setDesc(descCategory)
			.addText(text => text
				.setPlaceholder('e.g. science, food')
				.setValue(this.plugin.settings.currentsCategory)
				.onChange(async (value) => {
					this.plugin.settings.currentsCategory = value.trim();
					await this.plugin.saveSettings();
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
					.onChange(async (value) => {
						this.plugin.settings.currentsRegion = value;
						await this.plugin.saveSettings();
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
					.onChange(async (value) => {
						this.plugin.settings.currentsLanguage = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Headline limit')
			.setDesc('Number of headlines to fetch, the limit is 10 with the free API key.')
			.addText(text => {
				text.inputEl.type = "number";
				text
					.setPlaceholder('3')
					.setValue(String(this.plugin.settings.currentsLimit))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isNaN(parsed)) {
							return;
						}
						const clamped = Math.min(10, Math.max(3, parsed));
						this.plugin.settings.currentsLimit = clamped;
						text.setValue(String(clamped));
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Refresh headlines')
			.setDesc('Fetch fresh headlines.')
			.addButton(button => {
				button
					.setButtonText('Refresh')
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						button.setButtonText("Refreshing...");
						try {
							await this.plugin.refreshHeadlines();
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

		containerEl.createEl('h2', {text: 'Stock Settings'});

		new Setting(containerEl)
			.setName('Stock change color')
			.setDesc('Use any hex color. Leave blank to use the theme default.')
			.addText(text => text
				.setPlaceholder('e.g. #22c55e')
				.setValue(this.plugin.settings.stockChangeColor)
				.onChange(async (value) => {
					this.plugin.settings.stockChangeColor = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateTickerColors();
				}));

		new Setting(containerEl)
			.setName('Stock price color')
			.setDesc('Use any hex color. Leave blank to use the theme default.')
			.addText(text => text
				.setPlaceholder('e.g. #94a3b8')
				.setValue(this.plugin.settings.stockPriceColor)
				.onChange(async (value) => {
					this.plugin.settings.stockPriceColor = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateTickerColors();
				}));
	}
}
