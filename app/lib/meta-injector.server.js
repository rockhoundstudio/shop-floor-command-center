import { authenticate } from "../shopify.server";

export async function requireAuth(request) {
  const { admin } = await authenticate.admin(request);
  return admin;
}
