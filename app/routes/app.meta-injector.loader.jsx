case "exportCSV": {
      const allProducts = await fetchAllProducts(admin.graphql);
      
      const keys = [
        "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", 
        "material", "stone_family", "color", "cut_and_shape", "surface_finish", 
        "dimensions_mm", "weight_grams", "collection_name", "collection_location", 
        "collection_date", "primary_use", "setting_ready", "bail_included", 
        "is_one_of_a_kind", "treated", "found_object", "wire_material", "artist_notes"
      ];

      let csv = "Product ID,Product Title," + keys.join(",") + "\n";

      allProducts.forEach(product => {
        const row = [`"${product.id}"`, `"${product.title.replace(/"/g, '""')}"`];
        
        const fieldMap = {};
        if (product.metafields && product.metafields.edges) {
          product.metafields.edges.forEach(edge => { 
            fieldMap[edge.node.key] = edge.node.value; 
          });
        }
        
        keys.forEach(key => {
          let val = fieldMap[key] || "";
          row.push(`"${val.toString().replace(/"/g, '""')}"`);
        });
        
        csv += row.join(",") + "\n";
      });

      return new Response(JSON.stringify({ success: true, intent, csv }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    default:
      return new Response(JSON.stringify({ success: false, error: "Unknown intent" }), { status: 400 });
  }
}