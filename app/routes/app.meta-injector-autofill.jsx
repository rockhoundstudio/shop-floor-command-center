import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    const autofillRes = await executeAutofill(intent, body, admin);
    if (autofillRes instanceof Response) {
      return autofillRes;
    }
    return Response.json(autofillRes);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};