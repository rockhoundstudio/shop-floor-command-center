const fs = require('fs');
const path = 'app/routes/app.meta-injector-autofill.jsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  '  * secondary_medium: State accent metal or "None".',
  '  * secondary_medium: Look for a SECOND distinct metal component only (e.g., a gold accent ring, a copper wrap accent). If the ONLY metal visible is the primary bezel or setting, return strictly "None". Do NOT invent gemstones or materials not physically visible as a separate component.'
);

c = c.replace(
  '  * bail_included: State the bail style (e.g., "Integrated Bezel Bail", "Sterling Silver Pinch Bail") or "None".',
  '  * bail_included: Look at the TOP of the piece. If there is a separate small clip or loop pinched onto the bezel, return "Sterling Silver Pinch Bail". If the bail is part of the bezel frame itself with no separate clip, return "Integrated Bezel Bail". If there is no bail at all, return "None". Do NOT guess — only report what is physically visible.'
);

c = c.replace(
  '  * primary_medium: State the primary metal or mounting material (e.g., ".925 Sterling Silver Bezel", "Copper Bezel", "Alloy"). Do not leave blank!',
  '  * primary_medium: State the primary metal or mounting material (e.g., ".925 Sterling Silver Bezel", "Copper Bezel", "Alloy"). Do not leave blank!\n  * surface_finish: Describe the stone\'s surface finish as seen in the photo. Use terms like "High Polish", "Matte", "Satin", "Natural/Raw", "Tumbled". Do not leave blank.'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Done');
