# Global Ticker Plugin for Obsidian

The **Global Ticker** plugin adds two useful info bars: a top ticker for headline news and a bottom ticker for stock market updates, and it’s all super customizable to your liking! The APIs were picked from the [try Public APIs for free](https://github.com/public-apis/public-apis) repo.

To use this plugin, you’ll need to register for both APIs to get the data (they're free!). If that’s not something you’re comfortable with, this plugin might not be for you. The [Obsidian HackerNews](https://github.com/arpitbbhayani/obsidian-hackernews) and [Get Stock Information](https://github.com/mikejongbloet/obsidian-get-stock-information) plugins may be more up your alley, since they don't require registration.

## News Ticker: Currents News

The news ticker uses the [Currents News API](https://currentsapi.services/en), which provides global news from various sources, including headlines and links. The free plan offers up to 20 requests and allows a maximum of 10 headlines.

### Settings
- `category:` Filter which news categories you want to see. The list of available categories can be found at `/v1/available/categories`.
- `domain:` Filter results by specific website domains. Check if the domain is found in the database [here](https://www.currentsapi.services/en/statistic/).
- `domain_not:` Exclude specific domains from the results.
- `country:` Filter headlines by region. The list of 70+ supported country codes can be found at `/v1/available/regions`.
- `language:` Filter headlines by language. The list of 18+ valid language codes be found at `/v1/available/languages`.
- `limit:` Number of headlines to show, 10 is the limit with the free key.

The headlines are clickable and will open the original source for more information. Unfortunately, some of them are paywalled :( so you may want to exclude those domains if you don't have a subscription.

⚠️ _Beware the amount of headlines displayed depends on the available headlines. For example, if you set the limit to 10 but only 5 headlines are available for your specified settings, only 5 will be shown._

## Stocks Ticker: Alpaca

The stocks ticker uses the [Alpaca API](https://alpaca.markets/), specifically the Market Data API, to get basic stocks information. 

### Settings
- `symbols:` 
