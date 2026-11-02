// How the Sun, Moon and planets look on the 天象 map. Far out a planet is a point of light, like a
// bright star in its own colour; zoomed in it opens into its face: Jupiter's belts and four moons,
// Saturn's rings at their tilt, the phases of Venus, Mercury and Mars, set upright to the body's
// own north as it stands in the sky (lib/sky.ts bodyFaces). The Moon shows its maria, lit on the
// side towards the Sun, the rest faintly there by earthshine.
import { litPart, type BodyFace } from '../lib/sky'

/** Gradients the faces use, defined once in the map's <defs> (by SkyFaceDefs) */
export function SkyFaceDefs({ id }: { id: string }) {
  return (
    <>
      {/* The limb darkens on every disc */}
      <radialGradient id={`${id}-limb`}>
        <stop offset={0.55} stopColor="#000" stopOpacity={0} />
        <stop offset={1} stopColor="#000" stopOpacity={0.45} />
      </radialGradient>
      <radialGradient id={`${id}-sun`}>
        <stop offset={0} stopColor="#fffdf3" />
        <stop offset={0.65} stopColor="#fff1c2" />
        <stop offset={0.92} stopColor="#ffd77e" />
        <stop offset={1} stopColor="#ffbf5a" />
      </radialGradient>
      {/* A 月海: dark in the middle, fading at its edge */}
      <radialGradient id={`${id}-mare`}>
        <stop offset={0} stopColor="#5d5a55" stopOpacity={0.8} />
        <stop offset={0.65} stopColor="#5d5a55" stopOpacity={0.55} />
        <stop offset={1} stopColor="#5d5a55" stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`${id}-moonface`}>
        <stop offset={0} stopColor="#f1ece0" />
        <stop offset={1} stopColor="#cfc8b8" />
      </radialGradient>
      <radialGradient id={`${id}-crater`}>
        <stop offset={0} stopColor="#fffdf6" stopOpacity={0.95} />
        <stop offset={1} stopColor="#fffdf6" stopOpacity={0} />
      </radialGradient>
    </>
  )
}

/** The maria of the near side, north up (x to the right, y down, on a disc of radius 1) */
const MARIA: [number, number, number, number, number][] = [
  // cx, cy, rx, ry, turn
  [-0.52, -0.02, 0.3, 0.52, 8], // 风暴洋
  [-0.3, -0.42, 0.3, 0.23, -10], // 雨海
  [0.17, -0.38, 0.17, 0.16, 0], // 澄海
  [0.33, -0.07, 0.22, 0.2, 15], // 静海
  [0.7, -0.3, 0.12, 0.1, 0], // 危海
  [0.6, 0.16, 0.12, 0.21, -10], // 丰富海
  [0.37, 0.31, 0.1, 0.1, 0], // 酒海
  [-0.17, 0.34, 0.21, 0.15, 0], // 云海
  [-0.48, 0.38, 0.1, 0.1, 0], // 湿海
  [0.02, -0.7, 0.42, 0.07, 0], // 冷海
  [0.0, -0.12, 0.08, 0.07, 0], // 中央湾
]
/** Bright young craters: 第谷 and 哥白尼 */
const CRATERS: [number, number, number][] = [
  [-0.12, 0.68, 0.07],
  [-0.3, -0.12, 0.05],
]

/** Jupiter's belts (dark) and zones, from north to south: centre and half-height on a disc of radius 1 */
const BELTS: [number, number, string][] = [
  [-0.82, 0.2, '#b59a7c'],
  [-0.46, 0.05, '#c9a47c'],
  [-0.2, 0.09, '#b88760'],
  [0.17, 0.09, '#b07b55'],
  [0.43, 0.05, '#c9a47c'],
  [0.82, 0.2, '#b59a7c'],
]

export interface FaceProps {
  kind: string
  /** Where it is on the map, and its disc's radius (map units) */
  x: number
  y: number
  r: number
  /** Show the face (zoomed in far enough), not only the point of light */
  close: boolean
  /** The glow round a planet (map units), its gradient, and its colour */
  glow: number
  glowFill: string
  colour: string
  face?: BodyFace
  /** On the map, degrees clockwise from +x: where the body's north is, and the Sun */
  north: number
  sun: number
  /** Jupiter's moons on the map: the direction of each from Jupiter (degrees) */
  moonTurns?: number[]
  id: string
}

