// https://codepen.io/kevinpowell/pen/BavVLra
export function initTicker(root: ParentNode = document): void {
  // If a user hasn't opted in for reduced motion, then we add the animation.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const scrollers = root.querySelectorAll<HTMLElement>(".scroller");

  scrollers.forEach((scroller) => {
    // Add data-animated="true" to every `.scroller` on the page.
    scroller.setAttribute("data-animated", "true");

    // Make an array from the elements within `.scroller__inner`.
    const scrollerInner = scroller.querySelector<HTMLElement>(".scroller__inner");
    if (!scrollerInner) {
      return;
    }

    const scrollerContent = Array.from(scrollerInner.children);

    // For each item in the array, clone it, add aria-hidden to it,
    // and add it into the `.scroller__inner`.
    scrollerContent.forEach((item) => {
      const duplicatedItem = item.cloneNode(true) as Element;
      duplicatedItem.setAttribute("aria-hidden", "true");
      scrollerInner.appendChild(duplicatedItem);
    });
  });
}

// From https://codepen.io/kevinpowell/pen/BavVLra