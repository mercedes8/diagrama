import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx-js-style";
import {
  MONTHS,
  WDAYS,
  CELL_TYPES,
  REGIMES,
  INITIAL_EMPLOYEES,
  MAX_CONSEC_FRANCO,
} from "./constants";
import { getDaysInMonth, getDow, calcWorkingDays } from "./utils/dateUtils";
import { loadSavedData, saveData } from "./utils/storage";
import {
  isWorkShift,
  maxConsecForEmp,
  workedHours,
  countPerTurn,
  autoFillAll,
  calcTargetWithLAR,
} from "./utils/scheduleUtils";
import { S } from "./styles";
import AppHeader from "./components/layout/AppHeader";
import TabsBar from "./components/layout/TabsBar";
import AlertsPanel from "./components/schedule/AlertsPanel";
import ScheduleToolbar from "./components/schedule/ScheduleToolbar";
import BulkSelector from "./components/schedule/BulkSelector";
import JefeSelector from "./components/schedule/JefeSelector";
import HoursModal from "./components/schedule/HoursModal";
import ScheduleGrid from "./components/schedule/ScheduleGrid";
import StaffTab from "./components/staff/StaffTab";
import ConfigTab from "./components/config/ConfigTab";

export default function HospitalScheduler({ currentUser, onLogout }) {
  const now = new Date();
  const saved = useMemo(() => loadSavedData(), []);

  const [year, setYear] = useState(saved?.year ?? now.getFullYear());
  const [month, setMonth] = useState(saved?.month ?? now.getMonth());
  const [employees, setEmployees] = useState(
    saved?.employees ?? INITIAL_EMPLOYEES,
  );
  const [schedule, setSchedule] = useState(saved?.schedule ?? {});
  const [larDays, setLarDays] = useState(() => new Set(saved?.larDays ?? []));
  const [holidays, setHolidays] = useState(saved?.holidays ?? []);
  const [tab, setTab] = useState("schedule");
  const [filterTurn, setFilterTurn] = useState("ALL");
  const [filterEmpId, setFilterEmpId] = useState(null);
  const [service, setService] = useState(saved?.service ?? "SIP 5");
  const [beds, setBeds] = useState(saved?.beds ?? 30);
  const [newHoliday, setNewHoliday] = useState("");
  const [newEmp, setNewEmp] = useState({
    name: "",
    regime: "R15",
    turn: "TM",
    reduction: 0,
    note: "",
  });
  const [editEmpId, setEditEmpId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showAlerts, setShowAlerts] = useState(true);
  const [hoursReady, setHoursReady] = useState(!!saved);
  const [hoursOverride, setHoursOverride] = useState(
    saved?.hoursOverride ?? {},
  );
  const [bulkMode, setBulkMode] = useState(null);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [dragEmpId, setDragEmpId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [jefeId, setJefeId] = useState(saved?.jefeId ?? null);
  const [pmpIds, setPmpIds] = useState(() => new Set(saved?.pmpIds ?? []));

  const TURN_BASE_HOURS = { TM: 7, TT: 7, TN: 10 };
  const [earlyOffsets, setEarlyOffsets] = useState(
    saved?.earlyOffsets ?? { TM: 2, TT: 2, TN: 2 },
  );
  const [lateOffsets, setLateOffsets] = useState(
    saved?.lateOffsets ?? { TM: 2, TT: 2, TN: 2 },
  );

  const earlyHsForEmp = useCallback(
    (emp) => TURN_BASE_HOURS[emp.turn] - (earlyOffsets[emp.turn] ?? 2),
    [earlyOffsets],
  );
  const lateHsForEmp = useCallback(
    (emp) => TURN_BASE_HOURS[emp.turn] + (lateOffsets[emp.turn] ?? 2),
    [lateOffsets],
  );
  const reducedDailyHsForEmp = useCallback((emp) => {
    const base = TURN_BASE_HOURS[emp.turn] || 7;
    if (!emp.reduction || emp.reduction === 0) return null;
    return Math.round(base * (1 - emp.reduction / 100) * 100) / 100;
  }, []);

  const earlyOffset = earlyOffsets.TM;
  const lateOffset = lateOffsets.TM;
  const [savedOk, setSavedOk] = useState(false);

  const [customCellTypes, setCustomCellTypes] = useState(
    saved?.customCellTypes ?? [],
  );
  const [newCustom, setNewCustom] = useState({
    key: "",
    label: "",
    bg: "#e0f2fe",
    fg: "#0369a1",
    border: "#38bdf8",
    hours: 0,
    desc: "",
  });

  const [regimeHours, setRegimeHours] = useState(
    saved?.regimeHours ?? { R15: 160, R27: 144, H24: 88 },
  );
  const getRegimeHours = useCallback(
    (key) => regimeHours[key] ?? REGIMES[key]?.hours ?? 160,
    [regimeHours],
  );

  const [history, setHistory] = useState([]);
  const pushHistory = useCallback((prevSchedule, prevLarDays) => {
    setHistory((h) => [
      ...h.slice(-29),
      { schedule: prevSchedule, larDays: [...prevLarDays] },
    ]);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setSchedule(prev.schedule);
      setLarDays(new Set(prev.larDays ?? []));
      return h.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  // ── Autosave: guarda automáticamente cada vez que cambia el estado ──
  useEffect(() => {
    const timer = setTimeout(() => {
      saveData({
        year,
        month,
        employees,
        schedule,
        larDays: [...larDays],
        holidays,
        service,
        beds,
        jefeId,
        pmpIds: [...pmpIds],
        earlyOffsets,
        lateOffsets,
        hoursOverride,
        customCellTypes,
        regimeHours,
      });
    }, 800); // debounce 800ms para no guardar en cada keystroke
    return () => clearTimeout(timer);
  }, [
    year,
    month,
    employees,
    schedule,
    larDays,
    holidays,
    service,
    beds,
    jefeId,
    pmpIds,
    earlyOffsets,
    lateOffsets,
    hoursOverride,
    customCellTypes,
    regimeHours,
  ]);

  const gridRef = useRef();
  const scrollbarRef = useRef();
  const syncingGrid = useRef(false);
  const syncingScroll = useRef(false);

  useEffect(() => {
    const grid = gridRef.current;
    const bar = scrollbarRef.current;
    if (!grid || !bar) return;
    const onGrid = () => {
      if (syncingGrid.current) return;
      syncingScroll.current = true;
      bar.scrollLeft = grid.scrollLeft;
      syncingScroll.current = false;
    };
    const onBar = () => {
      if (syncingScroll.current) return;
      syncingGrid.current = true;
      grid.scrollLeft = bar.scrollLeft;
      syncingGrid.current = false;
    };
    grid.addEventListener("scroll", onGrid);
    bar.addEventListener("scroll", onBar);
    return () => {
      grid.removeEventListener("scroll", onGrid);
      bar.removeEventListener("scroll", onBar);
    };
  }, []);

  const handleDragStart = (empId) => setDragEmpId(empId);
  const handleDragOver = (e, empId) => {
    e.preventDefault();
    setDragOverId(empId);
  };
  const handleDrop = (targetId) => {
    if (!dragEmpId || dragEmpId === targetId) {
      setDragEmpId(null);
      setDragOverId(null);
      return;
    }
    setEmployees((prev) => {
      const arr = [...prev];
      const fromI = arr.findIndex((e) => e.id === dragEmpId);
      const toI = arr.findIndex((e) => e.id === targetId);
      if (arr[fromI].turn !== arr[toI].turn) return prev;
      const [moved] = arr.splice(fromI, 1);
      arr.splice(toI, 0, moved);
      return arr;
    });
    setDragEmpId(null);
    setDragOverId(null);
  };
  const handleDragEnd = () => {
    setDragEmpId(null);
    setDragOverId(null);
  };

  // ✅ DESPUÉS — Mens. siempre muestra el régimen completo
  const targetHours = (emp) => {
    if (hoursOverride[emp.id] !== undefined) return hoursOverride[emp.id];
    return calcTargetWithLAR(
      emp,
      year,
      month,
      holidays,
      larDays,
      daysInMonth,
      getRegimeHours,
    );
  };
  const daysInMonth = getDaysInMonth(year, month);

  const dayInfo = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = getDow(year, month, d);
      arr.push({
        day: d,
        dow,
        isSunday: dow === 0,
        isSat: dow === 6,
        isWeekend: dow === 0 || dow === 6,
        isHoliday: holidays.includes(d),
      });
    }
    return arr;
  }, [year, month, daysInMonth, holidays]);

  const visibleEmps = useMemo(() => {
    let list = employees;
    if (filterEmpId) list = list.filter((e) => e.id === filterEmpId);
    else if (filterTurn !== "ALL")
      list = list.filter((e) => e.turn === filterTurn);
    return list;
  }, [employees, filterTurn, filterEmpId]);

  const alerts = useMemo(() => {
    const out = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const di = dayInfo[d - 1];
      const c = countPerTurn(schedule, employees, d, jefeId, pmpIds);
      for (const t of ["TM", "TT", "TN"]) {
        if (c[t] > 0 && c[t] < 4)
          out.push({
            type: "danger",
            msg: `Día ${d} ${WDAYS[di.dow]} — ${t}: ${c[t]} personas (mín 4)`,
          });
        else if (c[t] > 8)
          out.push({
            type: "danger",
            msg: `Día ${d} ${WDAYS[di.dow]} — ${t}: ${c[t]} personas (máx 8)`,
          });
      }
    }
    for (const emp of employees) {
      const maxConsec = maxConsecForEmp(emp);
      let streak = 0,
        streakStart = null;
      for (let d = 1; d <= daysInMonth; d++) {
        const ct = schedule[`${emp.id}-${d}`];
        if (isWorkShift(ct)) {
          if (streak === 0) streakStart = d;
          streak++;
          if (streak > maxConsec) {
            out.push({
              type: "danger",
              msg: `${emp.name} (${emp.turn}): ${streak} guardias consecutivas desde día ${streakStart} (máx ${maxConsec})`,
            });
            streak = 0;
            streakStart = null;
          }
        } else {
          streak = 0;
          streakStart = null;
        }
      }
    }

    // ── Francos consecutivos máximos (máx 3) ──
    for (const emp of employees) {
      let streak = 0,
        streakStart = null;
      for (let d = 1; d <= daysInMonth; d++) {
        const ct = schedule[`${emp.id}-${d}`];
        if (!isWorkShift(ct)) {
          if (streak === 0) streakStart = d;
          streak++;
          if (streak > MAX_CONSEC_FRANCO) {
            out.push({
              type: "warning",
              msg: `${emp.name}: ${streak} francos consecutivos desde día ${streakStart} (máx ${MAX_CONSEC_FRANCO})`,
            });
            streak = 0;
            streakStart = null;
          }
        } else {
          streak = 0;
          streakStart = null;
        }
      }
    }
    for (const emp of employees) {
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
      const target = targetHours(emp);
      const diff = target - worked;
      if (Math.abs(diff) > 14)
        out.push({
          type: diff > 0 ? "info" : "warning",
          msg: `${emp.name}: ${worked}hs cargadas / ${target}hs objetivo (${diff > 0 ? "faltan" : "sobran"} ${Math.abs(diff)}hs)`,
        });
    }
    const isFreeCell = (empId, day) => {
      const v = schedule[`${empId}-${day}`];
      return !v || v === "F" || v === "FE" || v === "LIC" || v === "LAR";
    };
    const wpairs = [];
    for (const d of dayInfo) {
      if (d.isSat) {
        const sun = dayInfo.find((x) => x.day === d.day + 1 && x.isSunday);
        if (sun) wpairs.push({ sat: d.day, sun: sun.day });
      }
    }
    const allSatDays = dayInfo.filter((d) => d.isSat).map((d) => d.day);
    const allSunDays = dayInfo.filter((d) => d.isSunday).map((d) => d.day);
    for (const emp of employees) {
      // Contar todos los findes completos libres
      const findesCompletos = wpairs.filter(
        (p) => isFreeCell(emp.id, p.sat) && isFreeCell(emp.id, p.sun),
      );
      if (findesCompletos.length === 0 && wpairs.length > 0) {
        out.push({
          type: "danger",
          msg: `${emp.name}: sin finde completo libre (SAB+DOM consecutivos)`,
        });
      } else if (findesCompletos.length > 1) {
        out.push({
          type: "warning",
          msg: `${emp.name}: tiene ${findesCompletos.length} findes completos libres (debe ser solo 1)`,
        });
      }
      const usedSat = findesCompletos[0]?.sat;
      const hasExtraSat = allSatDays.some(
        (s) => s !== usedSat && isFreeCell(emp.id, s),
      );
      if (!hasExtraSat && allSatDays.length > (usedSat ? 1 : 0))
        out.push({
          type: "warning",
          msg: `${emp.name}: sin sábado libre adicional`,
        });
      const usedSun = findesCompletos[0]?.sun;
      const hasExtraSun = allSunDays.some(
        (s) => s !== usedSun && isFreeCell(emp.id, s),
      );
      if (!hasExtraSun && allSunDays.length > (usedSun ? 1 : 0))
        out.push({
          type: "warning",
          msg: `${emp.name}: sin domingo libre adicional`,
        });
    }
    return out;
  }, [
    schedule,
    larDays,
    employees,
    daysInMonth,
    dayInfo,
    earlyOffsets,
    lateOffsets,
    hoursOverride,
    regimeHours,
    jefeId,
    customCellTypes,
  ]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSchedule({});
    setBulkMode(null);
    setBulkSelected(new Set());
    setHoursReady(false);
    setHoursOverride({});
    setHistory([]);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSchedule({});
    setBulkMode(null);
    setBulkSelected(new Set());
    setHoursReady(false);
    setHoursOverride({});
    setHistory([]);
  };

  const setCellValue = (empId, day, type) => {
    setSchedule((prev) => {
      pushHistory(prev, larDays);
      const k = `${empId}-${day}`;
      const next = { ...prev };
      if (!type || next[k] === type) delete next[k];
      else next[k] = type;
      return next;
    });
  };

  const handleCellClick = (empId, day) => {
    if (!bulkMode) return;
    const k = `${empId}-${day}`;
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const applyBulk = () => {
    if (!bulkMode || bulkSelected.size === 0) return;
    if (bulkMode === "LAR") {
      pushHistory(schedule, larDays);
      setLarDays((prev) => {
        const next = new Set(prev);
        for (const k of bulkSelected) {
          if (next.has(k)) next.delete(k);
          else next.add(k);
        }
        return next;
      });
    } else {
      setSchedule((prev) => {
        pushHistory(prev, larDays); // ✅ pasar larDays aquí también
        const next = { ...prev }; // ✅ NO incluir larDays en schedule
        for (const k of bulkSelected) next[k] = bulkMode;
        return next;
      });
    }
    setBulkSelected(new Set());
  };

  const cancelBulk = () => {
    setBulkMode(null);
    setBulkSelected(new Set());
  };

  const doAutoFill = () => {
    setSchedule((prev) => {
      pushHistory(prev, larDays);
      return autoFillAll(
        employees,
        prev,
        dayInfo,
        daysInMonth,
        targetHours,
        earlyHsForEmp,
        lateHsForEmp,
        reducedDailyHsForEmp,
        jefeId,
        larDays,
        pmpIds,
      );
    });
  };
  const clearAll = () => {
    if (window.confirm("...")) {
      pushHistory(schedule, larDays);
      setSchedule({});
      setLarDays(new Set());
    }
  };

  const handleSave = () => {
    const ok = saveData({
      year,
      month,
      employees,
      schedule,
      larDays: [...larDays],
      holidays,
      service,
      beds,
      jefeId,
      pmpIds: [...pmpIds],
      earlyOffsets,
      lateOffsets,
      hoursOverride,
      customCellTypes,
      regimeHours,
    });
    if (ok) {
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    }
  };

  // ════════════════════════════════════════════════════════════════
  // REEMPLAZÁ COMPLETAMENTE tu función exportExcel con esta versión
  // ════════════════════════════════════════════════════════════════
  const exportExcel = () => {
    const mkFill = (hex) => ({
      patternType: "solid",
      fgColor: { rgb: hex.replace("#", "").toUpperCase().padStart(6, "0") },
    });
    const mkFont = (hex, bold = false, sz = 8, italic = false) => ({
      name: "Arial",
      sz,
      bold,
      italic,
      color: { rgb: hex.replace("#", "").toUpperCase().padStart(6, "0") },
    });
    const mkBdr = (style = "thin", hex = "CBD5E0") => ({
      style,
      color: { rgb: hex.replace("#", "").toUpperCase().padStart(6, "0") },
    });
    const borders = (s = "thin", hex = "CBD5E0") => ({
      top: mkBdr(s, hex),
      bottom: mkBdr(s, hex),
      left: mkBdr(s, hex),
      right: mkBdr(s, hex),
    });
    const align = (h = "center", v = "center", wrap = false) => ({
      horizontal: h,
      vertical: v,
      wrapText: wrap,
    });
    function lbl(ct) {
      switch (ct) {
        case "TM":
        case "EARLY":
        case "LATE":
          return "M";
        case "TT":
          return "T";
        case "TN":
          return "N";
        case "F":
          return "F";
        case "FE":
          return "F°";
        case "LIC":
          return "Lic";
        case "LAR":
          return "LAR";
        case "PM":
          return "PM";
        default:
          return "";
      }
    }
    function cs(ct, isSat, isSun, isHol) {
      const colBg = isHol || isSun ? "FFFF00" : isSat ? "C7E3FF" : "FFFFFF";
      const bStyle = isSat || isSun || isHol ? "medium" : "thin";
      const bHex = isSat || isSun || isHol ? "000000" : "CBD5E0";
      const B = borders(bStyle, bHex);
      const A = align("center", "center");
      function mk(bg, fg, bold = true, italic = false) {
        return {
          alignment: A,
          border: B,
          fill: mkFill(bg),
          font: mkFont(fg, bold, 8, italic),
        };
      }
      switch (ct) {
        case "TM":
          return mk(colBg, "1D4ED8", true);
        case "TT":
          return mk(colBg, "15803D", true);
        case "TN":
          return mk(colBg, "000000", true);
        case "F":
          return mk(colBg, "374151", false);
        case "FE":
          return mk(colBg, "DC2626", true, true);
        case "EARLY":
          return mk("FCE7F3", "9D174D", true);
        case "LATE":
          return mk("DCFCE7", "166534", true);
        case "LIC":
          return mk("FEF9C3", "7C2D12", true);
        case "LAR":
          return mk("FEF3C7", "92400E", true);
        case "PM":
          return mk("DBEAFE", "1E3A8A", true);
        default:
          return mk(colBg, "94A3B8", false);
      }
    }

    // ── Función que construye una hoja para los turnos indicados ──
    const buildSheet = (turns) => {
      const ws = {};
      const merges = [];
      const range = { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      let R = 0;
      const cell = (r, c, v, s) => {
        const addr = XLSX.utils.encode_cell({ r, c });
        ws[addr] = { v, t: typeof v === "number" ? "n" : "s", s };
        if (r > range.e.r) range.e.r = r;
        if (c > range.e.c) range.e.c = c;
      };
      const merge = (r, c, r2, c2) =>
        merges.push({ s: { r, c }, e: { r: r2, c: c2 } });
      const NC = 4,
        EX = 5,
        TC = NC + dayInfo.length + EX;
      const sTitle = {
        alignment: align("center", "center"),
        font: mkFont("1E3A8A", true, 13),
        fill: mkFill("FFFFFF"),
        border: borders("medium", "000000"),
      };
      for (let c = 0; c < TC; c++)
        cell(R, c, c === 0 ? "CRONOGRAMA MENSUAL DE FRANCOS" : "", sTitle);
      merge(R, 0, R, TC - 1);
      R++;
      const sInfo = (bg = "EFF6FF", fg = "1E40AF", h = "left") => ({
        alignment: align(h, "center"),
        font: mkFont(fg, true, 8),
        fill: mkFill(bg),
        border: borders("thin", "93C5FD"),
      });
      const c1 = Math.floor(TC * 0.36),
        c2 = Math.floor(TC * 0.18),
        c3 = Math.floor(TC * 0.18),
        c4 = TC - c1 - c2 - c3;
      const jefeEmp = employees.find((e) => e.id === jefeId);
      for (let c = 0; c < c1; c++)
        cell(R, c, c === 0 ? `SERVICIO: ${service}` : "", sInfo());
      merge(R, 0, R, c1 - 1);
      for (let c = 0; c < c2; c++)
        cell(
          R,
          c1 + c,
          c === 0 ? `Nº CAMAS: ${beds}` : "",
          sInfo("EFF6FF", "1E40AF", "center"),
        );
      merge(R, c1, R, c1 + c2 - 1);
      for (let c = 0; c < c3; c++)
        cell(
          R,
          c1 + c2 + c,
          c === 0 ? `${MONTHS[month].toUpperCase()} ${year}` : "",
          sInfo("EFF6FF", "1E40AF", "center"),
        );
      merge(R, c1 + c2, R, c1 + c2 + c3 - 1);
      for (let c = 0; c < c4; c++)
        cell(
          R,
          c1 + c2 + c3 + c,
          c === 0
            ? jefeEmp
              ? `Jefa/e: ${jefeEmp.name}`
              : "Jefa/e: _______________"
            : "",
          sInfo(),
        );
      merge(R, c1 + c2 + c3, R, TC - 1);
      R++;
      const sHdr = (bg = "1E3A8A", fg = "FFFFFF", h = "center") => ({
        alignment: align(h, "center", true),
        font: mkFont(fg, true, 7),
        fill: mkFill(bg),
        border: borders("medium", "000000"),
      });
      cell(R, 0, "MENS.", sHdr("374151"));
      cell(R, 1, "APELLIDO Y NOMBRE", sHdr("1E3A8A", "FFFFFF", "left"));
      cell(R, 2, "RÉG.", sHdr());
      cell(R, 3, "T.", sHdr());
      dayInfo.forEach((d, i) => {
        const bg = d.isHoliday
          ? "FF0000"
          : d.isSunday
            ? "FFFF00"
            : d.isSat
              ? "C7E3FF"
              : "DBEAFE";
        const fg = d.isHoliday ? "FFFFFF" : d.isSunday ? "1D4ED8" : "1E3A8A";
        const bs = d.isWeekend || d.isHoliday ? "medium" : "thin";
        const bh = d.isWeekend || d.isHoliday ? "000000" : "CBD5E0";
        cell(R, NC + i, `${d.day}\n${WDAYS[d.dow]}`, {
          alignment: align("center", "center", true),
          font: mkFont(fg, true, 7),
          fill: mkFill(bg),
          border: borders(bs, bh),
        });
      });
      cell(R, NC + dayInfo.length, "OBJ.", sHdr("374151"));
      cell(R, NC + dayInfo.length + 1, "CARG.", sHdr("374151"));
      const sHdrThick = (bg, fg) => ({
        alignment: align("center", "center", true),
        font: mkFont(fg, true, 7),
        fill: mkFill(bg),
        border: {
          top: mkBdr("medium", "000000"),
          bottom: mkBdr("medium", "000000"),
          left: mkBdr("medium", "000000"),
          right: mkBdr("medium", "000000"),
        },
      });
      cell(R, NC + dayInfo.length + 2, "F/FDE", sHdrThick("C7E3FF", "1D4ED8"));
      cell(R, NC + dayInfo.length + 3, "", sHdrThick("FFFF00", "1D4ED8"));
      R++;

      // ── Fila de JEFA/E DE SECCIÓN (separada, antes de los turnos) ──
      if (jefeEmp && turns.includes(jefeEmp.turn)) {
        const sJefaHdr = {
          alignment: align("left", "center"),
          font: mkFont("92400E", true, 9),
          fill: mkFill("FEF3C7"),
          border: borders("medium", "000000"),
        };
        for (let c = 0; c < TC; c++)
          cell(
            R,
            c,
            c === 0
              ? "JEFA/E DE SECCIÓN  —  no incluida en totales por turno"
              : "",
            sJefaHdr,
          );
        merge(R, 0, R, TC - 1);
        R++;
        const emp = jefeEmp;
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
        const dFg =
          Math.abs(diff) <= 7 ? "059669" : diff > 0 ? "F59E0B" : "EF4444";
        const eFg =
          emp.turn === "TM"
            ? "1D4ED8"
            : emp.turn === "TT"
              ? "15803D"
              : "000000";
        const sNameJ = {
          alignment: align("left", "center"),
          font: mkFont("92400E", true, 8),
          fill: mkFill("FFFBEB"),
          border: borders("medium", "F59E0B"),
        };
        const sMetaJ = (fg, bg = "FFFBEB", bold = true) => ({
          alignment: align("center", "center"),
          font: mkFont(fg, bold, 8),
          fill: mkFill(bg),
          border: borders("medium", "F59E0B"),
        });
        cell(R, 0, target, sMetaJ("92400E", "FEF3C7"));
        cell(R, 1, emp.name, sNameJ);
        cell(R, 2, emp.regime, sMetaJ("475569"));
        cell(R, 3, emp.turn, sMetaJ(eFg));
        dayInfo.forEach((d, i) => {
          const k = `${emp.id}-${d.day}`;
          const ct = larDays.has(k) ? "LAR" : schedule[k] || "";
          cell(R, NC + i, lbl(ct), cs(ct, d.isSat, d.isSunday, d.isHoliday));
        });
        cell(R, NC + dayInfo.length, target, sMetaJ("475569", "F8FAFC"));
        cell(R, NC + dayInfo.length + 1, worked, sMetaJ(dFg, "F8FAFC", true));
        const isFreeXLJ = (day) => {
          const v = schedule[`${emp.id}-${day}`];
          return !v || v === "F" || v === "FE" || v === "---";
        };
        const findesXLJ = dayInfo
          .filter((d) => d.isSat)
          .reduce((acc, d) => {
            const sun = dayInfo.find((x) => x.day === d.day + 1 && x.isSunday);
            return sun && isFreeXLJ(d.day) && isFreeXLJ(sun.day)
              ? acc + 1
              : acc;
          }, 0);
        const sFJ = (fg, bg) => ({
          alignment: align("center", "center"),
          font: mkFont(fg, true, 8),
          fill: mkFill(bg),
          border: {
            top: mkBdr("medium", "000000"),
            bottom: mkBdr("medium", "000000"),
            left: mkBdr("medium", "000000"),
            right: mkBdr("medium", "000000"),
          },
        });
        cell(
          R,
          NC + dayInfo.length + 2,
          findesXLJ || "",
          sFJ("92400E", "FFF7ED"),
        );
        cell(R, NC + dayInfo.length + 3, "", sFJ("1D4ED8", "FFFF00"));
        R++;
        // Fila separadora
        const sSep = {
          alignment: align("center", "center"),
          font: mkFont("CBD5E0", false, 4),
          fill: mkFill("F8FAFC"),
          border: borders("thin", "E2E8F0"),
        };
        for (let c = 0; c < TC; c++) cell(R, c, "", sSep);
        R++;
      }

      for (const turn of turns) {
        const emps = employees.filter(
          (e) => e.turn === turn && e.id !== jefeId,
        );
        if (!emps.length) continue;
        const tLbl =
          turn === "TM"
            ? "TURNO MAÑANA  (07:00–14:00)"
            : turn === "TT"
              ? "TURNO TARDE   (14:00–21:00)"
              : "TURNO NOCHE   (21:00–07:00)";
        const tFg =
          turn === "TM" ? "1D4ED8" : turn === "TT" ? "15803D" : "000000";
        const tBg =
          turn === "TM" ? "DBEAFE" : turn === "TT" ? "DCFCE7" : "F1F5F9";
        const sTh = {
          alignment: align("left", "center"),
          font: mkFont(tFg, true, 9),
          fill: mkFill(tBg),
          border: borders("medium", "000000"),
        };
        for (let c = 0; c < TC; c++) cell(R, c, c === 0 ? tLbl : "", sTh);
        merge(R, 0, R, TC - 1);
        R++;
        for (const emp of emps) {
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
          const dFg =
            Math.abs(diff) <= 7 ? "059669" : diff > 0 ? "F59E0B" : "EF4444";
          const eFg =
            turn === "TM" ? "1D4ED8" : turn === "TT" ? "15803D" : "000000";
          const sName = {
            alignment: align("left", "center"),
            font: mkFont("1E293B", false, 8),
            fill: mkFill("FFFFFF"),
            border: borders("thin", "CBD5E0"),
          };
          const sMeta = (fg, bg = "FFFFFF", bold = true) => ({
            alignment: align("center", "center"),
            font: mkFont(fg, bold, 8),
            fill: mkFill(bg),
            border: borders("thin", "CBD5E0"),
          });
          cell(R, 0, target, sMeta("1E40AF", "F1F5F9"));
          cell(R, 1, emp.name, sName);
          cell(R, 2, emp.regime, sMeta("475569"));
          cell(R, 3, emp.turn, sMeta(eFg));
          dayInfo.forEach((d, i) => {
            const k = `${emp.id}-${d.day}`;
            const ct = larDays.has(k) ? "LAR" : schedule[k] || "";
            cell(R, NC + i, lbl(ct), cs(ct, d.isSat, d.isSunday, d.isHoliday));
          });
          cell(R, NC + dayInfo.length, target, sMeta("475569", "F8FAFC"));
          cell(R, NC + dayInfo.length + 1, worked, sMeta(dFg, "F8FAFC", true));
          // H Trab (LAR)
          const isLARemp = [...larDays].some((k) => k.startsWith(`${emp.id}-`));
          const hTrabVal = isLARemp
            ? (() => {
                const base = getRegimeHours(emp.regime);
                const reduced =
                  emp.reduction > 0
                    ? Math.round(base * (1 - emp.reduction / 100))
                    : base;
                const wd = calcWorkingDays(year, month, holidays);
                const td2 = getDaysInMonth(year, month);
                return Math.round((wd * reduced) / td2);
              })()
            : "—";
          cell(R, NC + dayInfo.length + 2, hTrabVal, sMeta("0369A1", "E0F2FE"));

          const isFreeXL = (day) => {
            const v = schedule[`${emp.id}-${day}`];
            return !v || v === "F" || v === "FE" || v === "---";
          };
          const findesXL = dayInfo
            .filter((d) => d.isSat)
            .reduce((acc, d) => {
              const sun = dayInfo.find(
                (x) => x.day === d.day + 1 && x.isSunday,
              );
              return sun && isFreeXL(d.day) && isFreeXL(sun.day)
                ? acc + 1
                : acc;
            }, 0);
          const sFindes = (fg, bg) => ({
            alignment: align("center", "center"),
            font: mkFont(fg, true, 8),
            fill: mkFill(bg),
            border: {
              top: mkBdr("medium", "000000"),
              bottom: mkBdr("medium", "000000"),
              left: mkBdr("medium", "000000"),
              right: mkBdr("medium", "000000"),
            },
          });
          cell(
            R,
            NC + dayInfo.length + 2,
            findesXL || "",
            sFindes("92400E", "FFF7ED"),
          );
          cell(R, NC + dayInfo.length + 3, "", sFindes("1D4ED8", "FFFF00"));
          R++;
        }
        const sTotLbl = {
          alignment: align("left", "center"),
          font: mkFont("1E293B", true, 8, true),
          fill: mkFill("CBD5E1"),
          border: {
            top: mkBdr("medium", "000000"),
            bottom: mkBdr("medium", "000000"),
            left: mkBdr("medium", "000000"),
            right: mkBdr("thin", "94A3B8"),
          },
        };
        const sTotNum = (n) => {
          const fg =
            n === 0 ? "94A3B8" : n < 4 ? "EF4444" : n > 8 ? "F59E0B" : "059669";
          return {
            alignment: align("center", "center"),
            font: mkFont(fg, true, 8),
            fill: mkFill("CBD5E1"),
            border: {
              top: mkBdr("medium", "000000"),
              bottom: mkBdr("medium", "000000"),
              left: mkBdr("thin", "94A3B8"),
              right: mkBdr("thin", "94A3B8"),
            },
          };
        };
        for (let c = 0; c < NC; c++)
          cell(R, c, c === 1 ? "TOTAL DE ENFERMEROS" : "", sTotLbl);
        merge(R, 1, R, NC - 1);
        cell(R, 0, "", sTotLbl);
        dayInfo.forEach((d, i) => {
          const n = countPerTurn(schedule, employees, d.day, jefeId)[turn] || 0;
          cell(R, NC + i, n > 0 ? n : "", sTotNum(n));
        });
        for (let c = NC + dayInfo.length; c < TC; c++) cell(R, c, "", sTotLbl);
        R++;
      }
      // ── Sección PARTE MÉDICO PROLONGADO ──
      const pmpEmps = employees.filter(
        (e) => pmpIds.has(e.id) && turns.includes(e.turn),
      );
      if (pmpEmps.length > 0) {
        const sPmpHdr = {
          alignment: align("left", "center"),
          font: mkFont("DC2626", true, 9),
          fill: mkFill("FEF2F2"),
          border: borders("medium", "000000"),
        };
        for (let c = 0; c < TC; c++)
          cell(
            R,
            c,
            c === 0
              ? "PARTE MÉDICO PROLONGADO  —  no incluidos en cobertura activa"
              : "",
            sPmpHdr,
          );
        merge(R, 0, R, TC - 1);
        R++;
        for (const emp of pmpEmps) {
          const target = targetHours(emp);
          const sPmpName = {
            alignment: align("left", "center"),
            font: mkFont("B91C1C", false, 8),
            fill: mkFill("FFF1F2"),
            border: borders("thin", "FCA5A5"),
          };
          const sPmpMeta = (fg, bg = "FFF1F2") => ({
            alignment: align("center", "center"),
            font: mkFont(fg, false, 8),
            fill: mkFill(bg),
            border: borders("thin", "FCA5A5"),
          });
          cell(R, 0, target, sPmpMeta("B91C1C", "FEF2F2"));
          cell(R, 1, emp.name, sPmpName);
          cell(R, 2, emp.regime, sPmpMeta("475569"));
          cell(R, 3, emp.turn, sPmpMeta("475569"));
          dayInfo.forEach((d, i) => {
            const k = `${emp.id}-${d.day}`;
            const ct = larDays.has(k) ? "LAR" : schedule[k] || "";
            cell(R, NC + i, lbl(ct), cs(ct, d.isSat, d.isSunday, d.isHoliday));
          });
          cell(R, NC + dayInfo.length, "—", sPmpMeta("94A3B8"));
          cell(R, NC + dayInfo.length + 1, "—", sPmpMeta("94A3B8"));
          cell(R, NC + dayInfo.length + 2, "—", sPmpMeta("94A3B8"));
          cell(R, NC + dayInfo.length + 3, "", sPmpMeta("94A3B8"));
          R++;
        }
      }

      R++;
      const lgItems = [
        { l: "M = Mañana (07-14)", bg: "FFFFFF", fg: "1D4ED8" },
        { l: "T = Tarde (14-21)", bg: "FFFFFF", fg: "15803D" },
        { l: "N = Noche (21-07)", bg: "FFFFFF", fg: "000000" },
        { l: "F = Franco", bg: "FFFFFF", fg: "374151" },
        { l: "F° = Franco Esp.", bg: "FFFFFF", fg: "DC2626" },
        { l: "Lic = Licencia", bg: "FEF9C3", fg: "7C2D12" },
        { l: "LAR = Largo", bg: "FEF3C7", fg: "92400E" },
        { l: "PM", bg: "DBEAFE", fg: "1E3A8A" },
      ];
      const lgW = Math.floor(TC / lgItems.length);
      lgItems.forEach((it, i) => {
        const cs2 = i * lgW,
          ce = i === lgItems.length - 1 ? TC - 1 : cs2 + lgW - 1;
        const sLg = {
          alignment: align("center", "center"),
          font: mkFont(it.fg, true, 7),
          fill: mkFill(it.bg),
          border: borders("thin", "CBD5E0"),
        };
        for (let c = cs2; c <= ce; c++) cell(R, c, c === cs2 ? it.l : "", sLg);
        merge(R, cs2, R, ce);
      });
      R++;
      const sNote = {
        alignment: align("left", "center", true),
        font: mkFont("64748B", false, 7, true),
        fill: mkFill("FFFFFF"),
        border: borders("thin", "CBD5E0"),
      };
      for (let c = 0; c < TC; c++)
        cell(
          R,
          c,
          c === 0
            ? "NOTA: el cronograma sigue el régimen mensual del servicio. Los feriados se trabajan en el turno asignado salvo indicación contraria."
            : "",
          sNote,
        );
      merge(R, 0, R, TC - 1);
      R++;
      ws["!ref"] = XLSX.utils.encode_range(range);
      ws["!merges"] = merges;
      ws["!cols"] = [
        { wch: 5 },
        { wch: 26 },
        { wch: 6 },
        { wch: 4 },
        ...dayInfo.map(() => ({ wch: 3.5 })),
        { wch: 5 },
        { wch: 5 },
        { wch: 5 },
        { wch: 4 },
        { wch: 4 },
      ];
      ws["!rows"] = Array(R)
        .fill(null)
        .map((_, i) =>
          i === 0
            ? { hpt: 20 }
            : i === 1
              ? { hpt: 14 }
              : i === 2
                ? { hpt: 24 }
                : { hpt: 14 },
        );
      ws["!pageSetup"] = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      };
      ws["!printOptions"] = { gridLines: false };
      return ws;
    };

    // ── Crear libro con 2 hojas ──
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      buildSheet(["TM", "TT"]),
      `Mañ-Tarde ${MONTHS[month]}`,
    );
    XLSX.utils.book_append_sheet(
      wb,
      buildSheet(["TN"]),
      `Noche ${MONTHS[month]}`,
    );
    XLSX.writeFile(wb, `Cronograma_${MONTHS[month]}_${year}.xlsx`);
  };
  // ════════════════════════════════════════════════════════════════
  // REEMPLAZÁ COMPLETAMENTE tu función exportPDF con esta versión
  // Agrega salto de página entre TURNO TARDE y TURNO NOCHE
  // ════════════════════════════════════════════════════════════════
  const exportPDF = () => {
    const getCellInfo = (ct, isSat, isSun, isHol) => {
      const colBg = isHol || isSun ? "#ffff00" : isSat ? "#c7e3ff" : "#ffffff";
      switch (ct) {
        case "TM":
          return { l: "M", bg: colBg, fg: "#1d4ed8", bold: true };
        case "TT":
          return { l: "T", bg: colBg, fg: "#15803d", bold: true };
        case "TN":
          return { l: "N", bg: colBg, fg: "#000000", bold: true };
        case "F":
          return { l: "F", bg: colBg, fg: "#374151", bold: false };
        case "FE":
          return {
            l: "F°",
            bg: colBg,
            fg: "#dc2626",
            bold: true,
            italic: true,
          };
        case "EARLY":
          return { l: "M", bg: "#fce7f3", fg: "#9d174d", bold: true };
        case "LATE":
          return { l: "M", bg: "#dcfce7", fg: "#166534", bold: true };
        case "LIC":
          return { l: "Lic", bg: "#fef9c3", fg: "#7c2d12", bold: true };
        case "LAR":
          return { l: "LAR", bg: "#fef3c7", fg: "#92400e", bold: true };
        case "PM":
          return { l: "PM", bg: "#dbeafe", fg: "#1e3a8a", bold: true };
        default:
          return { l: "", bg: colBg, fg: "#94a3b8", bold: false };
      }
    };
    const jefeEmp = employees.find((e) => e.id === jefeId);
    const TC = 3 + dayInfo.length + 4;
    const c1 = Math.floor(TC * 0.36),
      c2 = Math.floor(TC * 0.18),
      c3 = Math.floor(TC * 0.18),
      c4 = TC - c1 - c2 - c3;
    const Sp = {
      root: `font-family:Arial,sans-serif;font-size:6.5pt;`,
      tbl: `border-collapse:collapse;width:100%;`,
      title: `text-align:center;font-size:12pt;font-weight:bold;color:#1e3a8a;text-decoration:underline;padding:5px;border:2pt solid #000;`,
      info: `background:#eff6ff;color:#1e40af;font-weight:bold;padding:2px 5px;border:1pt solid #93c5fd;font-size:7pt;`,
      hdr: `background:#1e3a8a;color:#fff;font-weight:bold;text-align:center;padding:3px 1px;border:1.5pt solid #000;font-size:6pt;`,
      tot: `background:#cbd5e1;font-weight:bold;font-style:italic;border:1.5pt solid #000;padding:1px 4px;`,
    };

    // ── Función que genera el HTML de una tabla para los turnos indicados ──
    const buildTable = (turns, isFirstPage) => {
      let H = `<table style="${Sp.tbl}">`;
      H += `<tr><td colspan="${TC}" style="${Sp.title}">CRONOGRAMA MENSUAL DE FRANCOS</td></tr>`;
      H += `<tr><td colspan="${c1}" style="${Sp.info}">&nbsp;SERVICIO: ${service}</td><td colspan="${c2}" style="${Sp.info}text-align:center;">Nº CAMAS: ${beds}</td><td colspan="${c3}" style="${Sp.info}text-align:center;">${MONTHS[month].toUpperCase()} ${year}</td><td colspan="${c4}" style="${Sp.info}">&nbsp;${jefeEmp ? `Jefa/e: ${jefeEmp.name}` : "Jefa/e: _______________"}</td></tr>`;
      H += `<tr><th style="${Sp.hdr}min-width:90pt;text-align:left;padding:2px 4px;">APELLIDO Y NOMBRE</th><th style="${Sp.hdr}">RÉG.</th><th style="${Sp.hdr}">T.</th>`;
      dayInfo.forEach((d) => {
        const bg = d.isHoliday
          ? "#dc2626"
          : d.isSunday
            ? "#ffff00"
            : d.isSat
              ? "#c7e3ff"
              : "#dbeafe";
        const fg = d.isHoliday ? "#ffffff" : "#1d4ed8";
        const bw = d.isWeekend || d.isHoliday ? "1.5pt" : "0.4pt";
        H += `<th style="background:${bg};color:${fg};font-weight:bold;text-align:center;padding:1px 0;border:${bw} solid #000;font-size:5.5pt;min-width:11pt;">${d.day}<br>${WDAYS[d.dow]}</th>`;
      });
      H += `<th style="${Sp.hdr}">OBJ.</th><th style="${Sp.hdr}">CARG.</th><th style="background:#c7e3ff;color:#1d4ed8;font-weight:bold;text-align:center;border:2pt solid #000;font-size:6pt;">F/FDE</th><th style="background:#ffff00;border:2pt solid #000;"></th></tr>`;
      for (const turn of turns) {
        const emps = employees.filter((e) => e.turn === turn);
        if (!emps.length) continue;
        const tLbl =
          turn === "TM"
            ? "TURNO MAÑANA  (07:00–14:00)"
            : turn === "TT"
              ? "TURNO TARDE   (14:00–21:00)"
              : "TURNO NOCHE   (21:00–07:00)";
        const tFg =
          turn === "TM" ? "#1d4ed8" : turn === "TT" ? "#15803d" : "#000000";
        const tBg =
          turn === "TM" ? "#dbeafe" : turn === "TT" ? "#dcfce7" : "#f1f5f9";
        H += `<tr><td colspan="${TC}" style="background:${tBg};color:${tFg};font-weight:bold;padding:2px 5px;font-size:8pt;border:2pt solid #000;">▶ ${tLbl}</td></tr>`;
        for (const emp of emps) {
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
          const dFg =
            Math.abs(diff) <= 7 ? "#059669" : diff > 0 ? "#f59e0b" : "#ef4444";
          const eFg =
            turn === "TM" ? "#1d4ed8" : turn === "TT" ? "#15803d" : "#000000";
          H += `<tr><td style="border:0.4pt solid #cbd5e1;padding:1px 3px;white-space:nowrap;">${emp.name}</td><td style="border:0.4pt solid #cbd5e1;text-align:center;font-size:6pt;">${emp.regime}</td><td style="border:0.4pt solid #cbd5e1;text-align:center;color:${eFg};font-weight:bold;font-size:6pt;">${emp.turn}</td>`;
          dayInfo.forEach((d) => {
            const k = `${emp.id}-${d.day}`;
            const ct = larDays.has(k) ? "LAR" : schedule[k] || "";
            const ci = getCellInfo(ct, d.isSat, d.isSunday, d.isHoliday);
            const bw = d.isWeekend || d.isHoliday ? "1.5pt" : "0.4pt";
            H += `<td style="background:${ci.bg};color:${ci.fg};${ci.bold ? "font-weight:bold;" : ""}${ci.italic ? "font-style:italic;" : ""}text-align:center;padding:1px 0;border:${bw} solid #000;font-size:6.5pt;">${ci.l}</td>`;
          });
          const isFreeP = (day) => {
            const v = schedule[`${emp.id}-${day}`];
            return !v || v === "F" || v === "FE" || v === "---";
          };
          const findesP = dayInfo
            .filter((d) => d.isSat)
            .reduce((acc, d) => {
              const sun = dayInfo.find(
                (x) => x.day === d.day + 1 && x.isSunday,
              );
              return sun && isFreeP(d.day) && isFreeP(sun.day) ? acc + 1 : acc;
            }, 0);
          H += `<td style="border:1.5pt solid #000;text-align:center;font-size:6pt;">${target}</td><td style="border:1.5pt solid #000;text-align:center;color:${dFg};font-weight:bold;font-size:6pt;">${worked}</td><td style="background:#fff7ed;color:#92400e;font-weight:bold;text-align:center;border:2pt solid #000;font-size:6pt;">${findesP || ""}</td><td style="background:#ffff00;border:2pt solid #000;font-size:6pt;"></td></tr>`;
        }
        H += `<tr><td colspan="3" style="${Sp.tot}">TOTAL DE ENFERMEROS</td>`;
        dayInfo.forEach((d) => {
          const n = countPerTurn(schedule, employees, d.day, jefeId)[turn] || 0;
          const col =
            n === 0
              ? "#94a3b8"
              : n < 4
                ? "#ef4444"
                : n > 8
                  ? "#f59e0b"
                  : "#059669";
          H += `<td style="background:#cbd5e1;color:${col};font-weight:bold;text-align:center;border:1pt solid #000;font-size:6.5pt;">${n > 0 ? n : ""}</td>`;
        });
        H += `<td colspan="4" style="background:#cbd5e1;border:1.5pt solid #000;"></td></tr>`;
      }
      H += `<tr>`;
      const lgItems = [
        { l: "M = Mañana (07-14)", bg: "#ffffff", fg: "#1d4ed8" },
        { l: "T = Tarde (14-21)", bg: "#ffffff", fg: "#15803d" },
        { l: "N = Noche (21-07)", bg: "#ffffff", fg: "#000000" },
        { l: "F = Franco", bg: "#ffffff", fg: "#374151" },
        { l: "F° = Franco Esp.", bg: "#ffffff", fg: "#dc2626" },
        { l: "Lic = Licencia", bg: "#fef9c3", fg: "#7c2d12" },
        { l: "LAR = Largo", bg: "#fef3c7", fg: "#92400e" },
        { l: "PM", bg: "#dbeafe", fg: "#1e3a8a" },
      ];
      const lgW = Math.floor(TC / lgItems.length);
      lgItems.forEach((it, i) => {
        const span = i === lgItems.length - 1 ? TC - i * lgW : lgW;
        H += `<td colspan="${span}" style="background:${it.bg};color:${it.fg};font-weight:bold;text-align:center;border:0.5pt solid #cbd5e1;padding:3px 2px;font-size:6pt;">${it.l}</td>`;
      });
      H += `</tr>`;
      H += `<tr><td colspan="${TC}" style="font-size:5.5pt;color:#64748b;font-style:italic;padding:2px 4px;border-top:1pt solid #e2e8f0;">NOTA: el cronograma sigue el régimen mensual del servicio. Los feriados se trabajan en el turno asignado salvo indicación contraria.</td></tr>`;
      H += `</table>`;
      return H;
    };

    // ── Página 1: Mañana + Tarde  |  Página 2: Noche ──
    let H = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;}
    @page{size:A3 landscape;margin:6mm;}
    body{margin:0;padding:4px;font-family:Arial,sans-serif;font-size:6.5pt;}
    table{border-collapse:collapse;width:100%;}
    td,th{padding:1px;}
    .page-break{page-break-before:always;padding-top:4px;}
  </style></head><body>`;

    H += buildTable(["TM", "TT"], true);
    H += `<div class="page-break">`;
    H += buildTable(["TN"], false);
    H += `</div>`;
    H += `</body></html>`;

    const blob = new Blob([H], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => {
        setTimeout(() => {
          win.print();
          URL.revokeObjectURL(url);
        }, 400);
      };
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cronograma_${MONTHS[month]}_${year}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };
  return (
    <div style={S.app}>
      {!hoursReady && (
        <HoursModal
          month={month}
          year={year}
          holidays={holidays}
          employees={employees}
          hoursOverride={hoursOverride}
          setHoursOverride={setHoursOverride}
          setHoursReady={setHoursReady}
          schedule={schedule}
          larDays={larDays}
          daysInMonth={daysInMonth}
          getRegimeHours={getRegimeHours}
        />
      )}
      <AppHeader
        service={service}
        beds={beds}
        month={month}
        year={year}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onExportExcel={exportExcel}
        onExportPDF={exportPDF}
        onSave={handleSave}
        savedOk={savedOk}
        currentUser={currentUser}
        onLogout={onLogout}
      />
      <TabsBar tab={tab} setTab={setTab} />
      <div style={S.content}>
        {tab === "schedule" && (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                paddingBottom: 12,
              }}
              className="no-print"
            >
              {Object.entries(CELL_TYPES)
                .filter(([k]) => k !== "---")
                .map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      color: "#475569",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 14,
                        borderRadius: 3,
                        background: v.bg,
                        color: v.fg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily:
                          k === "FE"
                            ? "'Georgia',serif"
                            : "'Barlow Condensed',sans-serif",
                        fontStyle: k === "FE" ? "italic" : "normal",
                      }}
                    >
                      {v.label}
                    </div>
                    <span>
                      {k === "TM"
                        ? "Mañana 07-14"
                        : k === "TT"
                          ? "Tarde 14-21"
                          : k === "TN"
                            ? "Noche 21-07"
                            : k === "F"
                              ? "Franco"
                              : k === "FE"
                                ? "Franco Esp."
                                : k === "LIC"
                                  ? "Licencia"
                                  : k === "LAR"
                                    ? "Largo"
                                    : k === "PM"
                                      ? "PM"
                                      : k === "EARLY"
                                        ? "Sale antes"
                                        : k === "LATE"
                                          ? "Sale después"
                                          : ""}
                    </span>
                  </div>
                ))}
            </div>
            <AlertsPanel
              alerts={alerts}
              showAlerts={showAlerts}
              setShowAlerts={setShowAlerts}
            />
            <ScheduleToolbar
              filterTurn={filterTurn}
              filterEmpId={filterEmpId}
              setFilterTurn={setFilterTurn}
              setFilterEmpId={setFilterEmpId}
              employees={employees}
              history={history}
              onUndo={undo}
              onAutoFill={doAutoFill}
              onClearAll={clearAll}
              onOpenHours={() => setHoursReady(false)}
            />
            <BulkSelector
              bulkMode={bulkMode}
              setBulkMode={setBulkMode}
              bulkSelected={bulkSelected}
              setBulkSelected={setBulkSelected}
              onApplyBulk={applyBulk}
              onCancelBulk={cancelBulk}
            />
            <JefeSelector
              jefeId={jefeId}
              setJefeId={setJefeId}
              employees={employees}
            />
            <ScheduleGrid
              gridRef={gridRef}
              scrollbarRef={scrollbarRef}
              visibleEmps={visibleEmps}
              employees={employees}
              dayInfo={dayInfo}
              daysInMonth={daysInMonth}
              schedule={schedule}
              larDays={larDays}
              bulkMode={bulkMode}
              bulkSelected={bulkSelected}
              customCellTypes={customCellTypes}
              jefeId={jefeId}
              pmpIds={pmpIds}
              setPmpIds={setPmpIds}
              dragEmpId={dragEmpId}
              dragOverId={dragOverId}
              setCellValue={setCellValue}
              handleCellClick={handleCellClick}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              handleDragEnd={handleDragEnd}
              targetHours={targetHours}
              earlyHsForEmp={earlyHsForEmp}
              lateHsForEmp={lateHsForEmp}
              reducedDailyHsForEmp={reducedDailyHsForEmp}
              year={year}
              month={month}
              holidays={holidays}
              getRegimeHours={getRegimeHours}
            />
          </>
        )}
        {tab === "staff" && (
          <StaffTab
            employees={employees}
            setEmployees={setEmployees}
            editEmpId={editEmpId}
            setEditEmpId={setEditEmpId}
            editData={editData}
            setEditData={setEditData}
            newEmp={newEmp}
            setNewEmp={setNewEmp}
            targetHours={targetHours}
          />
        )}
        {tab === "config" && (
          <ConfigTab
            service={service}
            setService={setService}
            beds={beds}
            setBeds={setBeds}
            year={year}
            setYear={setYear}
            month={month}
            holidays={holidays}
            setHolidays={setHolidays}
            newHoliday={newHoliday}
            setNewHoliday={setNewHoliday}
            daysInMonth={daysInMonth}
            earlyOffsets={earlyOffsets}
            setEarlyOffsets={setEarlyOffsets}
            lateOffsets={lateOffsets}
            setLateOffsets={setLateOffsets}
            customCellTypes={customCellTypes}
            setCustomCellTypes={setCustomCellTypes}
            newCustom={newCustom}
            setNewCustom={setNewCustom}
            regimeHours={regimeHours}
            setRegimeHours={setRegimeHours}
            getRegimeHours={getRegimeHours}
            employees={employees}
            schedule={schedule}
            larDays={larDays}
            dayInfo={dayInfo}
            targetHours={targetHours}
            earlyHsForEmp={earlyHsForEmp}
            lateHsForEmp={lateHsForEmp}
            reducedDailyHsForEmp={reducedDailyHsForEmp}
          />
        )}
      </div>
    </div>
  );
}
