import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/index.js' {
  interface ListMetaInjectorReportsInput {
    /**
     * Optional Shopify Product GID filter matching gid://shopify/Product/<digits>.
     */
    productId?: string;
    /**
     * Optional nonempty capture mode filter (up to 120 characters).
     */
    mode?: string;
    /**
     * Optional maximum number of report metadata entries to return (integer 1-5, default 3).
     */
    limit?: number;
    /**
     * Optional pagination cursor (reportId) to return reports after.
     */
    afterReportId?: string;
  }

  interface ListMetaInjectorReportsOutput {
    /**
     * Whether the list operation completed without a request or server error.
     */
    ok: boolean;
    /**
     * Response status such as ok, unavailable, invalid_request, invalid_cursor, or error.
     */
    status: string;
    [k: string]: unknown;
  }

  interface ReadMetaInjectorReportInput {
    /**
     * Required identifier of the captured report (e.g., srep_<sha256>).
     */
    reportId: string;
    /**
     * Optional section to read: 'report' or 'ui_audit' (default 'report').
     */
    section?: 'report' | 'ui_audit';
    /**
     * Optional 0-based server chunk index to read (nonnegative integer, default 0). Distinct from clipboard part numbers.
     */
    chunkIndex?: number;
  }

  interface ReadMetaInjectorReportOutput {
    /**
     * Whether the read operation completed without a request, not_found, or server error.
     */
    ok: boolean;
    /**
     * Response status such as ok, not_measured, not_found, invalid_request, or error.
     */
    status: string;
    [k: string]: unknown;
  }

  interface ShopifyTools {
    /**
     * Lists already captured temporary Meta Injector telemetry reports in volatile server memory, returning product/run/capture identities, pagination, and measured UI-audit availability. Unavailable reports are not successful tests and do not establish absence of errors.
     */
    register(
      name: 'list_meta_injector_reports',
      handler: (
        input: ListMetaInjectorReportsInput,
      ) =>
        | ListMetaInjectorReportsOutput
        | Promise<ListMetaInjectorReportsOutput>,
    );
    /**
     * Reads one lossless UTF-8 server chunk of a specific captured Meta Injector report or its measured UI audit by reportId. Server chunkIndex values are 0-based and distinct from clipboard part numbers. UI-audit data is measured only when recorded; never equate 67 telemetry targets with visible UI rows.
     */
    register(
      name: 'read_meta_injector_report',
      handler: (
        input: ReadMetaInjectorReportInput,
      ) => ReadMetaInjectorReportOutput | Promise<ReadMetaInjectorReportOutput>,
    );
  }

  const shopify: import('@shopify/ui-extensions/admin.app.tools.data').Api & {
    tools: ShopifyTools;
  };
  const globalThis: { shopify: typeof shopify };
}
