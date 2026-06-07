// --- GLOBAL UTILITY FUNCTIONS ---

// 1. Batch Governor: Splits large arrays into smaller, safe network chunks
export const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

// 2. ID Cleaner: Forces Shopify's strict Global ID format and strips bad characters
export const formatStrictGid = (id, type) => {
  const numericId = id.toString().replace(/\D/g, ""); 
  return `gid://shopify/${type}/${numericId}`;
};

// 3. Title Parser: Extracts the collection location/origin from a standard Rockhound title
export const extractOriginFromTitle = (title) => {
  const parts = title.split(" — ");
  if (parts.length >= 3) {
    return parts[1].trim();
  }
  return null;
};