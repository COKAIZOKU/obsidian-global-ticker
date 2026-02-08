# Global Ticker Plugin for Obsidian

The **Global Ticker** plugin adds two useful info bars: a top ticker for headline news and a bottom ticker for stock market updates, and it’s all super customizable to your liking! The APIs were picked from the [try Public APIs for free](https://github.com/public-apis/public-apis) repo.

**To use this plugin, you’ll need to register for both APIs to get the data** (they're free!). If that’s not something you’re comfortable with, this plugin might not be for you. The [Obsidian HackerNews](https://github.com/arpitbbhayani/obsidian-hackernews) and [Get Stock Information](https://github.com/mikejongbloet/obsidian-get-stock-information) plugins may be more up your alley, since they don't require registration.

## Settings

General settings found are:
- **Display**: Choose to display the news ticker, the stock ticker, or both.
- **Speed:** Controls the scrolling speed. There are 4 options available: super slow, slow, medium, and fast.
- **Direction:** Sets scrolling direction to left or right.
- **Refresh**: Refresh and fetch information using the individual buttons in each section's settings. There is also an option to refresh headlines and stocks every time Obsidian starts.
- **Footer:** Both tickers have a separate footers that can be shown or hidden. On the left, it displays the last refresh time, with the option to use either dd/mm/yy or mm/dd/yy format. On the right, it includes a button to fetch data without having to open the settings. 

### News Ticker: Currents

The news ticker uses the [Currents News API](https://currentsapi.services/en), which provides global headlines from various sources. The free plan offers up to 20 requests and allows a maximum of 10 headlines.
- `Category:` Filter which news categories you want to see. The list of available categories can be found at `/v1/available/categories`.
- `Domain:` Filter results by specific website domains. Check if the domain is found in the database [here](https://www.currentsapi.services/en/statistic/).
- `Domain_not:` Exclude specific domains from the results.
- `Country:` Filter headlines by region. The list of 70+ supported country codes can be found at `/v1/available/regions`.
- `Language:` Filter headlines by language. The list of 18+ valid language codes be found at `/v1/available/languages`.
- `Limit:` Number of headlines to show, 10 is the limit with the free key.
- **Underline:** Add an underline with the source and category of each headline. Not all fetched headlines have categories, so this field may be empty. If a headline displays a category different from the selected ones, it's because headlines can belong to multiple categories.

The headlines are clickable and will open the original source for more information. Unfortunately, some of them are paywalled :^( so you may want to exclude those domains if you don't have a subscription.

⚠️ _Beware the amount of headlines displayed depends on the **available** headlines. For example, if you set the limit to 10 but only 5 headlines are available for your specified settings, only 5 will be shown._

### Stocks Ticker: Finnhub

The stocks ticker uses the [Finnhub API](https://finnhub.io/) to retrieve global stock quotes. It displays the last fetched price and percentage change. 
- `Symbol:` Select the stock symbols to show. To see which symbols are supported, refer to `/v1/stock/symbol`, which includes a large list of available options.
- **Color:** The price color and the colors for both negative and positive percentage changes are customizable using hex color values.

