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