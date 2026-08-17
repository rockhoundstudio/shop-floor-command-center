const fs = require('fs');
const path = 'app/routes/app.meta-injector-autofill.jsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  '"Glue-On Loop". Match the tone and finish visible in the photo. Do not leave blank!',
  '"Glue-On Loop", "Drilled — Pinch Bail" (loose stone with a drilled hole and pinch bail through it, no bezel). Match the tone and finish visible in the photo. Do not leave blank!'
);

fs.writeFileSync(path, c, 'utf8');
console.log('Done');
