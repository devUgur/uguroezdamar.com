import { Html } from "@react-three/drei";
import { COLUMNS, type StatusCounts } from "../../board/board";
import { BACK_WALL_Z } from "./layout";
import type { ThemeColors } from "./useThemeColors";

interface Board3DProps {
  colors: ThemeColors;
  halfWidth: number;
  title: string;
  counts: StatusCounts;
  onOpen: () => void;
}

const WIDTH = 3.4;
const HEIGHT = 1.9;
const MARGIN = 0.8;

/** Right edge of the board on the back wall; windows start beyond it. */
export function boardRightEdge(halfWidth: number): number {
  return -halfWidth + MARGIN + WIDTH + 0.1;
}

/**
 * The project wall (plan stage 5): a board on the back wall with the flow of work of the current scope. It shows
 * only counts from the board data; a click opens the full board.
 */
export function Board3D({ colors, halfWidth, title, counts, onOpen }: Board3DProps) {
  const x = -halfWidth + WIDTH / 2 + MARGIN;
  return (
    <group position={[x, 1.95, BACK_WALL_Z + 0.06]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <boxGeometry args={[WIDTH + 0.12, HEIGHT + 0.12, 0.06]} />
        <meshStandardMaterial color={colors.border} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[WIDTH, HEIGHT, 0.01]} />
        <meshStandardMaterial color={colors.background} />
      </mesh>
      <Html transform position={[0, 0, 0.05]} distanceFactor={2.4} occlude="blending" zIndexRange={[10, 0]}>
        <button
          type="button"
          onClick={onOpen}
          className="flex w-[17rem] flex-col gap-1.5 rounded-sm bg-background p-3 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Tafel öffnen: ${title}`}
        >
          <span className="truncate font-serif text-base">Tafel · {title}</span>
          <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            {COLUMNS.map((column) => (
              <span key={column.status} className="flex justify-between gap-2">
                <span className={column.status === "blocked" && counts.blocked ? "text-destructive" : "text-muted-foreground"}>{column.label}</span>
                <span className="font-mono">{counts[column.status]}</span>
              </span>
            ))}
          </span>
        </button>
      </Html>
    </group>
  );
}
