import { MONTHS, WDAYS, CELL_TYPES, REGIMES, TURN_LABEL } from "../constants";
import { calcWorkingDays, getDaysInMonth, getDow } from "../utils/dateUtils";
import { workedHours, calcGuardiaHospitalaria } from "../utils/scheduleUtils";
import { S } from "../styles";

export default function ConfigTab({
  service,
  setService,
  beds,
  setBeds,
  year,
  setYear,
  month,
  holidays,
  setHolidays,
  newHoliday,
  setNewHoliday,
  daysInMonth,
  earlyOffsets,
  setEarlyOffsets,
  lateOffsets,
  setLateOffsets,
  customCellTypes,
  setCustomCellTypes,
  newCustom,
  setNewCustom,
  regimeHours,
  setRegimeHours,
  getRegimeHours,
  employees,
  schedule,
  larDays,
  dayInfo,
  targetHours,
  earlyHsForEmp,
  lateHsForEmp,
  reducedDailyHsForEmp,
}) {
  return (
    <>
      <div style={S.cfgBox}>
        <div style={S.cfgTitle}>📋 DATOS DEL SERVICIO</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {[
            [
              "SERVICIO",
              <input
                key="sv"
                style={{ ...S.formInput, width: 160 }}
                value={service}
                onChange={(e) => setService(e.target.value)}
              />,
            ],
            [
              "Nº CAMAS",
              <input
                key="bd"
                style={{ ...S.formInput, width: 80 }}
                type="number"
                value={beds}
                onChange={(e) => setBeds(+e.target.value)}
              />,
            ],
            [
              "AÑO",
              <input
                key="yr"
                style={{ ...S.formInput, width: 90 }}
                type="number"
                value={year}
                onChange={(e) => setYear(+e.target.value)}
              />,
            ],
          ].map(([l, c]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column" }}>
              <span style={S.formLabel}>{l}</span>
              {c}
            </div>
          ))}
        </div>
      </div>

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
                        [turn]: Math.max(
                          1,
                          Math.min(base - 1, +e.target.value),
                        ),
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

      <div style={S.cfgBox}>
        <div style={S.cfgTitle}>🎨 TIPOS DE CELDA PERSONALIZADOS</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
          Agregá tipos de turno especiales con color, inicial y horas propias.
          Aparecen en el menú contextual (click derecho) de cada celda.
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-end",
            padding: "10px 12px",
            background: "#f8fafc",
            borderRadius: 8,
            marginBottom: 12,
            border: "1px solid #e2e8f0",
          }}
        >
          {[
            [
              "CLAVE (ej: HC)",
              <input
                key="k"
                style={{
                  ...S.formInput,
                  width: 70,
                  textTransform: "uppercase",
                }}
                maxLength={5}
                placeholder="HC"
                value={newCustom.key}
                onChange={(e) =>
                  setNewCustom((p) => ({
                    ...p,
                    key: e.target.value.toUpperCase().replace(/\s/g, ""),
                  }))
                }
              />,
            ],
            [
              "INICIAL",
              <input
                key="l"
                style={{ ...S.formInput, width: 50 }}
                maxLength={4}
                placeholder="HC"
                value={newCustom.label}
                onChange={(e) =>
                  setNewCustom((p) => ({ ...p, label: e.target.value }))
                }
              />,
            ],
            [
              "DESCRIPCIÓN",
              <input
                key="d"
                style={{ ...S.formInput, width: 130 }}
                placeholder="Horario especial"
                value={newCustom.desc}
                onChange={(e) =>
                  setNewCustom((p) => ({ ...p, desc: e.target.value }))
                }
              />,
            ],
            [
              "HS",
              <input
                key="h"
                style={{ ...S.formInput, width: 55 }}
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={newCustom.hours}
                onChange={(e) =>
                  setNewCustom((p) => ({ ...p, hours: +e.target.value }))
                }
              />,
            ],
          ].map(([lbl, ctrl]) => (
            <div key={lbl} style={{ display: "flex", flexDirection: "column" }}>
              <span style={S.formLabel}>{lbl}</span>
              {ctrl}
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={S.formLabel}>COLOR FONDO</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="color"
                value={newCustom.bg}
                onChange={(e) =>
                  setNewCustom((p) => ({ ...p, bg: e.target.value }))
                }
                style={{
                  width: 36,
                  height: 30,
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  cursor: "pointer",
                  padding: 2,
                }}
              />
              <span style={{ fontSize: 9, color: "#94a3b8" }}>
                {newCustom.bg}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={S.formLabel}>COLOR TEXTO</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="color"
                value={newCustom.fg}
                onChange={(e) =>
                  setNewCustom((p) => ({ ...p, fg: e.target.value }))
                }
                style={{
                  width: 36,
                  height: 30,
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  cursor: "pointer",
                  padding: 2,
                }}
              />
              <span style={{ fontSize: 9, color: "#94a3b8" }}>
                {newCustom.fg}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={S.formLabel}>COLOR BORDE</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="color"
                value={newCustom.border}
                onChange={(e) =>
                  setNewCustom((p) => ({ ...p, border: e.target.value }))
                }
                style={{
                  width: 36,
                  height: 30,
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  cursor: "pointer",
                  padding: 2,
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={S.formLabel}>PREVIEW</span>
            <div
              style={{
                width: 36,
                height: 28,
                borderRadius: 4,
                background: newCustom.bg,
                color: newCustom.fg,
                border: `2px solid ${newCustom.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              {newCustom.label || "?"}
            </div>
          </div>
          <button
            style={S.btn("#059669")}
            onClick={() => {
              if (!newCustom.key || !newCustom.label) return;
              if (
                CELL_TYPES[newCustom.key] ||
                customCellTypes.find((c) => c.key === newCustom.key)
              ) {
                alert("Esa clave ya existe");
                return;
              }
              setCustomCellTypes((prev) => [...prev, { ...newCustom }]);
              setNewCustom({
                key: "",
                label: "",
                bg: "#e0f2fe",
                fg: "#0369a1",
                border: "#38bdf8",
                hours: 0,
                desc: "",
              });
            }}
          >
            + Agregar
          </button>
        </div>
        {customCellTypes.length === 0 ? (
          <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
            Sin tipos personalizados. Usá el formulario para crear uno.
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {customCellTypes.map((c, i) => (
              <div
                key={c.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 24,
                    borderRadius: 4,
                    background: c.bg,
                    color: c.fg,
                    border: `2px solid ${c.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {c.label}
                </div>
                <div>
                  <div
                    style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}
                  >
                    {c.key} — {c.desc || c.label}
                  </div>
                  <div style={{ fontSize: 9, color: "#94a3b8" }}>
                    {c.hours}hs · fondo {c.bg} · texto {c.fg}
                  </div>
                </div>
                <button
                  onClick={() =>
                    setCustomCellTypes((prev) => prev.filter((_, j) => j !== i))
                  }
                  style={{
                    background: "none",
                    border: "1px solid #fca5a5",
                    borderRadius: 4,
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: 11,
                    padding: "2px 7px",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <div
          style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}
        >
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

      <div style={S.cfgBox}>
        <div style={S.cfgTitle}>📊 CARGA HORARIA MENSUAL POR RÉGIMEN</div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>
          Editá las horas base de cada régimen. El cálculo mensual real se
          ajusta automáticamente con la fórmula:{" "}
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
            const mensual = hs;
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
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  <span style={S.formLabel}>HS MENSUALES BASE</span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
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
                    <span style={{ fontSize: 11, color: "#475569" }}>
                      hs/mes
                    </span>
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
                    {mensual}hs
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
                <span
                  style={{ fontSize: 11, fontWeight: 700, color: diffColor }}
                >
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

      <div style={S.cfgBox}>
        <div style={S.cfgTitle}>📏 REGLAS</div>
        {[
          "Franco obligatorio: 1 finde completo (sáb+dom juntos) + 1 sábado libre adicional + 1 domingo libre adicional",
          "FE en sábado + F/FE en domingo siguiente = cuenta como finde completo",
          "FE = F° (Franco Especial) — se carga manualmente antes del auto-completar",
          "Personal por guardia: mínimo 4 · máximo 8 enfermeros",
          "TM y TT: máximo 4 guardias consecutivas · TN: máximo 2 guardias consecutivas",
          "Click derecho → menú individual · Botones Lic/LAR/F° → selección múltiple · Ctrl+Z → deshacer",
        ].map((t, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              color: "#475569",
              padding: "5px 0",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              gap: 8,
            }}
          >
            <span style={{ color: "#1e40af", fontWeight: 700 }}>•</span> {t}
          </div>
        ))}
      </div>

      <div style={S.cfgTitle}>🏥 GUARDIA HOSPITALARIA MENSUAL (mín. 24hs)</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
        Conta las horas trabajadas en{" "}
        <b>domingos + feriados (todos los turnos)</b> y{" "}
        <b>sábados tarde/noche</b>. El turno mañana del sábado <b>no cuenta</b>{" "}
        como guardia hospitalaria.
      </div>

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
                          transition: "width .3s",
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

      <div style={S.cfgBox}>
        <div style={S.cfgTitle}>
          🏥 GUARDIA HOSPITALARIA MENSUAL (mín. 24hs)
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>
          Horas en <b>domingos + feriados (todos los turnos)</b> y{" "}
          <b>sábados tarde/noche</b>. Turno mañana del sábado <b>no cuenta</b>.
        </div>
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
                        <span style={{ fontSize: 9, color: "#94a3b8" }}>
                          0hs
                        </span>
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
        {(() => {
          const noCumplen = employees.filter(
            (e) =>
              calcGuardiaHospitalaria(schedule, e, dayInfo, daysInMonth) < 24,
          );
          return (
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
          );
        })()}
      </div>
    </>
  );
}
