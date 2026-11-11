import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/index.js' {
  interface ListMetaInjectorReportsInput {
    productId?: string;
    mode?: string;
    limit?: number;
    afterReportId?: string;
  }

  interface ListMetaInjectorReportsOutput {
    ok: boolean;
    status: string;
    [k: string]: unknown;
  }

  interface ReadMetaInjectorReportInput {
    reportId: string;
    section?: 'report' | 'ui_audit';
    view?: 'chunk' | 'index' | 'header' | 'review' | 'drawer' | 'field';
    drawer?: string;
    fieldKey?: string;
    chunkIndex?: number;
  }

  interface ReadMetaInjectorReportOutput {
    ok: boolean;
    status: string;
    [k: string]: unknown;
  }

  interface ShopifyTools {
    /**
     * Lists captured temporary Meta Injector reports with product, session, revision, capture identity, pagination and UI-audit availability. Use mode='live_bench_state' for bench snapshots. Unavailable reports do not prove successful tests or absence of errors.
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
     * Reads an exact reportId. For live_bench_state use view=index, header, review, drawer or field. Drawer requires drawer; field requires fieldKey. Description Review is a separate drawer. Omit unused drawer/fieldKey. For ui_audit use chunk or omit view. Follow nextChunkIndex while hasMoreChunks, keeping reportId, section, view, drawer and fieldKey unchanged. Never mix snapshots or treat proposals as saved.
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
