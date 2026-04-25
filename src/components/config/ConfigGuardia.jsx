import { MONTHS } from "../../constants";
import { calcGuardiaHospitalaria } from "../../utils/scheduleUtils";
import { S } from "../../styles";

export default function ConfigGuardia({
  month,
  year,
  employees,
  schedule,
  dayInfo,
  daysInMonth,
}) {
  const GuardiaTurnGrid = ({ insideCfgBox }) => (
    <>
      {["TM", "TT", "TN"].map((turn) => {
        const emps = employees.filter((e) => e.turn === turn);
        if (!emps.length) return null;
        const turnColor =
          turn === "TM" ? "#1d4ed8" : turn === "TT" ? "#15803d" : "#111";
        const turnLabel =
          turn === "TM"
            ? "Turno Mañana"
            : turn === "TT"
              ? "Turno Tarde"
              : "Turno Noche";
        return (
          <div key={turn} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "'Barlow Condensed',sans-serif",
                fontWeight: 900,
                fontSize: 13,
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
                gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))",
                gap: 6,
              }}
            >
              {emps.map((emp) => {
                const ghHs = calcGuardiaHospitalaria(
                  schedule,
                  emp,
                  dayInfo,
                  daysInMonth,
                );
                const cumple = ghHs >= 24;
                const pct = Math.min(100, Math.round((ghHs / 24) * 100));
                const barColor =
                  ghHs === 0 ? "#ef4444" : ghHs < 24 ? "#f59e0b" : "#059669";
                return (
                  <div
                    key={emp.id}
                    style={{
                      padding: "8px 12px",
                      background: cumple
                        ? "#f0fdf4"
                        : ghHs === 0
                          ? "#fef2f2"
                          : "#fffbeb",
                      border: `1px solid ${cumple ? "#86efac" : ghHs === 0 ? "#fca5a5" : "#fcd34d"}`,
                      borderRadius: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#1e293b",
                        }}
                      >
                        {emp.name}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: barColor,
                        }}
                      >
                        {ghHs}hs
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "#e2e8f0",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: barColor,
                          borderRadius: 3,
                          transition: insideCfgBox ? undefined : "width .3s",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 3,
                      }}
                    >
                      <span style={{ fontSize: 9, color: "#94a3b8" }}>0hs</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: barColor,
                        }}
                      >
                        {cumple ? "✅ Cumple" : `🔴 Faltan ${24 - ghHs}hs`}
                      </span>
                      <span style={{ fontSize: 9, color: "#94a3b8" }}>
                        24hs
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );

  const noCumplen = employees.filter(
    (e) => calcGuardiaHospitalaria(schedule, e, dayInfo, daysInMonth) < 24,
  );

  return (
    <>
      <div style={S.cfgTitle}>🏥 GUARDIA HOSPITALARIA MENSUAL (mín. 24hs)</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
        Conta las horas trabajadas en{" "}
        <b>domingos + feriados (todos los turnos)</b> y{" "}
        <b>sábados tarde/noche</b>. El turno mañana del sábado <b>no cuenta</b>{" "}
        como guardia hospitalaria.
      </div>
      <GuardiaTurnGrid insideCfgBox={false} />

      <div style={S.cfgBox}>
        <div style={S.cfgTitle}>
          🏥 GUARDIA HOSPITALARIA MENSUAL (mín. 24hs)
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
          Horas en <b>domingos + feriados (todos los turnos)</b> y{" "}
          <b>sábados tarde/noche</b>. Turno mañana del sábado <b>no cuenta</b>.
        </div>
        <GuardiaTurnGrid insideCfgBox={true} />
        <div
          style={{
            marginTop: 12,
            padding: "10px 16px",
            background: noCumplen.length === 0 ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${noCumplen.length === 0 ? "#86efac" : "#fca5a5"}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            color: noCumplen.length === 0 ? "#15803d" : "#991b1b",
          }}
        >
          {noCumplen.length === 0
            ? "✅ Todo el personal cumple las 24hs de guardia hospitalaria"
            : `🔴 ${noCumplen.length} empleado${noCumplen.length > 1 ? "s" : ""} no cumple${noCumplen.length > 1 ? "n" : ""}: ${noCumplen.map((e) => e.name.split(" ")[0]).join(", ")}`}
        </div>
      </div>
    </>
  );
}
