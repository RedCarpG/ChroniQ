// Shared by the sky and solar-system views without importing either page.
export const BODY_COLOUR: Record<string, string> = {
  earth: '#5b9bf0',
  pluto: '#c8b6a6',
  sun: '#ffcf4a',
  moon: '#ece6d6',
  mercury: '#c9bfb1',
  venus: '#fff3c9',
  mars: '#ff8a62',
  jupiter: '#f4d7a8',
  saturn: '#ead28f',
  uranus: '#a8e6e8',
  neptune: '#8ea9f3',
}

/** Each kind of deep-sky object's colour on the sky (as Stellarium marks them) */
export const DSO_COLOUR: Record<string, string> = {
  galaxy: '#ff9a8a',
  gc: '#ffd27a',
  oc: '#ffd27a',
  nebula: '#8fe3a8',
  pn: '#8fe3a8',
  snr: '#8fe3a8',
  asterism: '#b8c0d8',
}
