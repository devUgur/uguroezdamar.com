"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Vector3, type PerspectiveCamera } from "three";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { AgentSummary, OfficeSnapshot } from "../../../types";
import type { AgentLiveState } from "../agentState";
import { Desk3D } from "./Desk3D";
import { Figure3D } from "./Figure3D";
import { BACK_WALL_Z, buildOffice } from "./layout";
import { LabelProjector } from "./LabelProjector";
import type { FigureRegistry, LabelAnchors } from "./labels";
import { Room3D } from "./Room3D";
import { useThemeColors } from "./useThemeColors";

interface OfficeScene3DProps {
  agents: AgentSummary[];
  states: Record<string, AgentLiveState>;
  presence: OfficeSnapshot | null;
  serverOffsetMs: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Screen positions of the figures, read by the label layer above the canvas. */
  anchors: RefObject<LabelAnchors>;
}

const VIEW_DIRECTION = new Vector3(11, 8.5, 13).normalize();

/** Moves the camera back until the whole room fits the canvas, wide or narrow. */
function CameraRig({ halfWidth, depth, target }: { halfWidth: number; depth: number; target: Vector3 }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  useEffect(() => {
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const fitWidth = ((halfWidth * 2 + 3) / (2 * tanHalf * (size.width / size.height))) * 0.8;
    const fitDepth = ((depth + 2) / (2 * tanHalf)) * 0.75;
    camera.position.copy(target).addScaledVector(VIEW_DIRECTION, Math.max(10, fitWidth, fitDepth));
  }, [camera, size.width, size.height, halfWidth, depth, target]);
  return null;
}

/**
 * The 3D office. It draws what the events say and decides nothing: busy agents sit at their desk,
 * free ones walk, waiting ones raise a hand. Colors come from the portal's design tokens.
 */
export default function OfficeScene3D({ agents, states, presence, serverOffsetMs, selectedId, onSelect, anchors }: OfficeScene3DProps) {
  const colors = useThemeColors();
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const { placements, halfWidth, depth } = useMemo(() => buildOffice(agents.map((agent) => agent.desk)), [agents]);
  const target = useMemo(() => new Vector3(0, 1, BACK_WALL_Z + depth * 0.45), [depth]);
  const figures = useRef<FigureRegistry>(new Map());

  return (
    <Canvas
      flat
      shadows
      dpr={[1, 2]}
      camera={{ position: [11, 8.5, 13], fov: 34, near: 0.5, far: 80 }}
      className="touch-none"
      aria-label="Agenten-Büro in 3D"
    >
      <color attach="background" args={[colors.surface.getStyle()]} />
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[6, 11, 7]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      <Room3D colors={colors} halfWidth={halfWidth} depth={depth} />
      <CameraRig halfWidth={halfWidth} depth={depth} target={target} />
      <LabelProjector figures={figures} anchors={anchors} />
      {agents.map((agent, index) => {
        const placement = placements[index];
        if (!placement) return null;
        const state = states[agent.id];
        const activity = state?.activity ?? "idle";
        return (
          <group key={agent.id}>
            <group position={[placement.desk.x, 0, placement.desk.z]}>
              <Desk3D colors={colors} active={activity === "working"} />
            </group>
            {presence ? (
              <Figure3D
                id={agent.id}
                registry={figures}
                seat={placement.seat}
                desk={placement.desk}
                motion={presence.agents[agent.id]}
                serverOffsetMs={serverOffsetMs}
                activity={activity}
                selected={selectedId === agent.id}
                colors={colors}
                reducedMotion={reducedMotion}
                onSelect={() => onSelect(agent.id)}
              />
            ) : null}
          </group>
        );
      })}

      <ContactShadows position={[0, 0.01, 1]} opacity={0.35} scale={22} blur={2.4} far={3.2} />
      <OrbitControls
        makeDefault
        enableDamping
        enablePan={false}
        target={target}
        minDistance={7}
        maxDistance={60}
        minPolarAngle={0.35}
        maxPolarAngle={1.3}
        minAzimuthAngle={-1.15}
        maxAzimuthAngle={1.15}
      />
    </Canvas>
  );
}
