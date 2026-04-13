const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'nodes', 'help', 'utils', 'feishu-sdk', 'proto-buf');
const distDir = path.join(__dirname, '..', 'dist', 'nodes', 'help', 'utils', 'feishu-sdk', 'proto-buf');

const files = ['pbbp2.js', 'pbbp2.d.ts'];

for (const file of files) {
	const src = path.join(srcDir, file);
	const dest = path.join(distDir, file);
	if (fs.existsSync(src)) {
		fs.mkdirSync(distDir, { recursive: true });
		fs.copyFileSync(src, dest);
		console.log(`Copied ${file} -> dist`);
	} else {
		console.warn(`Warning: ${src} not found, skipping`);
	}
}
