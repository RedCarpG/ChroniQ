import { useEffect, useLayoutEffect, useRef } from 'react'
import heightsUrl from '../assets/moon/ldem_3_8bit.jpg'
import moonUrl from '../assets/moon/lroc_color_poles_1k.jpg'
import jupiterUrl from '../assets/planets/jupiter.jpg'
import marsUrl from '../assets/planets/mars.jpg'
import mercuryUrl from '../assets/planets/mercury.jpg'
import neptuneUrl from '../assets/planets/neptune.jpg'
import saturnUrl from '../assets/planets/saturn.jpg'
import uranusUrl from '../assets/planets/uranus.jpg'
import venusUrl from '../assets/planets/venus.jpg'
import type { BodyFace } from '../lib/sky'

// The Moon and the planets on the 天象 map as globes, drawn by WebGL: a sphere (Jupiter and Saturn
// flattened as they are) wrapped in its map, turned to the viewer as the body really is (its pole
// and the spin of its prime meridian, lib/sky.ts bodyFaces) and lit from the Sun's side. The Moon
// and Mercury scatter light as dust does (Lommel–Seeliger: flat at full, with the Moon's crater
// walls picked out by its heights near the terminator); the others darken towards the limb.
// Saturn's rings are drawn from their radii (C, B, the Cassini division, A), the planet's shadow
// falling across them and theirs across the planet. Maps: the Moon NASA's (LRO, LOLA), the planets
// Solar System Scope's (CC BY 4.0, assets/planets/README.md).

const MAPS: Record<string, string> = {
  moon: moonUrl,
  mercury: mercuryUrl,
  venus: venusUrl,
  mars: marsUrl,
  jupiter: jupiterUrl,
  saturn: saturnUrl,
  uranus: uranusUrl,
  neptune: neptuneUrl,
}
/** Polar radius over equatorial */
const FLAT: Record<string, number> = { jupiter: 0.935, saturn: 0.902, uranus: 0.977, neptune: 0.983 }
/** Minnaert's k: how much the limb darkens (1 none, lower more); 0 for the Lommel–Seeliger dust */
const LIMB: Record<string, number> = {
  moon: 0,
  mercury: 0,
  venus: 0.75,
  mars: 0.85,
  jupiter: 0.8,
  saturn: 0.8,
  uranus: 0.75,
  neptune: 0.75,
}
/** The colour before the map is in */
const BASE: Record<string, [number, number, number]> = {
  moon: [0.6, 0.58, 0.55],
  mercury: [0.55, 0.53, 0.5],
  venus: [0.92, 0.85, 0.66],
  mars: [0.78, 0.42, 0.26],
  jupiter: [0.85, 0.76, 0.62],
  saturn: [0.88, 0.8, 0.6],
  uranus: [0.66, 0.86, 0.88],
  neptune: [0.36, 0.5, 0.86],
}
/** How far out from the centre the picture reaches, in the body's radii (Saturn's rings reach 2.27) */
export const globeExtent = (kind: string) => (kind === 'saturn' ? 2.32 : 1.02)

const VERTEX = `
attribute vec2 p;
varying vec2 v;
void main() {
  v = p;
  gl_Position = vec4(p, 0.0, 1.0);
}`

