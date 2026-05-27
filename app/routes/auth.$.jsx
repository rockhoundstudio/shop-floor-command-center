import { boundary } from "@shopify/shopify-app-react-router/server";
import { login } from "../shopify.server";

export const loader = async ({ request }) => {
  return login(request);
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
