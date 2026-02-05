// https://codepen.io/kevinpowell/pen/BavVLra
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

export function initTicker(root: ParentNode = document): void {
  // If a user hasn't opted in for reduced motion, then we add the animation.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const MAX_VIEWPORT_PX = 8000;
  const MAX_CLONES = 100;

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

      // Always add one full copy so we can measure the true loop distance.
      appendClones(originalItems);

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
          "[my-plugin] Ticker reached clone cap; consider reducing window width or list length.",
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

    const restartAnimation = () => {
      scrollerInner.style.animation = "none";
      scrollerInner.offsetHeight;
      scrollerInner.style.removeProperty("animation");
    };

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
