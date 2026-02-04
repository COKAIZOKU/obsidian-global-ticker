import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";

export type TickerSpeed = "fast" | "slow" | "medium" | "very-slow";
export type TickerDirection = "left" | "right";

export interface MyPluginSettings {
	mySetting: string;
	newsTickerSpeed: TickerSpeed;
	stockTickerSpeed: TickerSpeed;
	newsTickerDirection: TickerDirection;
	stockTickerDirection: TickerDirection;
	tickerSpeed?: TickerSpeed;
	stockChangeColor: string;
	stockChangeNegativeColor: string;
	stockPriceColor: string;
	alpacaApiKey: string;
	alpacaApiSecret: string;
	alpacaDataBaseUrl: string;
	alpacaSymbols: string;
	currentsApiKey: string;
	currentsCategory: string;
	currentsLimit: number;
	currentsRegion: string;
	currentsLanguage: string;
	currentsDomains: string;
	currentsExcludeDomains: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	newsTickerSpeed: "slow",
	stockTickerSpeed: "slow",
	newsTickerDirection: "left",
	stockTickerDirection: "left",
	stockChangeColor: "",
	stockChangeNegativeColor: "",
	stockPriceColor: "",
	alpacaApiKey: "",
	alpacaApiSecret: "",
	alpacaDataBaseUrl: "https://data.alpaca.markets/v2",
	alpacaSymbols: "AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META",
	currentsApiKey: "",
	currentsCategory: "",
	currentsLimit: 5,
	currentsRegion: "",
	currentsLanguage: "",
	currentsDomains: "",
	currentsExcludeDomains: ""
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
	["vi", "Vietnamese"],
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

		containerEl.createEl('div', {text: 'News Settings', cls: 'setting-item-name setting-section-header'});
		const descNewsSettings = createFragment();
		descNewsSettings.appendText('Settings for the news ticker. The news are fetched from the ');
		descNewsSettings.appendChild(createEl('a', {text: 'Currents News API', href: 'https://currentsapi.services/'}));
		descNewsSettings.appendText('. Beware the amount of headlines displayed depends on the available headlines. For example, if you set the limit to 10 but only 5 headlines are available for your specified settings, only 5 will be shown.');
		containerEl.createEl('div', {
			cls: 'setting-item-description setting-section-description'
		}).appendChild(descNewsSettings);

		new Setting(containerEl)
			.setName('News ticker speed')
			.setDesc('Choose how fast the news ticker scrolls.')
			.addDropdown(dropdown => dropdown
				.addOption("very-slow", "Very Slow")
				.addOption("slow", "Slow")
				.addOption("medium", "Medium")
				.addOption("fast", "Fast")
				.setValue(this.plugin.settings.newsTickerSpeed)
				.onChange(async (value) => {
					if (
						value !== "very-slow" &&
						value !== "slow" &&
						value !== "fast" &&
						value !== "medium"
					) {
						return;
					}
					this.plugin.settings.newsTickerSpeed = value;
					await this.plugin.saveSettings();
					this.plugin.updateTickerSettings();
				}));

		new Setting(containerEl)
			.setName('News ticker direction')
			.setDesc('Choose the scrolling direction for the news ticker.')
			.addDropdown(dropdown => dropdown
				.addOption("left", "Left")
				.addOption("right", "Right")
				.setValue(this.plugin.settings.newsTickerDirection)
				.onChange(async (value) => {
					if (value !== "left" && value !== "right") {
						return;
					}
					this.plugin.settings.newsTickerDirection = value;
					await this.plugin.saveSettings();
					this.plugin.updateTickerSettings();
				}));

		const descCurrentsKey = createFragment();
		descCurrentsKey.appendText('Used to fetch live headlines, without it you will only see placeholder headlines. Get the free Currents API key by creating an account ');
		descCurrentsKey.appendChild(createEl('a', {text: 'here', href: 'https://currentsapi.services/en/register'}));
		descCurrentsKey.appendText('.');
		
