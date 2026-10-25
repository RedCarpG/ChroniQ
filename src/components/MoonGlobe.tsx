import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import heightsUrl from '../assets/moon/ldem_3_8bit.jpg'
import colourLargeUrl from '../assets/moon/lroc_color_2k.jpg'
import colourSmallUrl from '../assets/moon/lroc_color_poles_1k.jpg'
import type { MoonFrame } from '../lib/moonView'
import { litPart } from '../lib/sky'

// The Moon as seen, drawn by WebGL: a sphere wrapped in NASA's map of the Moon (LRO), turned as the
// Moon is turned to the viewer (its libration, and the tilt it is seen at), lit by the Sun. The light
// is Lommel–Seeliger's, as the Moon's dust scatters it: the full Moon looks flat, not like a ball, and
// the light fades only near the terminator, where the heights (LOLA) pick out the crater walls. The
// unlit part has a little earthshine. Where there is no WebGL, the phase is drawn flat (litPart).

const VERTEX = `
attribute vec2 p;
varying vec2 v;
void main() {
  v = p * 1.02;
  gl_Position = vec4(p, 0.0, 1.0);
}`

const FRAGMENT = `
precision highp float;
varying vec2 v;
uniform sampler2D uColour;
uniform sampler2D uHeight;
uniform mat3 uBody;
uniform vec3 uSun;
uniform vec3 uPole;
uniform vec2 uTexel;
uniform float uMapped;
uniform float uRelief;
uniform float uEarthshine;
uniform float uAa;
const float PI = 3.14159265;
void main() {
  float r = length(v);
  float edge = 1.0 - smoothstep(1.0 - uAa, 1.0 + uAa, r);
  if (edge <= 0.0) discard;
  // The point of the sphere under this pixel (z towards the viewer), and where it is on the Moon
  vec3 n = vec3(v, sqrt(max(0.0, 1.0 - r * r)));
  vec3 b = uBody * n;
  float lat = asin(clamp(b.z, -1.0, 1.0));
  vec2 uv = vec2(atan(b.y, b.x) / (2.0 * PI) + 0.5, 0.5 - lat / PI);
  vec3 albedo = mix(vec3(0.42), pow(texture2D(uColour, uv).rgb, vec3(2.2)), uMapped);
  // The ground's slope from the heights, east and north, tilting the surface's normal
  vec3 east = normalize(cross(uPole, n) + vec3(1e-5));
  vec3 north = cross(n, east);
  float hE = texture2D(uHeight, uv + vec2(uTexel.x, 0.0)).r - texture2D(uHeight, uv - vec2(uTexel.x, 0.0)).r;
  float hN = texture2D(uHeight, uv - vec2(0.0, uTexel.y)).r - texture2D(uHeight, uv + vec2(0.0, uTexel.y)).r;
  vec3 s = normalize(n - uRelief * uMapped * (hE / max(cos(lat), 0.2) * east + hN * north));
  float mu0 = dot(s, uSun);
  float mu = max(n.z, 0.0);
  float light = mu0 > 0.0 ? 2.0 * mu0 / (mu0 + mu + 1e-4) : 0.0;
  // Sunlit peaks just past the terminator, but no light far into the night side
  light *= smoothstep(-0.12, 0.02, dot(n, uSun));
  vec3 colour = albedo * light * 1.6 + albedo * uEarthshine * vec3(0.78, 0.88, 1.1) * (0.45 + 0.55 * mu);
  gl_FragColor = vec4(pow(colour, vec3(1.0 / 2.2)) * edge, edge);
}`

const DPR_MAX = 2

interface Gl {
  gl: WebGLRenderingContext
  loc: (name: string) => WebGLUniformLocation | null
  colour: WebGLTexture
  height: WebGLTexture
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
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const p = gl.getAttribLocation(program, 'p')
  gl.enableVertexAttribArray(p)
  gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0)
  // Grey until the maps come
  const texture = (unit: number) => {
    const tex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]))
    return tex
  }
  const colour = texture(0)
  const height = texture(1)
  const loc = (name: string) => gl.getUniformLocation(program, name)
  gl.uniform1i(loc('uColour'), 0)
  gl.uniform1i(loc('uHeight'), 1)
  gl.clearColor(0, 0, 0, 0)
  return { gl, loc, colour, height }
}

