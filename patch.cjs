const fs = require("fs");
const p = "./app/utils/meta-injector.loader.jsx";
let c = fs.readFileSync(p, "utf8");
const start = c.indexOf("let cleanJson = textContent.trim();");
const end = c.indexOf("const parsedValues = JSON.parse(cleanJson);");
const newBlock = "let cleanJson = textContent.trim();\n      if (cleanJson.slice(0,7) === String.fromCharCode(96,96,96,106,115,111,110)) { cleanJson = cleanJson.slice(7); if (cleanJson[0] === \"\\n\") cleanJson = cleanJson.slice(1); if (cleanJson.slice(-3) === String.fromCharCode(96,96,96)) cleanJson = cleanJson.slice(0,-3).trimEnd(); } else if (cleanJson.slice(0,3) === String.fromCharCode(96,96,96)) { cleanJson = cleanJson.slice(3); if (cleanJson[0] === \"\\n\") cleanJson = cleanJson.slice(1); if (cleanJson.slice(-3) === String.fromCharCode(96,96,96)) cleanJson = cleanJson.slice(0,-3).trimEnd(); }\n      ";
c = c.slice(0, start) + newBlock + c.slice(end);
fs.writeFileSync(p, c, "utf8");
console.log("Done");
