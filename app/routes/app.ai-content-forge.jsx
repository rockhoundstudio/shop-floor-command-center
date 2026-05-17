const prompt = `Generate SEO-optimized alt text and meta descriptions for Rockhound Studio that match how buyers search. Load natural keyword phrases: material type, color, shape, finish, origin location, "one of a kind", "handcrafted", "handmade stone", "gemstone pendant", "polished stone".

Return ONLY valid JSON with exactly these three fields:
{ "altText": "...", "seoTitle": "...", "metaDescription": "..." }

RULES:
- UNIQUE STONE MANDATE: Stones may share origin and material. Alt text must describe only the unique visual characteristics of this specific stone — color zones, pattern, finish, setting. Meta descriptions may reference shared origin locations as a story thread, but the visual description and bench truth must be unique to this stone. Never duplicate another stone's description.

- altText: Visual description of true colors from the image only (ignore title color words) + keywords. End with "Rockhound Studio". Max 125 chars.

- seoTitle: [Stone Name] + [Finished Type] + "One-of-a-Kind" + "Rockhound Studio". Max 70 chars.

- metaDescription: Material + origin + "one of a kind". Load natural keyword phrases. Max 150 chars STRICT. ${polishingInstruction}

Foreman's Direct Note: ${customHook}
Product Title: ${productTitle}
Product Description: ${productDescription}
Origin Context: ${origin}`;