/** A map into a texture: wrapping round in longitude, mipmapped (the sizes are powers of two) */
function upload(g: Gl, unit: number, tex: WebGLTexture, image: HTMLImageElement, format: number) {
  const { gl } = g
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, image)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
}

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

/** The Moon, drawn as seen (`frame`, lib/moonView), filling a square */
export function MoonGlobe({ frame, lit, label }: { frame: MoonFrame; lit: number; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gl = useRef<Gl | null>(null)
  const [flat, setFlat] = useState(false)
  // Whether the maps are in (0: a grey Moon, in its phase, until they come)
  const mapped = useRef(0)
  const draw = useRef(() => {})
  draw.current = () => {
    const g = gl.current
    const canvas = canvasRef.current
    if (!g || !canvas) return
    const { gl: c, loc } = g
    const size = Math.max(1, Math.round(canvas.clientWidth * Math.min(DPR_MAX, window.devicePixelRatio || 1)))
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size
      canvas.height = size
    }
    c.viewport(0, 0, size, size)
    const [x, y, z] = frame.body
    // Rows of the matrix: the Moon's axes in screen coordinates (WebGL takes it column by column)
    c.uniformMatrix3fv(loc('uBody'), false, [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]])
    c.uniform3fv(loc('uSun'), frame.sun)
    c.uniform3fv(loc('uPole'), z)
    c.uniform2f(loc('uTexel'), 1 / 1024, 1 / 512)
    c.uniform1f(loc('uMapped'), mapped.current)
    c.uniform1f(loc('uRelief'), 2.4)
    // Earthshine: the Earth seen from the Moon is nearly full when the Moon is new
    c.uniform1f(loc('uEarthshine'), 0.07 * (1 - lit) ** 2)
    c.uniform1f(loc('uAa'), (2.04 / size) * 1.2)
    c.clear(c.COLOR_BUFFER_BIT)
    c.drawArrays(c.TRIANGLE_STRIP, 0, 4)
  }

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    gl.current = setUp(canvas)
    if (!gl.current) return setFlat(true)
    const g = gl.current
    let gone = false
    // The maps: the heights and the smaller colour map first, the larger one too for a large Moon
    Promise.all([loadImage(colourSmallUrl), loadImage(heightsUrl)])
      .then(([colour, heights]) => {
        if (gone) return
        upload(g, 0, g.colour, colour, g.gl.RGB)
        upload(g, 1, g.height, heights, g.gl.LUMINANCE)
        mapped.current = 1
        draw.current()
        if (canvas.width > 640) return loadImage(colourLargeUrl)
      })
      .then((large) => {
        if (gone || !large) return
        upload(g, 0, g.colour, large, g.gl.RGB)
        draw.current()
      })
      .catch(() => {
        // Offline before the maps were kept: the Moon stays grey, still in its phase
      })
    const ro = new ResizeObserver(() => draw.current())
    ro.observe(canvas)
    return () => {
      gone = true
      ro.disconnect()
    }
  }, [])
  useEffect(() => draw.current(), [frame, lit])

  // Without WebGL: the lit part, turned towards the Sun (screen y is up, the SVG's is down)
  const turn = (Math.atan2(-frame.sun[1], frame.sun[0]) * 180) / Math.PI
  return (
    <div className="moon-globe" role="img" aria-label={label}>
      {flat ? (
        <svg viewBox="-1.05 -1.05 2.1 2.1">
          <circle className="moon-globe-dark" r={1} />
          <path className="moon-globe-lit" d={litPart(lit, 1)} transform={`rotate(${turn.toFixed(1)})`} />
        </svg>
      ) : (
        <canvas ref={canvasRef} />
      )}
    </div>
  )
}
