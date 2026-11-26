"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useCursor } from "@react-three/drei";
import type { Group } from "three";
import type { OfficeMotion } from "../../../types";
import type { AgentActivity } from "../agentState";
import type { FigureRegistry } from "./labels";
import { distance, motionIsWalking, motionPosition, turnToward, yawToward, type Vec2 } from "./layout";
import type { ThemeColors } from "./useThemeColors";

interface Figure3DProps {
  id: string;
  /** Lets the label layer find this figure's position. */
  registry: RefObject<FigureRegistry>;
  seat: Vec2;
  desk: Vec2;
  motion?: OfficeMotion;
  localPreview: boolean;
  serverOffsetMs: number;
  activity: AgentActivity;
  selected: boolean;
  colors: ThemeColors;
  reducedMotion: boolean;
  onSelect: () => void;
}

/**
 * One agent follows the room's shared motion plan. Each browser keeps its own camera controls.
 */
export function Figure3D(props: Figure3DProps) {
  const { id, selected, colors } = props;
  const latest = useRef(props);
  latest.current = props;

  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legs = [useRef<Group>(null), useRef<Group>(null)] as const;
  const arms = [useRef<Group>(null), useRef<Group>(null)] as const;
  const initialPosition = useRef(props.motion ? motionPosition(props.motion, Date.now() + props.serverOffsetMs) : props.seat).current;
  const motion = useRef({
    position: { ...initialPosition },
    yaw: yawToward(initialPosition, props.desk),
    wasPreview: props.localPreview,
    correction: { x: 0, z: 0 },
    correctionStartedAt: 0,
  });
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useEffect(() => {
    const registry = props.registry.current;
    const group = root.current;
    if (!registry || !group) return;
    registry.set(id, group);
    return () => {
      registry.delete(id);
    };
  }, [id, props.registry]);

  useFrame((_, delta) => {
    const { seat, desk, activity: state, reducedMotion, serverOffsetMs, localPreview } = latest.current;
    const m = motion.current;
    const seconds = Math.min(delta, 0.1);
    const now = Date.now() + serverOffsetMs;
    const sharedMotion = latest.current.motion;
    const busy = state !== "idle";
    const previous = m.position;
    let position = sharedMotion ? (reducedMotion ? sharedMotion.target : motionPosition(sharedMotion, now)) : seat;
    if (m.wasPreview && !localPreview) {
      m.correction = { x: m.position.x - position.x, z: m.position.z - position.z };
      m.correctionStartedAt = now;
    }
    m.wasPreview = localPreview;
    const correctionProgress = Math.min(1, Math.max(0, (now - m.correctionStartedAt) / 400));
    if (!localPreview && correctionProgress < 1) {
      position = {
        x: position.x + m.correction.x * (1 - correctionProgress),
        z: position.z + m.correction.z * (1 - correctionProgress),
      };
    }
    const walking = sharedMotion ? !reducedMotion && motionIsWalking(sharedMotion, now) : false;
    m.position = position;
    const seated = busy && distance(position, seat) < 0.06;
    const wanted = walking ? yawToward(previous, position) : seated ? yawToward(seat, desk) : m.yaw;
    m.yaw = turnToward(m.yaw, wanted, seconds * 8);

    if (!root.current || !body.current) return;
    root.current.position.set(position.x, 0, position.z);
    body.current.rotation.y = m.yaw;
    // The pelvis already meets the chair at y≈0.53; lowering the whole rig clips its legs through the floor.
    body.current.position.y += (0 - body.current.position.y) * Math.min(1, seconds * 10);

    const animationTime = now / 1000;
    const swing = walking ? Math.sin(animationTime * 9) * 0.7 : 0;
    const [legLeft, legRight] = legs;
    const [armLeft, armRight] = arms;
    if (legLeft.current) legLeft.current.rotation.x = seated ? -1.4 : swing;
    if (legRight.current) legRight.current.rotation.x = seated ? -1.4 : -swing;
    if (armLeft.current) armLeft.current.rotation.x = seated ? -1.15 + (state === "working" ? Math.sin(animationTime * 14) * 0.12 : 0) : -swing * 0.8;
    if (armRight.current) {
      armRight.current.rotation.x = seated
        ? state === "waiting" ? -2.6 + Math.sin(animationTime * 4) * 0.25 : -1.15 + (state === "working" ? Math.sin(animationTime * 14 + 1.5) * 0.12 : 0)
        : swing * 0.8;
    }
  });

  const torso = props.activity === "error" ? colors.destructive : colors.primary;
  return (
    <group
      ref={root}
      position={[initialPosition.x, 0, initialPosition.z]}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} visible={selected || hovered}>
        <ringGeometry args={[0.55, 0.68, 40]} />
        <meshBasicMaterial color={colors.primary} transparent opacity={selected ? 1 : 0.4} />
      </mesh>

      <group ref={body}>
        {[-0.13, 0.13].map((x, index) => (
          <group key={x} ref={legs[index]} position={[x, 0.62, 0]}>
            <mesh position={[0, -0.31, 0]} castShadow>
              <boxGeometry args={[0.16, 0.62, 0.18]} />
              <meshStandardMaterial color={colors.foreground} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.27, 0.5, 6, 14]} />
          <meshStandardMaterial color={torso} />
        </mesh>
        {[-0.4, 0.4].map((x, index) => (
          <group key={x} ref={arms[index]} position={[x, 1.32, 0]}>
            <mesh position={[0, -0.27, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.4, 4, 8]} />
              <meshStandardMaterial color={torso} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.78, 0]} castShadow>
          <sphereGeometry args={[0.24, 20, 16]} />
          <meshStandardMaterial color={colors.card} />
        </mesh>
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 1.8, 0.21]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color={colors.foreground} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
