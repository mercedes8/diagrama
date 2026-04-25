import { MONTHS } from "../../constants";
import { workedHours } from "../../utils/scheduleUtils";
import { S } from "../../styles";

export default function ConfigHoursBalance({
  month,
  year,
  employees,
  schedule,
  daysInMonth,
  targetHours,
  earlyHsForEmp,
  lateHsForEmp,
  reducedDailyHsForEmp,
}) {
  return (
    <div style={S.cfgBox}>
      <div style={S.cfgTitle}>
        ⚖️ BALANCE DE HORAS POR TURNO — {MONTHS[month].toUpperCase()} {year}
      </div>
      {["TM", "TT", "TN"].map((turn) => {
        const emps = employees.filter((e) => e.turn === turn);
        const totalObj = emps.reduce((s, e) => s + targetHours(e), 0);
        const totalCarg = emps.reduce(
          (s, e) =>
            s +
            workedHours(
              schedule,
              e.id,
              daysInMonth,
              earlyHsForEmp(e),
              lateHsForEmp(e),
              [],
              reducedDailyHsForEmp(e),
            ),
          0,
        );
        const diff = totalCarg - totalObj;
        const turnColor =
          turn === "TM" ? "#1d4ed8" : turn === "TT" ? "#15803d" : "#111";
        const diffColor =
          diff === 0 ? "#059669" : diff > 0 ? "#dc2626" : "#f59e0b";
        const turnLabel =
          turn === "TM" ? "Mañana" : turn === "TT" ? "Tarde" : "Noche";
        return (
          <div
            key={turn}
            style={{ borderBottom: "1px solid #e2e8f0", padding: "10px 0" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "'Barlow Condensed',sans-serif",
                  fontWeight: 900,
                  fontSize: 14,
                  color: turnColor,
                  minWidth: 70,
                }}
              >
                {turn} — {turnLabel}
              </span>
              <span style={{ fontSize: 11, color: "#475569" }}>
                Objetivo: <b>{totalObj}hs</b>
              </span>
              <span style={{ fontSize: 11, color: "#475569" }}>
                Cargadas: <b style={{ color: diffColor }}>{totalCarg}hs</b>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: diffColor }}>
                {diff === 0
                  ? "✅ Exacto"
                  : diff > 0
                    ? `🔴 +${diff}hs de exceso`
                    : `🟡 ${diff}hs faltantes`}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 6,
              }}
            >
              {emps.map((e) => {
                const w = workedHours(
                  schedule,
                  e.id,
                  daysInMonth,
                  earlyHsForEmp(e),
                  lateHsForEmp(e),
                  [],
                  reducedDailyHsForEmp(e),
                );
                const t = targetHours(e);
                const d = w - t;
                const c = d === 0 ? "#059669" : d > 0 ? "#dc2626" : "#f59e0b";
                return (
                  <span
                    key={e.id}
                    style={{
                      fontSize: 10,
                      background: "#f8fafc",
                      border: `1px solid ${c}`,
                      borderRadius: 8,
                      padding: "2px 8px",
                      color: c,
                      fontWeight: 600,
                    }}
                  >
                    {e.name.split(" ")[0]}: {w}/{t}hs{" "}
                    {d > 0 ? `(+${d})` : d < 0 ? `(${d})` : "✓"}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
