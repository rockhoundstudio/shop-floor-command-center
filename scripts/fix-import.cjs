const fs = require('fs');
const path = 'app/routes/app.meta-injector.injector.jsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  'import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS, productTypeOptions, collectionLocationOptions, normalizeDropdownValue } from "../utils/meta-injector.constants.jsx";',
  'import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS, productTypeOptions, collectionLocationOptions, normalizeDropdownValue, DROPDOWN_OPTIONS } from "../utils/meta-injector.constants.jsx";'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Done');
