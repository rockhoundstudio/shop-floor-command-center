export function MetaCore({ tab }) {
  if (tab === "bulkedit") return <div>Bulk Edit — placeholder</div>;
  if (tab === "inject") return <div>Inject — placeholder</div>;
  if (tab === "mindat") return <div>Mindat — placeholder</div>;
  return null;
}