const FRAGMENT = `
precision highp float;
varying vec2 v;
uniform sampler2D uColour;
uniform sampler2D uHeight;
uniform mat3 uBody;
uniform mat3 uBodyT;
uniform vec3 uSun;
uniform vec3 uBase;
uniform vec2 uTexel;
uniform float uExtent;
uniform float uFlat;
uniform float uLimb;
uniform float uMapped;
uniform float uRelief;
uniform float uEarthshine;
uniform float uRings;
uniform float uPixel;
const float PI = 3.14159265;

// Saturn's rings at a radius (in Saturn radii): colour and how much they cover
vec4 ring(float r) {
  if (r < 1.239 || r > 2.269) return vec4(0.0);
  if (r < 1.527) return vec4(0.55, 0.52, 0.48, 0.14);
  if (r < 1.951) return vec4(0.93, 0.87, 0.74, 0.55 + 0.35 * (r - 1.527) / 0.424);
  if (r < 2.027) return vec4(0.5, 0.48, 0.45, 0.07);
  if (r > 2.212 && r < 2.222) return vec4(0.5, 0.48, 0.45, 0.1);
  return vec4(0.83, 0.78, 0.67, 0.62);
}

void main() {
  vec2 q = v * uExtent;
  // A ray straight from the viewer through this pixel, in the body's coordinates: a + t b (t towards the viewer)
  vec3 a = uBody * vec3(q, 0.0);
  vec3 b = uBody * vec3(0.0, 0.0, 1.0);
  vec3 w = vec3(1.0, 1.0, 1.0 / (uFlat * uFlat));
  float A = dot(w, b * b);
  float B = 2.0 * dot(w, a * b);
  float C = dot(w, a * a) - 1.0;
  float disc = B * B - 4.0 * A * C;
  vec4 colour = vec4(0.0);
  float tBody = -1e9;
  vec3 sunB = uBody * uSun;
  if (disc > 0.0) {
    tBody = (-B + sqrt(disc)) / (2.0 * A);
    vec3 p = a + tBody * b;
    vec3 nb = normalize(vec3(p.x, p.y, p.z / (uFlat * uFlat)));
    vec3 n = normalize(uBodyT * nb);
    float lat = asin(clamp(nb.z, -1.0, 1.0));
    vec2 uv = vec2(atan(nb.y, nb.x) / (2.0 * PI) + 0.5, 0.5 - lat / PI);
    vec3 albedo = mix(uBase * uBase, pow(texture2D(uColour, uv).rgb, vec3(2.2)), uMapped);
    vec3 s = n;
    if (uRelief > 0.0) {
      // The ground's slope from the heights tilts the surface (the Moon)
      vec3 pole = uBodyT * vec3(0.0, 0.0, 1.0);
      vec3 east = normalize(cross(pole, n) + vec3(1e-5));
      vec3 north = cross(n, east);
      float hE = texture2D(uHeight, uv + vec2(uTexel.x, 0.0)).r - texture2D(uHeight, uv - vec2(uTexel.x, 0.0)).r;
      float hN = texture2D(uHeight, uv - vec2(0.0, uTexel.y)).r - texture2D(uHeight, uv + vec2(0.0, uTexel.y)).r;
      s = normalize(n - uRelief * uMapped * (hE / max(cos(lat), 0.2) * east + hN * north));
    }
    float mu0 = dot(s, uSun);
    float mu = max(n.z, 1e-3);
    float light;
    if (uLimb <= 0.0) light = mu0 > 0.0 ? 2.0 * mu0 / (mu0 + mu) : 0.0;
    else light = mu0 > 0.0 ? 1.2 * pow(mu0, uLimb) * pow(mu, uLimb - 1.0) : 0.0;
    light *= smoothstep(-0.1, 0.03, dot(n, uSun));
    // The rings' shadow across the globe
    if (uRings > 0.5 && abs(sunB.z) > 1e-4) {
      float ts = -p.z / sunB.z;
      if (ts > 0.0) light *= 1.0 - 0.8 * ring(length((p + ts * sunB).xy)).a;
    }
    vec3 lit = albedo * light + albedo * uEarthshine * vec3(0.78, 0.88, 1.1) * (0.45 + 0.55 * mu);
    // Soft edge, a pixel wide: how far in from the limb, from the chord through it
    float edge = clamp(disc / (4.0 * A * A) / (2.0 * uPixel), 0.0, 1.0);
    colour = vec4(pow(lit, vec3(1.0 / 2.2)) * edge, edge);
  }
  if (uRings > 0.5 && abs(b.z) > 1e-4) {
    float tr = -a.z / b.z;
    vec3 rp = a + tr * b;
    vec4 rg = ring(length(rp.xy));
    if (rg.a > 0.0) {
      // Lit on the face towards the Sun; seen from the other face, only what light comes through
      float face = sign(sunB.z) == sign(b.z) ? 1.0 : 0.3;
      // The planet's shadow: behind it from the Sun, within its width
      float along = dot(rp, sunB);
      if (along < 0.0 && length(rp - along * sunB) < 1.0) face *= 0.12;
      vec3 rc = rg.rgb * face;
      float ra = rg.a;
      if (tr > tBody) colour = vec4(rc * ra, ra) + colour * (1.0 - ra);
      else if (colour.a < 1.0) colour = colour + vec4(rc * ra, ra) * (1.0 - colour.a);
    }
  }
  gl_FragColor = colour;
}`

interface Gl {
  gl: WebGLRenderingContext
  loc: (name: string) => WebGLUniformLocation | null
}

