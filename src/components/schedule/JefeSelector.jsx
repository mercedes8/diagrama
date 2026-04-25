import { REGIMES } from "../../constants";
import { S } from "../../styles";

export default function JefeSelector({ jefeId, setJefeId, employees }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "stretch",
        marginBottom: 10,
        flexWrap: "wrap",
      }}
      className="no-print"
    >
      <div
        style={{
          border: "2px solid #1e40af",
          borderRadius: 8,
          padding: "8px 14px",
          background: "#eff6ff",
          minWidth: 260,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 13,
            fontWeight: 900,
            color: "#1e40af",
            letterSpacing: 1,
          }}
        >
          👑 JEFE/A DE SECCION
        </div>
        {jefeId ? (
          (() => {
            const jefe = employees.find((e) => e.id === jefeId);
            return jefe ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontWeight: 700, fontSize: 12, color: "#1e293b" }}
                  >
                    {jefe.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>
                    {REGIMES[jefe.regime]?.label}
                    {jefe.reduction > 0
                      ? ` · Reducción ${jefe.reduction}%`
                      : ""}
                    {jefe.regime === "H24" ? " · 24hs" : ""}
                    {" · "}
                    {jefe.turn}
                  </div>
                </div>
                <button
                  onClick={() => setJefeId(null)}
                  style={{
                    background: "none",
                    border: "1px solid #93c5fd",
                    borderRadius: 4,
                    color: "#1d4ed8",
                    cursor: "pointer",
                    fontSize: 10,
                    padding: "2px 8px",
                  }}
                >
                  Cambiar
                </button>
              </div>
            ) : null;
          })()
        ) : (
          <select
            style={{ ...S.formSel, fontSize: 11 }}
            value=""
            onChange={(e) => setJefeId(+e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.turn}
                {e.reduction > 0 ? ` -${e.reduction}%` : ""}
                {e.regime === "H24" ? " 24hs" : ""})
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
