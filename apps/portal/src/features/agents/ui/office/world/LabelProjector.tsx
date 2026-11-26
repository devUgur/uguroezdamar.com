"use client";

import { useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { FigureRegistry, LabelAnchors } from "./labels";

/** Height above the floor where labels hang: just over a standing figure's head. */
const LABEL_HEIGHT = 2.2;

interface LabelProjectorProps {
  figures: RefObject<FigureRegistry>;
  anchors: RefObject<LabelAnchors>;
}

/**
 * Projects each figure's head position to canvas pixels once per frame. The labels themselves are
 * plain DOM above the canvas (see FigureLabels): drei's Html renders through a second React root,
 * which React 19 rejects while the scene is mounting.
 */
export function LabelProjector({ figures, anchors }: LabelProjectorProps) {
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    if (!figures.current || !anchors.current) return;
    for (const [id, group] of figures.current) {
      point.set(group.position.x, LABEL_HEIGHT, group.position.z).project(camera);
      anchors.current[id] = {
        x: (point.x * 0.5 + 0.5) * size.width,
        y: (-point.y * 0.5 + 0.5) * size.height,
        visible: point.z < 1,
      };
    }
  });
  return null;
}