export function BodyFaceView({
  kind,
  x,
  y,
  r,
  close,
  glow,
  glowFill,
  colour,
  face,
  north,
  sun,
  moonTurns,
  id,
}: FaceProps) {
  const at = `translate(${x.toFixed(2)} ${y.toFixed(2)})`
  // Local frame: north up (−y), so the face turns by north + 90°
  const upright = `rotate(${(north + 90).toFixed(1)})`
  const toSun = `rotate(${sun.toFixed(1)})`
  const lit = face?.lit ?? 1
  if (kind === 'sun') {
    return (
      <g transform={at}>
        <circle className="disc" r={r} fill={`url(#${id}-sun)`} />
      </g>
    )
  }
  if (kind === 'moon') {
    const mask = `${id}-moonshade`
    return (
      // Placed by the outer group; the inner one (.disc) is what grows when hovered or chosen
      <g transform={at}>
        <g className="disc">
          <mask id={mask}>
            <circle r={r * 1.02} fill="#fff" />
            <path d={litPart(lit, r * 1.02)} transform={toSun} fill="#000" />
          </mask>
          <g transform={upright}>
            <circle r={r} fill={`url(#${id}-moonface)`} />
            {MARIA.map(([cx, cy, rx, ry, turn], i) => (
              <ellipse
                key={i}
                cx={cx * r}
                cy={cy * r}
                rx={rx * r}
                ry={ry * r}
                transform={turn ? `rotate(${turn} ${cx * r} ${cy * r})` : undefined}
                fill={`url(#${id}-mare)`}
              />
            ))}
            {CRATERS.map(([cx, cy, cr], i) => (
              <circle key={i} cx={cx * r} cy={cy * r} r={cr * r} fill={`url(#${id}-crater)`} />
            ))}
            <circle r={r} fill={`url(#${id}-limb)`} />
          </g>
          {/* The night side: dark, but the face still faintly there by earthshine */}
          <circle className="moon-night" r={r * 1.02} mask={`url(#${mask})`} />
        </g>
      </g>
    )
  }
  if (!close) {
    // A point of light: a bright core falling off into a glow in the planet's colour
    return <circle className="disc planet-point" cx={x} cy={y} r={glow} fill={glowFill} />
  }
  const shade = `${id}-shade-${kind}`
  const phased = lit < 0.995
  return (
    <g transform={at}>
      <g className={`disc planet-face face-${kind}`}>
        <circle className="planet-glow" r={glow} fill={glowFill} />
        {phased && (
          <mask id={shade}>
            <circle r={r * 2.6} fill="#fff" />
            <path d={litPart(lit, r * 1.01)} transform={toSun} fill="#000" />
          </mask>
        )}
        {kind === 'saturn' && face?.ringTilt !== undefined && (
          <SaturnRings r={r} tilt={face.ringTilt} upright={upright} half="back" />
        )}
        <g transform={upright}>
          {kind === 'jupiter' ? (
            <JupiterDisc r={r} id={id} />
          ) : kind === 'saturn' ? (
            <ellipse rx={r} ry={r * 0.9} fill="#e6cf98" />
          ) : kind === 'mars' ? (
            <>
              <circle r={r} fill="#d9774c" />
              <ellipse cx={-0.25 * r} cy={0.1 * r} rx={0.35 * r} ry={0.18 * r} fill="#9c4b2e" opacity={0.6} />
              <ellipse cx={0.3 * r} cy={-0.15 * r} rx={0.22 * r} ry={0.12 * r} fill="#9c4b2e" opacity={0.5} />
              <ellipse cy={-0.86 * r} rx={0.32 * r} ry={0.13 * r} fill="#f6f1ea" />
            </>
          ) : (
            <circle r={r} fill={colour} />
          )}
          {kind === 'saturn' && (
            <>
              <rect x={-r} y={-0.28 * r} width={2 * r} height={0.12 * r} fill="#c9ad74" opacity={0.6} />
              <rect x={-r} y={0.18 * r} width={2 * r} height={0.08 * r} fill="#c9ad74" opacity={0.5} />
            </>
          )}
          <ellipse
            rx={r}
            ry={kind === 'saturn' || kind === 'jupiter' ? r * (kind === 'saturn' ? 0.9 : 0.94) : r}
            fill={`url(#${id}-limb)`}
          />
        </g>
        {phased && <circle className="planet-night" r={r * 1.01} mask={`url(#${shade})`} />}
        {kind === 'saturn' && face?.ringTilt !== undefined && (
          <SaturnRings r={r} tilt={face.ringTilt} upright={upright} half="front" />
        )}
        {kind === 'jupiter' &&
          face?.moons?.map((m, i) => {
            // Not to scale: spread out so each stands clear of the disc (Io about 2 radii out, Callisto 4–5)
            const far = r * (1 + m.rj / 6)
            if (!m.front && m.rj < 1) return null
            const a = ((moonTurns?.[i] ?? 0) * Math.PI) / 180
            return (
              <circle
                key={m.name}
                className="jupiter-moon"
                cx={far * Math.cos(a)}
                cy={far * Math.sin(a)}
                r={Math.max(0.045 * r, 0.35)}
              />
            )
          })}
      </g>
    </g>
  )
}

function JupiterDisc({ r, id }: { r: number; id: string }) {
  const clip = `${id}-jupiter`
  return (
    <>
      <clipPath id={clip}>
        <ellipse rx={r} ry={r * 0.94} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect x={-r} y={-r} width={2 * r} height={2 * r} fill="#efdcbc" />
        {BELTS.map(([cy, h, c], i) => (
          <rect key={i} x={-r} y={(cy - h) * r} width={2 * r} height={2 * h * r} fill={c} />
        ))}
        {/* The Great Red Spot, in the southern belt */}
        <ellipse cx={0.32 * r} cy={0.3 * r} rx={0.16 * r} ry={0.08 * r} fill="#c46a4a" opacity={0.85} />
      </g>
    </>
  )
}

/** Saturn's rings, as an ellipse open by their tilt: the half behind the planet, or the half in front */
function SaturnRings({ r, tilt, upright, half }: { r: number; tilt: number; upright: string; half: 'back' | 'front' }) {
  const open = Math.max(0.03, Math.abs(Math.sin((tilt * Math.PI) / 180)))
  // Seen from the north (tilt > 0) the near half of the rings crosses the planet's southern side
  const nearSouth = tilt >= 0
  const arc = (a: number) => {
    const [rx, ry] = [a * r, a * r * open]
    const sweep = (half === 'front') === nearSouth ? 0 : 1
    return `M${-rx} 0A${rx} ${ry} 0 0 ${sweep} ${rx} 0`
  }
  return (
    <g transform={upright} className={`saturn-rings ${half}`}>
      <path d={arc(2.1)} className="ring-a" strokeWidth={0.26 * r} />
      <path d={arc(1.72)} className="ring-b" strokeWidth={0.38 * r} />
      <path d={arc(1.38)} className="ring-c" strokeWidth={0.22 * r} />
    </g>
  )
}
