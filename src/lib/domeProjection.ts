// 穹顶视角: the sky as one sees it standing under it, looking one way (as Stellarium shows it), rather
// than the all-sky map. A stereographic projection about the direction looked at, the horizon kept
// level: circles on the sky stay circles, so the horizon is an arc, the dome bends overhead, and below
// the horizon (under one's feet) is there too, behind the ground.
//
// Directions are unit vectors in the horizon frame: x east, y north, z up.

export type V3 = [number, number, number]

/** Where one looks: azimuth (from north through east) and altitude, degrees; and the field of view
 *  across the screen's shorter side, degrees */
export interface DomeView {
  az: number
  alt: number
  fov: number
}

const RAD = Math.PI / 180

export const FOV_MIN = 20
export const FOV_MAX = 150

/** A direction from its azimuth and altitude (degrees) */
export function dirOf(az: number, alt: number, out: V3 = [0, 0, 0]): V3 {
  const a = az * RAD
  const h = alt * RAD
  out[0] = Math.cos(h) * Math.sin(a)
  out[1] = Math.cos(h) * Math.cos(a)
  out[2] = Math.sin(h)
  return out
}

/** The camera looking that way, the horizon level: right, up and forward on the screen */
export interface Camera {
  r: V3
  u: V3
  f: V3
  /** Pixels per unit of the stereographic plane, and the screen's middle */
  scale: number
  cx: number
  cy: number
}

export function cameraFor(view: DomeView, width: number, height: number): Camera {
  const a = view.az * RAD
  const h = view.alt * RAD
  const f: V3 = [Math.cos(h) * Math.sin(a), Math.cos(h) * Math.cos(a), Math.sin(h)]
  // Right is level, a quarter turn clockwise (seen from above) from the way one faces
  const r: V3 = [Math.cos(a), -Math.sin(a), 0]
  // Up = right × forward
  const u: V3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]
  // Half the shorter side spans half the field: the plane's 2·tan(θ/2) at θ = fov / 2
  const scale = Math.min(width, height) / 2 / (2 * Math.tan((view.fov * RAD) / 4))
  return { r, u, f, scale, cx: width / 2, cy: height / 2 }
}

/**
 * The same camera for directions given in another frame, where m turns that frame's vectors into the
 * horizon frame (horizon = m · v, as from sky.horizonMatrix). Projecting is only dot products with
 * the camera's axes, so turning the three axes back (mᵀ) stands in for turning every point forward:
 * the stars stay as they are in J2000 and only the camera follows the time and place.
 */
export function turnCamera(cam: Camera, m: number[][]): Camera {
  const back = (a: V3): V3 => [
    m[0][0] * a[0] + m[1][0] * a[1] + m[2][0] * a[2],
    m[0][1] * a[0] + m[1][1] * a[1] + m[2][1] * a[2],
    m[0][2] * a[0] + m[1][2] * a[1] + m[2][2] * a[2],
  ]
  return { ...cam, r: back(cam.r), u: back(cam.u), f: back(cam.f) }
}

/** How far forward a direction is: 1 straight ahead, 0 square to the side, −1 straight behind */
export const ahead = (cam: Camera, v: V3) => v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2]

/** Directions further behind than this are not drawn (the projection runs off to infinity behind) */
export const BEHIND = -0.3

/**
 * A direction on the screen, written to out; false when it lies too far behind to draw. Stereographic:
 * a point at angle θ from the middle lands 2·tan(θ/2) out from it.
 */
export function projectDir(cam: Camera, v: V3, out: [number, number]): boolean {
  return projectXYZ(cam, v[0], v[1], v[2], out)
}

/** projectDir for a direction given by its parts (as read straight out of a packed array) */
export function projectXYZ(cam: Camera, x: number, y: number, z: number, out: [number, number]): boolean {
  const { r, u, f } = cam
  const ahead = x * f[0] + y * f[1] + z * f[2]
  if (ahead < BEHIND) return false
  const k = (2 / (1 + ahead)) * cam.scale
  out[0] = cam.cx + k * (x * r[0] + y * r[1] + z * r[2])
  out[1] = cam.cy - k * (x * u[0] + y * u[1] + z * u[2])
  return true
}

/**
 * How far the picture shifts between two views, in pixels at the middle of a screen whose shorter
 * side is `side`: the middle's move, plus the turn about the middle a change of azimuth makes when
 * looking up (straight up, turning round only spins the picture), plus the zoom
 */
export function viewShift(a: DomeView, b: DomeView, side: number): number {
  const pa = dirOf(a.az, a.alt)
  const pb = dirOf(b.az, b.alt)
  const cos = Math.max(-1, Math.min(1, pa[0] * pb[0] + pa[1] * pb[1] + pa[2] * pb[2]))
  const perDeg = side / b.fov
  const turn = Math.abs(((b.az - a.az + 540) % 360) - 180) * Math.abs(Math.sin(b.alt * RAD)) * RAD * (side / 2)
  const zoom = Math.abs(Math.log(b.fov / a.fov)) * (side / 2)
  return (Math.acos(cos) / RAD) * perDeg + turn + zoom
}

/** The direction under a point on the screen (the inverse, for a tap or a drag) */
export function unproject(cam: Camera, sx: number, sy: number): V3 {
  const X = (sx - cam.cx) / cam.scale
  const Y = -(sy - cam.cy) / cam.scale
  const d = (X * X + Y * Y) / 4
  // Inverse stereographic: (X, Y) on the plane tangent at f, back to the sphere
  const x = X / (1 + d)
  const y = Y / (1 + d)
  const z = (1 - d) / (1 + d)
  return [
    x * cam.r[0] + y * cam.u[0] + z * cam.f[0],
    x * cam.r[1] + y * cam.u[1] + z * cam.f[1],
    x * cam.r[2] + y * cam.u[2] + z * cam.f[2],
  ]
}

/** Azimuth and altitude (degrees) of a direction */
export function azAltOf(v: V3): { az: number; alt: number } {
  return { az: ((Math.atan2(v[0], v[1]) / RAD) % 360 + 360) % 360, alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD }
}

/**
 * The ground on the screen: the horizon is a great circle, so it projects to a circle (or, looking
 * level, to a straight line); the ground is the side of it holding the nadir.
 */
export type Ground =
  | { kind: 'circle'; x: number; y: number; r: number; inside: boolean }
  | { kind: 'line'; y: number }

export function groundOf(cam: Camera, view: DomeView): Ground {
  const p = (az: number): [number, number] => {
    const out: [number, number] = [0, 0]
    projectDir(cam, dirOf(az, 0), out)
    return out
  }
  // Three points of the horizon: ahead, and a quarter turn either way (never behind)
  const [a, b, c] = [p(view.az - 90), p(view.az), p(view.az + 90)]
  const det = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  if (Math.abs(view.alt) < 0.05 || Math.abs(det) < 1e-6 * cam.scale * cam.scale) return { kind: 'line', y: b[1] }
  const s = (q: [number, number]) => q[0] * q[0] + q[1] * q[1]
  const x = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / det
  const y = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / det
  const r = Math.hypot(a[0] - x, a[1] - y)
  // Looking up, the nadir is behind and the ground is outside the circle; looking down, inside it
  return { kind: 'circle', x, y, r, inside: view.alt < 0 }
}
