// 对准天空: where a phone's back is pointing, from its orientation sensors. Pure maths, apart from the
// sensors themselves in useDevicePointing.

const RAD = Math.PI / 180

/**
 * The direction out of a phone's back, from its orientation in the W3C convention (alpha about the
 * vertical with 0 as north, then beta, then gamma, all in degrees): an azimuth from north through
 * east, and an altitude above the horizon.
 */
export function pointingFrom(alpha: number, beta: number, gamma: number) {
  const [a, b, g] = [alpha * RAD, beta * RAD, gamma * RAD]
  const [sA, cA, sB, cB, sG, cG] = [Math.sin(a), Math.cos(a), Math.sin(b), Math.cos(b), Math.sin(g), Math.cos(g)]
  // The third column of the rotation matrix is the screen's outward normal; the back is its opposite
  const east = -(cG * sA * sB + cA * sG)
  const north = -(sA * sG - cA * cG * sB)
  const up = -(cB * cG)
  return {
    az: ((Math.atan2(east, north) / RAD) % 360 + 360) % 360,
    alt: Math.asin(Math.max(-1, Math.min(1, up))) / RAD,
  }
}

/** The compass alpha of a reading, or null without one. iOS gives its compass apart, measured the other way */
export function compassAlpha(e: { alpha: number | null; absolute: boolean; webkitCompassHeading?: number }): number | null {
  if (typeof e.webkitCompassHeading === 'number') return (360 - e.webkitCompassHeading) % 360
  return e.absolute && e.alpha !== null ? e.alpha : null
}

/** A step of an angle towards another, the short way round: sensors jitter */
export function smoothAngle(from: number, to: number, amount: number) {
  const gap = ((to - from + 540) % 360) - 180
  return (from + gap * amount + 360) % 360
}

/**
 * How far to turn the map, in degrees clockwise, so the zenith is up from what one looks at. The map
 * has the zenith in the middle and north up, so looking south needs no turn.
 */
export const mapTurn = (az: number) => az - 180
