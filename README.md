# Global Ticker for Obsidian

The **Global Ticker** plugin adds customizable information bars to Obsidian, including news Ticker from several sources (Currents, Google News, and Hacker News) and a bottom ticker for stock market updates powered by Finnhub. Most aspects of the tickers can be customized to your liking! The APIs were picked from the [try Public APIs for free](https://github.com/public-apis/public-apis) repository.

![cover](https://github.com/user-attachments/assets/963d00b8-5b7b-4b93-b1ba-f92cddf849ae)

**To use the stocks, you’ll need to register for the Finnhub API to get the data** (it's free!). If you would rather not register for an API, this plugin might not be for you. The [Get Stock Information](https://github.com/mikejongbloet/obsidian-get-stock-information) plugin may be a better alternative, as it doesn't require registration. 

If you only want the Hacker News headlines, [Obsidian HackerNews](https://github.com/arpitbbhayani/obsidian-hackernews) may be a better alternative.

## Index

- [Settings](#settings)
  - [Hacker News](#hacker-news)
  - [Google News](#google-news)
  - [Currents News](#currents-news)
  - [Finnhub Stocks](#finnhub-stocks)
- [Cache](#cache)
- [Limits](#limits)


## Settings

General settings found are:
- **Display**: Choose which ticker to display using the toggle in each ticker's settings section.
- **Speed:** Controls the scrolling speed. Four options are available: super slow, slow, medium, and fast.
- **Direction:** Sets scrolling direction to either left or right.
- **Refresh**: Refresh and fetch information using the individual buttons in each section's settings. There is also an option to refresh headlines every time Obsidian starts.
- **Footer:** Each ticker includes an optional footer that can be shown or hidden.
	- `footer:` On the left, it displays the last refresh time, with the option to use either `dd/mm/yy` or `mm/dd/yy` format. On the right, it includes a button to fetch data without having to open the settings.
- **Underline:** Each ticker, except the Finnhub one, includes an optional underline with metadata. 
	- `underline:` Contains the source and category of each headline. Not all fetched headlines have categories, so this field may be empty. If a headline displays a category different from the selected ones, it's because headlines can belong to multiple categories.
	- **Color:** Pick the color of the underline text.
- **Headline Limit:** Sets the maximum number of headlines to display. The upper limit depends on the source. The default is 10 headlines.

### Hacker News

The [Hacker News RSS](https://news.ycombinator.com/) feed provides technology-focused headlines and discussions from a variety of sources.
- `Feed:` Choose which feed to fetch: Front page, newest, ask HN, show HN, jobs, and active.
- `Search terms:` Filter headlines using comma-separated search terms. Terms are matched using OR logic.

### Google News

The [Google News RSS](https://news.google.com/home?hl=en-US&gl=US&ceid=US:en) feed provides news headlines from various sources. You can find an explanation of how Google News RSS URLs work [here](https://cloro.dev/blog/google-news-rss/).
- `Topic:` Choose which topic to fetch: Top stories, world, business, technology, sports.
- `Language:` Set the language using an IETF BCP 47 language tag with a region subtag. Examples include `en-US` (American English), `en-GB` (British English), `es-MX` (Mexican Spanish), `es-ES` (European Spanish), `de-DE` (German), and `fr-FR` (French).
- `Country:` Set the ISO 3166-1 alpha-2 country code. Examples include `US` (United States of America), and `ES` (Spain).

### Currents News

The [Currents News API](https://currentsapi.services/en) provides global headlines from various sources. It offers the most customization of the available news sources, but its free plan has some limitations: up to 20 requests per day and a maximum of 10 headlines per request.
- `Category:` Choose which category to fetch. The list of available categories can be found at `/v1/available/categories`.
- `Domain:` Filter results by specific website domains. Check if the domain is found in the database [here](https://www.currentsapi.services/en/statistic/).
- `Domain_not:` Exclude specific domains from the results.
- `Country:` Filter headlines by region. The list of 70+ supported country codes can be found at `/v1/available/regions`.
- `Language:` Filter headlines by language. The list of 18+ valid language codes be found at `/v1/available/languages`.
The headlines are clickable and will open the original source for more information. 


### Finnhub Stocks

The stock ticker uses the [Finnhub API](https://finnhub.io/) to retrieve global stock quotes. It displays the last fetched price and percentage change. 
- `Symbol:` Select the stock symbols to show. To see which symbols are supported, refer to `/v1/stock/symbol`, which includes a large list of available options.
- **Color:** Pick the color of the price, negative and positive percentages.

## Cache

Headlines are stored in a persistent cache within the plugin's data storage. This allows the most recently fetched data to remain visible while offline or when a fetch request fails.

## Limits

- Some sources included in Currents News and Google News may be behind paywalls. For Currents News, you may want to exclude those domains if you do not have a subscription.
- The number of headlines displayed depends on how many headlines are actually available for the selected settings. For example, if the headline limit is set to 10 but only 5 matching headlines are available, only those 5 will be displayed.
