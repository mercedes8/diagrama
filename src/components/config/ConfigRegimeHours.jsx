import { REGIMES } from "../../constants";
import { S } from "../../styles";

export default function ConfigRegimeHours({ regimeHours, setRegimeHours }) {
  return (
    <div style={S.cfgBox}>
      <div style={S.cfgTitle}>📊 CARGA HORARIA MENSUAL POR RÉGIMEN</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>
        Editá las horas base de cada régimen. El cálculo mensual real se ajusta
        automáticamente con la fórmula:{" "}
        <b>(días hábiles × hs régimen) ÷ días totales</b>.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          {
            key: "R15",
            label: "Régimen 15",
            color: "#1e40af",
            bg: "#eff6ff",
            note: "Corresponde aprox. a 40hs/semana",
          },
          {
            key: "R27",
            label: "Régimen 27",
            color: "#15803d",
            bg: "#f0fdf4",
            note: "Corresponde aprox. a 36hs/semana",
          },
          {
            key: "H24",
            label: "24hs Semanal",
            color: "#92400e",
            bg: "#fffbeb",
            note: "Corresponde aprox. a 24hs/semana",
          },
        ].map(({ key, label, color, bg, note }) => {
          const hs = regimeHours[key] ?? REGIMES[key].hours;
          const defaultHs = REGIMES[key].hours;
          const changed = hs !== defaultHs;
          return (
            <div
              key={key}
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
                padding: "12px 16px",
                background: bg,
                border: `1px solid ${color}40`,
                borderLeft: `4px solid ${color}`,
                borderRadius: 8,
              }}
            >
              <div style={{ minWidth: 130 }}>
                <div
                  style={{
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontWeight: 900,
                    fontSize: 14,
                    color,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  {note}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={S.formLabel}>HS MENSUALES BASE</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    min={40}
                    max={240}
                    step={1}
                    value={hs}
                    onChange={(e) =>
                      setRegimeHours((p) => ({
                        ...p,
                        [key]: Math.max(40, Math.min(240, +e.target.value)),
                      }))
                    }
                    style={{
                      ...S.formInput,
                      width: 72,
                      fontWeight: 700,
                      color,
                      fontSize: 14,
                    }}
                  />
                  <span style={{ fontSize: 11, color: "#475569" }}>hs/mes</span>
                  {changed && (
                    <button
                      onClick={() =>
                        setRegimeHours((p) => ({ ...p, [key]: defaultHs }))
                      }
                      style={{
                        background: "none",
                        border: "1px solid #94a3b8",
                        borderRadius: 4,
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: 10,
                        padding: "2px 7px",
                      }}
                      title={`Restaurar valor original (${defaultHs}hs)`}
                    >
                      ↩ {defaultHs}hs
                    </button>
                  )}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "8px 16px",
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  minWidth: 110,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: "#94a3b8",
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  HS BASE MENSUAL
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color,
                    lineHeight: 1.1,
                  }}
                >
                  {hs}hs
                </div>
                <div style={{ fontSize: 9, color: "#94a3b8" }}>
                  solo empleados con LAR usan fórmula reducida
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
