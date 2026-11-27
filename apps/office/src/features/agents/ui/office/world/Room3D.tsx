import { useMemo } from "react";
import { Color } from "three";
import { BACK_WALL_Z, WALL_HEIGHT } from "./layout";
import type { ThemeColors } from "./useThemeColors";

interface Room3DProps {
  colors: ThemeColors;
  halfWidth: number;
  depth: number;
  /** Windows keep clear of the wall left of this x, where the board hangs. */
  windowsFromX: number;
}

const WINDOW_SPACING = 3.5;

/** Floor, back wall with windows and a plant. Decorative; the board with data is Board3D. */
export function Room3D({ colors, halfWidth, depth, windowsFromX }: Room3DProps) {
  const centerZ = BACK_WALL_Z + depth / 2;
  const width = halfWidth * 2;
  const windowCount = Math.max(1, Math.floor(width / WINDOW_SPACING) - 1);
  const windowX = Array.from({ length: windowCount }, (_, index) => (index - (windowCount - 1) / 2) * WINDOW_SPACING).filter((x) => x - 1.2 > windowsFromX);
  // Floor lines at half strength: visible as a grid, not as a pattern.
  const gridColor = useMemo(() => new Color().lerpColors(colors.muted, colors.border, 0.5), [colors]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, centerZ]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      <gridHelper args={[width, Math.round(width), gridColor, gridColor]} position={[0, 0.005, centerZ]} scale={[1, 1, depth / width]} />

      <mesh position={[0, WALL_HEIGHT / 2, BACK_WALL_Z - 0.1]} receiveShadow>
        <boxGeometry args={[width + 0.4, WALL_HEIGHT, 0.2]} />
        <meshStandardMaterial color={colors.card} />
      </mesh>
      <mesh position={[0, 0.12, BACK_WALL_Z + 0.02]}>
        <boxGeometry args={[width, 0.24, 0.06]} />
        <meshStandardMaterial color={colors.border} />
      </mesh>

      {windowX.map((x) => (
        <group key={x} position={[x, 2, BACK_WALL_Z + 0.02]}>
          <mesh>
            <boxGeometry args={[2.4, 1.5, 0.05]} />
            <meshStandardMaterial color={colors.border} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[2.2, 1.3, 0.03]} />
            <meshStandardMaterial color={colors.background} emissive={colors.background} emissiveIntensity={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[0.06, 1.3, 0.02]} />
            <meshStandardMaterial color={colors.border} />
          </mesh>
        </group>
      ))}

      <group position={[halfWidth - 0.9, 0, BACK_WALL_Z + 0.8]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.26, 0.6, 16]} />
          <meshStandardMaterial color={colors.surface} />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <icosahedronGeometry args={[0.62, 1]} />
          <meshStandardMaterial color={colors.accent} flatShading />
        </mesh>
      </group>
    </group>
  );
}
