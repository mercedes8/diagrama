import { TURN_LABEL } from "../../constants";
import { S } from "../../styles";

export default function ConfigShiftOffsets({
  earlyOffsets,
  setEarlyOffsets,
  lateOffsets,
  setLateOffsets,
}) {
  return (
    <div style={S.cfgBox}>
      <div style={S.cfgTitle}>⏱️ SALIDA ANTICIPADA / TARDÍA — Por turno</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
        La celda rosada indica que el empleado sale <b>antes</b> del horario
        normal, y la verde que sale <b>después</b>. La inicial que se muestra
        siempre corresponde al turno (M / T / N).
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { turn: "TM", label: "Turno Mañana", color: "#1d4ed8", base: 7 },
          { turn: "TT", label: "Turno Tarde", color: "#15803d", base: 7 },
          { turn: "TN", label: "Turno Noche", color: "#111", base: 10 },
        ].map(({ turn, label, color, base }) => (
          <div
            key={turn}
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              alignItems: "flex-end",
              padding: "10px 14px",
              background: "#f8fafc",
              borderRadius: 8,
              border: `1px solid #e2e8f0`,
              borderLeft: `4px solid ${color}`,
            }}
          >
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontWeight: 900,
                fontSize: 13,
                color,
                minWidth: 120,
              }}
            >
              {turn} — {label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 26,
                    height: 20,
                    borderRadius: 4,
                    background: "#fce7f3",
                    border: "2px solid #f9a8d4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#9d174d",
                  }}
                >
                  {TURN_LABEL[turn]}
                </div>
                <span style={S.formLabel}>
                  ROSADO — horas antes de fin de turno
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={base - 1}
                  step={1}
                  value={earlyOffsets[turn] ?? 2}
                  onChange={(e) =>
                    setEarlyOffsets((p) => ({
                      ...p,
                      [turn]: Math.max(1, Math.min(base - 1, +e.target.value)),
                    }))
                  }
                  style={{ ...S.formInput, width: 60 }}
                />
                <span
                  style={{ fontSize: 11, color: "#9d174d", fontWeight: 700 }}
                >
                  → trabaja {base - (earlyOffsets[turn] ?? 2)}hs (sale{" "}
                  {earlyOffsets[turn] ?? 2}hs antes)
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 26,
                    height: 20,
                    borderRadius: 4,
                    background: "#dcfce7",
                    border: "2px solid #86efac",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#166534",
                  }}
                >
                  {TURN_LABEL[turn]}
                </div>
                <span style={S.formLabel}>
                  VERDE — horas después de fin de turno
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  max={6}
                  step={1}
                  value={lateOffsets[turn] ?? 2}
                  onChange={(e) =>
                    setLateOffsets((p) => ({
                      ...p,
                      [turn]: Math.max(1, Math.min(6, +e.target.value)),
                    }))
                  }
                  style={{ ...S.formInput, width: 60 }}
                />
                <span
                  style={{ fontSize: 11, color: "#166534", fontWeight: 700 }}
                >
                  → trabaja {base + (lateOffsets[turn] ?? 2)}hs (sale{" "}
                  {lateOffsets[turn] ?? 2}hs después)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
