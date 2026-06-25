import { useNavigate } from "react-router";

export default function AdditionalPage() {
  const navigate = useNavigate();
  return (
    <s-page
      heading="🪨 Tools"
      backAction={{ onAction: () => navigate("/app") }}
    >
      <s-section heading="Coming Soon">
        <s-paragraph>
          Additional tools will appear here. Use the navigation to access your current tools.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

