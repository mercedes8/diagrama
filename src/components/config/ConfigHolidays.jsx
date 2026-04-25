import { MONTHS, WDAYS } from "../../constants";
import { getDow } from "../../utils/dateUtils";
import { S } from "../../styles";

export default function ConfigHolidays({
  month,
  year,
  holidays,
  setHolidays,
  newHoliday,
  setNewHoliday,
  daysInMonth,
}) {
  return (
    <div style={S.cfgBox}>
      <div style={S.cfgTitle}>
        🔴 FERIADOS — {MONTHS[month].toUpperCase()} {year}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={S.formLabel}>DÍA DEL MES</span>
          <input
            style={{ ...S.formInput, width: 80 }}
            type="number"
            min={1}
            max={daysInMonth}
            value={newHoliday}
            onChange={(e) => setNewHoliday(e.target.value)}
          />
        </div>
        <button
          style={S.btn("#dc2626")}
          onClick={() => {
            const d = parseInt(newHoliday);
            if (d >= 1 && d <= daysInMonth && !holidays.includes(d)) {
              setHolidays((prev) => [...prev, d].sort((a, b) => a - b));
              setNewHoliday("");
            }
          }}
        >
          + Agregar feriado
        </button>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {holidays.length === 0 ? (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>
            Sin feriados cargados este mes
          </span>
        ) : (
          holidays.map((d) => (
            <span
              key={d}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 10px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 20,
                fontSize: 11,
                color: "#991b1b",
              }}
            >
              Día {d} — {WDAYS[getDow(year, month, d)]}
              <button
                onClick={() =>
                  setHolidays((prev) => prev.filter((x) => x !== d))
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
