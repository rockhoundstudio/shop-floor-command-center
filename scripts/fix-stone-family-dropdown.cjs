const fs = require('fs');
const path = 'app/routes/app.meta-injector.injector.jsx';
let c = fs.readFileSync(path, 'utf8');

const regex = /options=\{\[\s*\{[^}]*"Select stone family\.\.\."[^}]*\}[\s\S]*?\{ label: "Variscite", value: "Variscite" \}\s*\]\}/;

const newOptions = `options={[{ label: "Select stone family...", value: "" }, ...DROPDOWN_OPTIONS.stone_family]}`;

if (!regex.test(c)) { console.log('NO MATCH'); process.exit(1); }
c = c.replace(regex, newOptions);
fs.writeFileSync(path, c, 'utf8');
console.log('Done');
