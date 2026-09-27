const productQuery = await admin.graphql(`
        query getProduct($id: ID!) {
          product(id: $id) {
            id title
            seo { title description }
            productCategory { productTaxonomyNode { fullName } }
            variants(first: 1) { edges { node { id price weight weightUnit } } }
            media(first: 1) { edges { node { id alt } } }
            collections(first: 10) { edges { node { id title } } }
            metafields(first: 250) { edges { node { namespace key value } } }
          }
        }
      `, { variables: { id: productGid } });

      const productData = await productQuery.json();
      const product = productData?.data?.product;
      if (!product) return Response.json({ intent: "loadProductData", success: false, message: "Product not found" });

      const currentMetafields = {};
      if (product.metafields?.edges) {
        product.metafields.edges.forEach(({node}) => {
            currentMetafields[`${node.namespace}.${node.key}`] = node.value;
        });
      }

      const canonicalFields = {};
      const repairPlan = {};
      const legacyFields = {};

      Object.keys(PIN_CONFIG).forEach(inKey => {
         const cfg = PIN_CONFIG[inKey];
         if (cfg.target === "metafield") {
             const dotKey = `${cfg.ns}.${cfg.key}`;
             canonicalFields[inKey] = currentMetafields[dotKey] ?? "";
             repairPlan[inKey] = currentMetafields[dotKey] ?? "";
         } else if (cfg.target === "native") {
             if (inKey === "shopify_title") canonicalFields[inKey] = product.title || "";
             if (inKey === "seo_title") canonicalFields[inKey] = product.seo?.title || "";
             if (inKey === "poetic_hook") canonicalFields[inKey] = product.seo?.description || "";
             if (inKey === "google_product_category") canonicalFields[inKey] = product.productCategory?.productTaxonomyNode?.fullName || "";
             repairPlan[inKey] = canonicalFields[inKey];
         } else if (cfg.target === "native_variant") {
             const variant = product.variants?.edges?.[0]?.node;
             if (inKey === "price") canonicalFields[inKey] = variant?.price || "0.00";
             if (inKey === "shipping_weight_oz") canonicalFields[inKey] = variant?.weight ? String(variant.weight) : "";
             repairPlan[inKey] = canonicalFields[inKey];
         } else if (cfg.target === "native_media") {
             canonicalFields[inKey] = product.media?.edges?.[0]?.node?.alt || "";
             repairPlan[inKey] = canonicalFields[inKey];
         } else if (cfg.target === "native_collection") {
             canonicalFields[inKey] = product.collections?.edges?.map(e => e.node.title).join(", ") || "";
             repairPlan[inKey] = canonicalFields[inKey];
         }
      });