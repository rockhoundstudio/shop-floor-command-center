const fs = require('fs');
const path = 'app/routes/app.meta-injector-autofill.jsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  'const dbGeoData = await getGeoData(admin, parsed.stone_family || segment1);',
  'console.log("[titleParse] Gemini returned stone_family:", parsed.stone_family);\n        const dbGeoData = await getGeoData(admin, parsed.stone_family || segment1);'
);
fs.writeFileSync(path, content, 'utf8');
console.log('Done');
