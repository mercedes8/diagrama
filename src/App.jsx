import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx-js-style";

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const WDAYS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const STORAGE_KEY = "hospital_schedule_v1";

// ── Turno → inicial ──
const TURN_LABEL = { TM: "M", TT: "T", TN: "N" };

function getCellStyle(ct, isFrancoWeekendPair, empTurn = "TM", customCellTypes = []) {
  const border = isFrancoWeekendPair ? "2px solid #000" : "1px solid #e2e8f0";
  const tl = TURN_LABEL[empTurn] ?? "M";

  const custom = customCellTypes.find(c => c.key === ct);
  if (custom) return { label: custom.label, textColor: custom.fg, bg: custom.bg, bold: true, border: `2px solid ${custom.border}` };

  switch(ct) {
    case "TM":    return { label:"M",   textColor:"#1d4ed8", bg:"#fff",    bold:true,  border };
    case "TT":    return { label:"T",   textColor:"#15803d", bg:"#fff",    bold:true,  border };
    case "TN":    return { label:"N",   textColor:"#000",    bg:"#fff",    bold:true,  border };
    case "F":     return { label:"F",   textColor:"#374151", bg:"#fff",    bold:false, border };
    case "FE":    return { label:"F°",  textColor:"#dc2626", bg:"#fff",    bold:true,  border, specialFont:true };
    case "LIC":   return { label:tl,    textColor:"#7c2d12", bg:"#fef9c3", bold:true,  border:"1px solid #d97706" };
    case "EARLY": return { label:tl,    textColor:"#9d174d", bg:"#fce7f3", bold:true,  border:"2px solid #f9a8d4" };
    case "LATE":  return { label:tl,    textColor:"#166534", bg:"#dcfce7", bold:true,  border:"2px solid #86efac" };
    case "LAR":   return { label:tl,    textColor:"#92400e", bg:"#fef3c7", bold:true,  border:"1px solid #fbbf24" };
    case "PM":    return { label:"PM",  textColor:"#1e3a8a", bg:"#dbeafe", bold:true,  border:"1px solid #93c5fd" };
    default:      return { label:"",    textColor:"#94a3b8", bg:"#fff",    bold:false, border };
  }
}

const CELL_TYPES = {
  TM:    { label: "M",   bg: "#fff",    fg: "#1d4ed8", hours: 7  },
  TT:    { label: "T",   bg: "#fff",    fg: "#15803d", hours: 7  },
  TN:    { label: "N",   bg: "#fff",    fg: "#000",    hours: 10 },
  F:     { label: "F",   bg: "#fff",    fg: "#374151", hours: 0  },
  FE:    { label: "F°",  bg: "#fff",    fg: "#dc2626", hours: 0  },
  LIC:   { label: "Lic", bg: "#fef9c3", fg: "#7c2d12", hours: 0  },
  EARLY: { label: "●",   bg: "#fce7f3", fg: "#9d174d", hours: 0  },
  LATE:  { label: "●",   bg: "#dcfce7", fg: "#166534", hours: 0  },
  LAR:   { label: "LAR", bg: "#fef3c7", fg: "#92400e", hours: 0  },
  PM:    { label: "PM",  bg: "#dbeafe", fg: "#1e3a8a", hours: 0  },
  "---": { label: "",    bg: "#fff",    fg: "#94a3b8", hours: 0  },
};

const REGIMES = {
  R15: { label: "Régimen 15",   hours: 160 },
  R27: { label: "Régimen 27",   hours: 144 },
  H24: { label: "24hs Semanal", hours: 88  },
};

const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const getDow         = (y, m, d) => new Date(y, m, d).getDay();

function calcWorkingDays(year, month, holidays = []) {
  const total = getDaysInMonth(year, month);
  let working = 0;
  for (let d = 1; d <= total; d++) {
    const dow = getDow(year, month, d);
    if (dow !== 0) working++;
  }
  return working;
}


function effectiveHours(emp, year, month, holidays, getRegHours, larDays, daysInMonth) {
  // El objetivo es siempre la carga mensual completa
  // Las horas de LAR se suman en workedHours
  const base = getRegHours(emp.regime);
  return emp.reduction > 0 ? Math.round(base * (1 - emp.reduction / 100)) : base;
}

function workedHours(schedule, empId, days, earlyHsFor = 0, lateHsFor = 0, customTypes = [], baseHsOverride = null, larDays = null, empTurn = null, cargaMensual = null, month = null) {
  const earlyHs = typeof earlyHsFor === "function" ? earlyHsFor(empId) : earlyHsFor;
  const lateHs  = typeof lateHsFor  === "function" ? lateHsFor(empId)  : lateHsFor;
  let total = 0;

  // Sumar horas de días LAR (proporcional: carga/30 por día)
  if (larDays && cargaMensual) {
    const diasLAR = [...larDays].filter(k => k.startsWith(`${empId}-`)).length;
    if (diasLAR > 0) {
      const divisor = (month === 1) ? 28 : 30;
      total += Math.round((cargaMensual / divisor) * diasLAR);
    }
  }

  for (let d = 1; d <= days; d++) {
    const ct = schedule[`${empId}-${d}`];
    if (!ct) continue;
    if (ct === "EARLY") { total += earlyHs; continue; }
    if (ct === "LATE")  { total += lateHs;  continue; }
    if (CELL_TYPES[ct]) {
      const stdHours = CELL_TYPES[ct].hours;
      if (baseHsOverride !== null && stdHours > 0) { total += baseHsOverride; } else { total += stdHours; }
      continue;
    }
    const cust = customTypes.find(c => c.key === ct);
    if (cust) total += (cust.hours || 0);
  }
  return total;
}

function countPerTurn(schedule, employees, day, jefeId = null, pmpIds = null) {
  const c = { TM: 0, TT: 0, TN: 0 };
  for (const emp of employees) {
    if (jefeId && emp.id === jefeId) continue; // ← excluye jefa
    if (pmpIds && pmpIds.has(emp.id)) continue; // ← excluye PMP
    const ct = schedule[`${emp.id}-${day}`];
    if (["TM","EARLY","LATE"].includes(ct)) c.TM++;
    else if (ct === "TT") c.TT++;
    else if (ct === "TN") c.TN++;
  }
  return c;
}

const INITIAL_EMPLOYEES = [
  { id: 1,  name: "Spinoza Claudia",      regime: "R27", turn: "TM", reduction: 0,  note: "" },
  { id: 2,  name: "Nuñez Celestina",      regime: "R27", turn: "TM", reduction: 0,  note: "" },
  { id: 3,  name: "Ajaya Veronica",       regime: "R27", turn: "TM", reduction: 25, note: "Red.25%" },
  { id: 4,  name: "Lazzaro Claudia",      regime: "R27", turn: "TM", reduction: 0,  note: "" },
  { id: 5,  name: "Morganti Gisela",      regime: "R27", turn: "TM", reduction: 0,  note: "" },
  { id: 6,  name: "Quiroga Jesica",       regime: "R27", turn: "TM", reduction: 0,  note: "" },
  { id: 7,  name: "Marino Laura",         regime: "R27", turn: "TM", reduction: 0,  note: "" },
  { id: 8,  name: "Martinez Yenny",       regime: "R15", turn: "TM", reduction: 0,  note: "" },
  { id: 9,  name: "Quezada Daiana",       regime: "R15", turn: "TM", reduction: 0,  note: "Ingr.09/25" },
  { id: 10, name: "Dominguez Yamila",     regime: "R15", turn: "TM", reduction: 0,  note: "" },
  { id: 11, name: "Venturini Geraldine",  regime: "R15", turn: "TM", reduction: 0,  note: "" },
  { id: 12, name: "Pereira Gisel",        regime: "R15", turn: "TM", reduction: 0,  note: "" },
  { id: 13, name: "Abarza Alejandra",     regime: "R27", turn: "TT", reduction: 0,  note: "" },
  { id: 14, name: "Nievas Eliana",        regime: "R27", turn: "TT", reduction: 0,  note: "" },
  { id: 15, name: "Peña Janet",           regime: "R27", turn: "TT", reduction: 0,  note: "" },
  { id: 16, name: "Aguirre Tamara",       regime: "R15", turn: "TT", reduction: 0,  note: "Ingr.06/25" },
  { id: 17, name: "Mardones Claudia",     regime: "R15", turn: "TT", reduction: 0,  note: "" },
  { id: 18, name: "Condori Joana",        regime: "R27", turn: "TN", reduction: 0,  note: "" },
  { id: 19, name: "Bullones Priscila",    regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 20, name: "Garcia Laura",         regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 21, name: "Castilo Natalia",      regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 22, name: "Aguirre Mirian",       regime: "H24", turn: "TN", reduction: 0,  note: "24hs" },
  { id: 23, name: "Gomez Betiana",        regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 24, name: "Quispe Andrea",        regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 25, name: "Diaz Eliana",          regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 26, name: "Olmedo Melisa",        regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 27, name: "Bustos Elizabeth",     regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 28, name: "Perez Sabrina",        regime: "R15", turn: "TN", reduction: 0,  note: "" },
  { id: 29, name: "Siles Liliana",        regime: "R27", turn: "TN", reduction: 0,  note: "Part.med." },
];

const isWorkShift = (ct) => ["TM","TT","TN","EARLY","LATE"].includes(ct);
const MAX_CONSECUTIVE = { TM: 4, TT: 4, TN: 2 };
// Máximo consecutivo por régimen (TM/TT): R27=4, R15=6, TN=2
function maxConsecForEmp(emp) {
  if (emp.turn === "TN") return 2;
  return emp.regime === "R15" ? 6 : 4;
}
const MAX_CONSEC_FRANCO = 3;

function consecutivesBefore(next, empId, day) {
  let count = 0;
  for (let d = day - 1; d >= 1; d--) {
    if (isWorkShift(next[`${empId}-${d}`])) count++;
    else break;
  }
  return count;
}

function countPerTurnInNext(next, employees, day, turn, jefeId = null) {
  let c = 0;
  for (const emp of employees) {
    if (jefeId && emp.id === jefeId) continue; // excluye jefa
    const ct = next[`${emp.id}-${day}`];
    if (turn === "TM" && ["TM","EARLY","LATE"].includes(ct)) c++;
    else if (turn === "TT" && ct === "TT") c++;
    else if (turn === "TN" && ct === "TN") c++;
  }
  return c;
}

const canCoverOtherTurn = (emp) => emp.reduction === 0 && emp.regime !== "H24";

