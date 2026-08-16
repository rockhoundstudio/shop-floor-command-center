const fs = require('fs');
const path = 'app/routes/app.meta-injector-autofill.jsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  '  * secondary_medium: Look for a SECOND distinct metal component only (e.g., a gold accent ring, a copper wrap accent). If the ONLY metal visible is the primary bezel or setting, return strictly "None". Do NOT invent gemstones or materials not physically visible as a separate component.',
  '  * secondary_medium: Look ONLY for a second distinct METAL component (e.g., a gold accent ring). If you see small stones or crystals on a bail, those are part of the bail — return "None" for secondary_medium. Do NOT describe bail decorations here. If no second metal component exists, return strictly "None".'
);

c = c.replace(
  '  * bail_included: Look at the TOP of the piece. If there is a separate small clip or loop pinched onto the bezel, return "Sterling Silver Pinch Bail". If the bail is part of the bezel frame itself with no separate clip, return "Integrated Bezel Bail". If there is no bail at all, return "None". Do NOT guess — only report what is physically visible.',
  '  * bail_included: Look at the TOP of the piece. If there is a separate small clip or loop pinched onto the bezel (with or without accent stones), return "Silver Plated Pinch Bail". If the bail is welded or formed as part of the bezel frame with no separate clip, return "Integrated Bezel Bail". If there is no bail at all, return "None". Do NOT guess — only report what is physically visible.'
);

c = c.replace(
  '  * primary_medium: State the primary metal or mounting material (e.g., ".925 Sterling Silver Bezel", "Copper Bezel", "Alloy"). Do not leave blank!',
  '  * primary_medium: State the primary metal or mounting material. Use exactly one of these: ".925 Sterling Silver Bezel", "Silver Plated Bezel", "Alloy Bezel", "Copper Bezel", "Gold Plated Bezel". Do not leave blank!'
);

c = c.replace(
  '- primary_use: Smart Switch! Force strictly to best match (e.g., "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)").',
  '- primary_use: Smart Switch! Force strictly to best match (e.g., "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)"). If a chain is visible, classify as "Necklace".\n- chain_material: If a necklace chain is visible, identify it as exactly one of: "Silver Plated Snake Chain", "Gold Plated Snake Chain", "Sterling Silver Chain", "Cord". If no chain is visible, return "None".'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Done');
