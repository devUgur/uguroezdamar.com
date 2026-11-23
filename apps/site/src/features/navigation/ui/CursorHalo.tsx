"use client";

import { useEffect, useRef } from "react";

export function CursorHalo() {
  const haloRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const halo = haloRef.current;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!halo || !canHover.matches || reducedMotion.matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let currentScale = 1;
    let frame = 0;
    let hasPosition = false;

    const render = () => {
      const deltaX = targetX - currentX;
      const deltaY = targetY - currentY;
      const movement = Math.hypot(deltaX, deltaY);
      const targetScale = 1 + Math.min(movement / 150, 0.16);

      currentX += deltaX * 0.24;
      currentY += deltaY * 0.24;
      currentScale += (targetScale - currentScale) * 0.18;
      halo.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${currentScale})`;

      if (movement > 0.35 || Math.abs(currentScale - 1) > 0.002) {
        frame = window.requestAnimationFrame(render);
      } else {
        currentScale = 1;
        frame = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!hasPosition) {
        targetX = currentX = event.clientX;
        targetY = currentY = event.clientY;
        currentScale = 1;
        hasPosition = true;
        halo.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(1)`;
      }
      targetX = event.clientX;
      targetY = event.clientY;
      halo.dataset.visible = "true";
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const hide = () => {
      halo.dataset.visible = "false";
      hasPosition = false;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <span ref={haloRef} className="cursor-halo" aria-hidden="true" data-visible="false" />;
}
