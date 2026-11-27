import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
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
/** Room left between the board and the right wall, where the plant stands. */
const RIGHT_MARGIN = 1.9;
/** Texture pixels per metre of board: sharp enough to read from the default camera. */
const PX = 300;

/** Where the board hangs: on the back wall towards the camera's side, so it is in view from the default angle. */
export function boardCenterX(halfWidth: number): number {
  return halfWidth - RIGHT_MARGIN - WIDTH / 2;
}

/** Half the wall width the board takes, with a gap; windows keep clear of it. */
export const BOARD_CLEARANCE = WIDTH / 2 + 1.4;

/** Draws title and work per status into a texture: plain WebGL, no DOM layer over the canvas. */
function drawBoard(title: string, counts: StatusCounts, colors: ThemeColors): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * PX;
  canvas.height = HEIGHT * PX;
  const context = canvas.getContext("2d");
  if (context) {
    const pad = 60;
    context.fillStyle = colors.background.getStyle();
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = colors.foreground.getStyle();
    context.font = `64px "Playfair Display", serif`;
    context.fillText(`Tafel · ${title}`.slice(0, 30), pad, pad + 50);
    const rowHeight = 62;
    const columnWidth = (canvas.width - pad * 2) / 2;
    COLUMNS.forEach((column, index) => {
      const x = pad + (index % 2) * columnWidth;
      const y = pad + 160 + Math.floor(index / 2) * rowHeight;
      const blocked = column.status === "blocked" && counts.blocked > 0;
      context.font = `40px Inter, sans-serif`;
      context.fillStyle = (blocked ? colors.destructive : colors["muted-foreground"]).getStyle();
      context.fillText(column.label, x, y);
      context.font = `44px "JetBrains Mono", monospace`;
      context.fillStyle = (blocked ? colors.destructive : colors.foreground).getStyle();
      const value = String(counts[column.status]);
      context.fillText(value, x + columnWidth - 70 - context.measureText(value).width, y);
    });
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * The project wall (plan stage 5): a board on the back wall with the flow of work of the current scope. It shows
 * only counts from the board data; a click opens the full board.
 */
export function Board3D({ colors, halfWidth, title, counts, onOpen }: Board3DProps) {
  const texture = useMemo(() => drawBoard(title, counts, colors), [title, counts, colors]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group
      position={[boardCenterX(halfWidth), 1.95, BACK_WALL_Z + 0.06]}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <mesh>
        <boxGeometry args={[WIDTH + 0.12, HEIGHT + 0.12, 0.06]} />
        <meshStandardMaterial color={colors.border} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
