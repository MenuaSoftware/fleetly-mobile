import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { DamageView } from "@/lib/damage";

/**
 * Schematic vehicle outlines, one per damage `view`, drawn so a driver
 * can place and recognise a mark on the right part of the vehicle.
 *
 * These are hand-authored outlines, not the production line art. They
 * are deliberately schematic: recognisable as a van from arm's length,
 * and correct about where the panels, doors and wheels sit, which is
 * all the marker coordinates need to mean something. If real vector
 * artwork arrives from a designer, it drops in here and nothing else
 * changes — every consumer positions markers by fractional
 * positionX/positionY over the box this renders, never by pixel.
 *
 * `bodyType` is accepted and currently renders the same van outline for
 * every value. The schema has had van/truck/car since
 * *_create_vehicle.sql and the column exists precisely to drive this, so
 * the parameter is threaded through rather than pretended away — but
 * drawing three distinct vehicle types by hand would be three times the
 * guesswork at the same fidelity, so that waits for real artwork too.
 */

export type BodyType = "van" | "truck" | "car";

/** Aspect ratios the callers lay out against, so a marker's % lands in the right place. */
export const VIEW_ASPECT: Record<DamageView, number> = {
  front: 100 / 112,
  rear: 100 / 112,
  left: 220 / 104,
  right: 220 / 104,
};

export function VehicleDiagram({
  view,
  stroke,
  bodyType: _bodyType = "van",
}: {
  view: DamageView;
  stroke: string;
  bodyType?: BodyType;
}) {
  const common = {
    stroke,
    strokeWidth: 2,
    fill: "none" as const,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  if (view === "front" || view === "rear") {
    return (
      <Svg viewBox="0 0 100 112" width="100%" height="100%">
        {/* Body shell — same silhouette front and rear. */}
        <Path d="M14 30 Q14 12 32 12 L68 12 Q86 12 86 30 L86 92 Q86 98 80 98 L20 98 Q14 98 14 92 Z" {...common} />
        {/* Mirrors */}
        <Path d="M14 44 L6 40 L6 52 L14 50" {...common} />
        <Path d="M86 44 L94 40 L94 52 L86 50" {...common} />

        {view === "front" ? (
          <>
            {/* Windscreen */}
            <Path d="M22 20 L78 20 L74 46 L26 46 Z" {...common} />
            {/* Wiper */}
            <Line x1="32" y1="44" x2="60" y2="30" {...common} />
            {/* Headlights */}
            <Rect x="19" y="54" width="20" height="10" rx="4" {...common} />
            <Rect x="61" y="54" width="20" height="10" rx="4" {...common} />
            {/* Grille + plate */}
            <Line x1="40" y1="59" x2="60" y2="59" {...common} />
            <Rect x="36" y="70" width="28" height="9" rx="2" {...common} />
            {/* Bumper */}
            <Path d="M16 84 L84 84" {...common} />
          </>
        ) : (
          <>
            {/* Twin rear doors */}
            <Line x1="50" y1="16" x2="50" y2="94" {...common} />
            <Rect x="22" y="20" width="24" height="24" rx="2" {...common} />
            <Rect x="54" y="20" width="24" height="24" rx="2" {...common} />
            {/* Handles */}
            <Line x1="45" y1="56" x2="45" y2="64" {...common} />
            <Line x1="55" y1="56" x2="55" y2="64" {...common} />
            {/* Tail lights */}
            <Rect x="19" y="66" width="12" height="16" rx="2" {...common} />
            <Rect x="69" y="66" width="12" height="16" rx="2" {...common} />
            {/* Bumper */}
            <Path d="M16 88 L84 88" {...common} />
          </>
        )}
      </Svg>
    );
  }

  // Side views. `right` is the same outline mirrored, so the nose sits
  // on the side the driver is actually looking at when they walk that
  // side of the vehicle.
  const mirrored = view === "right";
  return (
    <Svg viewBox="0 0 220 104" width="100%" height="100%">
      <Path
        // Nose, windscreen rake, roof, rear, sill — one closed outline.
        d="M10 74 L12 58 Q14 52 24 50 L44 50 L58 22 Q60 16 72 16 L196 16 Q206 16 206 26 L206 74 Q206 80 200 80 L16 80 Q10 80 10 74 Z"
        {...common}
        transform={mirrored ? "translate(220,0) scale(-1,1)" : undefined}
      />
      {/* Cab window, sliding door + its window, body seams, wheels, handles. */}
      <Path
        d="M62 24 L96 24 L96 48 L52 48 Z"
        {...common}
        transform={mirrored ? "translate(220,0) scale(-1,1)" : undefined}
      />
      <Path
        d="M104 24 L146 24 L146 48 L104 48 Z"
        {...common}
        transform={mirrored ? "translate(220,0) scale(-1,1)" : undefined}
      />
      <Line x1="100" y1="18" x2="100" y2="80" {...common} transform={mirrored ? "translate(220,0) scale(-1,1)" : undefined} />
      <Line x1="152" y1="18" x2="152" y2="80" {...common} transform={mirrored ? "translate(220,0) scale(-1,1)" : undefined} />
      <Line x1="106" y1="56" x2="118" y2="56" {...common} transform={mirrored ? "translate(220,0) scale(-1,1)" : undefined} />
      <Circle cx={mirrored ? 220 - 62 : 62} cy="80" r="15" {...common} />
      <Circle cx={mirrored ? 220 - 62 : 62} cy="80" r="6" {...common} />
      <Circle cx={mirrored ? 220 - 176 : 176} cy="80" r="15" {...common} />
      <Circle cx={mirrored ? 220 - 176 : 176} cy="80" r="6" {...common} />
    </Svg>
  );
}
