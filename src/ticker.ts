export function createTicker(container: HTMLElement, items: string[]) {
  const ticker = container.createDiv({ cls: "ticker" });
  const list = ticker.createDiv({ cls: "ticker-list" });

  items.forEach(text => {
    list.createDiv({ cls: "ticker-item", text });
  });

  const clone = list.cloneNode(true) as HTMLElement;
  ticker.appendChild(clone);

  return ticker;
}
