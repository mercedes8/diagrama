import { REGIMES } from "../../constants";
import {
  calcFrancoWeekendPair,
  isWorkShift,
  workedHours,
  countPerTurn,
} from "../../utils/scheduleUtils";
import { getCellStyle } from "../../utils/cellUtils";
import { calcWorkingDays, getDaysInMonth } from "../../utils/dateUtils";
import CellContextMenu from "./CellContextMenu";
import GridHeader from "./GridHeader";
import { S } from "../../styles";

export default function ScheduleGrid({
  gridRef,
  scrollbarRef,
  visibleEmps,
  employees,
  dayInfo,
  daysInMonth,
  schedule,
  larDays,
  bulkMode,
  bulkSelected,
  customCellTypes,
  jefeId,
  pmpIds,
  setPmpIds,
  dragEmpId,
  dragOverId,
  setCellValue,
  handleCellClick,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  targetHours,
  earlyHsForEmp,
  lateHsForEmp,
  reducedDailyHsForEmp,
  year,
  month,
  holidays,
  getRegimeHours,
}) {
  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollbarRef}
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          height: 14,
          background: "#e2e8f0",
          borderRadius: "4px 4px 0 0",
          border: "1px solid #cbd5e1",
          borderBottom: "none",
        }}
      >
        <div
          style={{
            height: 1,
            width: `${3 * 175 + dayInfo.length * 34 + 4 * 36}px`,
          }}
        />
      </div>

      <div
        ref={gridRef}
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "65vh",
          border: "1px solid #000",
        }}
      >
        <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
          <GridHeader dayInfo={dayInfo} />
          <tbody>
            {["TM", "TT", "TN"].map((turn) => {
              const jefeEmpObj = jefeId
                ? visibleEmps.find((e) => e.id === jefeId && e.turn === turn)
                : null;
              const emps = visibleEmps.filter(
                (e) => e.turn === turn && e.id !== jefeId,
              );
              if (!emps.length) return null;
              const turnLabel =
                turn === "TM"
                  ? "TURNO MAÑANA (07:00–14:00)"
                  : turn === "TT"
                    ? "TURNO TARDE (14:00–21:00)"
                    : "TURNO NOCHE (21:00–07:00)";
              const turnColor =
                turn === "TM" ? "#1d4ed8" : turn === "TT" ? "#15803d" : "#111";
              const allTurnEmps = employees.filter((e) => e.turn === turn);
              return [
                <tr key={`sep-${turn}`}>
                  <td
                    colSpan={4 + dayInfo.length + 4}
                    style={{
                      background: "#fff",
                      color: turnColor,
                      padding: "5px 10px",
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      borderTop: "2px solid #000",
                      borderBottom: "1px solid #cbd5e1",
                      borderLeft: "2px solid #000",
                      borderRight: "2px solid #000",
                    }}
                  >
                    ▶ {turnLabel}
                  </td>
                </tr>,

                ...(jefeEmpObj
                  ? (() => {
                      const emp = jefeEmpObj;
                      const target = targetHours(emp);
                      const worked = workedHours(
                        schedule,
                        emp.id,
                        daysInMonth,
                        earlyHsForEmp(emp),
                        lateHsForEmp(emp),
                        customCellTypes,
                        reducedDailyHsForEmp(emp),
                        larDays,
                        emp.turn,
                        targetHours(emp),
                        month,
                      );
                      const diff = worked - target;
                      const mc =
                        Math.abs(diff) <= 7
                          ? "#059669"
                          : diff > 0
                            ? "#f59e0b"
                            : "#ef4444";
                      return [
                        <tr key="jefe-label">
                          <td
                            colSpan={4 + dayInfo.length + 4}
                            style={{
                              background: "#eff6ff",
                              color: "#1e40af",
                              padding: "3px 10px",
                              position: "sticky",
                              left: 0,
                              zIndex: 5,
                              fontSize: 10,
                              fontWeight: 900,
                              letterSpacing: 2,
                              borderBottom: "1px dashed #93c5fd",
                              borderLeft: "2px solid #1e40af",
                              borderRight: "2px solid #1e40af",
                            }}
                          >
                            JEFA/E DE SECCIÓN — no incluida en totales por turno
                          </td>
                        </tr>,
                        <tr
                          key={emp.id}
                          draggable
                          onDragStart={() => handleDragStart(emp.id)}
                          onDragOver={(e) => handleDragOver(e, emp.id)}
                          onDrop={() => handleDrop(emp.id)}
                          onDragEnd={handleDragEnd}
                          style={{
                            background: "#f0f9ff",
                            opacity: dragEmpId === emp.id ? 0.4 : 1,
                          }}
                        >
                          <td
                            style={{
                              ...S.tdMeta,
                              color: "#1e40af",
                              fontWeight: 900,
                              background: "#dbeafe",
                              borderRight: "1px solid #000",
                              fontSize: 11,
                            }}
                          >
                            {target}hs
                          </td>
                          <td
                            style={{
                              ...S.tdName,
                              background: "#eff6ff",
                              borderLeft: "3px solid #1e40af",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 9,
                                  background: "#1e40af",
                                  color: "#fff",
                                  borderRadius: 3,
                                  padding: "1px 4px",
                                  fontWeight: 900,
                                }}
                              >
                                JEFE/A
                              </span>
                              {emp.name}
                            </div>
                            <div style={{ fontSize: 9, color: "#94a3b8" }}>
                              {REGIMES[emp.regime]?.label}
                              {emp.reduction > 0 ? ` · -${emp.reduction}%` : ""}
                              {emp.note ? ` · ${emp.note}` : ""}
                            </div>
                          </td>
                          <td style={{ ...S.tdMeta, color: "#475569" }}>
                            {emp.regime}
                          </td>
                          <td
                            style={{
                              ...S.tdMeta,
                              color: turnColor,
                              fontWeight: 900,
                            }}
                          >
                            {emp.turn}
                          </td>
                          {dayInfo.map((d) => {
                            const k = `${emp.id}-${d.day}`;
                            const ct = schedule[k];
                            const isFrancoWeekendPair = calcFrancoWeekendPair(
                              emp.id,
                              d,
                              schedule,
                              dayInfo,
                            );
                            const cs = getCellStyle(
                              ct || "",
                              isFrancoWeekendPair,
                              emp.turn,
                              customCellTypes,
                            );
                            const isYellowCol = d.isSunday || d.isHoliday;
                            const hasOwnBg =
                              ["LIC", "EARLY", "LATE", "PM"].includes(ct) ||
                              customCellTypes.some((c) => c.key === ct);
                            const isLAR = larDays.has(k);
                            const yellowBg =
                              isYellowCol && !hasOwnBg ? "#ffff00" : cs.bg;
                            const isSelected = bulkMode && bulkSelected.has(k);
                            const cellBg = isSelected
                              ? "#bfdbfe"
                              : isLAR
                                ? isYellowCol
                                  ? "rgba(251,191,36,0.7)"
                                  : "rgba(253,224,71,0.55)"
                                : yellowBg;
                            const cellBorder = isSelected
                              ? "2px solid #1d4ed8"
                              : isLAR
                                ? "2px solid #f59e0b"
                                : cs.border;
                            return (
                              <td
                                key={d.day}
                                style={{
                                  background: cellBg,
                                  border: cellBorder,
                                  padding: 0,
                                }}
                              >
                                <CellContextMenu
                                  empId={emp.id}
                                  day={d.day}
                                  current={ct}
                                  onSelect={(type) =>
                                    setCellValue(emp.id, d.day, type)
                                  }
                                  empTurn={emp.turn}
                                  customCellTypes={customCellTypes}
                                >
                                  <div
                                    style={{
                                      ...S.cell,
                                      background: cellBg,
                                      color: isSelected
                                        ? "#1d4ed8"
                                        : cs.textColor,
                                      fontWeight: cs.bold ? 900 : 400,
                                      cursor: bulkMode ? "cell" : "default",
                                    }}
                                    onClick={() =>
                                      handleCellClick(emp.id, d.day)
                                    }
                                  >
                                    {cs.label}
                                  </div>
                                </CellContextMenu>
                              </td>
                            );
                          })}
                          <td
                            style={{
                              ...S.tdMeta,
                              color: mc,
                              fontWeight: 700,
                              background: "#dbeafe",
                            }}
                          >
                            {worked}hs
                          </td>
                          <td
                            style={{
                              ...S.tdMeta,
                              color: "#0369a1",
                              fontWeight: 700,
                              background: "#e0f2fe",
                            }}
                          >
                            —
                          </td>
                          <td
                            style={{
                              ...S.tdMeta,
                              color: "#92400e",
                              fontWeight: 700,
                              background: "#fff7ed",
                            }}
                          >
                            {
                              dayInfo.filter(
                                (d) =>
                                  d.isSat &&
                                  isWorkShift(schedule[`${emp.id}-${d.day}`]),
                              ).length
                            }
                          </td>
                          <td
                            style={{
                              ...S.tdMeta,
                              color: "#1d4ed8",
                              fontWeight: 700,
                              background: "#ffff00",
                            }}
                          >
                            {
                              dayInfo.filter(
                                (d) =>
                                  d.isSunday &&
                                  isWorkShift(schedule[`${emp.id}-${d.day}`]),
                              ).length
                            }
                          </td>
                        </tr>,
                        <tr key="jefe-div">
                          <td
                            colSpan={4 + dayInfo.length + 4}
                            style={{
                              background: "#787879ff",
                              height: 10,
                              padding: 0,
                            }}
                          />
                        </tr>,
                      ];
                    })()
                  : []),

                ...emps.flatMap((emp) => {
                  const target = targetHours(emp);
                  const worked = workedHours(
                    schedule,
                    emp.id,
                    daysInMonth,
                    earlyHsForEmp(emp),
                    lateHsForEmp(emp),
                    customCellTypes,
                    reducedDailyHsForEmp(emp),
                    larDays,
                    emp.turn,
                    targetHours(emp),
                    month,
                  );

                  const hTrab = (() => {
                    const diasLAR = [...larDays].filter((k) =>
                      k.startsWith(`${emp.id}-`),
                    ).length;
                    if (diasLAR === 0) return target;
                    const divisor = month === 1 ? 28 : 30;
                    const horasLicencia = (target / divisor) * diasLAR;
                    return Math.max(0, Math.round(target - horasLicencia));
                  })();

                  const diff = worked - hTrab;
                  const mc =
                    Math.abs(diff) <= 7
                      ? "#059669"
                      : diff > 0
                        ? "#f59e0b"
                        : "#ef4444";
                  const allTurnIdx = allTurnEmps.findIndex(
                    (e) => e.id === emp.id,
                  );
                  const midpoint = Math.ceil(allTurnEmps.length / 2);
                  const dividerRow =
                    turn === "TN" && allTurnIdx === midpoint ? (
                      <tr key="tn-div">
                        <td
                          colSpan={5}
                          style={{
                            background: "#e2e8f0",
                            padding: "1px 10px",
                            position: "sticky",
                            left: 0,
                            zIndex: 5,
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#475569",
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            borderTop: "2px dashed #94a3b8",
                            borderBottom: "2px dashed #94a3b8",
                            borderLeft: "2px solid #000",
                            borderRight: "1px solid #cbd5e1",
                          }}
                        >
                          · · · GRUPO 2 · · ·
                        </td>
                        {dayInfo.map((d) => (
                          <td
                            key={d.day}
                            style={{
                              background:
                                d.isSunday || d.isHoliday
                                  ? "#e6e600"
                                  : "#e2e8f0",
                              borderTop: "2px dashed #94a3b8",
                              borderBottom: "2px dashed #94a3b8",
                              borderLeft: "1px solid #cbd5e1",
                              borderRight: "1px solid #cbd5e1",
                              padding: 0,
                            }}
                          />
                        ))}
                      </tr>
                    ) : null;
                  const isJefe = emp.id === jefeId;
                  const isPmp = pmpIds.has(emp.id);
                  const isDragOver =
                    dragOverId === emp.id && dragEmpId !== emp.id;
                  const empRow = (
                    <tr
                      key={emp.id}
                      draggable
                      onDragStart={() => handleDragStart(emp.id)}
                      onDragOver={(e) => handleDragOver(e, emp.id)}
                      onDrop={() => handleDrop(emp.id)}
                      onDragEnd={handleDragEnd}
                      style={{
                        opacity: dragEmpId === emp.id ? 0.4 : 1,
                        outline: isDragOver ? "2px solid #1d4ed8" : "none",
                        cursor: "grab",
                      }}
                    >
                      <td
                        style={{
                          ...S.tdMeta,
                          color: "#1e40af",
                          fontWeight: 900,
                          background: "#f1f5f9",
                          borderRight: "1px solid #000",
                          fontSize: 11,
                        }}
                      >
                        {target}hs
                      </td>
                      <td
                        style={{
                          ...S.tdName,
                          background: isJefe ? "#eff6ff" : "#fff",
                          borderLeft: isJefe ? "3px solid #1e40af" : undefined,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              color: "#94a3b8",
                              cursor: "grab",
                              marginRight: 2,
                            }}
                          >
                            ⠿
                          </span>
                          {isJefe && (
                            <span
                              style={{
                                fontSize: 9,
                                background: "#1e40af",
                                color: "#fff",
                                borderRadius: 3,
                                padding: "1px 4px",
                                fontWeight: 900,
                              }}
                            >
                              JEFE
                            </span>
                          )}
                          {isPmp && (
                            <span
                              style={{
                                fontSize: 9,
                                background: "#dc2626",
                                color: "#fff",
                                borderRadius: 3,
                                padding: "1px 4px",
                                fontWeight: 900,
                              }}
                            >
                              PMP
                            </span>
                          )}
                          {emp.name}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPmpIds((prev) => {
                                const n = new Set(prev);
                                if (n.has(emp.id)) n.delete(emp.id);
                                else n.add(emp.id);
                                return n;
                              });
                            }}
                            title={isPmp ? "Quitar PMP" : "Marcar PMP"}
                            style={{
                              fontSize: 8,
                              background: isPmp ? "#fee2e2" : "#f1f5f9",
                              color: isPmp ? "#dc2626" : "#94a3b8",
                              border: `1px solid ${isPmp ? "#fca5a5" : "#cbd5e1"}`,
                              borderRadius: 3,
                              padding: "0px 4px",
                              cursor: "pointer",
                              fontWeight: 700,
                              marginLeft: 4,
                            }}
                          >
                            {isPmp ? "✕" : "PMP"}
                          </button>
                        </div>
                        <div style={{ fontSize: 9, color: "#94a3b8" }}>
                          {REGIMES[emp.regime]?.label}
                          {emp.reduction > 0 ? ` · -${emp.reduction}%` : ""}
                          {emp.note ? ` · ${emp.note}` : ""}
                        </div>
                      </td>
                      <td style={{ ...S.tdMeta, color: "#475569" }}>
                        {emp.regime}
                      </td>
                      <td
                        style={{
                          ...S.tdMeta,
                          color: turnColor,
                          fontWeight: 900,
                        }}
                      >
                        {emp.turn}
                      </td>
                      {dayInfo.map((d) => {
                        const k = `${emp.id}-${d.day}`;
                        const ct = schedule[k];
                        const isFrancoWeekendPair = calcFrancoWeekendPair(
                          emp.id,
                          d,
                          schedule,
                          dayInfo,
                        );
                        const cs = getCellStyle(
                          ct || "",
                          isFrancoWeekendPair,
                          emp.turn,
                          customCellTypes,
                        );
                        const isYellowCol = d.isSunday || d.isHoliday;
                        const hasOwnBg =
                          ["LIC", "EARLY", "LATE", "PM"].includes(ct) ||
                          customCellTypes.some((c) => c.key === ct);
                        const isLAR = larDays.has(k);
                        const yellowBg =
                          isYellowCol && !hasOwnBg ? "#ffff00" : cs.bg;
                        const isSelected = bulkMode && bulkSelected.has(k);
                        const cellBg = isSelected
                          ? "#bfdbfe"
                          : isLAR
                            ? isYellowCol
                              ? "rgba(251,191,36,0.7)"
                              : "rgba(253,224,71,0.55)"
                            : yellowBg;
                        const cellBorder = isSelected
                          ? "2px solid #1d4ed8"
                          : isLAR
                            ? "2px solid #f59e0b"
                            : cs.border;
                        return (
                          <td
                            key={d.day}
                            style={{
                              background: cellBg,
                              border: cellBorder,
                              padding: 0,
                            }}
                          >
                            <CellContextMenu
                              empId={emp.id}
                              day={d.day}
                              current={ct}
                              onSelect={(type) =>
                                setCellValue(emp.id, d.day, type)
                              }
                              empTurn={emp.turn}
                              customCellTypes={customCellTypes}
                            >
                              <div
                                style={{
                                  ...S.cell,
                                  background: cellBg,
                                  color: isSelected
                                    ? "#1d4ed8"
                                    : isLAR
                                      ? "#92400e"
                                      : cs.textColor,
                                  fontWeight: isLAR ? 900 : cs.bold ? 900 : 400,
                                  cursor: bulkMode ? "cell" : "default",
                                  fontFamily:
                                    ct === "FE"
                                      ? "'Georgia',serif"
                                      : "'Barlow Condensed',sans-serif",
                                  fontStyle: ct === "FE" ? "italic" : "normal",
                                  fontSize: isLAR ? 7 : undefined,
                                }}
                                onClick={() => handleCellClick(emp.id, d.day)}
                                title={
                                  bulkMode
                                    ? `Clic para ${bulkSelected.has(k) ? "deseleccionar" : "seleccionar"}`
                                    : ct === "EARLY"
                                      ? `Sale antes (${earlyHsForEmp(emp)}hs)`
                                      : ct === "LATE"
                                        ? `Sale después (${lateHsForEmp(emp)}hs)`
                                        : ct === "FE"
                                          ? "Franco Especial"
                                          : ""
                                }
                              >
                                {cs.label}
                              </div>
                            </CellContextMenu>
                          </td>
                        );
                      })}
                      <td
                        style={{
                          ...S.tdMeta,
                          color: mc,
                          fontWeight: 700,
                          background: "#f1f5f9",
                        }}
                      >
                        {worked}hs
                      </td>
                      <td
                        style={{
                          ...S.tdMeta,
                          color: "#0369a1",
                          fontWeight: 700,
                          background: "#e0f2fe",
                        }}
                      >
                        {(() => {
                          const isLARemp = [...larDays].some((k) =>
                            k.startsWith(`${emp.id}-`),
                          );
                          if (!isLARemp) return "—";
                          const base = getRegimeHours(emp.regime);
                          const reduced =
                            emp.reduction > 0
                              ? Math.round(base * (1 - emp.reduction / 100))
                              : base;
                          const wd = calcWorkingDays(year, month, holidays);
                          const td = getDaysInMonth(year, month);
                          return `${Math.round((wd * reduced) / td)}hs`;
                        })()}
                      </td>
                      <td
                        style={{
                          ...S.tdMeta,
                          color: "#92400e",
                          fontWeight: 700,
                          background: "#fff7ed",
                        }}
                      >
                        {
                          dayInfo.filter(
                            (d) =>
                              d.isSat &&
                              isWorkShift(schedule[`${emp.id}-${d.day}`]),
                          ).length
                        }
                      </td>
                      <td
                        style={{
                          ...S.tdMeta,
                          color: "#1d4ed8",
                          fontWeight: 700,
                          background: "#ffff00",
                        }}
                      >
                        {
                          dayInfo.filter(
                            (d) =>
                              d.isSunday &&
                              isWorkShift(schedule[`${emp.id}-${d.day}`]),
                          ).length
                        }
                      </td>
                    </tr>
                  );
                  return [dividerRow, empRow].filter(Boolean);
                }),
                <tr key={`total-${turn}`}>
                  <td
                    style={{
                      background: "#cbd5e1",
                      padding: "3px 5px",
                      textAlign: "center",
                      fontSize: 9,
                      borderTop: "1px solid #000",
                      borderBottom: "2px solid #000",
                      borderLeft: "2px solid #000",
                    }}
                  />
                  <td
                    colSpan={3}
                    style={{
                      background: "#cbd5e1",
                      color: "#1e293b",
                      padding: "3px 10px",
                      position: "sticky",
                      left: 0,
                      zIndex: 5,
                      fontSize: 10,
                      fontWeight: 900,
                      borderTop: "1px solid #000",
                      borderBottom: "2px solid #000",
                      borderLeft: "1px solid #94a3b8",
                      borderRight: "1px solid #94a3b8",
                      fontStyle: "italic",
                      letterSpacing: 0.5,
                    }}
                  >
                    TOTAL DE ENFERMEROS
                  </td>
                  {dayInfo.map((d) => {
                    const c = countPerTurn(schedule, employees, d.day, jefeId)[
                      turn
                    ];
                    const col =
                      c === 0
                        ? "#64748b"
                        : c < 4
                          ? "#ef4444"
                          : c > 8
                            ? "#f59e0b"
                            : "#059669";
                    return (
                      <td
                        key={d.day}
                        style={{
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: 900,
                          color: col,
                          background: "#cbd5e1",
                          borderTop: "1px solid #000",
                          borderBottom: "2px solid #000",
                          borderLeft: "1px solid #94a3b8",
                          borderRight: "1px solid #94a3b8",
                          padding: "2px 0",
                        }}
                      >
                        {c > 0 ? c : ""}
                      </td>
                    );
                  })}
                  <td
                    colSpan={5}
                    style={{
                      background: "#cbd5e1",
                      borderTop: "1px solid #000",
                      borderBottom: "2px solid #000",
                      borderLeft: "2px solid #000",
                    }}
                  />
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          overflowX: "auto",
          overflowY: "hidden",
          height: 14,
          background: "#e2e8f0",
          borderRadius: "0 0 4px 4px",
          border: "1px solid #cbd5e1",
          borderTop: "none",
        }}
        onScroll={(e) => {
          if (gridRef.current) gridRef.current.scrollLeft = e.target.scrollLeft;
        }}
      >
        <div
          style={{
            height: 1,
            width: `${3 * 175 + dayInfo.length * 34 + 4 * 36}px`,
          }}
        />
      </div>
    </div>
  );
}
