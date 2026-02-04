// https://codepen.io/kevinpowell/pen/BavVLra
const getGap = (scrollerInner: HTMLElement): number => {
  const style = getComputedStyle(scrollerInner);
  const gapValue = Number.parseFloat(style.columnGap || "");
  return Number.isFinite(gapValue) ? gapValue : 0;
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
      ? 160
      : speedKey === "slow"
        ? 60
        : speedKey === "very-slow"
          ? 40
          : 100;
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
        const duplicatedItem = item.cloneNode(true) as Element;
        duplicatedItem.setAttribute("aria-hidden", "true");
        scrollerInner.appendChild(duplicatedItem);
      });
    };

    const removeClones = () => {
      scrollerInner
        .querySelectorAll('[aria-hidden="true"]')
        .forEach((clone) => clone.remove());
    };

    const ensureSeamlessLoop = (): boolean => {
      removeClones();
      const scrollerWidth = scroller.getBoundingClientRect().width;
      if (scrollerWidth === 0) {
        return false;
      }

      const baseWidth = scrollerInner.scrollWidth;
      if (!baseWidth || scrollerInner.children.length === 0) {
        return false;
      }

      const gap = getGap(scrollerInner);
      const loopDistance = baseWidth + gap;
      const maxViewport = Math.min(scrollerWidth, MAX_VIEWPORT_PX);
      let guard = 0;
      while (
        scrollerInner.scrollWidth < maxViewport + loopDistance &&
        guard < MAX_CLONES
      ) {
        appendClones(originalItems);
        guard += 1;
      }
      if (scrollerWidth > MAX_VIEWPORT_PX || guard >= MAX_CLONES) {
        console.warn(
          "[my-plugin] Ticker reached clone cap; consider reducing window width or list length.",
          {
            scrollerWidth,
            maxViewport: MAX_VIEWPORT_PX,
            clones: guard,
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
