import type { ThemeColors } from "./useThemeColors";

interface Desk3DProps {
  colors: ThemeColors;
  /** The agent at this desk is busy: the screen lights up. */
  active: boolean;
}

const LEGS: [number, number][] = [
  [-1, -0.45],
  [1, -0.45],
  [-1, 0.45],
  [1, 0.45],
];

/** A desk with monitor, keyboard and chair, in the local space of its placement (chair towards +z). */
export function Desk3D({ colors, active }: Desk3DProps) {
  return (
    <group>
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.08, 1.1]} />
        <meshStandardMaterial color={colors.surface} />
      </mesh>
      {LEGS.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x * 1.05, 0.36, z]} castShadow>
          <boxGeometry args={[0.08, 0.72, 0.08]} />
          <meshStandardMaterial color={colors.border} />
        </mesh>
      ))}
      <mesh position={[0, 0.9, -0.3]}>
        <boxGeometry args={[0.1, 0.22, 0.1]} />
        <meshStandardMaterial color={colors.border} />
      </mesh>
      <mesh position={[0, 1.28, -0.32]} castShadow>
        <boxGeometry args={[0.95, 0.55, 0.06]} />
        <meshStandardMaterial color={colors.card} />
      </mesh>
      <mesh position={[0, 1.28, -0.285]}>
        <boxGeometry args={[0.85, 0.45, 0.02]} />
        <meshStandardMaterial
          color={active ? colors.foreground : colors.background}
          emissive={active ? colors.foreground : colors.background}
          emissiveIntensity={active ? 0.55 : 0.05}
        />
      </mesh>
      <mesh position={[0, 0.82, 0.15]}>
        <boxGeometry args={[0.7, 0.03, 0.22]} />
        <meshStandardMaterial color={colors.card} />
      </mesh>

      <group position={[0, 0, 1.15]}>
        <mesh position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.62, 0.08, 0.6]} />
          <meshStandardMaterial color={colors.accent} />
        </mesh>
        <mesh position={[0, 0.82, 0.3]} castShadow>
          <boxGeometry args={[0.62, 0.7, 0.07]} />
          <meshStandardMaterial color={colors.accent} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.44, 8]} />
          <meshStandardMaterial color={colors.border} />
        </mesh>
      </group>
    </group>
  );
}
