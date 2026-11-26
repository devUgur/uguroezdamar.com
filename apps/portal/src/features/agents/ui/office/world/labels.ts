import type { Group } from "three";

/** Screen position (px, relative to the canvas) of the point above a figure's head. */
export interface LabelAnchor {
  x: number;
  y: number;
  visible: boolean;
}

/** Written every frame by the scene, read every frame by the label layer; no React state involved. */
export type LabelAnchors = Record<string, LabelAnchor>;

/** The figures' root groups by agent id, so the projector can find them without searching the scene. */
export type FigureRegistry = Map<string, Group>;