function autoFillAll(employees, schedule, dayInfo, daysInMonth, getTarget, getEarlyHs, getLateHs, getReducedDailyHs = () => null, jefeId = null, larDays = new Set(), pmpIds = new Set()) {
  const next = { ...schedule };
  const original = { ...schedule };
  const byTurn = { TM: [], TT: [], TN: [] };
  // La jefa se excluye del staff operativo — tiene su propio cronograma pero no cuenta como cobertura
  // PMP incluidos en byTurn para generar su cronograma, pero excluidos de conteos de cobertura
  for (const emp of employees) if (byTurn[emp.turn] && emp.id !== jefeId) byTurn[emp.turn].push(emp);
  // Separar PMP para referencia
  const pmpEmpsArr = employees.filter(e => pmpIds.has(e.id));
  // Generar cronograma de la jefa por separado (mismas reglas de horas, sin afectar cobertura)
  const jefeEmpArr = jefeId ? employees.filter(e => e.id === jefeId) : [];

  // Una celda está bloqueada si tiene FE, LIC o LAR — nunca se pisa
  const blocked = (empId, day) => {
    const v = original[`${empId}-${day}`];
    return v != null && v !== "";
  };

  // Días protegidos: fines de semana asignados, no se trabajan ni se pisan
  const protectedDays = new Map();
  for (const emp of employees) protectedDays.set(emp.id, new Set());
  const protect     = (empId, day) => protectedDays.get(empId).add(day);
  const isProtected = (empId, day) => protectedDays.get(empId)?.has(day);

  // Solo escribe si no está bloqueado
  const setFranco = (empId, day) => { if (!blocked(empId, day)) next[`${empId}-${day}`] = "F"; };
  const setTurno  = (empId, day, t) => { if (!blocked(empId, day) && !isProtected(empId, day)) next[`${empId}-${day}`] = t; };

  // ── Pares sáb+dom del mes ──
  const weekendPairs = [];
  for (const d of dayInfo) {
    if (d.isSat) {
      const sun = dayInfo.find(x => x.day === d.day + 1 && x.isSunday);
      if (sun) weekendPairs.push({ sat: d.day, sun: sun.day });
    }
  }
  const allSats = dayInfo.filter(d => d.isSat).map(d => d.day);
  const allSuns = dayInfo.filter(d => d.isSunday).map(d => d.day);

  // Índices de rotación distribuida por turno
  const pairIdxByTurn = { TM: 0, TT: 0, TN: 0 };
  const satIdxByTurn  = { TM: 0, TT: 0, TN: 0 };
  const sunIdxByTurn  = { TM: 0, TT: 0, TN: 0 };

  // Pre-calcular offset por empleado para distribuir a lo largo del mes
  const empPairOffset = new Map();
  const empSatOffset  = new Map();
  const empSunOffset  = new Map();
  for (const turn of ["TM", "TT", "TN"]) {
    const emps = employees.filter(e => e.turn === turn);
    emps.forEach((emp, idx) => {
      empPairOffset.set(emp.id, idx);
      empSatOffset.set(emp.id,  idx);
      empSunOffset.set(emp.id,  idx);
    });
  }
  // ═══════════════════════════════════════════════════════════════
  // PASO 1 — Asignar francos de fin de semana
  // Regla: exactamente 1 finde completo (sáb+dom juntos) +
  //        1 sábado suelto (en semana diferente al finde) +
  //        1 domingo suelto (que NO sea adyacente a ningún sábado libre)
  // ═══════════════════════════════════════════════════════════════
  employees.forEach((emp) => {
    const turn = emp.turn;

   // — 1a. Finde completo (exactamente 1) —
// ── 1a. Finde completo (exactamente 1) ──
    // "Libre" = F, FE o vacío. FE cuenta como libre porque ya es franco.
    // Si ya tiene ≥1 finde completo preexistente → el primero es el oficial.
    // Si tiene >1 → los sáb/dom extras se convierten a turno (salvo FE, intocable).
    // Si no tiene ninguno → se asigna exactamente 1.
    let findePar = null;

// Solo cuenta como libre preexistente si fue cargado explícitamente (F o FE)
    // Una celda vacía NO cuenta como finde preexistente
    const isFreeOrFE = (empId, day) => {
      const v = next[`${empId}-${day}`];
      return v === "F" || v === "FE";
    };
    
    const isFEOnly = (empId, day) => next[`${empId}-${day}`] === "FE";

    const findesPreexistentes = weekendPairs.filter(p =>
      isFreeOrFE(emp.id, p.sat) && isFreeOrFE(emp.id, p.sun)
    );

    if (findesPreexistentes.length >= 1) {
      // El primero es el finde oficial → proteger
      findePar = findesPreexistentes[0];
      protect(emp.id, findePar.sat);
      protect(emp.id, findePar.sun);

      // Si hay más de uno → forzar los extras a turno (salvo FE intocable)
      for (let i = 1; i < findesPreexistentes.length; i++) {
        const extra = findesPreexistentes[i];
        if (!isFEOnly(emp.id, extra.sat) && !blocked(emp.id, extra.sat))
          next[`${emp.id}-${extra.sat}`] = turn;
        if (!isFEOnly(emp.id, extra.sun) && !blocked(emp.id, extra.sun))
          next[`${emp.id}-${extra.sun}`] = turn;
      }
    } else {
      // Sin finde preexistente → asignar exactamente 1
      const validos = weekendPairs.filter(p =>
        !blocked(emp.id, p.sat) && !blocked(emp.id, p.sun)
      );
      if (validos.length > 0) {
        const empIdxInTurn = Math.max(0, byTurn[turn].indexOf(emp));
        const totalInTurn  = Math.max(1, byTurn[turn].length);
        const pairIdx = Math.floor(empIdxInTurn * validos.length / totalInTurn);
        findePar = validos[Math.abs(pairIdx) % validos.length];
        pairIdxByTurn[turn]++;
        setFranco(emp.id, findePar.sat);
        setFranco(emp.id, findePar.sun);
        protect(emp.id, findePar.sat);
        protect(emp.id, findePar.sun);
      }
    }

    // — 1b. Sábado suelto (distinto al sáb del finde) —
    const satLibres = [findePar?.sat].filter(Boolean); // sábs ya libres
    const satPool = allSats.filter(s => s !== findePar?.sat && !blocked(emp.id, s));
    let satSuelto = null;
    if (satPool.length > 0) {
       const satIdx = (empSatOffset.get(emp.id) ?? 0) + 1; // +1 para no coincidir con el finde
      satSuelto = satPool[satIdx % satPool.length];
      satIdxByTurn[turn]++;
      setFranco(emp.id, satSuelto);
      protect(emp.id, satSuelto);
      satLibres.push(satSuelto);
    }

    // — 1c. Domingo suelto —
    // RESTRICCIÓN DURA: el dom suelto no puede ser el día siguiente a NINGÚN sábado libre
    // (eso formaría un segundo finde completo sáb+dom)
    const sunPool = allSuns.filter(s => {
      if (s === findePar?.sun) return false;   // ya usado
      if (blocked(emp.id, s)) return false;    // LIC / FE
      // Si este domingo es el día siguiente a cualquier sábado libre → descartado
      for (const sat of satLibres) {
        if (s === sat + 1) return false;
      }
      return true;
    });
    if (sunPool.length > 0) {
      const sunIdx = (empSunOffset.get(emp.id) ?? 0) + 2; // +2 para separar del finde y el sáb
      const domSuelto = sunPool[sunIdx % sunPool.length];
      sunIdxByTurn[turn]++;
      setFranco(emp.id, domSuelto);
      protect(emp.id, domSuelto);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // PASO 1b — Bloques festivos (feriado pegado a sáb/dom)
  // Cuando hay 3-4 días consecutivos de feriado+finde, distribuir
  // los francos en mitades rotativas: cada empleado descansa ~la
  // mitad del bloque y trabaja la otra, rotando por posición.
  // Nunca toca celdas bloqueadas (LIC/FE/LAR) ni días protegidos
  // del finde oficial asignado en el PASO 1.
  // ═══════════════════════════════════════════════════════════════
  (() => {
    // — Detectar bloques: secuencias contiguas de días feriado y/o finde —
    const festiveBlocks = [];
    let i = 0;
    while (i < dayInfo.length) {
      const d = dayInfo[i];
      if (d.isHoliday || d.isWeekend) {
        const block = [d];
        let j = i + 1;
        while (j < dayInfo.length && (dayInfo[j].isHoliday || dayInfo[j].isWeekend)) {
          block.push(dayInfo[j]);
          j++;
        }
        // Solo bloques de 3+ días que mezclen feriado y finde
        const hasHol     = block.some(x => x.isHoliday);
        const hasWeekend = block.some(x => x.isWeekend);
        if (block.length >= 3 && hasHol && hasWeekend) {
          festiveBlocks.push(block);
        }
        i = j;
      } else {
        i++;
      }
    }

    if (festiveBlocks.length === 0) return;

    for (const block of festiveBlocks) {
      const blockDays = block.map(d => d.day);
      // Cada empleado descansa la mitad (redondeando arriba)
      const half = Math.ceil(block.length / 2);

      for (const turn of ["TM", "TT", "TN"]) {
        const emps = byTurn[turn];
        if (!emps.length) continue;

        emps.forEach((emp, empIdx) => {
          // Días del bloque disponibles para este empleado
          const available = blockDays.filter(day =>
            !blocked(emp.id, day) && !isProtected(emp.id, day)
          );
          if (available.length === 0) return;

          // Rotación: cada empleado arranca desde un punto distinto
          // para que la cobertura quede distribuida entre el equipo
          const offset  = empIdx % available.length;
          const daysOff = new Set();
          for (let k = 0; k < half && k < available.length; k++) {
            daysOff.add(available[(offset + k) % available.length]);
          }

          for (const day of available) {
            const cur = next[`${emp.id}-${day}`];
            if (daysOff.has(day)) {
              // Asignar franco solo si la celda es F o estaba vacía
              if (!cur || cur === "F") {
                setFranco(emp.id, day);
              }
            } else {
              // Asignar turno solo si la celda es F o estaba vacía
              if (!cur || cur === "F") {
                setTurno(emp.id, day, turn);
              }
            }
          }
        });
      }
    }
  })();

  // ═══════════════════════════════════════════════════════════════
  // PASO 2 — Inicializar celdas vacías como franco y asignar turnos
  // ═══════════════════════════════════════════════════════════════
  for (const turn of ["TM", "TT", "TN"]) {
    byTurn[turn].forEach((emp, empIdx) => {
      const target  = getTarget(emp);
      const tHoursBase = CELL_TYPES[turn].hours;
      const reducedDailyHs = getReducedDailyHs(emp);
      const tHours = reducedDailyHs !== null ? reducedDailyHs : tHoursBase;

      // Rellenar vacíos con franco (sin pisar LIC/FE ni protegidos)
      for (const d of dayInfo) {
        const k = `${emp.id}-${d.day}`;
        if (!next[k]) next[k] = "F";
      }

      // Días donde se puede trabajar: no bloqueados, no protegidos
      const available = dayInfo
        .filter(d => !blocked(emp.id, d.day) && !isProtected(emp.id, d.day))
        .map(d => d.day)
        .sort((a, b) => a - b);

      // Horas ya fijadas (LIC, FE, EARLY, LATE, LAR pre-existentes)
     // ── Fórmula limpia: guardias = carga horaria mensual / hs por turno ──
        // TM y TT → target / 7    |    TN → target / 10
        // Las horas ya fijas (EARLY, LATE, LIC, LAR pre-cargados) se descuentan
        const horasFijas = Object.entries(next)
          .filter(([k]) => k.startsWith(`${emp.id}-`))
          .reduce((acc, [, v]) => {
            if (v === "EARLY") return acc + getEarlyHs(emp);
            if (v === "LATE")  return acc + getLateHs(emp);
            if (v === "LIC" || v === "LAR" || v === "FE") return acc; // 0 hs
            if (isWorkShift(v)) return acc + tHours;
            return acc;
          }, 0);

        // Guardias exactas a trabajar = (carga horaria - ya fijas) / hs diarias
        const totalGuardias = Math.round(target / tHours);          // ej: 144/7 = 21
        const guardiasYaFijas = Math.round(horasFijas / tHours);    // EARLY/LATE ya contados
        const needed = Math.max(0, totalGuardias - guardiasYaFijas);
      if (needed === 0 || available.length === 0) return;

      const effectiveNeeded = Math.min(needed, available.length);
      const maxConsec = maxConsecForEmp(emp);
      const toWork = new Set();

      if (turn === "TN") {
        // ── Patrón TN: N N F F … (prioridad), sino N N F ──
        // Respeta celdas bloqueadas/protegidas: si un día no está disponible
        // se salta en el patrón pero se mantiene el ritmo.
        let workStreak = 0;   // noches consecutivas asignadas
        let francoStreak = 0; // francos consecutivos del patrón
        const WORK_BLOCK  = 2;
        const FRANCO_PREF = 2; // preferido
        const FRANCO_MIN  = 1; // mínimo si no alcanza

        // Fase 1: intentar N N F F
        let phase = "work"; // "work" | "franco"
        let wCount = 0, fCount = 0;
        for (const d of available) {
          if (toWork.size >= effectiveNeeded) break;
          // Si el día está bloqueado (puesto por usuario), lo tratamos como franco de corte
          if (blocked(emp.id, d) || isProtected(emp.id, d)) {
            // cuenta como corte si estábamos en racha de trabajo
            if (phase === "work") { phase = "franco"; fCount = 1; wCount = 0; }
            else { fCount++; if (fCount >= FRANCO_PREF) { phase = "work"; wCount = 0; fCount = 0; } }
            continue;
          }
          if (phase === "work") {
            toWork.add(d); wCount++;
            if (wCount >= WORK_BLOCK) { phase = "franco"; fCount = 0; wCount = 0; }
          } else {
            fCount++;
            if (fCount >= FRANCO_PREF) { phase = "work"; wCount = 0; fCount = 0; }
          }
        }

        // Fase 2: si faltan días de trabajo, relajar a N N F
        if (toWork.size < effectiveNeeded) {
          toWork.clear();
          phase = "work"; wCount = 0; fCount = 0;
          for (const d of available) {
            if (toWork.size >= effectiveNeeded) break;
            if (blocked(emp.id, d) || isProtected(emp.id, d)) {
              if (phase === "work") { phase = "franco"; fCount = 1; wCount = 0; }
              else { fCount++; if (fCount >= FRANCO_MIN) { phase = "work"; wCount = 0; fCount = 0; } }
              continue;
            }
            if (phase === "work") {
              toWork.add(d); wCount++;
              if (wCount >= WORK_BLOCK) { phase = "franco"; fCount = 0; wCount = 0; }
            } else {
              fCount++;
              if (fCount >= FRANCO_MIN) { phase = "work"; wCount = 0; fCount = 0; }
            }
          }
        }

        // Fallback final si aún faltan
        if (toWork.size < effectiveNeeded) {
          for (const d of available) {
            if (toWork.size >= effectiveNeeded) break;
            if (!toWork.has(d)) toWork.add(d);
          }
        }
      } else {
        // ── TM / TT: secuencial con corte obligatorio al llegar a maxConsec ──
        // Recorre todos los días del mes en orden, respetando:
        //  - Días no disponibles (bloqueados/protegidos) cuentan como franco si no son turno
        //  - Al llegar a maxConsec consecutivos, el siguiente disponible es OBLIGATORIAMENTE franco
        //  - Cualquier franco (usuario o sistema) reinicia la racha
        const availSet = new Set(available);
        let streak = 0;        // racha de trabajo actual
        let remaining = effectiveNeeded;

        for (let d = 1; d <= daysInMonth && remaining > 0; d++) {
          const v = next[`${emp.id}-${d}`];
          if (!availSet.has(d)) {
            // Día no disponible: si es turno suma racha, si no la resetea
            if (isWorkShift(v)) streak++;
            else streak = 0;
            continue;
          }
          // Día disponible
          if (streak >= maxConsec) {
            // Corte obligatorio — deja como franco, resetea racha
            streak = 0;
          } else {
            toWork.add(d);
            streak++;
            remaining--;
          }
        }
        // Fallback: si faltan días (mes muy corto o restricciones muy estrictas)
        if (toWork.size < effectiveNeeded) {
          for (const d of available) {
            if (toWork.size >= effectiveNeeded) break;
            if (!toWork.has(d)) toWork.add(d);
          }
        }
      }

      for (const d of toWork) setTurno(emp.id, d, turn);
    });
  }

  // ── Generar cronograma de la jefa (sin afectar cobertura) ──
  for (const emp of jefeEmpArr) {
    const target  = getTarget(emp);
    const tHoursBase = CELL_TYPES[emp.turn]?.hours || 7;
    const reducedDailyHs = getReducedDailyHs(emp);
    const tHours = reducedDailyHs !== null ? reducedDailyHs : tHoursBase;

    for (const d of dayInfo) {
      const k = `${emp.id}-${d.day}`;
      if (!next[k]) next[k] = "F";
    }

    const available = dayInfo
      .filter(d => !blocked(emp.id, d.day) && !isProtected(emp.id, d.day))
      .map(d => d.day).sort((a, b) => a - b);

    const horasFijas = Object.entries(next)
      .filter(([k]) => k.startsWith(`${emp.id}-`))
      .reduce((acc, [, v]) => {
        if (v === "EARLY") return acc + getEarlyHs(emp);
        if (v === "LATE")  return acc + getLateHs(emp);
        if (v === "LIC" || v === "LAR" || v === "FE") return acc;
        if (isWorkShift(v)) return acc + tHours;
        return acc;
      }, 0);

    const totalGuardias = Math.round(target / tHours);
    const guardiasYaFijas = Math.round(horasFijas / tHours);
    const needed = Math.max(0, totalGuardias - guardiasYaFijas);
    const effectiveNeeded = Math.min(needed, available.length);
    if (effectiveNeeded === 0) continue;

    const maxConsec = maxConsecForEmp(emp);
    const toWork = new Set();
    const availSet = new Set(available);
    let streak = 0, remaining = effectiveNeeded;

    for (let d = 1; d <= daysInMonth && remaining > 0; d++) {
      const v = next[`${emp.id}-${d}`];
      if (!availSet.has(d)) { isWorkShift(v) ? streak++ : (streak = 0); continue; }
      if (streak >= maxConsec) { streak = 0; }
      else { toWork.add(d); streak++; remaining--; }
    }
    if (toWork.size < effectiveNeeded) {
      for (const d of available) { if (toWork.size >= effectiveNeeded) break; if (!toWork.has(d)) toWork.add(d); }
    }
    for (const d of toWork) setTurno(emp.id, d, emp.turn);
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 3 — Garantizar mínimo 4 por turno por día
  // RESTRICCIÓN: solo se puede mover a alguien si ese día NO es
  // un día protegido (finde/suelto) → así no se rompe la regla del finde único
  // ═══════════════════════════════════════════════════════════════
  let changed = true, passes = 0;
  while (changed && passes < 15) {
    changed = false; passes++;
    for (const di of dayInfo) {
      for (const turn of ["TM", "TT", "TN"]) {
        let current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
        if (current >= 4) continue;

        const propios = byTurn[turn]
          .filter(emp => {
            const tH = CELL_TYPES[emp.turn]?.hours || 7;
            const wH = workedHours(next, emp.id, daysInMonth, getEarlyHs(emp), getLateHs(emp), [], getReducedDailyHs(emp));
            return (
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day) &&          // ← respeta fin de semana
              consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp) &&
              wH + tH <= getTarget(emp) + tH           // no superar objetivo + 1 turno de margen
            );
          })
          .sort((a, b) =>
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
            workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
          );
        for (let i = 0; i < (4 - current) && i < propios.length; i++) {
          next[`${propios[i].id}-${di.day}`] = turn; changed = true;
        }

        current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
        if (current >= 4) continue;

        const foraneos = employees
          .filter(emp => {
            const tH = CELL_TYPES[emp.turn]?.hours || 7;
            const wH = workedHours(next, emp.id, daysInMonth, getEarlyHs(emp), getLateHs(emp), [], getReducedDailyHs(emp));
            return (
              emp.turn !== turn &&
              canCoverOtherTurn(emp) &&
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day) &&          // ← respeta fin de semana
              consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp) &&
              wH + tH <= getTarget(emp) + tH            // no superar objetivo + 1 turno de margen
            );
          })
          .sort((a, b) =>
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
            workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
          );
        for (let i = 0; i < (4 - current) && i < foraneos.length; i++) {
          next[`${foraneos[i].id}-${di.day}`] = turn; changed = true;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 4 — Recortar exceso (máximo 8 por turno por día)
  // ═══════════════════════════════════════════════════════════════
  for (const di of dayInfo) {
    for (const turn of ["TM", "TT", "TN"]) {
      let current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
      if (current <= 8) continue;
      const sobrantes = byTurn[turn]
        .filter(emp =>
          next[`${emp.id}-${di.day}`] === turn &&
          !blocked(emp.id, di.day) &&
          !isProtected(emp.id, di.day)
        )
        .sort((a, b) =>
          workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b)) -
          workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a))
        );
      for (let i = 0; i < sobrantes.length && current > 8; i++) {
        if (current - 1 < 4) break;
        next[`${sobrantes[i].id}-${di.day}`] = "F";
        current--;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 5 — Recortar horas individuales con exceso
  // ═══════════════════════════════════════════════════════════════
  for (const emp of employees) {
    const target = getTarget(emp);
    const tHours = CELL_TYPES[emp.turn]?.hours || 7;
    let worked = workedHours(next, emp.id, daysInMonth, getEarlyHs(emp), getLateHs(emp), [], getReducedDailyHs(emp));
    if (worked <= target) continue;

    const workDays = dayInfo
      .filter(di =>
        isWorkShift(next[`${emp.id}-${di.day}`]) &&
        !blocked(emp.id, di.day) &&
        !isProtected(emp.id, di.day)
      )
      .sort((a, b) =>
        countPerTurnInNext(next, employees, b.day, emp.turn, jefeId) -
        countPerTurnInNext(next, employees, a.day, emp.turn, jefeId)
      );
    for (const di of workDays) {
      if (worked <= target + tHours) break;
      if (countPerTurnInNext(next, employees, di.day, emp.turn) <= 4) continue;
      next[`${emp.id}-${di.day}`] = "F";
      worked -= tHours;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 5b — Forzar cumplimiento de carga horaria
  // Si el empleado está bajo su objetivo, convierte F→turno
  // en días libres que NO sean el finde protegido, sáb/dom sueltos
  // ni FE/LIC/LAR. Solo esos son inamovibles.
  // ═══════════════════════════════════════════════════════════════
  for (const emp of employees) {
    const target = getTarget(emp);
    const tHours = CELL_TYPES[emp.turn]?.hours || 7;
    let worked = workedHours(next, emp.id, daysInMonth, getEarlyHs(emp), getLateHs(emp), [], getReducedDailyHs(emp));
    if (worked >= target) continue;

    // Días con F convertibles — respeta solo bloqueados y protegidos
    const frankDays = dayInfo
      .filter(di =>
        next[`${emp.id}-${di.day}`] === "F" &&
        !blocked(emp.id, di.day) &&
        !isProtected(emp.id, di.day)
      )
      .sort((a, b) =>
        // Priorizar días donde hay menos gente del turno (equilibra cobertura)
        countPerTurnInNext(next, employees, a.day, emp.turn, jefeId) -
        countPerTurnInNext(next, employees, b.day, emp.turn, jefeId)
      );

    for (const di of frankDays) {
      if (worked >= target) break;
      next[`${emp.id}-${di.day}`] = emp.turn;
      worked += tHours;
    }
  }
// ═══════════════════════════════════════════════════════════════
  // PASO 6 — Romper cadenas de más de 3 francos consecutivos
  // Solo convierte celdas "F" puras (nunca LIC, FE, LAR).
  // ═══════════════════════════════════════════════════════════════
  let francoChanged = true;
  let francoPasses  = 0;
  while (francoChanged && francoPasses < 15) {
    francoChanged = false;
    francoPasses++;
    for (const emp of employees) {
      let streak     = 0;
      let streakDays = [];

      const flushStreak = () => {
        if (streak > MAX_CONSEC_FRANCO) {
          const convertible = streakDays.filter(d =>
            next[`${emp.id}-${d}`] === "F" &&
            !blocked(emp.id, d) &&
            !isProtected(emp.id, d)
          );
          if (convertible.length > 0) {
            const pick = convertible.slice().sort((a, b) =>
              countPerTurnInNext(next, employees, a, emp.turn, jefeId) -
              countPerTurnInNext(next, employees, b, emp.turn, jefeId)
            )[0];
            next[`${emp.id}-${pick}`] = emp.turn;
            francoChanged = true;
          }
        }
        streak     = 0;
        streakDays = [];
      };

      for (let d = 1; d <= daysInMonth; d++) {
        const v     = next[`${emp.id}-${d}`];
        const isOff = !isWorkShift(v);
        if (isOff) { streak++; streakDays.push(d); }
        else { flushStreak(); }
      }
      flushStreak();
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // PASO 6b — Franco obligatorio antes de cada día LAR
  // Si el día anterior a un LAR es un turno de trabajo y no está
  // bloqueado por el usuario, se convierte a franco.
  // ═══════════════════════════════════════════════════════════════
  for (const emp of employees) {
    for (let d = 2; d <= daysInMonth; d++) {
      const kLar = `${emp.id}-${d}`;
      if (!larDays.has(kLar)) continue;          // día d no es LAR
      const kPrev = `${emp.id}-${d - 1}`;
      const vPrev = next[kPrev];
      // Si el día anterior es turno de trabajo y no está bloqueado → franco
      if (isWorkShift(vPrev) && !blocked(emp.id, d - 1) && !isProtected(emp.id, d - 1)) {
        next[kPrev] = "F";
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 7 — Enforcement estricto de horas por empleado
  // Si un empleado tiene más horas que su objetivo, elimina días de
  // trabajo (de los más staffeados primero) hasta llegar al objetivo.
  // No respeta el mínimo de 4 por turno — la prioridad es cumplir
  // las horas del régimen.
  // ═══════════════════════════════════════════════════════════════
  for (const emp of employees) {
    const target = getTarget(emp);
    const tHours = CELL_TYPES[emp.turn]?.hours || 7;
    let worked = workedHours(next, emp.id, daysInMonth, getEarlyHs(emp), getLateHs(emp), [], getReducedDailyHs(emp));
    if (worked <= target) continue;

    const workDays = dayInfo
      .filter(di =>
        isWorkShift(next[`${emp.id}-${di.day}`]) &&
        !blocked(emp.id, di.day) &&
        !isProtected(emp.id, di.day)
      )
      .sort((a, b) =>
        // Primero los días con más gente trabajando (menor impacto al sacarla)
        countPerTurnInNext(next, employees, b.day, emp.turn) -
        countPerTurnInNext(next, employees, a.day, emp.turn)
      );

    for (const di of workDays) {
      if (worked <= target) break;
      next[`${emp.id}-${di.day}`] = "F";
      worked -= tHours;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 8 — Cobertura mínima cuando hay francos pre-bloqueados
  // Respeta maxConsec para no crear tiradas largas de trabajo.
  // ═══════════════════════════════════════════════════════════════
  for (const di of dayInfo) {
    for (const turn of ["TM", "TT", "TN"]) {
      let current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
      if (current >= 4) continue;

      const blockedFrancosCount = (byTurn[turn] || []).filter(emp => {
        const orig = original[`${emp.id}-${di.day}`];
        return orig === "F" || orig === "FE" || orig === "LAR" || orig === "LIC" || orig === "PMP";
      }).length;

      if (blockedFrancosCount === 0) continue;

      const candidates = (byTurn[turn] || [])
        .filter(emp =>
          next[`${emp.id}-${di.day}`] === "F" &&
          !blocked(emp.id, di.day) &&
          !isProtected(emp.id, di.day) &&
          consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp)
        )
        .sort((a, b) =>
          workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
          workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
        );

      for (const emp of candidates) {
        if (current >= 4) break;
        next[`${emp.id}-${di.day}`] = turn;
        current++;
      }

      if (current < 4) {
        const foraneos = employees
          .filter(emp =>
            emp.turn !== turn &&
            emp.id !== jefeId &&
            canCoverOtherTurn(emp) &&
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) &&
            !isProtected(emp.id, di.day) &&
            consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp)
          )
          .sort((a, b) =>
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
            workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
          );
        for (const emp of foraneos) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn;
          current++;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 9 — Enforcement ABSOLUTO de rachas máximas
  // Rompe cualquier racha > maxConsec convirtiendo el día que la
  // supera en franco. Esto corre DESPUÉS de todos los ajustes.
  // ═══════════════════════════════════════════════════════════════
  for (const emp of employees) {
    if (emp.id === jefeId || pmpIds.has(emp.id)) continue;
    const maxC = maxConsecForEmp(emp);
    let streak = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const k = `${emp.id}-${d}`;
      const v = next[k];

      if (isWorkShift(v)) {
        streak++;
        // Si la racha supera el máximo Y el día no está bloqueado → forzar franco
        if (streak > maxC && !blocked(emp.id, d) && !isProtected(emp.id, d)) {
          next[k] = "F";
          streak = 0; // reiniciar racha desde este franco forzado
        }
      } else {
        streak = 0;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 10 — Cobertura mínima 4 usando personal de otro turno
  // Si un turno no llega a 4 con sus propios empleados, incorpora
  // personal de otros turnos (TM↔TT↔TN) hasta completar 4.
  // ═══════════════════════════════════════════════════════════════
  for (const di of dayInfo) {
    for (const turn of ["TM", "TT", "TN"]) {
      let current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
      if (current >= 4) continue;

      // 1. Usar propios del turno que estén de franco (no bloqueados)
      const ownFrancos = (byTurn[turn] || [])
        .filter(emp =>
          next[`${emp.id}-${di.day}`] === "F" &&
          !blocked(emp.id, di.day) &&
          !isProtected(emp.id, di.day) &&
          consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp)
        )
        .sort((a, b) =>
          workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
          workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
        );
      for (const emp of ownFrancos) {
        if (current >= 4) break;
        next[`${emp.id}-${di.day}`] = turn;
        current++;
      }

      // 2. Si aún faltan, usar de otros turnos
      if (current < 4) {
        const otherTurns = employees
          .filter(emp =>
            emp.turn !== turn &&
            emp.id !== jefeId &&
            !pmpIds.has(emp.id) &&
            canCoverOtherTurn(emp) &&
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) &&
            !isProtected(emp.id, di.day) &&
            consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp)
          )
          .sort((a, b) =>
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
            workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
          );
        for (const emp of otherTurns) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn;
          current++;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════
  // PASO 11 — ESCANEO FINAL: cumplimiento de todas las reglas
  //
  // Reglas por turno:
  //   TN  → patrón N N F F (máx 2 noches, máx 2 francos)
  //   TM/TT R27 → máx 4 trabajo, máx 2 francos
  //   TM/TT R15 → máx 6 trabajo, máx 2 francos
  //
  // Múltiples pasadas hasta que no haya violaciones.
  // ═══════════════════════════════════════════════════════════════
  let p11Changed = true;
  let p11Passes = 0;
  while (p11Changed && p11Passes < 15) {
    p11Changed = false;
    p11Passes++;

    for (const emp of employees) {
      if (emp.id === jefeId || pmpIds.has(emp.id)) continue;
      const maxWork = maxConsecForEmp(emp);   // TN=2, R27=4, R15=6
      const maxFranco = 2;                    // nunca más de 2 francos seguidos
      const tHours = CELL_TYPES[emp.turn]?.hours || 7;

      let workStreak = 0;
      let francoStreak = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const k = `${emp.id}-${d}`;
        const v = next[k];
        const isBl = blocked(emp.id, d);
        const isPr = isProtected(emp.id, d);

        if (isWorkShift(v)) {
          francoStreak = 0;
          workStreak++;

          // ── Violación: demasiados trabajos seguidos ──
          if (workStreak > maxWork && !isBl) {
            next[k] = "F";
            workStreak = 0;
            p11Changed = true;
          }

        } else if (v === "F") {
          workStreak = 0;
          francoStreak++;

          // ── Violación: demasiados francos seguidos ──
          if (francoStreak > maxFranco && !isBl && !isPr) {
            const worked = workedHours(next, emp.id, daysInMonth, getEarlyHs(emp), getLateHs(emp), [], getReducedDailyHs(emp));
            const target = getTarget(emp);
            // Solo convertir a trabajo si no supera el objetivo
            if (worked < target) {
              next[k] = emp.turn;
              workStreak = 1;
              francoStreak = 0;
              p11Changed = true;
            }
          }

        } else {
          // LIC, LAR, FE, PMP, etc → resetea ambas rachas (no cuentan)
          workStreak = 0;
          francoStreak = 0;
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 12 — Garantía ABSOLUTA de mínimo 4 por turno por día
  // Intenta primero respetando rachas. Si no alcanza, usa cualquier
  // empleado disponible sin importar la racha (cobertura es prioridad).
  // ═══════════════════════════════════════════════════════════════
  for (const di of dayInfo) {
    for (const turn of ["TM", "TT", "TN"]) {
      let current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
      if (current >= 4) continue;

      // Ronda 1: propios respetando racha
      const propios = (byTurn[turn] || [])
        .filter(emp =>
          next[`${emp.id}-${di.day}`] === "F" &&
          !blocked(emp.id, di.day) &&
          !isProtected(emp.id, di.day) &&
          consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp)
        )
        .sort((a, b) =>
          workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
          workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
        );
      for (const emp of propios) {
        if (current >= 4) break;
        next[`${emp.id}-${di.day}`] = turn; current++;
      }

      // Ronda 2: foráneos respetando racha
      if (current < 4) {
        const foraneos = employees
          .filter(emp =>
            emp.turn !== turn && emp.id !== jefeId && !pmpIds.has(emp.id) &&
            canCoverOtherTurn(emp) &&
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) && !isProtected(emp.id, di.day) &&
            consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp)
          )
          .sort((a, b) =>
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
            workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
          );
        for (const emp of foraneos) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn; current++;
        }
      }

      // Ronda 3 (forzada): propios SIN respetar racha — cobertura mínima es obligatoria
      if (current < 4) {
        const forzados = (byTurn[turn] || [])
          .filter(emp =>
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) && !isProtected(emp.id, di.day)
          )
          .sort((a, b) =>
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
            workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
          );
        for (const emp of forzados) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn; current++;
        }
      }

      // Ronda 4 (última): cualquier empleado disponible de cualquier turno
      if (current < 4) {
        const cualquiera = employees
          .filter(emp =>
            emp.id !== jefeId && !pmpIds.has(emp.id) &&
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) && !isProtected(emp.id, di.day)
          )
          .sort((a, b) =>
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a), [], getReducedDailyHs(a)) -
            workedHours(next, b.id, daysInMonth, getEarlyHs(b), getLateHs(b), [], getReducedDailyHs(b))
          );
        for (const emp of cualquiera) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn; current++;
        }
      }
    }
  }

  return next;
}

const isFrancoOrEmpty = v => !v || v === "F" || v === "---";

function calcFrancoWeekendPair(empId, d, schedule, dayInfo) {
  const isFreeOrFE = (empId, day) => {
    const v = schedule[`${empId}-${day}`];
    return !v || v === "F" || v === "FE" || v === "---";
  };
  if (d.isSat) {
    const nextDay = dayInfo.find(x => x.day === d.day + 1);
    if (!nextDay || !nextDay.isSunday) return false;
    return isFreeOrFE(empId, d.day) && isFreeOrFE(empId, nextDay.day);
  }
  if (d.isSunday) {
    if (d.day === 1) return false;
    const prevDay = dayInfo.find(x => x.day === d.day - 1);
    if (!prevDay || !prevDay.isSat) return false;
    return isFreeOrFE(empId, prevDay.day) && isFreeOrFE(empId, d.day);
  }
  return false;
}

function CellContextMenu({ empId, day, current, onSelect, children, empTurn = "TM", customCellTypes = [] }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ x: 0, y: 0 });
  const menuRef = useRef();
  const tl = TURN_LABEL[empTurn] ?? "M";
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const allTypes = [
    ...Object.entries(CELL_TYPES).map(([k, v]) => ({
      key: k, bg: v.bg, fg: v.fg,
      label: k === "EARLY" ? tl : k === "LATE" ? tl : v.label,
      desc: k==="TM"?"07:00–14:00":k==="TT"?"14:00–21:00":k==="TN"?"21:00–07:00":k==="F"?"Franco":k==="FE"?"Franco Especial":k==="LIC"?"Licencia":k==="LAR"?"Largo":k==="PM"?"PM":k==="EARLY"?"Sale antes (rosado)":k==="LATE"?"Sale después (verde)":"Vacío",
      isCustom: false, isFE: k === "FE",
    })),
    ...customCellTypes.map(c => ({
      key: c.key, bg: c.bg, fg: c.fg, label: c.label,
      desc: c.desc || c.label, isCustom: true, isFE: false,
    })),
  ];

  return (
    <div onContextMenu={e => { e.preventDefault(); setPos({ x: e.clientX, y: e.clientY }); setOpen(true); }}>
      {children}
      {open && (
        <div ref={menuRef} style={{ position:"fixed", top:pos.y, left:pos.x, zIndex:9999, background:"#fff", border:"1px solid #cbd5e1", borderRadius:8, padding:6, display:"flex", flexDirection:"column", gap:3, boxShadow:"0 8px 32px rgba(0,0,0,.75)", minWidth:230 }}>
          {allTypes.map(({key, bg, fg, label, desc, isCustom, isFE}) => (
            <button key={key} onClick={() => { onSelect(key); setOpen(false); }} style={{ background:current===key?"#f1f5f9":bg, color:fg, border:isCustom?"1px solid "+fg:"none", borderRadius:5, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:700, textAlign:"left", opacity:current===key?0.5:1, fontFamily:isFE?"'Georgia',serif":"'Barlow Condensed',sans-serif", letterSpacing:".5px", display:"flex", justifyContent:"space-between", gap:10 }}>
              <span style={{ fontStyle:isFE?"italic":"normal" }}>{label}</span>
              <span style={{ fontSize:10, fontWeight:400, opacity:.7 }}>{desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

  const getLARDivisor = (year, month) => {
  // Febrero = 28, resto = 30
  return month === 1 ? 28 : 30;
};

function loadSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}
function calcGuardiaHospitalaria(schedule, emp, dayInfo, daysInMonth) {
  let total = 0;
  for (const d of dayInfo) {
    const ct = schedule[`${emp.id}-${d.day}`];
    if (!isWorkShift(ct)) continue;

    const esTurnoTrabajo = ct === emp.turn || ct === "EARLY" || ct === "LATE";
    if (!esTurnoTrabajo) continue;

    const hs = CELL_TYPES[emp.turn]?.hours || 7;

    if (emp.turn === "TM") {
      // Sábado mañana NO cuenta, domingo y feriado SÍ
      if (d.isSunday || d.isHoliday) total += hs;
    } else {
      // TT y TN: sábado, domingo y feriado cuentan
      if (d.isSat || d.isSunday || d.isHoliday) total += hs;
    }
  }
  return total;
} 
export default function HospitalScheduler({ currentUser, onLogout }) {
  const now = new Date();
  const saved = useMemo(() => loadSavedData(), []);

  const [year,       setYear]       = useState(saved?.year       ?? now.getFullYear());
  const [month,      setMonth]      = useState(saved?.month      ?? now.getMonth());
  const [employees,  setEmployees]  = useState(saved?.employees  ?? INITIAL_EMPLOYEES);
  const [schedule,   setSchedule]   = useState(saved?.schedule   ?? {});
  const [larDays, setLarDays] = useState(() => new Set(saved?.larDays ?? []));
  const [holidays,   setHolidays]   = useState(saved?.holidays   ?? []);
  const [tab,        setTab]        = useState("schedule");
  const [filterTurn, setFilterTurn] = useState("ALL");
  const [filterEmpId,setFilterEmpId]= useState(null);
  const [service,    setService]    = useState(saved?.service    ?? "SIP 5");
  const [beds,       setBeds]       = useState(saved?.beds       ?? 30);
  const [newHoliday, setNewHoliday] = useState("");
  const [newEmp,     setNewEmp]     = useState({ name:"", regime:"R15", turn:"TM", reduction:0, note:"" });
  const [editEmpId,  setEditEmpId]  = useState(null);
  const [editData,   setEditData]   = useState({});
  const [showAlerts, setShowAlerts] = useState(true);
  const [hoursReady,    setHoursReady]    = useState(!!saved);
  const [hoursOverride, setHoursOverride] = useState(saved?.hoursOverride ?? {});
  const [bulkMode,     setBulkMode]     = useState(null);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [dragEmpId,  setDragEmpId]  = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [jefeId,     setJefeId]     = useState(saved?.jefeId ?? null);
  const [pmpIds,     setPmpIds]     = useState(() => new Set(saved?.pmpIds ?? []));

  const TURN_BASE_HOURS = { TM: 7, TT: 7, TN: 10 };
  const [earlyOffsets, setEarlyOffsets] = useState(saved?.earlyOffsets ?? { TM: 2, TT: 2, TN: 2 });
  const [lateOffsets,  setLateOffsets]  = useState(saved?.lateOffsets  ?? { TM: 2, TT: 2, TN: 2 });

  const earlyHsForEmp = useCallback((emp) => TURN_BASE_HOURS[emp.turn] - (earlyOffsets[emp.turn] ?? 2), [earlyOffsets]);
  const lateHsForEmp  = useCallback((emp) => TURN_BASE_HOURS[emp.turn] + (lateOffsets[emp.turn]  ?? 2), [lateOffsets]);
  const reducedDailyHsForEmp = useCallback((emp) => {
    const base = TURN_BASE_HOURS[emp.turn] || 7;
    if (!emp.reduction || emp.reduction === 0) return null;
    return Math.round(base * (1 - emp.reduction / 100) * 100) / 100;
  }, []);

  const earlyOffset = earlyOffsets.TM;
  const lateOffset  = lateOffsets.TM;
  const [savedOk,    setSavedOk]    = useState(false);

  const [customCellTypes, setCustomCellTypes] = useState(saved?.customCellTypes ?? []);
  const [newCustom, setNewCustom] = useState({ key:"", label:"", bg:"#e0f2fe", fg:"#0369a1", border:"#38bdf8", hours:0, desc:"" });

  const [regimeHours, setRegimeHours] = useState(saved?.regimeHours ?? { R15: 160, R27: 144, H24: 88 });
  const getRegimeHours = useCallback((key) => regimeHours[key] ?? REGIMES[key]?.hours ?? 160, [regimeHours]);

  const [history, setHistory] = useState([]);
  const pushHistory = useCallback((prevSchedule, prevLarDays) => {
  setHistory(h => [...h.slice(-29), { schedule: prevSchedule, larDays: [...prevLarDays] }]);
}, []);

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setSchedule(prev.schedule);
      setLarDays(new Set(prev.larDays ?? []));
      return h.slice(0, -1);
          });
  }, []);

  useEffect(() => {
    const handler = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  // ── Autosave: guarda automáticamente cada vez que cambia el estado ──
  useEffect(() => {
    const timer = setTimeout(() => {
      saveData({
        year, month, employees, schedule,
        larDays: [...larDays],
        holidays, service, beds, jefeId,
        pmpIds: [...pmpIds],
        earlyOffsets, lateOffsets,
        hoursOverride, customCellTypes, regimeHours
      });
    }, 800); // debounce 800ms para no guardar en cada keystroke
    return () => clearTimeout(timer);
  }, [year, month, employees, schedule, larDays, holidays, service, beds,
      jefeId, pmpIds, earlyOffsets, lateOffsets, hoursOverride, customCellTypes, regimeHours]);

  const gridRef        = useRef();
  const scrollbarRef   = useRef();
  const syncingGrid    = useRef(false);
  const syncingScroll  = useRef(false);

  useEffect(() => {
    const grid = gridRef.current;
    const bar  = scrollbarRef.current;
    if (!grid || !bar) return;
    const onGrid = () => { if (syncingGrid.current) return; syncingScroll.current = true; bar.scrollLeft = grid.scrollLeft; syncingScroll.current = false; };
    const onBar  = () => { if (syncingScroll.current) return; syncingGrid.current = true; grid.scrollLeft = bar.scrollLeft; syncingGrid.current = false; };
    grid.addEventListener("scroll", onGrid);
    bar.addEventListener("scroll", onBar);
    return () => { grid.removeEventListener("scroll", onGrid); bar.removeEventListener("scroll", onBar); };
  }, []);

  const handleDragStart = (empId) => setDragEmpId(empId);
  const handleDragOver  = (e, empId) => { e.preventDefault(); setDragOverId(empId); };
  const handleDrop      = (targetId) => {
    if (!dragEmpId || dragEmpId === targetId) { setDragEmpId(null); setDragOverId(null); return; }
    setEmployees(prev => {
      const arr = [...prev];
      const fromI = arr.findIndex(e => e.id === dragEmpId);
      const toI   = arr.findIndex(e => e.id === targetId);
      if (arr[fromI].turn !== arr[toI].turn) return prev;
      const [moved] = arr.splice(fromI, 1);
      arr.splice(toI, 0, moved);
      return arr;
    });
    setDragEmpId(null); setDragOverId(null);
  };
  const handleDragEnd = () => { setDragEmpId(null); setDragOverId(null); };

  // ✅ DESPUÉS — Mens. siempre muestra el régimen completo
const targetHours = (emp) => {
  if (hoursOverride[emp.id] !== undefined) return hoursOverride[emp.id];
  return calcTargetWithLAR(emp, year, month, holidays, larDays, daysInMonth, getRegimeHours);
};
  const daysInMonth = getDaysInMonth(year, month);

  const dayInfo = useMemo(() => {
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = getDow(year, month, d);
      arr.push({ day:d, dow, isSunday:dow===0, isSat:dow===6, isWeekend:dow===0||dow===6, isHoliday:holidays.includes(d) });
    }
    return arr;
  }, [year, month, daysInMonth, holidays]);

  const visibleEmps = useMemo(() => {
    let list = employees;
    if (filterEmpId) list = list.filter(e => e.id === filterEmpId);
    else if (filterTurn !== "ALL") list = list.filter(e => e.turn === filterTurn);
    return list;
  }, [employees, filterTurn, filterEmpId]);

  const alerts = useMemo(() => {
    const out = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const di = dayInfo[d - 1];
      const c  = countPerTurn(schedule, employees, d, jefeId, pmpIds);
      for (const t of ["TM","TT","TN"]) {
        if (c[t] > 0 && c[t] < 4) out.push({ type:"danger",  msg:`Día ${d} ${WDAYS[di.dow]} — ${t}: ${c[t]} personas (mín 4)` });
        else if (c[t] > 8)         out.push({ type:"danger",  msg:`Día ${d} ${WDAYS[di.dow]} — ${t}: ${c[t]} personas (máx 8)` });
      }
    }
    for (const emp of employees) {
      const maxConsec = maxConsecForEmp(emp);
      let streak = 0, streakStart = null;
      for (let d = 1; d <= daysInMonth; d++) {
        const ct = schedule[`${emp.id}-${d}`];
        if (isWorkShift(ct)) { if (streak===0) streakStart=d; streak++; if (streak>maxConsec) { out.push({ type:"danger", msg:`${emp.name} (${emp.turn}): ${streak} guardias consecutivas desde día ${streakStart} (máx ${maxConsec})` }); streak=0; streakStart=null; } }
        else { streak=0; streakStart=null; }
      }
    }

    // ── Francos consecutivos máximos (máx 3) ──
    for (const emp of employees) {
      let streak = 0, streakStart = null;
      for (let d = 1; d <= daysInMonth; d++) {
        const ct = schedule[`${emp.id}-${d}`];
        if (!isWorkShift(ct)) {
          if (streak === 0) streakStart = d;
          streak++;
          if (streak > MAX_CONSEC_FRANCO) {
            out.push({ type:"warning", msg:`${emp.name}: ${streak} francos consecutivos desde día ${streakStart} (máx ${MAX_CONSEC_FRANCO})` });
            streak = 0; streakStart = null;
          }
        } else { streak = 0; streakStart = null; }
      }
    } 
    for (const emp of employees) {
      const worked = workedHours(schedule, emp.id, daysInMonth, earlyHsForEmp(emp), lateHsForEmp(emp), customCellTypes, reducedDailyHsForEmp(emp), larDays, emp.turn, targetHours(emp), month);
      const target = targetHours(emp);
      const diff   = target - worked;
      if (Math.abs(diff) > 14) out.push({ type:diff>0?"info":"warning", msg:`${emp.name}: ${worked}hs cargadas / ${target}hs objetivo (${diff>0?"faltan":"sobran"} ${Math.abs(diff)}hs)` });
    }
    const isFreeCell = (empId, day) => { const v = schedule[`${empId}-${day}`]; return !v||v==="F"||v==="FE"||v==="LIC"||v==="LAR"; };
    const wpairs = [];
    for (const d of dayInfo) { if (d.isSat) { const sun=dayInfo.find(x=>x.day===d.day+1&&x.isSunday); if (sun) wpairs.push({sat:d.day,sun:sun.day}); } }
    const allSatDays = dayInfo.filter(d=>d.isSat).map(d=>d.day);
    const allSunDays = dayInfo.filter(d=>d.isSunday).map(d=>d.day);
    for (const emp of employees) {
      // Contar todos los findes completos libres
      const findesCompletos = wpairs.filter(p => isFreeCell(emp.id,p.sat) && isFreeCell(emp.id,p.sun));
      if (findesCompletos.length === 0 && wpairs.length > 0) {
        out.push({ type:"danger", msg:`${emp.name}: sin finde completo libre (SAB+DOM consecutivos)` });
      } else if (findesCompletos.length > 1) {
        out.push({ type:"warning", msg:`${emp.name}: tiene ${findesCompletos.length} findes completos libres (debe ser solo 1)` });
      }
      const usedSat = findesCompletos[0]?.sat;
      const hasExtraSat = allSatDays.some(s => s!==usedSat && isFreeCell(emp.id,s));
      if (!hasExtraSat && allSatDays.length>(usedSat?1:0)) out.push({ type:"warning", msg:`${emp.name}: sin sábado libre adicional` });
      const usedSun = findesCompletos[0]?.sun;
      const hasExtraSun = allSunDays.some(s => s!==usedSun && isFreeCell(emp.id,s));
      if (!hasExtraSun && allSunDays.length>(usedSun?1:0)) out.push({ type:"warning", msg:`${emp.name}: sin domingo libre adicional` });
    }
    return out;
  }, [schedule, larDays, employees, daysInMonth, dayInfo, earlyOffsets, lateOffsets, hoursOverride, regimeHours, jefeId, customCellTypes]);

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); setSchedule({}); setBulkMode(null); setBulkSelected(new Set()); setHoursReady(false); setHoursOverride({}); setHistory([]); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); setSchedule({}); setBulkMode(null); setBulkSelected(new Set()); setHoursReady(false); setHoursOverride({}); setHistory([]); };

  const setCellValue = (empId, day, type) => {
    setSchedule(prev => {
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
    setBulkSelected(prev => { const next=new Set(prev); if(next.has(k)) next.delete(k); else next.add(k); return next; });
  };

  


function calcTargetWithLAR(emp, year, month, holidays, larDays, daysInMonth, getRegimeHours) {
  // El target siempre es la carga mensual completa (144hs, 160hs, etc.)
  // Las horas de LAR se suman en workedHours, completando el total
  const base = getRegimeHours(emp.regime);
  return emp.reduction > 0 ? Math.round(base * (1 - emp.reduction / 100)) : base;
}

  const applyBulk = () => {
  if (!bulkMode || bulkSelected.size === 0) return;
  if (bulkMode === "LAR") {
    pushHistory(schedule, larDays);
    setLarDays(prev => {
      const next = new Set(prev);
      for (const k of bulkSelected) {
        if (next.has(k)) next.delete(k); else next.add(k);
      }
      return next;
    });
  } else {
    setSchedule(prev => {
      pushHistory(prev, larDays); // ✅ pasar larDays aquí también
      const next = { ...prev };   // ✅ NO incluir larDays en schedule
      for (const k of bulkSelected) next[k] = bulkMode;
      return next;
    });
  }
  setBulkSelected(new Set());
};

  const cancelBulk = () => { setBulkMode(null); setBulkSelected(new Set()); };

  const doAutoFill = () => {
    setSchedule(prev => {
      pushHistory(prev, larDays);
      return autoFillAll(employees, prev, dayInfo, daysInMonth, targetHours, earlyHsForEmp, lateHsForEmp, reducedDailyHsForEmp, jefeId, larDays, pmpIds);
    });
  };
  const clearAll = () => { if(window.confirm("...")) { pushHistory(schedule, larDays); setSchedule({}); setLarDays(new Set()); } };

  const handleSave = () => {
    const ok = saveData({ year, month, employees, schedule, larDays:[...larDays], holidays, service, beds, jefeId, pmpIds:[...pmpIds], earlyOffsets, lateOffsets, hoursOverride, customCellTypes, regimeHours });
    if (ok) { setSavedOk(true); setTimeout(() => setSavedOk(false), 2500); }
  };


  // ════════════════════════════════════════════════════════════════
// REEMPLAZÁ COMPLETAMENTE tu función exportExcel con esta versión
// ════════════════════════════════════════════════════════════════
const exportExcel = () => {
  const mkFill=(hex)=>({patternType:"solid",fgColor:{rgb:hex.replace("#","").toUpperCase().padStart(6,"0")}});
  const mkFont=(hex,bold=false,sz=8,italic=false)=>({name:"Arial",sz,bold,italic,color:{rgb:hex.replace("#","").toUpperCase().padStart(6,"0")}});
  const mkBdr=(style="thin",hex="CBD5E0")=>({style,color:{rgb:hex.replace("#","").toUpperCase().padStart(6,"0")}});
  const borders=(s="thin",hex="CBD5E0")=>({top:mkBdr(s,hex),bottom:mkBdr(s,hex),left:mkBdr(s,hex),right:mkBdr(s,hex)});
  const align=(h="center",v="center",wrap=false)=>({horizontal:h,vertical:v,wrapText:wrap});
  function lbl(ct){switch(ct){case "TM":case "EARLY":case "LATE":return "M";case "TT":return "T";case "TN":return "N";case "F":return "F";case "FE":return "F°";case "LIC":return "Lic";case "LAR":return "LAR";case "PM":return "PM";default:return "";}}
  function cs(ct,isSat,isSun,isHol){const colBg=isHol||isSun?"FFFF00":isSat?"C7E3FF":"FFFFFF";const bStyle=(isSat||isSun||isHol)?"medium":"thin";const bHex=(isSat||isSun||isHol)?"000000":"CBD5E0";const B=borders(bStyle,bHex);const A=align("center","center");function mk(bg,fg,bold=true,italic=false){return{alignment:A,border:B,fill:mkFill(bg),font:mkFont(fg,bold,8,italic)};}switch(ct){case "TM":return mk(colBg,"1D4ED8",true);case "TT":return mk(colBg,"15803D",true);case "TN":return mk(colBg,"000000",true);case "F":return mk(colBg,"374151",false);case "FE":return mk(colBg,"DC2626",true,true);case "EARLY":return mk("FCE7F3","9D174D",true);case "LATE":return mk("DCFCE7","166534",true);case "LIC":return mk("FEF9C3","7C2D12",true);case "LAR":return mk("FEF3C7","92400E",true);case "PM":return mk("DBEAFE","1E3A8A",true);default:return mk(colBg,"94A3B8",false);}}

  // ── Función que construye una hoja para los turnos indicados ──
  const buildSheet = (turns) => {
    const ws={};const merges=[];const range={s:{r:0,c:0},e:{r:0,c:0}};let R=0;
    const cell=(r,c,v,s)=>{const addr=XLSX.utils.encode_cell({r,c});ws[addr]={v,t:(typeof v==="number")?"n":"s",s};if(r>range.e.r)range.e.r=r;if(c>range.e.c)range.e.c=c;};
    const merge=(r,c,r2,c2)=>merges.push({s:{r,c},e:{r:r2,c:c2}});
    const NC=4,EX=5,TC=NC+dayInfo.length+EX;
    const sTitle={alignment:align("center","center"),font:mkFont("1E3A8A",true,13),fill:mkFill("FFFFFF"),border:borders("medium","000000")};
    for(let c=0;c<TC;c++)cell(R,c,c===0?"CRONOGRAMA MENSUAL DE FRANCOS":"",sTitle);merge(R,0,R,TC-1);R++;
    const sInfo=(bg="EFF6FF",fg="1E40AF",h="left")=>({alignment:align(h,"center"),font:mkFont(fg,true,8),fill:mkFill(bg),border:borders("thin","93C5FD")});
    const c1=Math.floor(TC*0.36),c2=Math.floor(TC*0.18),c3=Math.floor(TC*0.18),c4=TC-c1-c2-c3;
    const jefeEmp=employees.find(e=>e.id===jefeId);
    for(let c=0;c<c1;c++)cell(R,c,c===0?`SERVICIO: ${service}`:"",sInfo());merge(R,0,R,c1-1);
    for(let c=0;c<c2;c++)cell(R,c1+c,c===0?`Nº CAMAS: ${beds}`:"",sInfo("EFF6FF","1E40AF","center"));merge(R,c1,R,c1+c2-1);
    for(let c=0;c<c3;c++)cell(R,c1+c2+c,c===0?`${MONTHS[month].toUpperCase()} ${year}`:"",sInfo("EFF6FF","1E40AF","center"));merge(R,c1+c2,R,c1+c2+c3-1);
    for(let c=0;c<c4;c++)cell(R,c1+c2+c3+c,c===0?(jefeEmp?`Jefa/e: ${jefeEmp.name}`:"Jefa/e: _______________"):"",sInfo());merge(R,c1+c2+c3,R,TC-1);R++;
    const sHdr=(bg="1E3A8A",fg="FFFFFF",h="center")=>({alignment:align(h,"center",true),font:mkFont(fg,true,7),fill:mkFill(bg),border:borders("medium","000000")});
    cell(R,0,"MENS.",sHdr("374151"));cell(R,1,"APELLIDO Y NOMBRE",sHdr("1E3A8A","FFFFFF","left"));cell(R,2,"RÉG.",sHdr());cell(R,3,"T.",sHdr());
    dayInfo.forEach((d,i)=>{const bg=d.isHoliday?"FF0000":d.isSunday?"FFFF00":d.isSat?"C7E3FF":"DBEAFE";const fg=d.isHoliday?"FFFFFF":d.isSunday?"1D4ED8":"1E3A8A";const bs=(d.isWeekend||d.isHoliday)?"medium":"thin";const bh=(d.isWeekend||d.isHoliday)?"000000":"CBD5E0";cell(R,NC+i,`${d.day}\n${WDAYS[d.dow]}`,{alignment:align("center","center",true),font:mkFont(fg,true,7),fill:mkFill(bg),border:borders(bs,bh)});});
    cell(R,NC+dayInfo.length,"OBJ.",sHdr("374151"));cell(R,NC+dayInfo.length+1,"CARG.",sHdr("374151"));const sHdrThick=(bg,fg)=>({alignment:align("center","center",true),font:mkFont(fg,true,7),fill:mkFill(bg),border:{top:mkBdr("medium","000000"),bottom:mkBdr("medium","000000"),left:mkBdr("medium","000000"),right:mkBdr("medium","000000")}});
cell(R,NC+dayInfo.length+2,"F/FDE",sHdrThick("C7E3FF","1D4ED8"));cell(R,NC+dayInfo.length+3,"",sHdrThick("FFFF00","1D4ED8"));R++;

    // ── Fila de JEFA/E DE SECCIÓN (separada, antes de los turnos) ──
    if(jefeEmp && turns.includes(jefeEmp.turn)){
      const sJefaHdr={alignment:align("left","center"),font:mkFont("92400E",true,9),fill:mkFill("FEF3C7"),border:borders("medium","000000")};
      for(let c=0;c<TC;c++)cell(R,c,c===0?"JEFA/E DE SECCIÓN  —  no incluida en totales por turno":"",sJefaHdr);merge(R,0,R,TC-1);R++;
      const emp=jefeEmp;
      const target=targetHours(emp);const worked=workedHours(schedule,emp.id,daysInMonth,earlyHsForEmp(emp),lateHsForEmp(emp),customCellTypes,reducedDailyHsForEmp(emp),larDays,emp.turn,targetHours(emp),month);
      const diff=worked-target;const dFg=Math.abs(diff)<=7?"059669":diff>0?"F59E0B":"EF4444";
      const eFg=emp.turn==="TM"?"1D4ED8":emp.turn==="TT"?"15803D":"000000";
      const sNameJ={alignment:align("left","center"),font:mkFont("92400E",true,8),fill:mkFill("FFFBEB"),border:borders("medium","F59E0B")};
      const sMetaJ=(fg,bg="FFFBEB",bold=true)=>({alignment:align("center","center"),font:mkFont(fg,bold,8),fill:mkFill(bg),border:borders("medium","F59E0B")});
      cell(R,0,target,sMetaJ("92400E","FEF3C7"));cell(R,1,emp.name,sNameJ);cell(R,2,emp.regime,sMetaJ("475569"));cell(R,3,emp.turn,sMetaJ(eFg));
      dayInfo.forEach((d,i)=>{const k=`${emp.id}-${d.day}`;const ct=larDays.has(k)?"LAR":(schedule[k]||"");cell(R,NC+i,lbl(ct),cs(ct,d.isSat,d.isSunday,d.isHoliday));});
      cell(R,NC+dayInfo.length,target,sMetaJ("475569","F8FAFC"));cell(R,NC+dayInfo.length+1,worked,sMetaJ(dFg,"F8FAFC",true));
      const isFreeXLJ=(day)=>{const v=schedule[`${emp.id}-${day}`];return !v||v==="F"||v==="FE"||v==="---";};
      const findesXLJ=dayInfo.filter(d=>d.isSat).reduce((acc,d)=>{const sun=dayInfo.find(x=>x.day===d.day+1&&x.isSunday);return(sun&&isFreeXLJ(d.day)&&isFreeXLJ(sun.day))?acc+1:acc;},0);
      const sFJ=(fg,bg)=>({alignment:align("center","center"),font:mkFont(fg,true,8),fill:mkFill(bg),border:{top:mkBdr("medium","000000"),bottom:mkBdr("medium","000000"),left:mkBdr("medium","000000"),right:mkBdr("medium","000000")}});
      cell(R,NC+dayInfo.length+2,findesXLJ||"",sFJ("92400E","FFF7ED"));cell(R,NC+dayInfo.length+3,"",sFJ("1D4ED8","FFFF00"));R++;
      // Fila separadora
      const sSep={alignment:align("center","center"),font:mkFont("CBD5E0",false,4),fill:mkFill("F8FAFC"),border:borders("thin","E2E8F0")};
      for(let c=0;c<TC;c++)cell(R,c,"",sSep);R++;
    }

    for(const turn of turns){
      const emps=employees.filter(e=>e.turn===turn && e.id!==jefeId);if(!emps.length)continue;
      const tLbl=turn==="TM"?"TURNO MAÑANA  (07:00–14:00)":turn==="TT"?"TURNO TARDE   (14:00–21:00)":"TURNO NOCHE   (21:00–07:00)";
      const tFg=turn==="TM"?"1D4ED8":turn==="TT"?"15803D":"000000";const tBg=turn==="TM"?"DBEAFE":turn==="TT"?"DCFCE7":"F1F5F9";
      const sTh={alignment:align("left","center"),font:mkFont(tFg,true,9),fill:mkFill(tBg),border:borders("medium","000000")};
      for(let c=0;c<TC;c++)cell(R,c,c===0?tLbl:"",sTh);merge(R,0,R,TC-1);R++;
      for(const emp of emps){
        const target=targetHours(emp);const worked=workedHours(schedule,emp.id,daysInMonth,earlyHsForEmp(emp),lateHsForEmp(emp),customCellTypes,reducedDailyHsForEmp(emp),larDays,emp.turn,targetHours(emp),month);const diff=worked-target;const dFg=Math.abs(diff)<=7?"059669":diff>0?"F59E0B":"EF4444";const eFg=turn==="TM"?"1D4ED8":turn==="TT"?"15803D":"000000";
        const sName={alignment:align("left","center"),font:mkFont("1E293B",false,8),fill:mkFill("FFFFFF"),border:borders("thin","CBD5E0")};
        const sMeta=(fg,bg="FFFFFF",bold=true)=>({alignment:align("center","center"),font:mkFont(fg,bold,8),fill:mkFill(bg),border:borders("thin","CBD5E0")});
        cell(R,0,target,sMeta("1E40AF","F1F5F9"));cell(R,1,emp.name,sName);cell(R,2,emp.regime,sMeta("475569"));cell(R,3,emp.turn,sMeta(eFg));
        dayInfo.forEach((d,i)=>{const k=`${emp.id}-${d.day}`;const ct=larDays.has(k)?"LAR":(schedule[k]||"");cell(R,NC+i,lbl(ct),cs(ct,d.isSat,d.isSunday,d.isHoliday));});
        cell(R,NC+dayInfo.length,target,sMeta("475569","F8FAFC"));cell(R,NC+dayInfo.length+1,worked,sMeta(dFg,"F8FAFC",true));
// H Trab (LAR)
const isLARemp=[...larDays].some(k=>k.startsWith(`${emp.id}-`));
const hTrabVal=isLARemp?(()=>{const base=getRegimeHours(emp.regime);const reduced=emp.reduction>0?Math.round(base*(1-emp.reduction/100)):base;const wd=calcWorkingDays(year,month,holidays);const td2=getDaysInMonth(year,month);return Math.round((wd*reduced)/td2);})():"—";
cell(R,NC+dayInfo.length+2,hTrabVal,sMeta("0369A1","E0F2FE"));
        
        const isFreeXL=(day)=>{const v=schedule[`${emp.id}-${day}`];return !v||v==="F"||v==="FE"||v==="---";};
        const findesXL=dayInfo.filter(d=>d.isSat).reduce((acc,d)=>{const sun=dayInfo.find(x=>x.day===d.day+1&&x.isSunday);return(sun&&isFreeXL(d.day)&&isFreeXL(sun.day))?acc+1:acc;},0);
        const sFindes=(fg,bg)=>({alignment:align("center","center"),font:mkFont(fg,true,8),fill:mkFill(bg),border:{top:mkBdr("medium","000000"),bottom:mkBdr("medium","000000"),left:mkBdr("medium","000000"),right:mkBdr("medium","000000")}});
cell(R,NC+dayInfo.length+2,findesXL||"",sFindes("92400E","FFF7ED"));cell(R,NC+dayInfo.length+3,"",sFindes("1D4ED8","FFFF00"));R++;
      }
      const sTotLbl={alignment:align("left","center"),font:mkFont("1E293B",true,8,true),fill:mkFill("CBD5E1"),border:{top:mkBdr("medium","000000"),bottom:mkBdr("medium","000000"),left:mkBdr("medium","000000"),right:mkBdr("thin","94A3B8")}};
      const sTotNum=(n)=>{const fg=n===0?"94A3B8":n<4?"EF4444":n>8?"F59E0B":"059669";return{alignment:align("center","center"),font:mkFont(fg,true,8),fill:mkFill("CBD5E1"),border:{top:mkBdr("medium","000000"),bottom:mkBdr("medium","000000"),left:mkBdr("thin","94A3B8"),right:mkBdr("thin","94A3B8")}};};
      for(let c=0;c<NC;c++)cell(R,c,c===1?"TOTAL DE ENFERMEROS":"",sTotLbl);merge(R,1,R,NC-1);cell(R,0,"",sTotLbl);
      dayInfo.forEach((d,i)=>{const n=countPerTurn(schedule,employees,d.day,jefeId)[turn]||0;cell(R,NC+i,n>0?n:"",sTotNum(n));});
      for(let c=NC+dayInfo.length;c<TC;c++)cell(R,c,"",sTotLbl);R++;
    }
    // ── Sección PARTE MÉDICO PROLONGADO ──
    const pmpEmps = employees.filter(e => pmpIds.has(e.id) && turns.includes(e.turn));
    if (pmpEmps.length > 0) {
      const sPmpHdr={alignment:align("left","center"),font:mkFont("DC2626",true,9),fill:mkFill("FEF2F2"),border:borders("medium","000000")};
      for(let c=0;c<TC;c++)cell(R,c,c===0?"PARTE MÉDICO PROLONGADO  —  no incluidos en cobertura activa":"",sPmpHdr);merge(R,0,R,TC-1);R++;
      for(const emp of pmpEmps){
        const target=targetHours(emp);
        const sPmpName={alignment:align("left","center"),font:mkFont("B91C1C",false,8),fill:mkFill("FFF1F2"),border:borders("thin","FCA5A5")};
        const sPmpMeta=(fg,bg="FFF1F2")=>({alignment:align("center","center"),font:mkFont(fg,false,8),fill:mkFill(bg),border:borders("thin","FCA5A5")});
        cell(R,0,target,sPmpMeta("B91C1C","FEF2F2"));cell(R,1,emp.name,sPmpName);cell(R,2,emp.regime,sPmpMeta("475569"));cell(R,3,emp.turn,sPmpMeta("475569"));
        dayInfo.forEach((d,i)=>{const k=`${emp.id}-${d.day}`;const ct=larDays.has(k)?"LAR":(schedule[k]||"");cell(R,NC+i,lbl(ct),cs(ct,d.isSat,d.isSunday,d.isHoliday));});
        cell(R,NC+dayInfo.length,"—",sPmpMeta("94A3B8"));cell(R,NC+dayInfo.length+1,"—",sPmpMeta("94A3B8"));
        cell(R,NC+dayInfo.length+2,"—",sPmpMeta("94A3B8"));cell(R,NC+dayInfo.length+3,"",sPmpMeta("94A3B8"));R++;
      }
    }

    R++;
    const lgItems=[{l:"M = Mañana (07-14)",bg:"FFFFFF",fg:"1D4ED8"},{l:"T = Tarde (14-21)",bg:"FFFFFF",fg:"15803D"},{l:"N = Noche (21-07)",bg:"FFFFFF",fg:"000000"},{l:"F = Franco",bg:"FFFFFF",fg:"374151"},{l:"F° = Franco Esp.",bg:"FFFFFF",fg:"DC2626"},{l:"Lic = Licencia",bg:"FEF9C3",fg:"7C2D12"},{l:"LAR = Largo",bg:"FEF3C7",fg:"92400E"},{l:"PM",bg:"DBEAFE",fg:"1E3A8A"}];
    const lgW=Math.floor(TC/lgItems.length);
    lgItems.forEach((it,i)=>{const cs2=i*lgW,ce=i===lgItems.length-1?TC-1:cs2+lgW-1;const sLg={alignment:align("center","center"),font:mkFont(it.fg,true,7),fill:mkFill(it.bg),border:borders("thin","CBD5E0")};for(let c=cs2;c<=ce;c++)cell(R,c,c===cs2?it.l:"",sLg);merge(R,cs2,R,ce);});R++;
    const sNote={alignment:align("left","center",true),font:mkFont("64748B",false,7,true),fill:mkFill("FFFFFF"),border:borders("thin","CBD5E0")};
    for(let c=0;c<TC;c++)cell(R,c,c===0?"NOTA: el cronograma sigue el régimen mensual del servicio. Los feriados se trabajan en el turno asignado salvo indicación contraria.":"",sNote);merge(R,0,R,TC-1);R++;
    ws["!ref"]=XLSX.utils.encode_range(range);ws["!merges"]=merges;
    ws["!cols"]=[{wch:5},{wch:26},{wch:6},{wch:4},...dayInfo.map(()=>({wch:3.5})),{wch:5},{wch:5},{wch:5},{wch:4},{wch:4}];
    ws["!rows"]=Array(R).fill(null).map((_,i)=>i===0?{hpt:20}:i===1?{hpt:14}:i===2?{hpt:24}:{hpt:14});
    ws["!pageSetup"]={orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9};
    ws["!printOptions"]={gridLines:false};
    return ws;
  };

  // ── Crear libro con 2 hojas ──
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(["TM","TT"]), `Mañ-Tarde ${MONTHS[month]}`);
  XLSX.utils.book_append_sheet(wb, buildSheet(["TN"]),      `Noche ${MONTHS[month]}`);
  XLSX.writeFile(wb, `Cronograma_${MONTHS[month]}_${year}.xlsx`);
};
  // ════════════════════════════════════════════════════════════════
// REEMPLAZÁ COMPLETAMENTE tu función exportPDF con esta versión
// Agrega salto de página entre TURNO TARDE y TURNO NOCHE
// ════════════════════════════════════════════════════════════════
const exportPDF = () => {
  const getCellInfo=(ct,isSat,isSun,isHol)=>{const colBg=isHol||isSun?"#ffff00":isSat?"#c7e3ff":"#ffffff";switch(ct){case "TM":return{l:"M",bg:colBg,fg:"#1d4ed8",bold:true};case "TT":return{l:"T",bg:colBg,fg:"#15803d",bold:true};case "TN":return{l:"N",bg:colBg,fg:"#000000",bold:true};case "F":return{l:"F",bg:colBg,fg:"#374151",bold:false};case "FE":return{l:"F°",bg:colBg,fg:"#dc2626",bold:true,italic:true};case "EARLY":return{l:"M",bg:"#fce7f3",fg:"#9d174d",bold:true};case "LATE":return{l:"M",bg:"#dcfce7",fg:"#166534",bold:true};case "LIC":return{l:"Lic",bg:"#fef9c3",fg:"#7c2d12",bold:true};case "LAR":return{l:"LAR",bg:"#fef3c7",fg:"#92400e",bold:true};case "PM":return{l:"PM",bg:"#dbeafe",fg:"#1e3a8a",bold:true};default:return{l:"",bg:colBg,fg:"#94a3b8",bold:false};}};
  const jefeEmp=employees.find(e=>e.id===jefeId);const TC=3+dayInfo.length+4;const c1=Math.floor(TC*0.36),c2=Math.floor(TC*0.18),c3=Math.floor(TC*0.18),c4=TC-c1-c2-c3;
  const S={root:`font-family:Arial,sans-serif;font-size:6.5pt;`,tbl:`border-collapse:collapse;width:100%;`,title:`text-align:center;font-size:12pt;font-weight:bold;color:#1e3a8a;text-decoration:underline;padding:5px;border:2pt solid #000;`,info:`background:#eff6ff;color:#1e40af;font-weight:bold;padding:2px 5px;border:1pt solid #93c5fd;font-size:7pt;`,hdr:`background:#1e3a8a;color:#fff;font-weight:bold;text-align:center;padding:3px 1px;border:1.5pt solid #000;font-size:6pt;`,tot:`background:#cbd5e1;font-weight:bold;font-style:italic;border:1.5pt solid #000;padding:1px 4px;`};

  // ── Función que genera el HTML de una tabla para los turnos indicados ──
  const buildTable = (turns, isFirstPage) => {
    let H = `<table style="${S.tbl}">`;
    H+=`<tr><td colspan="${TC}" style="${S.title}">CRONOGRAMA MENSUAL DE FRANCOS</td></tr>`;
    H+=`<tr><td colspan="${c1}" style="${S.info}">&nbsp;SERVICIO: ${service}</td><td colspan="${c2}" style="${S.info}text-align:center;">Nº CAMAS: ${beds}</td><td colspan="${c3}" style="${S.info}text-align:center;">${MONTHS[month].toUpperCase()} ${year}</td><td colspan="${c4}" style="${S.info}">&nbsp;${jefeEmp?`Jefa/e: ${jefeEmp.name}`:"Jefa/e: _______________"}</td></tr>`;
    H+=`<tr><th style="${S.hdr}min-width:90pt;text-align:left;padding:2px 4px;">APELLIDO Y NOMBRE</th><th style="${S.hdr}">RÉG.</th><th style="${S.hdr}">T.</th>`;
    dayInfo.forEach(d=>{const bg=d.isHoliday?"#dc2626":d.isSunday?"#ffff00":d.isSat?"#c7e3ff":"#dbeafe";const fg=d.isHoliday?"#ffffff":"#1d4ed8";const bw=(d.isWeekend||d.isHoliday)?"1.5pt":"0.4pt";H+=`<th style="background:${bg};color:${fg};font-weight:bold;text-align:center;padding:1px 0;border:${bw} solid #000;font-size:5.5pt;min-width:11pt;">${d.day}<br>${WDAYS[d.dow]}</th>`;});
H+=`<th style="${S.hdr}">OBJ.</th><th style="${S.hdr}">CARG.</th><th style="background:#c7e3ff;color:#1d4ed8;font-weight:bold;text-align:center;border:2pt solid #000;font-size:6pt;">F/FDE</th><th style="background:#ffff00;border:2pt solid #000;"></th></tr>`;
    for(const turn of turns){
      const emps=employees.filter(e=>e.turn===turn);if(!emps.length)continue;
      const tLbl=turn==="TM"?"TURNO MAÑANA  (07:00–14:00)":turn==="TT"?"TURNO TARDE   (14:00–21:00)":"TURNO NOCHE   (21:00–07:00)";
      const tFg=turn==="TM"?"#1d4ed8":turn==="TT"?"#15803d":"#000000";const tBg=turn==="TM"?"#dbeafe":turn==="TT"?"#dcfce7":"#f1f5f9";
      H+=`<tr><td colspan="${TC}" style="background:${tBg};color:${tFg};font-weight:bold;padding:2px 5px;font-size:8pt;border:2pt solid #000;">▶ ${tLbl}</td></tr>`;
      for(const emp of emps){
        const target=targetHours(emp);const worked=workedHours(schedule,emp.id,daysInMonth,earlyHsForEmp(emp),lateHsForEmp(emp),customCellTypes,reducedDailyHsForEmp(emp),larDays,emp.turn,targetHours(emp),month);const diff=worked-target;const dFg=Math.abs(diff)<=7?"#059669":diff>0?"#f59e0b":"#ef4444";const eFg=turn==="TM"?"#1d4ed8":turn==="TT"?"#15803d":"#000000";
        H+=`<tr><td style="border:0.4pt solid #cbd5e1;padding:1px 3px;white-space:nowrap;">${emp.name}</td><td style="border:0.4pt solid #cbd5e1;text-align:center;font-size:6pt;">${emp.regime}</td><td style="border:0.4pt solid #cbd5e1;text-align:center;color:${eFg};font-weight:bold;font-size:6pt;">${emp.turn}</td>`;
        dayInfo.forEach(d=>{const k=`${emp.id}-${d.day}`;const ct=larDays.has(k)?"LAR":(schedule[k]||"");const ci=getCellInfo(ct,d.isSat,d.isSunday,d.isHoliday);const bw=(d.isWeekend||d.isHoliday)?"1.5pt":"0.4pt";H+=`<td style="background:${ci.bg};color:${ci.fg};${ci.bold?"font-weight:bold;":""}${ci.italic?"font-style:italic;":""}text-align:center;padding:1px 0;border:${bw} solid #000;font-size:6.5pt;">${ci.l}</td>`;});
       const isFreeP=(day)=>{const v=schedule[`${emp.id}-${day}`];return !v||v==="F"||v==="FE"||v==="---";};
const findesP=dayInfo.filter(d=>d.isSat).reduce((acc,d)=>{const sun=dayInfo.find(x=>x.day===d.day+1&&x.isSunday);return(sun&&isFreeP(d.day)&&isFreeP(sun.day))?acc+1:acc;},0);
H+=`<td style="border:1.5pt solid #000;text-align:center;font-size:6pt;">${target}</td><td style="border:1.5pt solid #000;text-align:center;color:${dFg};font-weight:bold;font-size:6pt;">${worked}</td><td style="background:#fff7ed;color:#92400e;font-weight:bold;text-align:center;border:2pt solid #000;font-size:6pt;">${findesP||""}</td><td style="background:#ffff00;border:2pt solid #000;font-size:6pt;"></td></tr>`;
      }
      H+=`<tr><td colspan="3" style="${S.tot}">TOTAL DE ENFERMEROS</td>`;
      dayInfo.forEach(d=>{const n=countPerTurn(schedule,employees,d.day,jefeId)[turn]||0;const col=n===0?"#94a3b8":n<4?"#ef4444":n>8?"#f59e0b":"#059669";H+=`<td style="background:#cbd5e1;color:${col};font-weight:bold;text-align:center;border:1pt solid #000;font-size:6.5pt;">${n>0?n:""}</td>`;});
      H+=`<td colspan="4" style="background:#cbd5e1;border:1.5pt solid #000;"></td></tr>`;
    }
    H+=`<tr>`;
    const lgItems=[{l:"M = Mañana (07-14)",bg:"#ffffff",fg:"#1d4ed8"},{l:"T = Tarde (14-21)",bg:"#ffffff",fg:"#15803d"},{l:"N = Noche (21-07)",bg:"#ffffff",fg:"#000000"},{l:"F = Franco",bg:"#ffffff",fg:"#374151"},{l:"F° = Franco Esp.",bg:"#ffffff",fg:"#dc2626"},{l:"Lic = Licencia",bg:"#fef9c3",fg:"#7c2d12"},{l:"LAR = Largo",bg:"#fef3c7",fg:"#92400e"},{l:"PM",bg:"#dbeafe",fg:"#1e3a8a"}];
    const lgW=Math.floor(TC/lgItems.length);
    lgItems.forEach((it,i)=>{const span=i===lgItems.length-1?TC-i*lgW:lgW;H+=`<td colspan="${span}" style="background:${it.bg};color:${it.fg};font-weight:bold;text-align:center;border:0.5pt solid #cbd5e1;padding:3px 2px;font-size:6pt;">${it.l}</td>`;});
    H+=`</tr>`;
    H+=`<tr><td colspan="${TC}" style="font-size:5.5pt;color:#64748b;font-style:italic;padding:2px 4px;border-top:1pt solid #e2e8f0;">NOTA: el cronograma sigue el régimen mensual del servicio. Los feriados se trabajan en el turno asignado salvo indicación contraria.</td></tr>`;
    H+=`</table>`;
    return H;
  };

  // ── Página 1: Mañana + Tarde  |  Página 2: Noche ──
  let H=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;}
    @page{size:A3 landscape;margin:6mm;}
    body{margin:0;padding:4px;font-family:Arial,sans-serif;font-size:6.5pt;}
    table{border-collapse:collapse;width:100%;}
    td,th{padding:1px;}
    .page-break{page-break-before:always;padding-top:4px;}
  </style></head><body>`;

  H += buildTable(["TM","TT"], true);
  H += `<div class="page-break">`;
  H += buildTable(["TN"], false);
  H += `</div>`;
  H += `</body></html>`;

  const blob=new Blob([H],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(blob);const win=window.open(url,"_blank");
  if(win){win.onload=()=>{setTimeout(()=>{win.print();URL.revokeObjectURL(url);},400);};}else{const a=document.createElement("a");a.href=url;a.download=`Cronograma_${MONTHS[month]}_${year}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
};
  const S = {
    app:       { minHeight:"100vh", display:"flex", flexDirection:"column", background:"#fff", color:"#1e293b" },
    hdr:       { background:"#1e40af", borderBottom:"2px solid #1e3a8a", padding:"14px 20px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" },
    hdrTitle:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:900, color:"#fff", letterSpacing:1, lineHeight:1 },
    hdrSub:    { fontSize:11, color:"#bfdbfe", fontWeight:600, marginTop:2 },
    monthNav:  { marginLeft:"auto", display:"flex", alignItems:"center", gap:8 },
    navBtn:    { background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:14 },
    monthLbl:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:700, color:"#fff", minWidth:200, textAlign:"center", letterSpacing:1 },
    tabs:      { display:"flex", gap:1, padding:"10px 20px 0", background:"#fff", borderBottom:"2px solid #e2e8f0" },
    content:   { flex:1, padding:"14px 20px", background:"#fff" },
    gridWrap:  { overflowX:"auto", border:"1px solid #000" },
    thName:    { background:"#fff", color:"#1e293b", padding:"7px 10px", minWidth:175, position:"sticky", left:0, zIndex:12, fontSize:11, fontWeight:700, textAlign:"left", whiteSpace:"nowrap", border:"1px solid #cbd5e1" },
    thMeta:    { background:"#fff", color:"#374151", padding:"5px 6px", textAlign:"center", fontSize:10, whiteSpace:"nowrap", minWidth:52, border:"1px solid #cbd5e1" },
    tdName:    { background:"#fff", color:"#1e293b", padding:"5px 10px", position:"sticky", left:0, zIndex:5, fontSize:11, whiteSpace:"nowrap", border:"1px solid #e2e8f0" },
    tdMeta:    { background:"#fff", padding:"4px 5px", textAlign:"center", fontSize:11, fontWeight:600, border:"1px solid #cbd5e1" },
    cell:      { width:30, height:26, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:10, userSelect:"none" },
    btn:       (bg, fg="#fff") => ({ padding:"6px 14px", border:"none", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:700, background:bg, color:fg, letterSpacing:".5px" }),
    formInput: { background:"#fff", border:"1px solid #cbd5e1", color:"#1e293b", padding:"5px 10px", borderRadius:6, fontSize:12, outline:"none" },
    formSel:   { background:"#fff", border:"1px solid #cbd5e1", color:"#1e293b", padding:"5px 10px", borderRadius:6, fontSize:12, cursor:"pointer" },
    formLabel: { fontSize:10, color:"#64748b", fontWeight:700, letterSpacing:".5px", marginBottom:3, display:"block" },
    cfgBox:    { background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:14, marginBottom:12 },
    cfgTitle:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:700, color:"#1e40af", marginBottom:10, letterSpacing:1 },
  };

  const TabBtn = ({ id, label }) => (
    <div onClick={() => setTab(id)} style={{ padding:"8px 18px", borderRadius:"8px 8px 0 0", cursor:"pointer", fontSize:12, fontWeight:700, letterSpacing:".5px", userSelect:"none", background:tab===id?"#fff":"transparent", border:tab===id?"1px solid #cbd5e1":"1px solid transparent", borderBottom:"none", color:tab===id?"#1e40af":"#64748b" }}>{label}</div>
  );

  const BULK_OPTS = [
    { type:"LIC", label:"Lic  — Licencia",       bg:"#fef9c3", fg:"#7c2d12", border:"#d97706" },
    { type:"LAR", label:"LAR — Largo",            bg:"#fef3c7", fg:"#92400e", border:"#fbbf24" },
    { type:"FE",  label:"F°  — Franco Especial", bg:"#fff",    fg:"#dc2626", border:"#fca5a5" },
  ];

  return (
    <div style={S.app}>

      {/* MODAL HORAS */}
      {!hoursReady && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:12, padding:24, maxWidth:720, width:"100%", maxHeight:"90vh", overflowY:"auto", border:"3px solid #1e40af", boxShadow:"0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, color:"#1e40af", marginBottom:4 }}>📋 HORAS MENSUALES — {MONTHS[month].toUpperCase()} {year}</div>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>Confirmá o ajustá las horas objetivo de cada empleado antes de armar el diagrama.</div>
            {(() => {
              const wd = calcWorkingDays(year, month, holidays);
              const td = getDaysInMonth(year, month);
              return (
                <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap", padding:"8px 12px", background:"#fffbeb", border:"1px solid #fbbf24", borderRadius:8, marginBottom:14, fontSize:11 }}>
                  <span style={{ color:"#92400e", fontWeight:700 }}>📐 Fórmula solo para empleados con LAR:</span>
                  <span style={{ color:"#475569" }}><b>(días hábiles × hs régimen) ÷ días totales</b></span>
                  <span style={{ color:"#64748b" }}>→ Días hábiles (Lun–Sáb): <b style={{ color:"#059669" }}>{wd}</b></span>
                  <span style={{ color:"#64748b" }}>· Días totales: <b style={{ color:"#1e40af" }}>{td}</b></span>
                  <span style={{ color:"#94a3b8", fontStyle:"italic" }}>· Sin LAR → hs régimen completo</span>
                </div>
              );
            })()}
            {["TM","TT","TN"].map(turn => {
              const emps = employees.filter(e => e.turn === turn);
              if (!emps.length) return null;
              const turnLabel = turn==="TM"?"Turno Mañana":turn==="TT"?"Turno Tarde":"Turno Noche";
              const turnColor = turn==="TM"?"#1d4ed8":turn==="TT"?"#15803d":"#111";
              return (
                <div key={turn} style={{ marginBottom:16 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:14, color:turnColor, borderBottom:`2px solid ${turnColor}`, paddingBottom:4, marginBottom:8 }}>{turn} — {turnLabel}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:6 }}>
                    {emps.map(emp => {
const base = effectiveHours(emp, year, month, holidays, getRegimeHours, larDays, daysInMonth);                      const regBase = getRegimeHours(emp.regime);
                      const reduced = emp.reduction>0 ? Math.round(regBase*(1-emp.reduction/100)) : regBase;
                      const wd = calcWorkingDays(year,month,holidays);
                      const td = getDaysInMonth(year,month);
                      const hasLAR = (() => { for(let d=1;d<=td;d++) if(schedule[`${emp.id}-${d}`]==="LAR") return true; return false; })();
                      const isEdited = hoursOverride[emp.id] !== undefined;
                      const current = isEdited ? hoursOverride[emp.id] : base;
                      return (
                        <div key={emp.id} style={{ display:"flex", alignItems:"center", gap:8, background:isEdited?"#fffbeb":hasLAR?"#fef3c7":"#f8fafc", border:isEdited?"1px solid #fbbf24":hasLAR?"1px solid #fbbf24":"1px solid #e2e8f0", borderRadius:6, padding:"6px 10px" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"#1e293b", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", display:"flex", alignItems:"center", gap:4 }}>
                              {hasLAR && <span style={{ fontSize:8, background:"#f59e0b", color:"#fff", borderRadius:3, padding:"1px 4px", fontWeight:900, flexShrink:0 }}>LAR</span>}
                              {emp.name}
                            </div>
                            <div style={{ fontSize:9, color:"#94a3b8" }}>{REGIMES[emp.regime]?.label}{emp.reduction>0?` · -${emp.reduction}%`:""}</div>
                            <div style={{ fontSize:8, color:hasLAR?"#92400e":"#94a3b8", marginTop:1 }}>
                              {hasLAR ? `(${diasHabiles}d × ${emp.turn==="TN"?10:7}hs × ${reduced}) ÷ ${month===1?28:30} = ${Math.round((diasHabiles*(emp.turn==="TN"?10:7)*reduced)/(month===1?28:30))}hs LAR → ${base}hs a trabajar` : `${reduced}hs (régimen completo)`}
                            </div>
                          </div>
                          <input type="number" min={0} max={300} value={current} onChange={e=>setHoursOverride(prev=>({...prev,[emp.id]:+e.target.value}))} style={{ width:54, textAlign:"center", fontSize:13, fontWeight:700, color:isEdited?"#92400e":"#059669", border:isEdited?"2px solid #fbbf24":"1px solid #cbd5e1", borderRadius:6, padding:"3px 4px", background:"#fff" }} />
                          <span style={{ fontSize:10, color:"#94a3b8" }}>hs</span>
                          {isEdited&&<button onClick={()=>setHoursOverride(prev=>{const n={...prev};delete n[emp.id];return n;})} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#94a3b8", padding:0 }} title="Restaurar">↩</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:16, borderTop:"1px solid #e2e8f0", paddingTop:16 }}>
              <button onClick={()=>{setHoursOverride({});setHoursReady(true);}} style={{ ...S.btn("#64748b"), fontSize:12 }}>Usar valores estándar</button>
              <button onClick={()=>setHoursReady(true)} style={{ ...S.btn("#1e40af"), fontSize:13, padding:"8px 24px" }}>✅ Confirmar horas y abrir diagrama</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={S.hdr} className="no-print">
        <div>
          <div style={S.hdrTitle}>🏥 CRONOGRAMA MENSUAL DE TURNOS</div>
          <div style={S.hdrSub}>{service} · {beds} CAMAS · TM 07-14 | TT 14-21 | TN 21-07</div>
        </div>
        <div style={S.monthNav}>
          <button style={S.navBtn} onClick={prevMonth}>◀</button>
          <div style={S.monthLbl}>{MONTHS[month].toUpperCase()} {year}</div>
          <button style={S.navBtn} onClick={nextMonth}>▶</button>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button style={S.btn("#059669")} onClick={exportExcel}>📊 Excel</button>
          <button style={S.btn("#4f46e5")} onClick={exportPDF}>🖨️ PDF</button>
          <button onClick={handleSave} style={{ ...S.btn(savedOk?"#059669":"#0f172a"), transition:"background .3s", minWidth:110 }}>
            {savedOk ? "✅ Guardado!" : "💾 Guardar"}
          </button>
          {currentUser && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:4, padding:"4px 12px", background:"rgba(255,255,255,.1)", borderRadius:20, border:"1px solid rgba(255,255,255,.2)" }}>
              <span style={{ fontSize:11, color:"#bfdbfe", fontWeight:600 }}>👤 {currentUser.name}</span>
              <button onClick={onLogout} style={{ background:"rgba(239,68,68,.2)", border:"1px solid rgba(239,68,68,.4)", color:"#fca5a5", padding:"3px 10px", borderRadius:12, cursor:"pointer", fontSize:10, fontWeight:700 }}>SALIR</button>
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={S.tabs} className="no-print">
        <TabBtn id="schedule" label="📅 Diagrama" />
        <TabBtn id="staff"    label="👤 Personal" />
        <TabBtn id="config"   label="⚙️ Config" />
      </div>

      <div style={S.content}>
        {tab === "schedule" && <>

          {/* Leyenda */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, paddingBottom:12 }} className="no-print">
            {Object.entries(CELL_TYPES).filter(([k])=>k!=="---").map(([k,v])=>(
              <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#475569" }}>
                <div style={{ width:24, height:14, borderRadius:3, background:v.bg, color:v.fg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, fontFamily:k==="FE"?"'Georgia',serif":"'Barlow Condensed',sans-serif", fontStyle:k==="FE"?"italic":"normal" }}>{v.label}</div>
                <span>{k==="TM"?"Mañana 07-14":k==="TT"?"Tarde 14-21":k==="TN"?"Noche 21-07":k==="F"?"Franco":k==="FE"?"Franco Esp.":k==="LIC"?"Licencia":k==="LAR"?"Largo":k==="PM"?"PM":k==="EARLY"?"Sale antes":k==="LATE"?"Sale después":""}</span>
              </div>
            ))}
          </div>

          {/* Alertas */}
          {showAlerts && alerts.length > 0 && (
            <div style={{ marginBottom:10 }} className="no-print">
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#64748b" }}>⚠️ {alerts.filter(a=>a.type==="danger").length} críticas · {alerts.filter(a=>a.type==="warning").length} advertencias · {alerts.filter(a=>a.type==="info").length} info</span>
                <button style={S.btn("#e2e8f0","#475569")} onClick={()=>setShowAlerts(false)}>Ocultar</button>
              </div>
              {alerts.slice(0,10).map((a,i)=>(
                <div key={i} style={{ padding:"5px 12px", borderRadius:5, fontSize:11, marginBottom:3, background:a.type==="danger"?"#fef2f2":a.type==="warning"?"#fffbeb":"#eff6ff", borderLeft:`3px solid ${a.type==="danger"?"#ef4444":a.type==="warning"?"#f97316":"#3b82f6"}`, color:a.type==="danger"?"#991b1b":a.type==="warning"?"#92400e":"#1e40af" }}>
                  {a.type==="danger"?"🔴":a.type==="warning"?"🟠":"🔵"} {a.msg}
                </div>
              ))}
              {alerts.length>10&&<div style={{ fontSize:10, color:"#475569", padding:"3px 12px" }}>...y {alerts.length-10} más</div>}
            </div>
          )}
          {!showAlerts&&<button style={{ ...S.btn("#e2e8f0","#475569"), marginBottom:10, fontSize:10 }} className="no-print" onClick={()=>setShowAlerts(true)}>Mostrar alertas 🔴{alerts.filter(a=>a.type==="danger").length} 🟠{alerts.filter(a=>a.type==="warning").length}</button>}

          {/* Toolbar */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }} className="no-print">
            {[["ALL","Todos","#cbd5e1"],["TM","Mañana","#1d4ed8"],["TT","Tarde","#92400e"],["TN","Noche","#3b0764"]].map(([k,l,c])=>(
              <button key={k} onClick={()=>{setFilterTurn(k);setFilterEmpId(null);}} style={{ padding:"5px 14px", borderRadius:20, border:"1px solid #cbd5e1", background:filterTurn===k&&!filterEmpId?c:"#fff", color:filterTurn===k&&!filterEmpId?"#fff":"#475569", fontSize:11, fontWeight:700, cursor:"pointer" }}>{l}</button>
            ))}
            <select value={filterEmpId||""} onChange={e=>{const v=e.target.value;setFilterEmpId(v?+v:null);if(v)setFilterTurn("ALL");}} style={{ ...S.formSel, fontSize:11, maxWidth:200 }}>
              <option value="">— Ver todos —</option>
              {["TM","TT","TN"].map(turn=>(
                <optgroup key={turn} label={turn==="TM"?"Mañana":turn==="TT"?"Tarde":"Noche"}>
                  {employees.filter(e=>e.turn===turn).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              ))}
            </select>
            <div style={{ flex:1 }} />
            <button
              style={{ ...S.btn(history.length>0?"#f59e0b":"#e2e8f0", history.length>0?"#000":"#94a3b8"), fontSize:11 }}
              onClick={undo}
              disabled={history.length===0}
              title="Deshacer última acción (Ctrl+Z)"
            >↩ Deshacer{history.length>0?` (${history.length})`:""}</button>
            <button style={S.btn("#f59e0b","#000")} onClick={doAutoFill}>⚡ Auto-completar</button>
            <button style={S.btn("#e2e8f0","#475569")} onClick={clearAll}>🗑️ Limpiar todo</button>
            <button style={{ ...S.btn("#e0f2fe","#0369a1"), fontSize:11 }} onClick={()=>setHoursReady(false)}>⏱ Horas mensuales</button>
          </div>

          {/* Selección múltiple */}
          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:10, flexWrap:"wrap", padding:"8px 12px", background:bulkMode?"#f8fafc":"#fff", border:"1px solid #e2e8f0", borderRadius:8 }} className="no-print">
            <span style={{ fontSize:11, fontWeight:700, color:"#475569", marginRight:4 }}>Marcar múltiples días:</span>
            {BULK_OPTS.map(opt=>(
              <button key={opt.type} onClick={()=>{setBulkMode(bulkMode===opt.type?null:opt.type);setBulkSelected(new Set());}} style={{ padding:"5px 14px", borderRadius:6, border:`2px solid ${opt.border}`, background:bulkMode===opt.type?opt.fg:opt.bg, color:bulkMode===opt.type?"#fff":opt.fg, fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:opt.type==="FE"?"'Georgia',serif":"'Barlow Condensed',sans-serif", fontStyle:opt.type==="FE"?"italic":"normal" }}>{opt.label}</button>
            ))}
            {bulkMode&&<><span style={{ fontSize:10, color:"#64748b", fontStyle:"italic" }}>✅ {bulkSelected.size} celda{bulkSelected.size!==1?"s":""} seleccionada{bulkSelected.size!==1?"s":""} — hacé clic en las celdas</span><button style={{ ...S.btn("#059669"), fontSize:11 }} onClick={applyBulk} disabled={bulkSelected.size===0}>✔ Aplicar {CELL_TYPES[bulkMode]?.label}</button><button style={{ ...S.btn("#e2e8f0","#475569"), fontSize:11 }} onClick={cancelBulk}>✕ Cancelar</button></>}
            {!bulkMode&&<span style={{ fontSize:10, color:"#94a3b8", fontStyle:"italic" }}>· Botón derecho sobre celda para cambiar turno individual</span>}
          </div>

          {/* Jefe/a */}
          <div style={{ display:"flex", gap:12, alignItems:"stretch", marginBottom:10, flexWrap:"wrap" }} className="no-print">
            <div style={{ border:"2px solid #1e40af", borderRadius:8, padding:"8px 14px", background:"#eff6ff", minWidth:260, display:"flex", flexDirection:"column", gap:6 }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, color:"#1e40af", letterSpacing:1 }}>👑 JEFE/A DE SECCION</div>
              {jefeId ? (() => { const jefe=employees.find(e=>e.id===jefeId); return jefe?(<div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ flex:1 }}><div style={{ fontWeight:700, fontSize:12, color:"#1e293b" }}>{jefe.name}</div><div style={{ fontSize:10, color:"#64748b" }}>{REGIMES[jefe.regime]?.label}{jefe.reduction>0?` · Reducción ${jefe.reduction}%`:""}{jefe.regime==="H24"?" · 24hs":""}{" · "}{jefe.turn}</div></div><button onClick={()=>setJefeId(null)} style={{ background:"none", border:"1px solid #93c5fd", borderRadius:4, color:"#1d4ed8", cursor:"pointer", fontSize:10, padding:"2px 8px" }}>Cambiar</button></div>):null; })()
              : <select style={{ ...S.formSel, fontSize:11 }} value="" onChange={e=>setJefeId(+e.target.value)}><option value="">— Seleccionar —</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.turn}{e.reduction>0?` -${e.reduction}%`:""}{e.regime==="H24"?" 24hs":""})</option>)}</select>}
            </div>
          </div>

          {/* GRILLA */}
          <div style={{ position:"relative" }}>
            <div ref={scrollbarRef} style={{ overflowX:"auto", overflowY:"hidden", height:14, background:"#e2e8f0", borderRadius:"4px 4px 0 0", border:"1px solid #cbd5e1", borderBottom:"none" }}>
              <div style={{ height:1, width:`${3*175 + dayInfo.length*34 + 4*36}px` }} />
            </div>

            <div ref={gridRef} style={{ overflowX:"auto", overflowY:"auto", maxHeight:"65vh", border:"1px solid #000" }}>
              <table style={{ minWidth:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ position:"sticky", top:0, zIndex:10 }}>
                    <th style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:"#f1f5f9", minWidth:36, fontSize:9, fontWeight:900, borderRight:"1px solid #000" }}>Mens.</th>
                    <th style={{ ...S.thName, position:"sticky", top:0, left:0, zIndex:20, background:"#f8fafc" }}>APELLIDO Y NOMBRE</th>
                    <th style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:"#f8fafc" }}>Rég.</th>
                    <th style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:"#f8fafc" }}>T.</th>
                    {dayInfo.map(d=>{const isYellow=d.isSunday||d.isHoliday; const bg=isYellow?"#ffff00":"#f8fafc"; return(<th key={d.day} style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:bg, color:d.isHoliday?"#dc2626":d.isSunday?"#1d4ed8":"#374151", minWidth:30, maxWidth:34, padding:"4px 2px", fontSize:9, border:d.isWeekend?"2px solid #000":"1px solid #cbd5e1", fontWeight:900 }}><div style={{ fontSize:8 }}>{WDAYS[d.dow]}</div><div style={{ fontSize:11, fontWeight:900 }}>{d.day}</div>{d.isHoliday&&<div style={{ fontSize:7, color:"#dc2626", fontWeight:700 }}>FER</div>}</th>);})}
                    <th style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:"#f1f5f9", minWidth:36, fontSize:9, fontWeight:900 }}>Carg.</th>
                    <th style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:"#e0f2fe", minWidth:36, fontSize:9, fontWeight:900, color:"#0369a1" }}>H Trab</th>
                    <th style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:"#fff7ed", minWidth:30, fontSize:9, fontWeight:900, color:"#92400e" }}>Sáb</th>
                    <th style={{ ...S.thMeta, position:"sticky", top:0, zIndex:10, background:"#ffff00", minWidth:30, fontSize:9, fontWeight:900, color:"#1d4ed8" }}>Dom</th>
                  </tr>
                </thead>
                <tbody>
                  {["TM","TT","TN"].map(turn => {
                    const jefeEmpObj = jefeId ? visibleEmps.find(e => e.id === jefeId && e.turn === turn) : null;
const emps = visibleEmps.filter(e => e.turn === turn && e.id !== jefeId);
                    if (!emps.length) return null;
                    const turnLabel = turn==="TM"?"TURNO MAÑANA (07:00–14:00)":turn==="TT"?"TURNO TARDE (14:00–21:00)":"TURNO NOCHE (21:00–07:00)";
                    const turnColor = turn==="TM"?"#1d4ed8":turn==="TT"?"#15803d":"#111";
                    const allTurnEmps = employees.filter(e => e.turn === turn);
                    return [
                      <tr key={`sep-${turn}`}>
                        <td colSpan={4+dayInfo.length+4} style={{ background:"#fff", color:turnColor, padding:"5px 10px", position:"sticky", left:0, zIndex:5, fontSize:11, fontWeight:900, letterSpacing:1, textTransform:"uppercase", borderTop:"2px solid #000", borderBottom:"1px solid #cbd5e1", borderLeft:"2px solid #000", borderRight:"2px solid #000" }}>▶ {turnLabel}</td>
                      </tr>,
           

  // ── Fila JEFA (si pertenece a este turno) ──
  ...(jefeEmpObj ? (() => {
    const emp = jefeEmpObj;
    const target = targetHours(emp);
    const worked = workedHours(schedule, emp.id, daysInMonth, earlyHsForEmp(emp), lateHsForEmp(emp), customCellTypes, reducedDailyHsForEmp(emp), larDays, emp.turn, targetHours(emp), month);
    const diff = worked - target;
    const mc = Math.abs(diff)<=7?"#059669":diff>0?"#f59e0b":"#ef4444";
    return [
      // Separador visual "JEFA DE SECCIÓN"
      <tr key="jefe-label">
        <td colSpan={4+dayInfo.length+4} style={{ background:"#eff6ff", color:"#1e40af", padding:"3px 10px", position:"sticky", left:0, zIndex:5, fontSize:10, fontWeight:900, letterSpacing:2, borderBottom:"1px dashed #93c5fd", borderLeft:"2px solid #1e40af", borderRight:"2px solid #1e40af" }}>
          JEFA/E DE SECCIÓN — no incluida en totales por turno
        </td>
      </tr>,
      // Fila del empleado (igual que la normal, copiá tu empRow)
      <tr key={emp.id} draggable onDragStart={()=>handleDragStart(emp.id)} onDragOver={e=>handleDragOver(e,emp.id)} onDrop={()=>handleDrop(emp.id)} onDragEnd={handleDragEnd} style={{ background:"#f0f9ff", opacity:dragEmpId===emp.id?0.4:1 }}>
        <td style={{ ...S.tdMeta, color:"#1e40af", fontWeight:900, background:"#dbeafe", borderRight:"1px solid #000", fontSize:11 }}>{target}hs</td>
        <td style={{ ...S.tdName, background:"#eff6ff", borderLeft:"3px solid #1e40af" }}>
          <div style={{ fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:9, background:"#1e40af", color:"#fff", borderRadius:3, padding:"1px 4px", fontWeight:900 }}>JEFE/A</span>
            {emp.name}
          </div>
          <div style={{ fontSize:9, color:"#94a3b8" }}>{REGIMES[emp.regime]?.label}{emp.reduction>0?` · -${emp.reduction}%`:""}{emp.note?` · ${emp.note}`:""}</div>
        </td>
        <td style={{ ...S.tdMeta, color:"#475569" }}>{emp.regime}</td>
        <td style={{ ...S.tdMeta, color:turnColor, fontWeight:900 }}>{emp.turn}</td>
        {dayInfo.map(d => {
          const k  = `${emp.id}-${d.day}`;
          const ct = schedule[k];
          const isFrancoWeekendPair = calcFrancoWeekendPair(emp.id, d, schedule, dayInfo);
          const cs = getCellStyle(ct||'', isFrancoWeekendPair, emp.turn, customCellTypes);
          const isYellowCol = d.isSunday || d.isHoliday;
          const hasOwnBg = ["LIC","EARLY","LATE","PM"].includes(ct) || customCellTypes.some(c=>c.key===ct);
          const isLAR = larDays.has(k);
          const yellowBg = isYellowCol && !hasOwnBg ? "#ffff00" : cs.bg;
          const isSelected = bulkMode && bulkSelected.has(k);
          const cellBg = isSelected ? "#bfdbfe" : isLAR ? (isYellowCol ? "rgba(251,191,36,0.7)" : "rgba(253,224,71,0.55)") : yellowBg;
          const cellBorder = isSelected ? "2px solid #1d4ed8" : isLAR ? "2px solid #f59e0b" : cs.border;
          return (
            <td key={d.day} style={{ background:cellBg, border:cellBorder, padding:0 }}>
              <CellContextMenu empId={emp.id} day={d.day} current={ct} onSelect={type=>setCellValue(emp.id,d.day,type)} empTurn={emp.turn} customCellTypes={customCellTypes}>
                <div style={{ ...S.cell, background:cellBg, color:isSelected?"#1d4ed8":cs.textColor, fontWeight:cs.bold?900:400, cursor:bulkMode?"cell":"default" }}
                  onClick={()=>handleCellClick(emp.id,d.day)}
                >{cs.label}</div>
              </CellContextMenu>
            </td>
          );
        })}
        <td style={{ ...S.tdMeta, color:mc, fontWeight:700, background:"#dbeafe" }}>{worked}hs</td>
        <td style={{ ...S.tdMeta, color:"#0369a1", fontWeight:700, background:"#e0f2fe" }}>—</td>
        <td style={{ ...S.tdMeta, color:"#92400e", fontWeight:700, background:"#fff7ed" }}>{dayInfo.filter(d=>d.isSat&&isWorkShift(schedule[`${emp.id}-${d.day}`])).length}</td>
        <td style={{ ...S.tdMeta, color:"#1d4ed8", fontWeight:700, background:"#ffff00" }}>{dayInfo.filter(d=>d.isSunday&&isWorkShift(schedule[`${emp.id}-${d.day}`])).length}</td>
      </tr>,
      // Línea divisoria entre jefa y el resto
      <tr key="jefe-div">
        <td colSpan={4+dayInfo.length+4} style={{ background:"#787879ff", height:10, padding:0 }} />
      </tr>,
    ];
  })() : []),
    
                      ...emps.flatMap((emp, empIdx) => {
                        const target = targetHours(emp); // Esta es la CARGA FIJA (ej: 160)
                          const worked = workedHours(schedule, emp.id, daysInMonth, earlyHsForEmp(emp), lateHsForEmp(emp), customCellTypes, reducedDailyHsForEmp(emp), larDays, emp.turn, targetHours(emp), month);

                          // --- NUEVA LÓGICA LAR ---
                          const hTrab = (() => {
                            const diasLAR = [...larDays].filter(k => k.startsWith(`${emp.id}-`)).length;
                            if (diasLAR === 0) return target;
                            const divisor = (month === 1) ? 28 : 30;
                            const horasLicencia = (target / divisor) * diasLAR;
                            return Math.max(0, Math.round(target - horasLicencia));
                          })();

                          // Comparamos lo trabajado contra el nuevo objetivo (hTrab)
                          const diff = worked - hTrab; 
                        const mc = Math.abs(diff) <= 7 ? "#059669" : diff > 0 ? "#f59e0b" : "#ef4444";
                        const allTurnIdx = allTurnEmps.findIndex(e => e.id === emp.id);
                        const midpoint  = Math.ceil(allTurnEmps.length / 2);
                        const dividerRow = turn==="TN" && allTurnIdx===midpoint ? (
                          <tr key="tn-div">
                            <td colSpan={5} style={{ background:"#e2e8f0", padding:"1px 10px", position:"sticky", left:0, zIndex:5, fontSize:9, fontWeight:700, color:"#475569", letterSpacing:2, textTransform:"uppercase", borderTop:"2px dashed #94a3b8", borderBottom:"2px dashed #94a3b8", borderLeft:"2px solid #000", borderRight:"1px solid #cbd5e1" }}>· · · GRUPO 2 · · ·</td>
                            {dayInfo.map(d=><td key={d.day} style={{ background:(d.isSunday||d.isHoliday)?"#e6e600":"#e2e8f0", borderTop:"2px dashed #94a3b8", borderBottom:"2px dashed #94a3b8", borderLeft:"1px solid #cbd5e1", borderRight:"1px solid #cbd5e1", padding:0 }} />)}
                          </tr>
                        ) : null;
                        const isJefe    = emp.id === jefeId;
                        const isPmp     = pmpIds.has(emp.id);
                        const isDragOver = dragOverId===emp.id && dragEmpId!==emp.id;
                        const empRow = (
                          <tr key={emp.id} draggable onDragStart={()=>handleDragStart(emp.id)} onDragOver={e=>handleDragOver(e,emp.id)} onDrop={()=>handleDrop(emp.id)} onDragEnd={handleDragEnd} style={{ opacity:dragEmpId===emp.id?0.4:1, outline:isDragOver?"2px solid #1d4ed8":"none", cursor:"grab" }}>
                            <td style={{ ...S.tdMeta, color:"#1e40af", fontWeight:900, background:"#f1f5f9", borderRight:"1px solid #000", fontSize:11 }}>{target}hs</td>
                            <td style={{ ...S.tdName, background:isJefe?"#eff6ff":"#fff", borderLeft:isJefe?"3px solid #1e40af":undefined }}>
                              <div style={{ fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
                                <span style={{ fontSize:9, color:"#94a3b8", cursor:"grab", marginRight:2 }}>⠿</span>
                                {isJefe&&<span style={{ fontSize:9, background:"#1e40af", color:"#fff", borderRadius:3, padding:"1px 4px", fontWeight:900 }}>JEFE</span>}
                                {isPmp&&<span style={{ fontSize:9, background:"#dc2626", color:"#fff", borderRadius:3, padding:"1px 4px", fontWeight:900 }}>PMP</span>}
                                {emp.name}
                                <button onClick={e=>{e.stopPropagation();setPmpIds(prev=>{const n=new Set(prev);if(n.has(emp.id))n.delete(emp.id);else n.add(emp.id);return n;});}} title={isPmp?"Quitar PMP":"Marcar PMP"} style={{ fontSize:8, background:isPmp?"#fee2e2":"#f1f5f9", color:isPmp?"#dc2626":"#94a3b8", border:`1px solid ${isPmp?"#fca5a5":"#cbd5e1"}`, borderRadius:3, padding:"0px 4px", cursor:"pointer", fontWeight:700, marginLeft:4 }}>{isPmp?"✕":"PMP"}</button>
                              </div>
                              <div style={{ fontSize:9, color:"#94a3b8" }}>{REGIMES[emp.regime]?.label}{emp.reduction>0?` · -${emp.reduction}%`:""}{emp.note?` · ${emp.note}`:""}</div>
                            </td>
                            <td style={{ ...S.tdMeta, color:"#475569" }}>{emp.regime}</td>
                            <td style={{ ...S.tdMeta, color:turnColor, fontWeight:900 }}>{emp.turn}</td>
                            {dayInfo.map(d => {
                              const k  = `${emp.id}-${d.day}`;
                              const ct = schedule[k];
                              const isFrancoWeekendPair = calcFrancoWeekendPair(emp.id, d, schedule, dayInfo);
                              const cs = getCellStyle(ct||'', isFrancoWeekendPair, emp.turn, customCellTypes);
                              const isYellowCol = d.isSunday || d.isHoliday;
                              const hasOwnBg    = ["LIC","EARLY","LATE","PM"].includes(ct) || customCellTypes.some(c=>c.key===ct);
                              const isLAR       = larDays.has(k);
                              const yellowBg    = isYellowCol && !hasOwnBg ? "#ffff00" : cs.bg;
                              const isSelected  = bulkMode && bulkSelected.has(k);
                              const cellBg      = isSelected ? "#bfdbfe" : isLAR ? (isYellowCol ? "rgba(251,191,36,0.7)" : "rgba(253,224,71,0.55)") : yellowBg;
                              const cellBorder  = isSelected ? "2px solid #1d4ed8" : isLAR ? "2px solid #f59e0b" : cs.border;
                              return (
                                <td key={d.day} style={{ background:cellBg, border:cellBorder, padding:0 }}>
                                <CellContextMenu empId={emp.id} day={d.day} current={ct} onSelect={type=>setCellValue(emp.id,d.day,type)} empTurn={emp.turn} customCellTypes={customCellTypes}>
                                    <div style={{ ...S.cell, background:cellBg, color:isSelected?"#1d4ed8":isLAR?"#92400e":cs.textColor, fontWeight:isLAR?900:cs.bold?900:400, cursor:bulkMode?"cell":"default", fontFamily:ct==="FE"?"'Georgia',serif":"'Barlow Condensed',sans-serif", fontStyle:ct==="FE"?"italic":"normal", fontSize:isLAR?7:undefined }}
                                      onClick={()=>handleCellClick(emp.id,d.day)}
                                      title={bulkMode?`Clic para ${bulkSelected.has(k)?"deseleccionar":"seleccionar"}`:ct==="EARLY"?`Sale antes (${earlyHsForEmp(emp)}hs)`:ct==="LATE"?`Sale después (${lateHsForEmp(emp)}hs)`:ct==="FE"?"Franco Especial":""}
                                    >{cs.label}</div>
                                  </CellContextMenu>
                                </td>
                              );
                            })}
                            <td style={{ ...S.tdMeta, color:mc, fontWeight:700, background:"#f1f5f9" }}>{worked}hs</td>
<td style={{ ...S.tdMeta, color:"#0369a1", fontWeight:700, background:"#e0f2fe" }}>
  {(() => {
    const isLARemp = [...larDays].some(k => k.startsWith(`${emp.id}-`));
    if (!isLARemp) return "—";
    const base = getRegimeHours(emp.regime);
    const reduced = emp.reduction > 0 ? Math.round(base * (1 - emp.reduction / 100)) : base;
    const wd = calcWorkingDays(year, month, holidays);
    const td = getDaysInMonth(year, month);
    return `${Math.round((wd * reduced) / td)}hs`;
  })()}
</td>
                            <td style={{ ...S.tdMeta, color:"#92400e", fontWeight:700, background:"#fff7ed" }}>{dayInfo.filter(d=>d.isSat&&isWorkShift(schedule[`${emp.id}-${d.day}`])).length}</td>
                            <td style={{ ...S.tdMeta, color:"#1d4ed8", fontWeight:700, background:"#ffff00" }}>{dayInfo.filter(d=>d.isSunday&&isWorkShift(schedule[`${emp.id}-${d.day}`])).length}</td>
                          </tr>
                        );
                        return [dividerRow, empRow].filter(Boolean);
                      }),
                      <tr key={`total-${turn}`}>
                        <td style={{ background:"#cbd5e1", padding:"3px 5px", textAlign:"center", fontSize:9, borderTop:"1px solid #000", borderBottom:"2px solid #000", borderLeft:"2px solid #000" }} />
                        <td colSpan={3} style={{ background:"#cbd5e1", color:"#1e293b", padding:"3px 10px", position:"sticky", left:0, zIndex:5, fontSize:10, fontWeight:900, borderTop:"1px solid #000", borderBottom:"2px solid #000", borderLeft:"1px solid #94a3b8", borderRight:"1px solid #94a3b8", fontStyle:"italic", letterSpacing:0.5 }}>TOTAL DE ENFERMEROS</td>
                        {dayInfo.map(d => {
                          const c   = countPerTurn(schedule, employees, d.day,jefeId)[turn];
                          const col = c===0?"#64748b":c<4?"#ef4444":c>8?"#f59e0b":"#059669";
                          return <td key={d.day} style={{ textAlign:"center", fontSize:11, fontWeight:900, color:col, background:"#cbd5e1", borderTop:"1px solid #000", borderBottom:"2px solid #000", borderLeft:"1px solid #94a3b8", borderRight:"1px solid #94a3b8", padding:"2px 0" }}>{c>0?c:""}</td>;
                        })}
                        <td colSpan={5} style={{ background:"#cbd5e1", borderTop:"1px solid #000", borderBottom:"2px solid #000", borderLeft:"2px solid #000" }} />
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ overflowX:"auto", overflowY:"hidden", height:14, background:"#e2e8f0", borderRadius:"0 0 4px 4px", border:"1px solid #cbd5e1", borderTop:"none" }}
              onScroll={e => { if(gridRef.current) gridRef.current.scrollLeft = e.target.scrollLeft; }}>
              <div style={{ height:1, width:`${3*175 + dayInfo.length*34 + 4*36}px` }} />
            </div>
          </div>
        </>}

        {/* PERSONAL */}
        {tab === "staff" && <>
          <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap", padding:12, background:"#fff", borderRadius:8, marginBottom:12 }}>
            {[["NOMBRE",<input key="n" style={{ ...S.formInput, width:200 }} placeholder="Apellido, Nombre" value={newEmp.name} onChange={e=>setNewEmp(p=>({...p,name:e.target.value}))} />],["RÉGIMEN",<select key="r" style={S.formSel} value={newEmp.regime} onChange={e=>setNewEmp(p=>({...p,regime:e.target.value}))}>{Object.entries(REGIMES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>],["TURNO",<select key="t" style={S.formSel} value={newEmp.turn} onChange={e=>setNewEmp(p=>({...p,turn:e.target.value}))}><option value="TM">TM — Mañana</option><option value="TT">TT — Tarde</option><option value="TN">TN — Noche</option></select>],["REDUCCIÓN %",<input key="rd" style={{ ...S.formInput, width:70 }} type="number" min={0} max={50} value={newEmp.reduction} onChange={e=>setNewEmp(p=>({...p,reduction:+e.target.value}))} />],["NOTA",<input key="nt" style={{ ...S.formInput, width:120 }} placeholder="Prest./Ingr./..." value={newEmp.note} onChange={e=>setNewEmp(p=>({...p,note:e.target.value}))} />]].map(([lbl,ctrl])=>(
              <div key={lbl} style={{ display:"flex", flexDirection:"column" }}><span style={S.formLabel}>{lbl}</span>{ctrl}</div>
            ))}
            <button style={S.btn("#059669")} onClick={()=>{if(!newEmp.name.trim())return;setEmployees(prev=>[...prev,{...newEmp,id:Date.now()}]);setNewEmp({name:"",regime:"R15",turn:"TM",reduction:0,note:""});}}>+ Agregar</button>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["#","Nombre","Régimen","Turno","Hs Objetivo","Reducción","Nota","Acciones"].map(h=><th key={h} style={{ background:"#fff", color:"#1e293b", padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:700, border:"1px solid #cbd5e1", borderBottom:"2px solid #000" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {employees.map((emp,i)=>{
                const isEdit=editEmpId===emp.id;const tc=emp.turn==="TM"?"#60a5fa":emp.turn==="TT"?"#fbbf24":"#a78bfa";const td={border:"1px solid #e2e8f0",padding:"7px 12px",fontSize:12,color:"#cbd5e1",background:"#fff"};
                return(<tr key={emp.id}><td style={{...td,color:"#94a3b8",width:30}}>{i+1}</td><td style={td}>{isEdit?<input style={{...S.formInput,width:180}} value={editData.name} onChange={e=>setEditData(p=>({...p,name:e.target.value}))} />:emp.name}</td><td style={td}>{isEdit?<select style={S.formSel} value={editData.regime} onChange={e=>setEditData(p=>({...p,regime:e.target.value}))}>{Object.entries(REGIMES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>:<span style={{background:"#e0e7ff",padding:"2px 7px",borderRadius:4,fontSize:10,color:"#1e40af"}}>{REGIMES[emp.regime]?.label}</span>}</td><td style={td}>{isEdit?<select style={S.formSel} value={editData.turn} onChange={e=>setEditData(p=>({...p,turn:e.target.value}))}><option value="TM">TM</option><option value="TT">TT</option><option value="TN">TN</option></select>:<span style={{color:tc,fontWeight:700}}>{emp.turn}</span>}</td><td style={{...td,color:"#059669",fontWeight:700}}>{targetHours(emp)}hs</td><td style={td}>{isEdit?<input style={{...S.formInput,width:60}} type="number" min={0} max={50} value={editData.reduction} onChange={e=>setEditData(p=>({...p,reduction:+e.target.value}))} />:emp.reduction>0?<span style={{color:"#fb923c",fontWeight:700}}>-{emp.reduction}%</span>:<span style={{color:"#94a3b8"}}>—</span>}</td><td style={{...td,fontSize:10,color:"#475569"}}>{isEdit?<input style={{...S.formInput,width:100}} value={editData.note} onChange={e=>setEditData(p=>({...p,note:e.target.value}))} />:emp.note||"—"}</td><td style={{...td,display:"flex",gap:4}}>{isEdit?<><button style={S.btn("#059669")} onClick={()=>{setEmployees(prev=>prev.map(e=>e.id===emp.id?{...e,...editData}:e));setEditEmpId(null);}}>✓</button><button style={S.btn("#e2e8f0","#475569")} onClick={()=>setEditEmpId(null)}>✕</button></>:<><button style={S.btn("#f59e0b","#000")} onClick={()=>{setEditEmpId(emp.id);setEditData({...emp});}}>✏️</button><button style={S.btn("#dc2626")} onClick={()=>{if(window.confirm(`¿Eliminar a ${emp.name}?`))setEmployees(prev=>prev.filter(e=>e.id!==emp.id));}}>🗑</button></>}</td></tr>);
              })}
            </tbody>
          </table>
        </>}

        {/* CONFIG */}
        {tab === "config" && <>
          <div style={S.cfgBox}>
            <div style={S.cfgTitle}>📋 DATOS DEL SERVICIO</div>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
              {[["SERVICIO",<input key="sv" style={{...S.formInput,width:160}} value={service} onChange={e=>setService(e.target.value)} />],["Nº CAMAS",<input key="bd" style={{...S.formInput,width:80}} type="number" value={beds} onChange={e=>setBeds(+e.target.value)} />],["AÑO",<input key="yr" style={{...S.formInput,width:90}} type="number" value={year} onChange={e=>setYear(+e.target.value)} />]].map(([l,c])=>(
                <div key={l} style={{ display:"flex", flexDirection:"column" }}><span style={S.formLabel}>{l}</span>{c}</div>
              ))}
            </div>
          </div>

          <div style={S.cfgBox}>
            <div style={S.cfgTitle}>⏱️ SALIDA ANTICIPADA / TARDÍA — Por turno</div>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>
              La celda rosada indica que el empleado sale <b>antes</b> del horario normal, y la verde que sale <b>después</b>.
              La inicial que se muestra siempre corresponde al turno (M / T / N).
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { turn:"TM", label:"Turno Mañana", color:"#1d4ed8", base:7  },
                { turn:"TT", label:"Turno Tarde",  color:"#15803d", base:7  },
                { turn:"TN", label:"Turno Noche",  color:"#111",    base:10 },
              ].map(({ turn, label, color, base }) => (
                <div key={turn} style={{ display:"flex", gap:20, flexWrap:"wrap", alignItems:"flex-end", padding:"10px 14px", background:"#f8fafc", borderRadius:8, border:`1px solid #e2e8f0`, borderLeft:`4px solid ${color}` }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:13, color, minWidth:120 }}>{turn} — {label}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:26, height:20, borderRadius:4, background:"#fce7f3", border:"2px solid #f9a8d4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:"#9d174d" }}>{TURN_LABEL[turn]}</div>
                      <span style={S.formLabel}>ROSADO — horas antes de fin de turno</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <input type="number" min={1} max={base-1} step={1}
                        value={earlyOffsets[turn] ?? 2}
                        onChange={e => setEarlyOffsets(p => ({ ...p, [turn]: Math.max(1, Math.min(base-1, +e.target.value)) }))}
                        style={{...S.formInput, width:60}}
                      />
                      <span style={{ fontSize:11, color:"#9d174d", fontWeight:700 }}>
                        → trabaja {base - (earlyOffsets[turn] ?? 2)}hs (sale {earlyOffsets[turn] ?? 2}hs antes)
                      </span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:26, height:20, borderRadius:4, background:"#dcfce7", border:"2px solid #86efac", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:"#166534" }}>{TURN_LABEL[turn]}</div>
                      <span style={S.formLabel}>VERDE — horas después de fin de turno</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <input type="number" min={1} max={6} step={1}
                        value={lateOffsets[turn] ?? 2}
                        onChange={e => setLateOffsets(p => ({ ...p, [turn]: Math.max(1, Math.min(6, +e.target.value)) }))}
                        style={{...S.formInput, width:60}}
                      />
                      <span style={{ fontSize:11, color:"#166534", fontWeight:700 }}>
                        → trabaja {base + (lateOffsets[turn] ?? 2)}hs (sale {lateOffsets[turn] ?? 2}hs después)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── TIPOS DE CELDA PERSONALIZADOS ── */}
          <div style={S.cfgBox}>
            <div style={S.cfgTitle}>🎨 TIPOS DE CELDA PERSONALIZADOS</div>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>
              Agregá tipos de turno especiales con color, inicial y horas propias. Aparecen en el menú contextual (click derecho) de cada celda.
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end", padding:"10px 12px", background:"#f8fafc", borderRadius:8, marginBottom:12, border:"1px solid #e2e8f0" }}>
              {[
                ["CLAVE (ej: HC)", <input key="k" style={{...S.formInput,width:70,textTransform:"uppercase"}} maxLength={5} placeholder="HC" value={newCustom.key} onChange={e=>setNewCustom(p=>({...p,key:e.target.value.toUpperCase().replace(/\s/g,"")}))} />],
                ["INICIAL", <input key="l" style={{...S.formInput,width:50}} maxLength={4} placeholder="HC" value={newCustom.label} onChange={e=>setNewCustom(p=>({...p,label:e.target.value}))} />],
                ["DESCRIPCIÓN", <input key="d" style={{...S.formInput,width:130}} placeholder="Horario especial" value={newCustom.desc} onChange={e=>setNewCustom(p=>({...p,desc:e.target.value}))} />],
                ["HS", <input key="h" style={{...S.formInput,width:55}} type="number" min={0} max={24} step={0.5} value={newCustom.hours} onChange={e=>setNewCustom(p=>({...p,hours:+e.target.value}))} />],
              ].map(([lbl,ctrl])=>(
                <div key={lbl} style={{ display:"flex", flexDirection:"column" }}><span style={S.formLabel}>{lbl}</span>{ctrl}</div>
              ))}
              <div style={{ display:"flex", flexDirection:"column" }}>
                <span style={S.formLabel}>COLOR FONDO</span>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <input type="color" value={newCustom.bg} onChange={e=>setNewCustom(p=>({...p,bg:e.target.value}))} style={{ width:36, height:30, border:"1px solid #cbd5e1", borderRadius:4, cursor:"pointer", padding:2 }} />
                  <span style={{ fontSize:9, color:"#94a3b8" }}>{newCustom.bg}</span>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <span style={S.formLabel}>COLOR TEXTO</span>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <input type="color" value={newCustom.fg} onChange={e=>setNewCustom(p=>({...p,fg:e.target.value}))} style={{ width:36, height:30, border:"1px solid #cbd5e1", borderRadius:4, cursor:"pointer", padding:2 }} />
                  <span style={{ fontSize:9, color:"#94a3b8" }}>{newCustom.fg}</span>
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <span style={S.formLabel}>COLOR BORDE</span>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <input type="color" value={newCustom.border} onChange={e=>setNewCustom(p=>({...p,border:e.target.value}))} style={{ width:36, height:30, border:"1px solid #cbd5e1", borderRadius:4, cursor:"pointer", padding:2 }} />
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column" }}>
                <span style={S.formLabel}>PREVIEW</span>
                <div style={{ width:36, height:28, borderRadius:4, background:newCustom.bg, color:newCustom.fg, border:`2px solid ${newCustom.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900 }}>
                  {newCustom.label||"?"}
                </div>
              </div>
              <button style={S.btn("#059669")} onClick={()=>{
                if (!newCustom.key || !newCustom.label) return;
                if (CELL_TYPES[newCustom.key] || customCellTypes.find(c=>c.key===newCustom.key)) { alert("Esa clave ya existe"); return; }
                setCustomCellTypes(prev=>[...prev, {...newCustom}]);
                setNewCustom({ key:"", label:"", bg:"#e0f2fe", fg:"#0369a1", border:"#38bdf8", hours:0, desc:"" });
              }}>+ Agregar</button>
            </div>
            {customCellTypes.length === 0
              ? <div style={{ fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>Sin tipos personalizados. Usá el formulario para crear uno.</div>
              : <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {customCellTypes.map((c,i) => (
                    <div key={c.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8 }}>
                      <div style={{ width:30, height:24, borderRadius:4, background:c.bg, color:c.fg, border:`2px solid ${c.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900 }}>{c.label}</div>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:"#1e293b" }}>{c.key} — {c.desc||c.label}</div>
                        <div style={{ fontSize:9, color:"#94a3b8" }}>{c.hours}hs · fondo {c.bg} · texto {c.fg}</div>
                      </div>
                      <button onClick={()=>setCustomCellTypes(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"1px solid #fca5a5", borderRadius:4, color:"#ef4444", cursor:"pointer", fontSize:11, padding:"2px 7px" }}>✕</button>
                    </div>
                  ))}
                </div>
            }
          </div>

          <div style={S.cfgBox}>
            <div style={S.cfgTitle}>🔴 FERIADOS — {MONTHS[month].toUpperCase()} {year}</div>
            <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" }}>
              <div style={{ display:"flex", flexDirection:"column" }}><span style={S.formLabel}>DÍA DEL MES</span><input style={{...S.formInput,width:80}} type="number" min={1} max={daysInMonth} value={newHoliday} onChange={e=>setNewHoliday(e.target.value)} /></div>
              <button style={S.btn("#dc2626")} onClick={()=>{const d=parseInt(newHoliday);if(d>=1&&d<=daysInMonth&&!holidays.includes(d)){setHolidays(prev=>[...prev,d].sort((a,b)=>a-b));setNewHoliday("");}}}>+ Agregar feriado</button>
            </div>
            <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:6 }}>
              {holidays.length===0?<span style={{ fontSize:11, color:"#94a3b8" }}>Sin feriados cargados este mes</span>:holidays.map(d=><span key={d} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:20, fontSize:11, color:"#991b1b" }}>Día {d} — {WDAYS[getDow(year,month,d)]}<button onClick={()=>setHolidays(prev=>prev.filter(x=>x!==d))} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:13 }}>×</button></span>)}
            </div>
          </div>

          <div style={S.cfgBox}>
            <div style={S.cfgTitle}>📊 CARGA HORARIA MENSUAL POR RÉGIMEN</div>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:14 }}>
              Editá las horas base de cada régimen. El cálculo mensual real se ajusta automáticamente con la fórmula: <b>(días hábiles × hs régimen) ÷ días totales</b>.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[
                { key:"R15", label:"Régimen 15",   color:"#1e40af", bg:"#eff6ff", note:"Corresponde aprox. a 40hs/semana" },
                { key:"R27", label:"Régimen 27",   color:"#15803d", bg:"#f0fdf4", note:"Corresponde aprox. a 36hs/semana" },
                { key:"H24", label:"24hs Semanal", color:"#92400e", bg:"#fffbeb", note:"Corresponde aprox. a 24hs/semana" },
              ].map(({ key, label, color, bg, note }) => {
                const hs = regimeHours[key] ?? REGIMES[key].hours;
                const defaultHs = REGIMES[key].hours;
                const changed = hs !== defaultHs;
                const wd = calcWorkingDays(year, month, holidays);
                const td = getDaysInMonth(year, month);
                const mensual = hs;
                return (
                  <div key={key} style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap", padding:"12px 16px", background:bg, border:`1px solid ${color}40`, borderLeft:`4px solid ${color}`, borderRadius:8 }}>
                    <div style={{ minWidth:130 }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:14, color }}>{label}</div>
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:2 }}>{note}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      <span style={S.formLabel}>HS MENSUALES BASE</span>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <input
                          type="number" min={40} max={240} step={1}
                          value={hs}
                          onChange={e => setRegimeHours(p => ({ ...p, [key]: Math.max(40, Math.min(240, +e.target.value)) }))}
                          style={{ ...S.formInput, width:72, fontWeight:700, color, fontSize:14 }}
                        />
                        <span style={{ fontSize:11, color:"#475569" }}>hs/mes</span>
                        {changed && (
                          <button onClick={() => setRegimeHours(p => ({ ...p, [key]: defaultHs }))}
                            style={{ background:"none", border:"1px solid #94a3b8", borderRadius:4, color:"#64748b", cursor:"pointer", fontSize:10, padding:"2px 7px" }}
                            title={`Restaurar valor original (${defaultHs}hs)`}>↩ {defaultHs}hs</button>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 16px", background:"#fff", borderRadius:8, border:"1px solid #e2e8f0", minWidth:110 }}>
                      <div style={{ fontSize:9, color:"#94a3b8", fontWeight:700, letterSpacing:.5 }}>HS BASE MENSUAL</div>
                      <div style={{ fontSize:20, fontWeight:900, color, lineHeight:1.1 }}>{mensual}hs</div>
          
                       <div style={{ fontSize:9, color:"#94a3b8" }}>solo empleados con LAR usan fórmula reducida</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={S.cfgBox}>
            <div style={S.cfgTitle}>⚖️ BALANCE DE HORAS POR TURNO — {MONTHS[month].toUpperCase()} {year}</div>
            {["TM","TT","TN"].map(turn=>{
              const emps=employees.filter(e=>e.turn===turn);const totalObj=emps.reduce((s,e)=>s+targetHours(e),0);const totalCarg=emps.reduce((s,e)=>s+workedHours(schedule,e.id,daysInMonth,earlyHsForEmp(e),lateHsForEmp(e),[],reducedDailyHsForEmp(e)),0);const diff=totalCarg-totalObj;const turnColor=turn==="TM"?"#1d4ed8":turn==="TT"?"#15803d":"#111";const diffColor=diff===0?"#059669":diff>0?"#dc2626":"#f59e0b";const turnLabel=turn==="TM"?"Mañana":turn==="TT"?"Tarde":"Noche";
              return(
                <div key={turn} style={{ borderBottom:"1px solid #e2e8f0", padding:"10px 0" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", marginBottom:6 }}>
                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:14, color:turnColor, minWidth:70 }}>{turn} — {turnLabel}</span>
                    <span style={{ fontSize:11, color:"#475569" }}>Objetivo: <b>{totalObj}hs</b></span>
                    <span style={{ fontSize:11, color:"#475569" }}>Cargadas: <b style={{ color:diffColor }}>{totalCarg}hs</b></span>
                    <span style={{ fontSize:11, fontWeight:700, color:diffColor }}>{diff===0?"✅ Exacto":diff>0?`🔴 +${diff}hs de exceso`:`🟡 ${diff}hs faltantes`}</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                    {emps.map(e=>{const w=workedHours(schedule,e.id,daysInMonth,earlyHsForEmp(e),lateHsForEmp(e),[],reducedDailyHsForEmp(e));const t=targetHours(e);const d=w-t;const c=d===0?"#059669":d>0?"#dc2626":"#f59e0b";return(<span key={e.id} style={{ fontSize:10, background:"#f8fafc", border:`1px solid ${c}`, borderRadius:8, padding:"2px 8px", color:c, fontWeight:600 }}>{e.name.split(" ")[0]}: {w}/{t}hs {d>0?`(+${d})`:d<0?`(${d})`:"✓"}</span>);})}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={S.cfgBox}>
            <div style={S.cfgTitle}>📏 REGLAS</div>
            {["Franco obligatorio: 1 finde completo (sáb+dom juntos) + 1 sábado libre adicional + 1 domingo libre adicional","FE en sábado + F/FE en domingo siguiente = cuenta como finde completo","FE = F° (Franco Especial) — se carga manualmente antes del auto-completar","Personal por guardia: mínimo 4 · máximo 8 enfermeros","TM y TT: máximo 4 guardias consecutivas · TN: máximo 2 guardias consecutivas","Click derecho → menú individual · Botones Lic/LAR/F° → selección múltiple · Ctrl+Z → deshacer"].map((t,i)=>(
              <div key={i} style={{ fontSize:12, color:"#475569", padding:"5px 0", borderBottom:"1px solid #e2e8f0", display:"flex", gap:8 }}><span style={{ color:"#1e40af", fontWeight:700 }}>•</span> {t}</div>
            ))}
          </div>
        
        
  <div style={S.cfgTitle}>🏥 GUARDIA HOSPITALARIA MENSUAL (mín. 24hs)</div>
  <div style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>
    Conta las horas trabajadas en <b>domingos + feriados (todos los turnos)</b> y <b>sábados tarde/noche</b>.
    El turno mañana del sábado <b>no cuenta</b> como guardia hospitalaria.
  </div>

  {/* Resumen por turno */}
  {["TM","TT","TN"].map(turn => {
    const emps = employees.filter(e => e.turn === turn);
    if (!emps.length) return null;
    const turnColor = turn==="TM"?"#1d4ed8":turn==="TT"?"#15803d":"#111";
    const turnLabel = turn==="TM"?"Turno Mañana":turn==="TT"?"Turno Tarde":"Turno Noche";

    return (
      <div key={turn} style={{ marginBottom:16 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:13, color:turnColor, borderBottom:`2px solid ${turnColor}`, paddingBottom:4, marginBottom:8 }}>
          {turn} — {turnLabel}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:6 }}>
          {emps.map(emp => {
            const ghHs   = calcGuardiaHospitalaria(schedule, emp, dayInfo, daysInMonth);
            const cumple  = ghHs >= 24;
            const pct     = Math.min(100, Math.round((ghHs / 24) * 100));
            const barColor = ghHs === 0 ? "#ef4444" : ghHs < 24 ? "#f59e0b" : "#059669";

            return (
              <div key={emp.id} style={{ padding:"8px 12px", background: cumple ? "#f0fdf4" : ghHs===0 ? "#fef2f2" : "#fffbeb", border:`1px solid ${cumple?"#86efac":ghHs===0?"#fca5a5":"#fcd34d"}`, borderRadius:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#1e293b" }}>{emp.name}</span>
                  <span style={{ fontSize:13, fontWeight:900, color:barColor }}>{ghHs}hs</span>
                </div>
                {/* Barra de progreso */}
                <div style={{ height:6, background:"#e2e8f0", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:3, transition:"width .3s" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                  <span style={{ fontSize:9, color:"#94a3b8" }}>0hs</span>
                  <span style={{ fontSize:9, fontWeight:700, color:barColor }}>
                    {cumple ? "✅ Cumple" : `🔴 Faltan ${24 - ghHs}hs`}
                  </span>
                  <span style={{ fontSize:9, color:"#94a3b8" }}>24hs</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  })}

     <div style={S.cfgBox}>
            <div style={S.cfgTitle}>🏥 GUARDIA HOSPITALARIA MENSUAL (mín. 24hs)</div>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:12 }}>
              Horas en <b>domingos + feriados (todos los turnos)</b> y <b>sábados tarde/noche</b>.
              Turno mañana del sábado <b>no cuenta</b>.
            </div>
            {["TM","TT","TN"].map(turn => {
              const emps = employees.filter(e => e.turn === turn);
              if (!emps.length) return null;
              const turnColor = turn==="TM"?"#1d4ed8":turn==="TT"?"#15803d":"#111";
              const turnLabel = turn==="TM"?"Turno Mañana":turn==="TT"?"Turno Tarde":"Turno Noche";
              return (
                <div key={turn} style={{ marginBottom:16 }}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:13, color:turnColor, borderBottom:`2px solid ${turnColor}`, paddingBottom:4, marginBottom:8 }}>
                    {turn} — {turnLabel}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px,1fr))", gap:6 }}>
                    {emps.map(emp => {
                      const ghHs    = calcGuardiaHospitalaria(schedule, emp, dayInfo, daysInMonth);
                      const cumple  = ghHs >= 24;
                      const pct     = Math.min(100, Math.round((ghHs / 24) * 100));
                      const barColor = ghHs === 0 ? "#ef4444" : ghHs < 24 ? "#f59e0b" : "#059669";
                      return (
                        <div key={emp.id} style={{ padding:"8px 12px", background:cumple?"#f0fdf4":ghHs===0?"#fef2f2":"#fffbeb", border:`1px solid ${cumple?"#86efac":ghHs===0?"#fca5a5":"#fcd34d"}`, borderRadius:8 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:"#1e293b" }}>{emp.name}</span>
                            <span style={{ fontSize:13, fontWeight:900, color:barColor }}>{ghHs}hs</span>
                          </div>
                          <div style={{ height:6, background:"#e2e8f0", borderRadius:3, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:3 }} />
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
                            <span style={{ fontSize:9, color:"#94a3b8" }}>0hs</span>
                            <span style={{ fontSize:9, fontWeight:700, color:barColor }}>
                              {cumple ? "✅ Cumple" : `🔴 Faltan ${24 - ghHs}hs`}
                            </span>
                            <span style={{ fontSize:9, color:"#94a3b8" }}>24hs</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {(() => {
              const noCumplen = employees.filter(e => calcGuardiaHospitalaria(schedule, e, dayInfo, daysInMonth) < 24);
              return (
                <div style={{ marginTop:12, padding:"10px 16px", background:noCumplen.length===0?"#f0fdf4":"#fef2f2", border:`1px solid ${noCumplen.length===0?"#86efac":"#fca5a5"}`, borderRadius:8, fontSize:12, fontWeight:700, color:noCumplen.length===0?"#15803d":"#991b1b" }}>
                  {noCumplen.length === 0
                    ? "✅ Todo el personal cumple las 24hs de guardia hospitalaria"
                    : `🔴 ${noCumplen.length} empleado${noCumplen.length>1?"s":""} no cumple${noCumplen.length>1?"n":""}: ${noCumplen.map(e=>e.name.split(" ")[0]).join(", ")}`
                  }
                </div>
              );
            })()}
          </div>

        </>}
      </div>
    </div>
  );
}