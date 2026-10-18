import { createLucideIcon } from 'lucide-react'

/**
 * The composer's own marks for the choices that mean "let Dito decide".
 *
 * Drawn on the same 24px grid and weight as the shelf icons, two-tone: the
 * body (`dt-duo`) carries a light wash of the line colour, so a mark reads as
 * a shape and not a scribble at 14–16px, and it picks up the accent with the
 * row around it.
 */
const duo = 'dt-duo'
const solid = 'dt-duo-solid'

/** Skills as Dito needs them: a hand of cards, the front one lit. */
export const SkillDeckIcon = createLucideIcon('skill-deck', [
  ['path', { d: 'M8.75 6.5V5.25a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2V15.5a2 2 0 0 1-2 2h-1.5', key: 'back' }],
  ['rect', { x: '3.75', y: '6.5', width: '12.75', height: '14.25', rx: '2.25', className: duo, key: 'front' }],
  [
    'path',
    {
      d: 'M10.1 10.6c.3 1.6 1.25 2.55 2.85 2.85-1.6.3-2.55 1.25-2.85 2.85-.3-1.6-1.25-2.55-2.85-2.85 1.6-.3 2.55-1.25 2.85-2.85z',
      className: solid,
      key: 'spark',
    },
  ],
])

/** Every connected service: Dito at the hub, each service on its own branch. */
export const ConnectorHubIcon = createLucideIcon('connector-hub', [
  ['circle', { cx: '12', cy: '12.6', r: '2.1', className: solid, key: 'hub' }],
  ['circle', { cx: '12', cy: '4.2', r: '2.3', className: duo, key: 'a' }],
  ['circle', { cx: '4.7', cy: '16.8', r: '2.3', className: duo, key: 'b' }],
  ['circle', { cx: '19.3', cy: '16.8', r: '2.3', className: duo, key: 'c' }],
  ['path', { d: 'M12 10.1V6.9M9.85 13.85l-3.1 1.8M14.15 13.85l3.1 1.8', key: 'spokes' }],
])

/** Dito's usual voice: a plain reply, nothing put on. */
export const PlainVoiceIcon = createLucideIcon('plain-voice', [
  [
    'path',
    {
      d: 'M12 4c4.42 0 8 2.95 8 6.6s-3.58 6.6-8 6.6c-.93 0-1.82-.13-2.65-.37L5.1 18.75l1.05-3.35C4.8 14.2 4 12.5 4 10.6 4 6.95 7.58 4 12 4z',
      className: duo,
      key: 'bubble',
    },
  ],
  ['path', { d: 'M8.75 9.35h6.5M8.75 12.35h3.75', key: 'lines' }],
])