		new Setting(containerEl)
			.setName('Currents API key')
			.setDesc(descCurrentsKey)
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
			.addTextArea(text => text
				.setPlaceholder('e.g. science, food')
				.setValue(this.plugin.settings.currentsCategory)
				.onChange(async (value) => {
					this.plugin.settings.currentsCategory = value.trim();
					await this.plugin.saveSettings();
				}));
		const descDomains = createFragment();
		descDomains.appendText('Filter headlines by source domains. To see if a domain is supported, search for it ');
		descDomains.appendChild(createEl('a', {text: 'here', href: 'https://www.currentsapi.services/en/statistic/'}));
		descDomains.appendText('.');

		new Setting(containerEl)
			.setName('Domains')
			.setDesc(descDomains)
			.addTextArea(text => text
				.setPlaceholder('e.g. bbc.com, nytimes.com')
				.setValue(this.plugin.settings.currentsDomains)
				.onChange(async (value) => {
					this.plugin.settings.currentsDomains = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Exclude domains')
			.setDesc('Exclude headlines from specific domains.')
			.addTextArea(text => text
				.setPlaceholder('e.g. bbc.com, nytimes.com')
				.setValue(this.plugin.settings.currentsExcludeDomains)
				.onChange(async (value) => {
					this.plugin.settings.currentsExcludeDomains = value.trim();
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
			.setDesc('Number of headlines to fetch. The limit is 10 with the free API key.')
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
			.setDesc('Fetch fresh headlines. The limit is 20 requests daily with the free API key.')
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

		containerEl.createEl('div', {text: 'Stocks Settings', cls: 'setting-item-name setting-section-header margin-top'});
		const descStockSettings = createFragment();
		descStockSettings.appendText('Settings for the stocks ticker. The stocks are fetched from the ');
		descStockSettings.appendChild(createEl('a', {text: 'Alpaca Market Data API', href: 'https://docs.alpaca.markets/'}));
		descStockSettings.appendText('.');
		containerEl.createEl('div', {
			cls: 'setting-item-description setting-section-description'
		}).appendChild(descStockSettings);

		new Setting(containerEl)
			.setName('Stocks ticker speed')
			.setDesc('Choose how fast the stocks ticker scrolls.')
			.addDropdown(dropdown => dropdown
				.addOption("very-slow", "Very Slow")
				.addOption("slow", "Slow")
				.addOption("medium", "Medium")
				.addOption("fast", "Fast")
				.setValue(this.plugin.settings.stockTickerSpeed)
				.onChange(async (value) => {
					if (
						value !== "very-slow" &&
						value !== "slow" &&
						value !== "fast" &&
						value !== "medium"
					) {
						return;
					}
					this.plugin.settings.stockTickerSpeed = value;
					await this.plugin.saveSettings();
					this.plugin.updateTickerSettings();
				}));

		new Setting(containerEl)
			.setName('Stocks ticker direction')
			.setDesc('Choose the scrolling direction for the stocks ticker.')
			.addDropdown(dropdown => dropdown
				.addOption("left", "Left")
				.addOption("right", "Right")
				.setValue(this.plugin.settings.stockTickerDirection)
				.onChange(async (value) => {
					if (value !== "left" && value !== "right") {
						return;
					}
					this.plugin.settings.stockTickerDirection = value;
					await this.plugin.saveSettings();
					this.plugin.updateTickerSettings();
				}));

		const descAlpacaKey = createFragment();
		descAlpacaKey.appendText('Used to fetch stocks data. without it you will only see placeholder stocks data. Get the free Alpaca API key by creating an account ');
		descAlpacaKey.appendChild(createEl('a', {text: 'here', href: 'https://app.alpaca.markets/account/login?ref=alpaca.markets'}));
		descAlpacaKey.appendText('.');

		new Setting(containerEl)
			.setName('Alpaca API key')
			.setDesc(descAlpacaKey)
			.addText(text => text
				.setPlaceholder('Enter your Alpaca API key')
				.setValue(this.plugin.settings.alpacaApiKey)
				.onChange(async (value) => {
					this.plugin.settings.alpacaApiKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Alpaca API secret')
			.setDesc('Your Alpaca API secret.')
			.addText(text => {
				text.inputEl.type = "password";
				text
					.setPlaceholder('Enter your Alpaca API secret')
					.setValue(this.plugin.settings.alpacaApiSecret)
					.onChange(async (value) => {
						this.plugin.settings.alpacaApiSecret = value.trim();
						await this.plugin.saveSettings();
					});
			});
		
		const descDataUrl = createFragment();
		descDataUrl.appendText('Defaults to ');
		descDataUrl.appendChild(createEl('code', {text: 'https://data.alpaca.markets/v2'}));
		descDataUrl.appendText('. Change this only if you are using a different Alpaca data provider. Only ');
		descDataUrl.appendChild(createEl('code', {text: 'https://'}));;
		descDataUrl.appendText(' URLs are allowed for security reasons.');

		new Setting(containerEl)
			.setName('Data base URL')
			.setDesc(descDataUrl)
			.addText(text => text
				.setPlaceholder('https://data.alpaca.markets/v2')
				.setValue(this.plugin.settings.alpacaDataBaseUrl)
				.onChange(async (value) => {
					const trimmed = value.trim();
					if (/^http:\/\//i.test(trimmed)) {
						new Notice("Please use https:// for the Alpaca data base URL.");
						text.setValue(this.plugin.settings.alpacaDataBaseUrl);
						return;
					}
					this.plugin.settings.alpacaDataBaseUrl = trimmed;
					await this.plugin.saveSettings();
				}));

		const descStockSymbols = createFragment();
		descStockSymbols.appendText('Comma-separated list of stocks ticker symbols to display. To see the full list of supported symbols, check the ');
		descStockSymbols.appendChild(createEl('a', {text: 'assets list', href: 'https://docs.alpaca.markets/reference/get-v2-assets-1'}));
		descStockSymbols.appendText('.');

		new Setting(containerEl)
			.setName('Stocks symbols')
			.setDesc(descStockSymbols)
			.addTextArea(text => text
				.setPlaceholder('e.g. AAPL, MSFT, TSLA')
				.setValue(this.plugin.settings.alpacaSymbols)
				.onChange(async (value) => {
					this.plugin.settings.alpacaSymbols = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Stocks positive change color')
			.setDesc('Use any hex color. Leave blank to use the theme default.')
			.addText(text => text
				.setPlaceholder('e.g. #a68af6')
				.setValue(this.plugin.settings.stockChangeColor)
				.onChange(async (value) => {
					this.plugin.settings.stockChangeColor = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateTickerColors();
				}));

		new Setting(containerEl)
			.setName('Stocks negative change color')
			.setDesc('Use any hex color. Leave blank to use the theme default.')
			.addText(text => text
				.setPlaceholder('e.g. #fb464c')
				.setValue(this.plugin.settings.stockChangeNegativeColor)
				.onChange(async (value) => {
					this.plugin.settings.stockChangeNegativeColor = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateTickerColors();
				}));

		new Setting(containerEl)
			.setName('Stocks price color')
			.setDesc('Use any hex color. Leave blank to use the theme default.')
			.addText(text => text
				.setPlaceholder('e.g. #666666')
				.setValue(this.plugin.settings.stockPriceColor)
				.onChange(async (value) => {
					this.plugin.settings.stockPriceColor = value.trim();
					await this.plugin.saveSettings();
					this.plugin.updateTickerColors();
				}));
		
		new Setting(containerEl)
			.setName('Refresh stocks data')
			.setDesc('Fetch the latest stocks quotes.')
			.addButton(button => {
				button
					.setButtonText('Refresh')
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						button.setButtonText("Refreshing...");
						try {
							await this.plugin.refreshStocks();
							new Notice("Stocks data refreshed.");
						} catch (error) {
							console.error("Failed to refresh stocks data", error);
							new Notice("Failed to refresh stocks data. Check your Alpaca credentials and connection.");
						} finally {
							button.setDisabled(false);
							button.setButtonText("Refresh");
						}
					});
			});
	}
}
