const fs = require('fs');
const path = 'app/routes/app.meta-injector-autofill.jsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  '  * primary_medium: State the primary metal or mounting material. Use exactly one of these: ".925 Sterling Silver Bezel", "Silver Plated Bezel", "Alloy Bezel", "Copper Bezel", "Gold Plated Bezel". Do not leave blank!',
  '  * primary_medium: State the primary metal or mounting material. Use exactly one of these: ".925 Sterling Silver Bezel", "Silver Plated Bezel", "Gold Plated Bezel", "Copper Bezel", "Gold Tone Alloy Bezel", "Silver Tone Alloy Bezel", "Bronze Tone Alloy Bezel", "Glue-On Loop". Match the tone and finish visible in the photo. Do not leave blank!'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Done');
