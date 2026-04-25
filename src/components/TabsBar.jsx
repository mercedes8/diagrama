import { S } from "../styles";

export default function TabsBar({ tab, setTab }) {
  const TabBtn = ({ id, label }) => (
    <div
      onClick={() => setTab(id)}
      style={{
        padding: "8px 18px",
        borderRadius: "8px 8px 0 0",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: ".5px",
        userSelect: "none",
        background: tab === id ? "#fff" : "transparent",
        border: tab === id ? "1px solid #cbd5e1" : "1px solid transparent",
        borderBottom: "none",
        color: tab === id ? "#1e40af" : "#64748b",
      }}
    >
      {label}
    </div>
  );
  return (
    <div style={S.tabs} className="no-print">
      <TabBtn id="schedule" label="📅 Diagrama" />
      <TabBtn id="staff" label="👤 Personal" />
      <TabBtn id="config" label="⚙️ Config" />
    </div>
  );
}
