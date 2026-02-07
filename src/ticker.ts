// getGap and getItemsWidth are used to calculate the total width of the items in the ticker
// Including any gaps between them
// This is important for determining the amount of clones
const getGap = (scrollerInner: HTMLElement): number => {
  const style = getComputedStyle(scrollerInner);
  const gapValue = Number.parseFloat(style.columnGap || "");
  return Number.isFinite(gapValue) ? gapValue : 0;
};

const getItemsWidth = (items: Element[], gap: number): number => {
  if (items.length === 0) {
    return 0;
  }

  const total = items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const gaps = Math.max(0, items.length - 1) * gap;
  return total + gaps;
};

// Calculates the animation duration based on the distance to loop and the speed setting
export function applyTickerSpeed(scroller: HTMLElement): void {
  const scrollerInner = scroller.querySelector<HTMLElement>(".scroller__inner");
  if (!scrollerInner) {
    return;
  }

  const inlineLoopDistance = Number.parseFloat(
    scroller.style.getPropertyValue("--_loop-distance")
  );
  const gap = getGap(scrollerInner);
  const fallbackDistance = scrollerInner.scrollWidth / 2 + gap / 2;
  const distance = Number.isFinite(inlineLoopDistance)
    ? inlineLoopDistance
    : fallbackDistance;
  if (!distance || !Number.isFinite(distance)) {
    return;
  }

  const speedKey = scroller.dataset.speed ?? "medium";
  const speedPxPerSec = 
    speedKey === "fast"
      ? 120
      : speedKey === "slow"
        ? 40
        : speedKey === "very-slow"
          ? 20
          : 80;
  const duration = distance / speedPxPerSec;
  scroller.style.setProperty("--_animation-duration", `${duration}s`);
}

// Initializes the ticker by cloning items to create a seamless loop and applying animation settings
export function initTicker(root: ParentNode = document): void {
  // If a user hasn't opted in for reduced motion, then we add the animation
  // The reduced motion option will kill the animation and will make the plugin useless 
  // Sommetimes it will also make the plugin look broken
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const MAX_VIEWPORT_PX = 8000; // Cap the viewport width for clones
  const MAX_CLONES = 100; // Absolute cap on clones to prevent infinite loops

  const scrollers = root.querySelectorAll<HTMLElement>(".scroller");

  scrollers.forEach((scroller) => {
    if (scroller.dataset.animated === "true") {
      return;
    }

    // Enable nowrap sizing but pause animation until clones are ready.
    scroller.setAttribute("data-animated", "true");
    scroller.style.setProperty("--_animation-play-state", "paused");

    // Make an array from the elements within `.scroller__inner`.
    const scrollerInner = scroller.querySelector<HTMLElement>(".scroller__inner");
    if (!scrollerInner) {
      return;
    }

    const originalItems = Array.from(scrollerInner.children);

    const appendClones = (items: Element[]) => {
      items.forEach((item) => {
        const duplicatedItem = item.cloneNode(true) as HTMLElement;
        duplicatedItem.setAttribute("aria-hidden", "true");
        duplicatedItem.setAttribute("data-ticker-clone", "true");
        duplicatedItem.style.setProperty("display", "inline-flex", "important");
        duplicatedItem.style.setProperty("visibility", "visible", "important");
        duplicatedItem.style.setProperty("opacity", "1", "important");
        scrollerInner.appendChild(duplicatedItem);
      });
    };

    // Remove any existing clones when recalculating size
    const removeClones = () => {
      Array.from(scrollerInner.children).forEach((child) => {
        const el = child as HTMLElement;
        if (
          el.getAttribute("data-ticker-clone") === "true" ||
          el.getAttribute("aria-hidden") === "true"
        ) {
          el.remove();
        }
      });
    };
  
    const ensureSeamlessLoop = (): boolean => {
      removeClones();
      const scrollerWidth = scroller.getBoundingClientRect().width;
      if (scrollerWidth === 0) {
        return false;
      }

      if (scrollerInner.children.length === 0) {
        return false;
      }

      // Always add one full copy to measure the true loop distance
      appendClones(originalItems);

      // Everything below here is about measuring the loop distance and adding additional clones as needed 
      const scrollerRect = scrollerInner.getBoundingClientRect();
      const firstOriginal = originalItems[0] as HTMLElement | undefined; 
      const firstClone = scrollerInner.querySelector<HTMLElement>( 
        '[data-ticker-clone="true"]'
      );
      const gap = getGap(scrollerInner);
      const measuredWidth = getItemsWidth(originalItems, gap);
      const measuredLoopDistance =
        firstOriginal && firstClone
          ? firstClone.getBoundingClientRect().left -
            firstOriginal.getBoundingClientRect().left
          : 0;
      const baseWidth = measuredWidth || scrollerRect.width || scrollerInner.scrollWidth;
      const loopDistance =
        measuredLoopDistance > 0 && Number.isFinite(measuredLoopDistance)
          ? measuredLoopDistance
          : baseWidth + gap;
      if (!loopDistance || !Number.isFinite(loopDistance)) {
        return false;
      }

      const maxViewport = Math.min(scrollerWidth, MAX_VIEWPORT_PX);
      const copiesNeeded = Math.max( 
        2,
        Math.ceil((maxViewport + loopDistance) / loopDistance)
      );
      const maxCopies = MAX_CLONES + 1;
      const targetCopies = Math.min(copiesNeeded, maxCopies);
      for (let copy = 2; copy < targetCopies; copy += 1) {
        appendClones(originalItems);
      }
      if (scrollerWidth > MAX_VIEWPORT_PX || copiesNeeded > maxCopies) {
        console.warn(
          "Ticker reached clone cap; consider reducing window width or list length.",
          {
            scrollerWidth,
            maxViewport: MAX_VIEWPORT_PX,
            clones: targetCopies - 1,
            baseWidth,
            loopDistance,
          }
        );
      }
      scroller.style.setProperty("--_loop-distance", `${loopDistance}px`);
      return true;
    };
    
    // After rebuilding the clones and recalculating the loop distance the animation needs to be restarted
    const restartAnimation = () => {
      scrollerInner.style.animation = "none";
      scrollerInner.offsetHeight;
      scrollerInner.style.removeProperty("animation");
    };

    // Recalculates the necessary clones and animation settings for the ticker
    const rebuild = () => {
      scroller.style.setProperty("--_animation-play-state", "paused");
      if (!ensureSeamlessLoop()) {
        return;
      }
      applyTickerSpeed(scroller);
      scroller.style.removeProperty("--_animation-play-state");
      restartAnimation();
    };

    requestAnimationFrame(rebuild);

    // Use ResizeObserver if available for more efficient resizing
    // Otherwise fall back to window resize event
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        rebuild();
      });
      observer.observe(scrollerInner);
      observer.observe(scroller);
    } else {
      window.addEventListener("resize", rebuild, { passive: true });
    }
  });
}

// From https://codepen.io/kevinpowell/pen/BavVLra, the animation speed logic was changed though 
