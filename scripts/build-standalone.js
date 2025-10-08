const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'index.html');
const cssPath = path.join(projectRoot, 'styles.css');
const jsPath = path.join(projectRoot, 'app.js');
const outputPath = path.join(projectRoot, 'standalone.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const inlineCss = `<style>\n${css}\n</style>`;
const inlineJs = `<script>\n${js}\n</script>`;

let output = html.replace('<link rel="stylesheet" href="styles.css" />', inlineCss);
output = output.replace('<script src="app.js"></script>', inlineJs);

const banner = `<!--\n  standalone.html is generated automatically by scripts/build-standalone.js\n  It inlines styles.css and app.js so the dashboard works as a single file.\n  Run \"node scripts/build-standalone.js\" after editing the source files to refresh it.\n-->\n`;

fs.writeFileSync(outputPath, banner + output);
console.log(`Standalone bundle written to ${path.relative(projectRoot, outputPath)}`);