function setUp(canvas: HTMLCanvasElement): Gl | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true })
  if (!gl) return null
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, source)
    gl.compileShader(s)
    return s
  }
  const program = gl.createProgram()!
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const p = gl.getAttribLocation(program, 'p')
  gl.enableVertexAttribArray(p)
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0)
  for (const unit of [0, 1]) {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]))
  }
  const loc = (name: string) => gl.getUniformLocation(program, name)
  gl.uniform1i(loc('uColour'), 0)
  gl.uniform1i(loc('uHeight'), 1)
  gl.clearColor(0, 0, 0, 0)
  return { gl, loc }
}

function upload(gl: WebGLRenderingContext, unit: number, image: HTMLImageElement, format: number) {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, image)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
}

/** Each map loaded once, shared by every globe that wants it */
const images = new Map<string, Promise<HTMLImageElement>>()
function image(url: string) {
  let p = images.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
    images.set(url, p)
  }
  return p
}

/** Whether this browser can draw the globes (else the map keeps the flat faces) */
export const canDrawGlobes = (() => {
  let ok: boolean | null = null
  return () => {
    if (ok === null) {
      try {
        ok = !!document.createElement('canvas').getContext('webgl')
      } catch {
        ok = false
      }
    }
    return ok
  }
})()

/**
 * A body as a globe, filling a square canvas `pixels` wide (device pixels) that reaches `globeExtent`
 * of its radii from the centre; the canvas is sized to its box by the page (CSS)
 */
export function SkyGlobe({ kind, face, pixels }: { kind: string; face: BodyFace; pixels: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gl = useRef<Gl | null>(null)
  const mapped = useRef(0)
  const draw = useRef(() => {})
  draw.current = () => {
    const g = gl.current
    const canvas = canvasRef.current
    if (!g || !canvas) return
    const { gl: c, loc } = g
    const size = Math.max(8, Math.min(1024, Math.round(pixels)))
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size
      canvas.height = size
    }
    c.viewport(0, 0, size, size)
    const [x, y, z] = face.frame.body
    // uBody takes a direction in the viewer's frame to the body's; WebGL reads matrices by columns
    c.uniformMatrix3fv(loc('uBody'), false, [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]])
    c.uniformMatrix3fv(loc('uBodyT'), false, [...x, ...y, ...z])
    c.uniform3fv(loc('uSun'), face.frame.sun)
    c.uniform3fv(loc('uBase'), BASE[kind] ?? [0.7, 0.7, 0.7])
    c.uniform2f(loc('uTexel'), 1 / 1024, 1 / 512)
    const extent = globeExtent(kind)
    c.uniform1f(loc('uExtent'), extent)
    c.uniform1f(loc('uFlat'), FLAT[kind] ?? 1)
    c.uniform1f(loc('uLimb'), LIMB[kind] ?? 0.8)
    c.uniform1f(loc('uMapped'), mapped.current)
    c.uniform1f(loc('uRelief'), kind === 'moon' ? 2.4 : 0)
    // Earthshine on the Moon: the Earth seen from it is nearly full when the Moon is new
    c.uniform1f(loc('uEarthshine'), kind === 'moon' ? 0.07 * (1 - face.lit) ** 2 : 0)
    c.uniform1f(loc('uRings'), kind === 'saturn' ? 1 : 0)
    c.uniform1f(loc('uPixel'), (2 * extent) / size)
    c.clear(c.COLOR_BUFFER_BIT)
    c.drawArrays(c.TRIANGLE_STRIP, 0, 4)
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    gl.current = setUp(canvas)
    const g = gl.current
    if (!g) return
    let gone = false
    const loads: Promise<unknown>[] = [image(MAPS[kind]).then((img) => !gone && upload(g.gl, 0, img, g.gl.RGB))]
    if (kind === 'moon') loads.push(image(heightsUrl).then((img) => !gone && upload(g.gl, 1, img, g.gl.LUMINANCE)))
    Promise.all(loads)
      .then(() => {
        if (gone) return
        mapped.current = 1
        draw.current()
      })
      .catch(() => {
        // Offline before the maps were kept: the globe stays in its plain colour, still lit and phased
      })
    return () => {
      gone = true
    }
  }, [kind])
  useEffect(() => draw.current(), [face, pixels])

  return <canvas ref={canvasRef} className="sky-globe" />
}
