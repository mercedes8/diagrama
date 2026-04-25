import { MONTHS, REGIMES } from "../constants";
import { effectiveHours } from "../utils/scheduleUtils";
import { calcWorkingDays, getDaysInMonth } from "../utils/dateUtils";
import { S } from "../styles";

export default function HoursModal({
  month,
  year,
  holidays,
  employees,
  hoursOverride,
  setHoursOverride,
  setHoursReady,
  schedule,
  larDays,
  daysInMonth,
  getRegimeHours,
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          maxWidth: 720,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "3px solid #1e40af",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: 22,
            fontWeight: 900,
            color: "#1e40af",
            marginBottom: 4,
          }}
        >
          📋 HORAS MENSUALES — {MONTHS[month].toUpperCase()} {year}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
          Confirmá o ajustá las horas objetivo de cada empleado antes de armar
          el diagrama.
        </div>
        {(() => {
          const wd = calcWorkingDays(year, month, holidays);
          const td = getDaysInMonth(year, month);
          return (
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
                padding: "8px 12px",
                background: "#fffbeb",
                border: "1px solid #fbbf24",
                borderRadius: 8,
                marginBottom: 14,
                fontSize: 11,
              }}
            >
              <span style={{ color: "#92400e", fontWeight: 700 }}>
                📐 Fórmula solo para empleados con LAR:
              </span>
              <span style={{ color: "#475569" }}>
                <b>(días hábiles × hs régimen) ÷ días totales</b>
              </span>
              <span style={{ color: "#64748b" }}>
                → Días hábiles (Lun–Sáb):{" "}
                <b style={{ color: "#059669" }}>{wd}</b>
              </span>
              <span style={{ color: "#64748b" }}>
                · Días totales: <b style={{ color: "#1e40af" }}>{td}</b>
              </span>
              <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                · Sin LAR → hs régimen completo
              </span>
            </div>
          );
        })()}
        {["TM", "TT", "TN"].map((turn) => {
          const emps = employees.filter((e) => e.turn === turn);
          if (!emps.length) return null;
          const turnLabel =
            turn === "TM"
              ? "Turno Mañana"
              : turn === "TT"
                ? "Turno Tarde"
                : "Turno Noche";
          const turnColor =
            turn === "TM" ? "#1d4ed8" : turn === "TT" ? "#15803d" : "#111";
          return (
            <div key={turn} style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontWeight: 900,
                  fontSize: 14,
                  color: turnColor,
                  borderBottom: `2px solid ${turnColor}`,
                  paddingBottom: 4,
                  marginBottom: 8,
                }}
              >
                {turn} — {turnLabel}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))",
                  gap: 6,
                }}
              >
                {emps.map((emp) => {
                  const base = effectiveHours(
                    emp,
                    year,
                    month,
                    holidays,
                    getRegimeHours,
                    larDays,
                    daysInMonth,
                  );
                  const regBase = getRegimeHours(emp.regime);
                  const reduced =
                    emp.reduction > 0
                      ? Math.round(regBase * (1 - emp.reduction / 100))
                      : regBase;
                  const wd = calcWorkingDays(year, month, holidays);
                  const td = getDaysInMonth(year, month);
                  const hasLAR = (() => {
                    for (let d = 1; d <= td; d++)
                      if (schedule[`${emp.id}-${d}`] === "LAR") return true;
                    return false;
                  })();
                  const isEdited = hoursOverride[emp.id] !== undefined;
                  const current = isEdited ? hoursOverride[emp.id] : base;
                  return (
                    <div
                      key={emp.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: isEdited
                          ? "#fffbeb"
                          : hasLAR
                            ? "#fef3c7"
                            : "#f8fafc",
                        border: isEdited
                          ? "1px solid #fbbf24"
                          : hasLAR
                            ? "1px solid #fbbf24"
                            : "1px solid #e2e8f0",
                        borderRadius: 6,
                        padding: "6px 10px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#1e293b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {hasLAR && (
                            <span
                              style={{
                                fontSize: 8,
                                background: "#f59e0b",
                                color: "#fff",
                                borderRadius: 3,
                                padding: "1px 4px",
                                fontWeight: 900,
                                flexShrink: 0,
                              }}
                            >
                              LAR
                            </span>
                          )}
                          {emp.name}
                        </div>
                        <div style={{ fontSize: 9, color: "#94a3b8" }}>
                          {REGIMES[emp.regime]?.label}
                          {emp.reduction > 0 ? ` · -${emp.reduction}%` : ""}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: hasLAR ? "#92400e" : "#94a3b8",
                            marginTop: 1,
                          }}
                        >
                          {hasLAR
                            ? `(${diasHabiles}d × ${emp.turn === "TN" ? 10 : 7}hs × ${reduced}) ÷ ${month === 1 ? 28 : 30} = ${Math.round((diasHabiles * (emp.turn === "TN" ? 10 : 7) * reduced) / (month === 1 ? 28 : 30))}hs LAR → ${base}hs a trabajar`
                            : `${reduced}hs (régimen completo)`}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={current}
                        onChange={(e) =>
                          setHoursOverride((prev) => ({
                            ...prev,
                            [emp.id]: +e.target.value,
                          }))
                        }
                        style={{
                          width: 54,
                          textAlign: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: isEdited ? "#92400e" : "#059669",
                          border: isEdited
                            ? "2px solid #fbbf24"
                            : "1px solid #cbd5e1",
                          borderRadius: 6,
                          padding: "3px 4px",
                          background: "#fff",
                        }}
                      />
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>hs</span>
                      {isEdited && (
                        <button
                          onClick={() =>
                            setHoursOverride((prev) => {
                              const n = { ...prev };
                              delete n[emp.id];
                              return n;
                            })
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#94a3b8",
                            padding: 0,
                          }}
                          title="Restaurar"
                        >
                          ↩
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 16,
            borderTop: "1px solid #e2e8f0",
            paddingTop: 16,
          }}
        >
          <button
            onClick={() => {
              setHoursOverride({});
              setHoursReady(true);
            }}
            style={{ ...S.btn("#64748b"), fontSize: 12 }}
          >
            Usar valores estándar
          </button>
          <button
            onClick={() => setHoursReady(true)}
            style={{ ...S.btn("#1e40af"), fontSize: 13, padding: "8px 24px" }}
          >
            ✅ Confirmar horas y abrir diagrama
          </button>
        </div>
      </div>
    </div>
  );
}
