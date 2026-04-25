import { S } from "../../styles";

export default function AlertsPanel({ alerts, showAlerts, setShowAlerts }) {
  return (
    <>
      {showAlerts && alerts.length > 0 && (
        <div style={{ marginBottom: 10 }} className="no-print">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
              ⚠️ {alerts.filter((a) => a.type === "danger").length} críticas ·{" "}
              {alerts.filter((a) => a.type === "warning").length} advertencias ·{" "}
              {alerts.filter((a) => a.type === "info").length} info
            </span>
            <button
              style={S.btn("#e2e8f0", "#475569")}
              onClick={() => setShowAlerts(false)}
            >
              Ocultar
            </button>
          </div>
          {alerts.slice(0, 10).map((a, i) => (
            <div
              key={i}
              style={{
                padding: "5px 12px",
                borderRadius: 5,
                fontSize: 11,
                marginBottom: 3,
                background:
                  a.type === "danger"
                    ? "#fef2f2"
                    : a.type === "warning"
                      ? "#fffbeb"
                      : "#eff6ff",
                borderLeft: `3px solid ${a.type === "danger" ? "#ef4444" : a.type === "warning" ? "#f97316" : "#3b82f6"}`,
                color:
                  a.type === "danger"
                    ? "#991b1b"
                    : a.type === "warning"
                      ? "#92400e"
                      : "#1e40af",
              }}
            >
              {a.type === "danger" ? "🔴" : a.type === "warning" ? "🟠" : "🔵"}{" "}
              {a.msg}
            </div>
          ))}
          {alerts.length > 10 && (
            <div
              style={{ fontSize: 10, color: "#475569", padding: "3px 12px" }}
            >
              ...y {alerts.length - 10} más
            </div>
          )}
        </div>
      )}
      {!showAlerts && (
        <button
          style={{
            ...S.btn("#e2e8f0", "#475569"),
            marginBottom: 10,
            fontSize: 10,
          }}
          className="no-print"
          onClick={() => setShowAlerts(true)}
        >
          Mostrar alertas 🔴{alerts.filter((a) => a.type === "danger").length}{" "}
          🟠{alerts.filter((a) => a.type === "warning").length}
        </button>
      )}
    </>
  );
}
