import { authenticate } from "../shopify.server";

// ==========================================
// ENGINE: META-INJECTOR SECURE GATEKEEPER
// ==========================================
// This file acts as the secure valve for your app. It verifies the session 
// and ensures only authorized users can write lapidary data to the Shopify store.

export async function requireAuth(request) {
  // Authenticates the request and hands back the 'admin' object 
  // which contains the graphql and rest clients needed to talk to Shopify.
  const { admin } = await authenticate.admin(request);
  return admin;
}