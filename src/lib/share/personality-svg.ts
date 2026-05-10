/**
 * Generates an SVG string for the personality card share image.
 * Matches the tourmaline dark-green theme.
 *
 * Fonts are embedded as base64 woff2 so the canvas-to-PNG pipeline
 * renders them correctly (external @import doesn't work in Image → canvas).
 */

import type { PersonalityTrait } from '$lib/analysis/personality';
import { INTER_WOFF2, JETBRAINS_MONO_WOFF2 } from './fonts/embedded-fonts';

export interface PersonalityCardData {
	archetype: string;
	archetypeBlurb: string;
	traits: PersonalityTrait[];
}

const BG = '#0a0f0a';
const SURFACE = '#0f170f';
const BORDER = '#1a2b1a';
const ACCENT = '#4ade80';
const TEXT = '#e5e7eb';
const MUTED = '#9ca3af';
const DIM = '#6b7280';

const FONT_FACE_CSS = `
@font-face {
	font-family: 'Inter';
	src: url(data:font/woff2;base64,${INTER_WOFF2}) format('woff2');
	font-weight: 100 900;
	font-style: normal;
}
@font-face {
	font-family: 'JetBrains Mono';
	src: url(data:font/woff2;base64,${JETBRAINS_MONO_WOFF2}) format('woff2');
	font-weight: 400;
	font-style: normal;
}
`.trim();

export function renderPersonalitySvg(card: PersonalityCardData): string {
	const traitRows = card.traits
		.map(
			(t, i) => `
		<g transform="translate(32, ${230 + i * 58})">
			<rect width="536" height="48" rx="6" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>
			<text x="12" y="18" font-family="'JetBrains Mono', monospace" font-size="10" fill="${DIM}" text-transform="uppercase" letter-spacing="0.08em">${esc(t.label)}</text>
			<text x="12" y="36" font-family="Inter, sans-serif" font-size="14" font-weight="600" fill="${TEXT}">${esc(t.value)}</text>
			<text x="524" y="28" font-family="Inter, sans-serif" font-size="10" fill="${MUTED}" text-anchor="end">${esc(t.detail)}</text>
		</g>`
		)
		.join('');

	return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="620" viewBox="0 0 600 620">
	<defs>
		<style>${FONT_FACE_CSS}</style>
	</defs>

	<!-- Background -->
	<rect width="600" height="620" rx="12" fill="${BG}"/>

	<!-- Top accent line -->
	<rect x="0" y="0" width="600" height="3" rx="1.5" fill="${ACCENT}"/>

	<!-- Archetype -->
	<text x="32" y="60" font-family="Inter, sans-serif" font-size="32" font-weight="700" fill="${TEXT}">I'm a</text>
	<text x="32" y="100" font-family="Inter, sans-serif" font-size="36" font-weight="700" fill="${ACCENT}">${esc(card.archetype)}</text>

	<!-- Blurb -->
	<text x="32" y="130" font-family="Inter, sans-serif" font-size="14" fill="${MUTED}">${esc(card.archetypeBlurb)}</text>

	<!-- Divider -->
	<line x1="32" y1="160" x2="568" y2="160" stroke="${BORDER}" stroke-width="1"/>

	<!-- Section label -->
	<text x="32" y="195" font-family="'JetBrains Mono', monospace" font-size="11" fill="${DIM}" letter-spacing="0.08em">PERSONALITY PROFILE</text>

	<!-- Trait cards -->
	${traitRows}

	<!-- Footer -->
	<line x1="32" y1="580" x2="568" y2="580" stroke="${BORDER}" stroke-width="1"/>
	<text x="32" y="605" font-family="'JetBrains Mono', monospace" font-size="11" fill="${DIM}">tourmaline</text>
	<text x="568" y="605" font-family="Inter, sans-serif" font-size="11" fill="${DIM}" text-anchor="end">croft.click</text>
</svg>`;
}

function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
