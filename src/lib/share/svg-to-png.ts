/**
 * Converts an SVG string to a PNG Uint8Array using an offscreen canvas.
 * Runs in the browser only.
 */

const WIDTH = 1200;
const HEIGHT = 1240;

export function svgToPng(svgString: string): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		const blob = new Blob([svgString], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);

		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = WIDTH;
			canvas.height = HEIGHT;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				URL.revokeObjectURL(url);
				reject(new Error('Could not get canvas context'));
				return;
			}

			// Scale up from SVG viewBox (600×620) to canvas (1200×1240)
			ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
			URL.revokeObjectURL(url);

			canvas.toBlob(
				(pngBlob) => {
					if (!pngBlob) {
						reject(new Error('toBlob returned null'));
						return;
					}
					pngBlob.arrayBuffer().then((buf) => {
						resolve(new Uint8Array(buf));
					});
				},
				'image/png',
				1.0
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load SVG image'));
		};

		img.src = url;
	});
}
