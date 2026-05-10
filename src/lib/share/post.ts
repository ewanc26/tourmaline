/**
 * Creates a Bluesky post with the personality card image attached.
 * Uses RichText for proper @mention resolution.
 */

import { Agent, RichText } from '@atproto/api';
import type { PersonalityCardData } from './personality-svg';
import { renderPersonalitySvg } from './personality-svg';
import { svgToPng } from './svg-to-png';

export interface ShareResult {
	uri: string;
	cid: string;
}

export async function sharePersonality(
	agent: Agent,
	card: PersonalityCardData
): Promise<ShareResult> {
	// 1. Render SVG → PNG
	const svg = renderPersonalitySvg(card);
	const pngBytes = await svgToPng(svg);

	// 2. Upload the image blob
	const { data: blobData } = await agent.uploadBlob(pngBytes, {
		encoding: 'image/png'
	});

	// 3. Build rich text with @mention
	const rt = new RichText({
		text: `I'm a ${card.archetype}!\n\nfound out by using tourmaline by @ewancroft.uk`
	});
	await rt.detectFacets(agent);

	// 4. Create the post
	const result = await agent.post({
		text: rt.text,
		facets: rt.facets,
		embed: {
			$type: 'app.bsky.embed.images',
			images: [
				{
					alt: `${card.archetype} — personality profile from tourmaline`,
					image: blobData.blob,
					aspectRatio: {
						width: 1200,
						height: 1240
					}
				}
			]
		},
		createdAt: new Date().toISOString()
	});

	return { uri: result.uri, cid: result.cid };
}
