import { CELL_TYPES, MAX_CONSEC_FRANCO } from "../constants";

export function effectiveHours(
  emp,
  year,
  month,
  holidays,
  getRegHours,
  larDays,
  daysInMonth,
) {
  // El objetivo es siempre la carga mensual completa
  // Las horas de LAR se suman en workedHours
  const base = getRegHours(emp.regime);
  return emp.reduction > 0
    ? Math.round(base * (1 - emp.reduction / 100))
    : base;
}

export function workedHours(
  schedule,
  empId,
  days,
  earlyHsFor = 0,
  lateHsFor = 0,
  customTypes = [],
  baseHsOverride = null,
  larDays = null,
  empTurn = null,
  cargaMensual = null,
  month = null,
) {
  const earlyHs =
    typeof earlyHsFor === "function" ? earlyHsFor(empId) : earlyHsFor;
  const lateHs = typeof lateHsFor === "function" ? lateHsFor(empId) : lateHsFor;
  let total = 0;

  // Sumar horas de días LAR (proporcional: carga/30 por día)
  if (larDays && cargaMensual) {
    const diasLAR = [...larDays].filter((k) =>
      k.startsWith(`${empId}-`),
    ).length;
    if (diasLAR > 0) {
      const divisor = month === 1 ? 28 : 30;
      total += Math.round((cargaMensual / divisor) * diasLAR);
    }
  }

  for (let d = 1; d <= days; d++) {
    const ct = schedule[`${empId}-${d}`];
    if (!ct) continue;
    if (ct === "EARLY") {
      total += earlyHs;
      continue;
    }
    if (ct === "LATE") {
      total += lateHs;
      continue;
    }
    if (CELL_TYPES[ct]) {
      const stdHours = CELL_TYPES[ct].hours;
      if (baseHsOverride !== null && stdHours > 0) {
        total += baseHsOverride;
      } else {
        total += stdHours;
      }
      continue;
    }
    const cust = customTypes.find((c) => c.key === ct);
    if (cust) total += cust.hours || 0;
  }
  return total;
}

export function countPerTurn(
  schedule,
  employees,
  day,
  jefeId = null,
  pmpIds = null,
) {
  const c = { TM: 0, TT: 0, TN: 0 };
  for (const emp of employees) {
    if (jefeId && emp.id === jefeId) continue; // ← excluye jefa
    if (pmpIds && pmpIds.has(emp.id)) continue; // ← excluye PMP
    const ct = schedule[`${emp.id}-${day}`];
    if (["TM", "EARLY", "LATE"].includes(ct)) c.TM++;
    else if (ct === "TT") c.TT++;
    else if (ct === "TN") c.TN++;
  }
  return c;
}

export const isWorkShift = (ct) =>
  ["TM", "TT", "TN", "EARLY", "LATE"].includes(ct);
// Máximo consecutivo por régimen (TM/TT): R27=4, R15=6, TN=2
export function maxConsecForEmp(emp) {
  if (emp.turn === "TN") return 2;
  return emp.regime === "R15" ? 6 : 4;
}

export function consecutivesBefore(next, empId, day) {
  let count = 0;
  for (let d = day - 1; d >= 1; d--) {
    if (isWorkShift(next[`${empId}-${d}`])) count++;
    else break;
  }
  return count;
}

export function countPerTurnInNext(next, employees, day, turn, jefeId = null) {
  let c = 0;
  for (const emp of employees) {
    if (jefeId && emp.id === jefeId) continue; // excluye jefa
    const ct = next[`${emp.id}-${day}`];
    if (turn === "TM" && ["TM", "EARLY", "LATE"].includes(ct)) c++;
    else if (turn === "TT" && ct === "TT") c++;
    else if (turn === "TN" && ct === "TN") c++;
  }
  return c;
}

export const canCoverOtherTurn = (emp) =>
  emp.reduction === 0 && emp.regime !== "H24";

export function autoFillAll(
  employees,
  schedule,
  dayInfo,
  daysInMonth,
  getTarget,
  getEarlyHs,
  getLateHs,
  getReducedDailyHs = () => null,
  jefeId = null,
  larDays = new Set(),
  pmpIds = new Set(),
) {
  const next = { ...schedule };
  const original = { ...schedule };
  const byTurn = { TM: [], TT: [], TN: [] };
  // La jefa se excluye del staff operativo — tiene su propio cronograma pero no cuenta como cobertura
  // PMP incluidos en byTurn para generar su cronograma, pero excluidos de conteos de cobertura
  for (const emp of employees)
    if (byTurn[emp.turn] && emp.id !== jefeId) byTurn[emp.turn].push(emp);
  // Separar PMP para referencia
  const pmpEmpsArr = employees.filter((e) => pmpIds.has(e.id));
  // Generar cronograma de la jefa por separado (mismas reglas de horas, sin afectar cobertura)
  const jefeEmpArr = jefeId ? employees.filter((e) => e.id === jefeId) : [];

  // Una celda está bloqueada si tiene FE, LIC o LAR — nunca se pisa
  const blocked = (empId, day) => {
    const v = original[`${empId}-${day}`];
    return v != null && v !== "";
  };

  // Días protegidos: fines de semana asignados, no se trabajan ni se pisan
  const protectedDays = new Map();
  for (const emp of employees) protectedDays.set(emp.id, new Set());
  const protect = (empId, day) => protectedDays.get(empId).add(day);
  const isProtected = (empId, day) => protectedDays.get(empId)?.has(day);

  // Solo escribe si no está bloqueado
  const setFranco = (empId, day) => {
    if (!blocked(empId, day)) next[`${empId}-${day}`] = "F";
  };
  const setTurno = (empId, day, t) => {
    if (!blocked(empId, day) && !isProtected(empId, day))
      next[`${empId}-${day}`] = t;
  };

  // ── Pares sáb+dom del mes ──
  const weekendPairs = [];
  for (const d of dayInfo) {
    if (d.isSat) {
      const sun = dayInfo.find((x) => x.day === d.day + 1 && x.isSunday);
      if (sun) weekendPairs.push({ sat: d.day, sun: sun.day });
    }
  }
  const allSats = dayInfo.filter((d) => d.isSat).map((d) => d.day);
  const allSuns = dayInfo.filter((d) => d.isSunday).map((d) => d.day);

  // Índices de rotación distribuida por turno
  const pairIdxByTurn = { TM: 0, TT: 0, TN: 0 };
  const satIdxByTurn = { TM: 0, TT: 0, TN: 0 };
  const sunIdxByTurn = { TM: 0, TT: 0, TN: 0 };

  // Pre-calcular offset por empleado para distribuir a lo largo del mes
  const empPairOffset = new Map();
  const empSatOffset = new Map();
  const empSunOffset = new Map();
  for (const turn of ["TM", "TT", "TN"]) {
    const emps = employees.filter((e) => e.turn === turn);
    emps.forEach((emp, idx) => {
      empPairOffset.set(emp.id, idx);
      empSatOffset.set(emp.id, idx);
      empSunOffset.set(emp.id, idx);
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

    const findesPreexistentes = weekendPairs.filter(
      (p) => isFreeOrFE(emp.id, p.sat) && isFreeOrFE(emp.id, p.sun),
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
      const validos = weekendPairs.filter(
        (p) => !blocked(emp.id, p.sat) && !blocked(emp.id, p.sun),
      );
      if (validos.length > 0) {
        const empIdxInTurn = Math.max(0, byTurn[turn].indexOf(emp));
        const totalInTurn = Math.max(1, byTurn[turn].length);
        const pairIdx = Math.floor(
          (empIdxInTurn * validos.length) / totalInTurn,
        );
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
    const satPool = allSats.filter(
      (s) => s !== findePar?.sat && !blocked(emp.id, s),
    );
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
    const sunPool = allSuns.filter((s) => {
      if (s === findePar?.sun) return false; // ya usado
      if (blocked(emp.id, s)) return false; // LIC / FE
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
        while (
          j < dayInfo.length &&
          (dayInfo[j].isHoliday || dayInfo[j].isWeekend)
        ) {
          block.push(dayInfo[j]);
          j++;
        }
        // Solo bloques de 3+ días que mezclen feriado y finde
        const hasHol = block.some((x) => x.isHoliday);
        const hasWeekend = block.some((x) => x.isWeekend);
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
      const blockDays = block.map((d) => d.day);
      // Cada empleado descansa la mitad (redondeando arriba)
      const half = Math.ceil(block.length / 2);

      for (const turn of ["TM", "TT", "TN"]) {
        const emps = byTurn[turn];
        if (!emps.length) continue;

        emps.forEach((emp, empIdx) => {
          // Días del bloque disponibles para este empleado
          const available = blockDays.filter(
            (day) => !blocked(emp.id, day) && !isProtected(emp.id, day),
          );
          if (available.length === 0) return;

          // Rotación: cada empleado arranca desde un punto distinto
          // para que la cobertura quede distribuida entre el equipo
          const offset = empIdx % available.length;
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
      const target = getTarget(emp);
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
        .filter((d) => !blocked(emp.id, d.day) && !isProtected(emp.id, d.day))
        .map((d) => d.day)
        .sort((a, b) => a - b);

      // Horas ya fijadas (LIC, FE, EARLY, LATE, LAR pre-existentes)
      // ── Fórmula limpia: guardias = carga horaria mensual / hs por turno ──
      // TM y TT → target / 7    |    TN → target / 10
      // Las horas ya fijas (EARLY, LATE, LIC, LAR pre-cargados) se descuentan
      const horasFijas = Object.entries(next)
        .filter(([k]) => k.startsWith(`${emp.id}-`))
        .reduce((acc, [, v]) => {
          if (v === "EARLY") return acc + getEarlyHs(emp);
          if (v === "LATE") return acc + getLateHs(emp);
          if (v === "LIC" || v === "LAR" || v === "FE") return acc; // 0 hs
          if (isWorkShift(v)) return acc + tHours;
          return acc;
        }, 0);

      // Guardias exactas a trabajar = (carga horaria - ya fijas) / hs diarias
      const totalGuardias = Math.round(target / tHours); // ej: 144/7 = 21
      const guardiasYaFijas = Math.round(horasFijas / tHours); // EARLY/LATE ya contados
      const needed = Math.max(0, totalGuardias - guardiasYaFijas);
      if (needed === 0 || available.length === 0) return;

      const effectiveNeeded = Math.min(needed, available.length);
      const maxConsec = maxConsecForEmp(emp);
      const toWork = new Set();

      if (turn === "TN") {
        // ── Patrón TN: N N F F … (prioridad), sino N N F ──
        // Respeta celdas bloqueadas/protegidas: si un día no está disponible
        // se salta en el patrón pero se mantiene el ritmo.
        let workStreak = 0; // noches consecutivas asignadas
        let francoStreak = 0; // francos consecutivos del patrón
        const WORK_BLOCK = 2;
        const FRANCO_PREF = 2; // preferido
        const FRANCO_MIN = 1; // mínimo si no alcanza

        // Fase 1: intentar N N F F
        let phase = "work"; // "work" | "franco"
        let wCount = 0,
          fCount = 0;
        for (const d of available) {
          if (toWork.size >= effectiveNeeded) break;
          // Si el día está bloqueado (puesto por usuario), lo tratamos como franco de corte
          if (blocked(emp.id, d) || isProtected(emp.id, d)) {
            // cuenta como corte si estábamos en racha de trabajo
            if (phase === "work") {
              phase = "franco";
              fCount = 1;
              wCount = 0;
            } else {
              fCount++;
              if (fCount >= FRANCO_PREF) {
                phase = "work";
                wCount = 0;
                fCount = 0;
              }
            }
            continue;
          }
          if (phase === "work") {
            toWork.add(d);
            wCount++;
            if (wCount >= WORK_BLOCK) {
              phase = "franco";
              fCount = 0;
              wCount = 0;
            }
          } else {
            fCount++;
            if (fCount >= FRANCO_PREF) {
              phase = "work";
              wCount = 0;
              fCount = 0;
            }
          }
        }

        // Fase 2: si faltan días de trabajo, relajar a N N F
        if (toWork.size < effectiveNeeded) {
          toWork.clear();
          phase = "work";
          wCount = 0;
          fCount = 0;
          for (const d of available) {
            if (toWork.size >= effectiveNeeded) break;
            if (blocked(emp.id, d) || isProtected(emp.id, d)) {
              if (phase === "work") {
                phase = "franco";
                fCount = 1;
                wCount = 0;
              } else {
                fCount++;
                if (fCount >= FRANCO_MIN) {
                  phase = "work";
                  wCount = 0;
                  fCount = 0;
                }
              }
              continue;
            }
            if (phase === "work") {
              toWork.add(d);
              wCount++;
              if (wCount >= WORK_BLOCK) {
                phase = "franco";
                fCount = 0;
                wCount = 0;
              }
            } else {
              fCount++;
              if (fCount >= FRANCO_MIN) {
                phase = "work";
                wCount = 0;
                fCount = 0;
              }
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
        let streak = 0; // racha de trabajo actual
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
    const target = getTarget(emp);
    const tHoursBase = CELL_TYPES[emp.turn]?.hours || 7;
    const reducedDailyHs = getReducedDailyHs(emp);
    const tHours = reducedDailyHs !== null ? reducedDailyHs : tHoursBase;

    for (const d of dayInfo) {
      const k = `${emp.id}-${d.day}`;
      if (!next[k]) next[k] = "F";
    }

    const available = dayInfo
      .filter((d) => !blocked(emp.id, d.day) && !isProtected(emp.id, d.day))
      .map((d) => d.day)
      .sort((a, b) => a - b);

    const horasFijas = Object.entries(next)
      .filter(([k]) => k.startsWith(`${emp.id}-`))
      .reduce((acc, [, v]) => {
        if (v === "EARLY") return acc + getEarlyHs(emp);
        if (v === "LATE") return acc + getLateHs(emp);
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
    let streak = 0,
      remaining = effectiveNeeded;

    for (let d = 1; d <= daysInMonth && remaining > 0; d++) {
      const v = next[`${emp.id}-${d}`];
      if (!availSet.has(d)) {
        isWorkShift(v) ? streak++ : (streak = 0);
        continue;
      }
      if (streak >= maxConsec) {
        streak = 0;
      } else {
        toWork.add(d);
        streak++;
        remaining--;
      }
    }
    if (toWork.size < effectiveNeeded) {
      for (const d of available) {
        if (toWork.size >= effectiveNeeded) break;
        if (!toWork.has(d)) toWork.add(d);
      }
    }
    for (const d of toWork) setTurno(emp.id, d, emp.turn);
  }

  // ═══════════════════════════════════════════════════════════════
  // PASO 3 — Garantizar mínimo 4 por turno por día
  // RESTRICCIÓN: solo se puede mover a alguien si ese día NO es
  // un día protegido (finde/suelto) → así no se rompe la regla del finde único
  // ═══════════════════════════════════════════════════════════════
  let changed = true,
    passes = 0;
  while (changed && passes < 15) {
    changed = false;
    passes++;
    for (const di of dayInfo) {
      for (const turn of ["TM", "TT", "TN"]) {
        let current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
        if (current >= 4) continue;

        const propios = byTurn[turn]
          .filter((emp) => {
            const tH = CELL_TYPES[emp.turn]?.hours || 7;
            const wH = workedHours(
              next,
              emp.id,
              daysInMonth,
              getEarlyHs(emp),
              getLateHs(emp),
              [],
              getReducedDailyHs(emp),
            );
            return (
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day) && // ← respeta fin de semana
              consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp) &&
              wH + tH <= getTarget(emp) + tH // no superar objetivo + 1 turno de margen
            );
          })
          .sort(
            (a, b) =>
              workedHours(
                next,
                a.id,
                daysInMonth,
                getEarlyHs(a),
                getLateHs(a),
                [],
                getReducedDailyHs(a),
              ) -
              workedHours(
                next,
                b.id,
                daysInMonth,
                getEarlyHs(b),
                getLateHs(b),
                [],
                getReducedDailyHs(b),
              ),
          );
        for (let i = 0; i < 4 - current && i < propios.length; i++) {
          next[`${propios[i].id}-${di.day}`] = turn;
          changed = true;
        }

        current = countPerTurnInNext(next, employees, di.day, turn, jefeId);
        if (current >= 4) continue;

        const foraneos = employees
          .filter((emp) => {
            const tH = CELL_TYPES[emp.turn]?.hours || 7;
            const wH = workedHours(
              next,
              emp.id,
              daysInMonth,
              getEarlyHs(emp),
              getLateHs(emp),
              [],
              getReducedDailyHs(emp),
            );
            return (
              emp.turn !== turn &&
              canCoverOtherTurn(emp) &&
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day) && // ← respeta fin de semana
              consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp) &&
              wH + tH <= getTarget(emp) + tH // no superar objetivo + 1 turno de margen
            );
          })
          .sort(
            (a, b) =>
              workedHours(
                next,
                a.id,
                daysInMonth,
                getEarlyHs(a),
                getLateHs(a),
                [],
                getReducedDailyHs(a),
              ) -
              workedHours(
                next,
                b.id,
                daysInMonth,
                getEarlyHs(b),
                getLateHs(b),
                [],
                getReducedDailyHs(b),
              ),
          );
        for (let i = 0; i < 4 - current && i < foraneos.length; i++) {
          next[`${foraneos[i].id}-${di.day}`] = turn;
          changed = true;
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
        .filter(
          (emp) =>
            next[`${emp.id}-${di.day}`] === turn &&
            !blocked(emp.id, di.day) &&
            !isProtected(emp.id, di.day),
        )
        .sort(
          (a, b) =>
            workedHours(
              next,
              b.id,
              daysInMonth,
              getEarlyHs(b),
              getLateHs(b),
              [],
              getReducedDailyHs(b),
            ) -
            workedHours(next, a.id, daysInMonth, getEarlyHs(a), getLateHs(a)),
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
    let worked = workedHours(
      next,
      emp.id,
      daysInMonth,
      getEarlyHs(emp),
      getLateHs(emp),
      [],
      getReducedDailyHs(emp),
    );
    if (worked <= target) continue;

    const workDays = dayInfo
      .filter(
        (di) =>
          isWorkShift(next[`${emp.id}-${di.day}`]) &&
          !blocked(emp.id, di.day) &&
          !isProtected(emp.id, di.day),
      )
      .sort(
        (a, b) =>
          countPerTurnInNext(next, employees, b.day, emp.turn, jefeId) -
          countPerTurnInNext(next, employees, a.day, emp.turn, jefeId),
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
    let worked = workedHours(
      next,
      emp.id,
      daysInMonth,
      getEarlyHs(emp),
      getLateHs(emp),
      [],
      getReducedDailyHs(emp),
    );
    if (worked >= target) continue;

    // Días con F convertibles — respeta solo bloqueados y protegidos
    const frankDays = dayInfo
      .filter(
        (di) =>
          next[`${emp.id}-${di.day}`] === "F" &&
          !blocked(emp.id, di.day) &&
          !isProtected(emp.id, di.day),
      )
      .sort(
        (a, b) =>
          // Priorizar días donde hay menos gente del turno (equilibra cobertura)
          countPerTurnInNext(next, employees, a.day, emp.turn, jefeId) -
          countPerTurnInNext(next, employees, b.day, emp.turn, jefeId),
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
  let francoPasses = 0;
  while (francoChanged && francoPasses < 15) {
    francoChanged = false;
    francoPasses++;
    for (const emp of employees) {
      let streak = 0;
      let streakDays = [];

      const flushStreak = () => {
        if (streak > MAX_CONSEC_FRANCO) {
          const convertible = streakDays.filter(
            (d) =>
              next[`${emp.id}-${d}`] === "F" &&
              !blocked(emp.id, d) &&
              !isProtected(emp.id, d),
          );
          if (convertible.length > 0) {
            const pick = convertible
              .slice()
              .sort(
                (a, b) =>
                  countPerTurnInNext(next, employees, a, emp.turn, jefeId) -
                  countPerTurnInNext(next, employees, b, emp.turn, jefeId),
              )[0];
            next[`${emp.id}-${pick}`] = emp.turn;
            francoChanged = true;
          }
        }
        streak = 0;
        streakDays = [];
      };

      for (let d = 1; d <= daysInMonth; d++) {
        const v = next[`${emp.id}-${d}`];
        const isOff = !isWorkShift(v);
        if (isOff) {
          streak++;
          streakDays.push(d);
        } else {
          flushStreak();
        }
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
      if (!larDays.has(kLar)) continue; // día d no es LAR
      const kPrev = `${emp.id}-${d - 1}`;
      const vPrev = next[kPrev];
      // Si el día anterior es turno de trabajo y no está bloqueado → franco
      if (
        isWorkShift(vPrev) &&
        !blocked(emp.id, d - 1) &&
        !isProtected(emp.id, d - 1)
      ) {
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
    let worked = workedHours(
      next,
      emp.id,
      daysInMonth,
      getEarlyHs(emp),
      getLateHs(emp),
      [],
      getReducedDailyHs(emp),
    );
    if (worked <= target) continue;

    const workDays = dayInfo
      .filter(
        (di) =>
          isWorkShift(next[`${emp.id}-${di.day}`]) &&
          !blocked(emp.id, di.day) &&
          !isProtected(emp.id, di.day),
      )
      .sort(
        (a, b) =>
          // Primero los días con más gente trabajando (menor impacto al sacarla)
          countPerTurnInNext(next, employees, b.day, emp.turn) -
          countPerTurnInNext(next, employees, a.day, emp.turn),
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

      const blockedFrancosCount = (byTurn[turn] || []).filter((emp) => {
        const orig = original[`${emp.id}-${di.day}`];
        return (
          orig === "F" ||
          orig === "FE" ||
          orig === "LAR" ||
          orig === "LIC" ||
          orig === "PMP"
        );
      }).length;

      if (blockedFrancosCount === 0) continue;

      const candidates = (byTurn[turn] || [])
        .filter(
          (emp) =>
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) &&
            !isProtected(emp.id, di.day) &&
            consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp),
        )
        .sort(
          (a, b) =>
            workedHours(
              next,
              a.id,
              daysInMonth,
              getEarlyHs(a),
              getLateHs(a),
              [],
              getReducedDailyHs(a),
            ) -
            workedHours(
              next,
              b.id,
              daysInMonth,
              getEarlyHs(b),
              getLateHs(b),
              [],
              getReducedDailyHs(b),
            ),
        );

      for (const emp of candidates) {
        if (current >= 4) break;
        next[`${emp.id}-${di.day}`] = turn;
        current++;
      }

      if (current < 4) {
        const foraneos = employees
          .filter(
            (emp) =>
              emp.turn !== turn &&
              emp.id !== jefeId &&
              canCoverOtherTurn(emp) &&
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day) &&
              consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp),
          )
          .sort(
            (a, b) =>
              workedHours(
                next,
                a.id,
                daysInMonth,
                getEarlyHs(a),
                getLateHs(a),
                [],
                getReducedDailyHs(a),
              ) -
              workedHours(
                next,
                b.id,
                daysInMonth,
                getEarlyHs(b),
                getLateHs(b),
                [],
                getReducedDailyHs(b),
              ),
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
        .filter(
          (emp) =>
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) &&
            !isProtected(emp.id, di.day) &&
            consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp),
        )
        .sort(
          (a, b) =>
            workedHours(
              next,
              a.id,
              daysInMonth,
              getEarlyHs(a),
              getLateHs(a),
              [],
              getReducedDailyHs(a),
            ) -
            workedHours(
              next,
              b.id,
              daysInMonth,
              getEarlyHs(b),
              getLateHs(b),
              [],
              getReducedDailyHs(b),
            ),
        );
      for (const emp of ownFrancos) {
        if (current >= 4) break;
        next[`${emp.id}-${di.day}`] = turn;
        current++;
      }

      // 2. Si aún faltan, usar de otros turnos
      if (current < 4) {
        const otherTurns = employees
          .filter(
            (emp) =>
              emp.turn !== turn &&
              emp.id !== jefeId &&
              !pmpIds.has(emp.id) &&
              canCoverOtherTurn(emp) &&
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day) &&
              consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp),
          )
          .sort(
            (a, b) =>
              workedHours(
                next,
                a.id,
                daysInMonth,
                getEarlyHs(a),
                getLateHs(a),
                [],
                getReducedDailyHs(a),
              ) -
              workedHours(
                next,
                b.id,
                daysInMonth,
                getEarlyHs(b),
                getLateHs(b),
                [],
                getReducedDailyHs(b),
              ),
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
      const maxWork = maxConsecForEmp(emp); // TN=2, R27=4, R15=6
      const maxFranco = 2; // nunca más de 2 francos seguidos
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
            const worked = workedHours(
              next,
              emp.id,
              daysInMonth,
              getEarlyHs(emp),
              getLateHs(emp),
              [],
              getReducedDailyHs(emp),
            );
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
        .filter(
          (emp) =>
            next[`${emp.id}-${di.day}`] === "F" &&
            !blocked(emp.id, di.day) &&
            !isProtected(emp.id, di.day) &&
            consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp),
        )
        .sort(
          (a, b) =>
            workedHours(
              next,
              a.id,
              daysInMonth,
              getEarlyHs(a),
              getLateHs(a),
              [],
              getReducedDailyHs(a),
            ) -
            workedHours(
              next,
              b.id,
              daysInMonth,
              getEarlyHs(b),
              getLateHs(b),
              [],
              getReducedDailyHs(b),
            ),
        );
      for (const emp of propios) {
        if (current >= 4) break;
        next[`${emp.id}-${di.day}`] = turn;
        current++;
      }

      // Ronda 2: foráneos respetando racha
      if (current < 4) {
        const foraneos = employees
          .filter(
            (emp) =>
              emp.turn !== turn &&
              emp.id !== jefeId &&
              !pmpIds.has(emp.id) &&
              canCoverOtherTurn(emp) &&
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day) &&
              consecutivesBefore(next, emp.id, di.day) < maxConsecForEmp(emp),
          )
          .sort(
            (a, b) =>
              workedHours(
                next,
                a.id,
                daysInMonth,
                getEarlyHs(a),
                getLateHs(a),
                [],
                getReducedDailyHs(a),
              ) -
              workedHours(
                next,
                b.id,
                daysInMonth,
                getEarlyHs(b),
                getLateHs(b),
                [],
                getReducedDailyHs(b),
              ),
          );
        for (const emp of foraneos) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn;
          current++;
        }
      }

      // Ronda 3 (forzada): propios SIN respetar racha — cobertura mínima es obligatoria
      if (current < 4) {
        const forzados = (byTurn[turn] || [])
          .filter(
            (emp) =>
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day),
          )
          .sort(
            (a, b) =>
              workedHours(
                next,
                a.id,
                daysInMonth,
                getEarlyHs(a),
                getLateHs(a),
                [],
                getReducedDailyHs(a),
              ) -
              workedHours(
                next,
                b.id,
                daysInMonth,
                getEarlyHs(b),
                getLateHs(b),
                [],
                getReducedDailyHs(b),
              ),
          );
        for (const emp of forzados) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn;
          current++;
        }
      }

      // Ronda 4 (última): cualquier empleado disponible de cualquier turno
      if (current < 4) {
        const cualquiera = employees
          .filter(
            (emp) =>
              emp.id !== jefeId &&
              !pmpIds.has(emp.id) &&
              next[`${emp.id}-${di.day}`] === "F" &&
              !blocked(emp.id, di.day) &&
              !isProtected(emp.id, di.day),
          )
          .sort(
            (a, b) =>
              workedHours(
                next,
                a.id,
                daysInMonth,
                getEarlyHs(a),
                getLateHs(a),
                [],
                getReducedDailyHs(a),
              ) -
              workedHours(
                next,
                b.id,
                daysInMonth,
                getEarlyHs(b),
                getLateHs(b),
                [],
                getReducedDailyHs(b),
              ),
          );
        for (const emp of cualquiera) {
          if (current >= 4) break;
          next[`${emp.id}-${di.day}`] = turn;
          current++;
        }
      }
    }
  }

  return next;
}

export const isFrancoOrEmpty = (v) => !v || v === "F" || v === "---";

export function calcFrancoWeekendPair(empId, d, schedule, dayInfo) {
  const isFreeOrFE = (empId, day) => {
    const v = schedule[`${empId}-${day}`];
    return !v || v === "F" || v === "FE" || v === "---";
  };
  if (d.isSat) {
    const nextDay = dayInfo.find((x) => x.day === d.day + 1);
    if (!nextDay || !nextDay.isSunday) return false;
    return isFreeOrFE(empId, d.day) && isFreeOrFE(empId, nextDay.day);
  }
  if (d.isSunday) {
    if (d.day === 1) return false;
    const prevDay = dayInfo.find((x) => x.day === d.day - 1);
    if (!prevDay || !prevDay.isSat) return false;
    return isFreeOrFE(empId, prevDay.day) && isFreeOrFE(empId, d.day);
  }
  return false;
}

export const getLARDivisor = (year, month) => {
  // Febrero = 28, resto = 30
  return month === 1 ? 28 : 30;
};

export function calcGuardiaHospitalaria(schedule, emp, dayInfo, daysInMonth) {
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
export function calcTargetWithLAR(
  emp,
  year,
  month,
  holidays,
  larDays,
  daysInMonth,
  getRegimeHours,
) {
  // El target siempre es la carga mensual completa (144hs, 160hs, etc.)
  // Las horas de LAR se suman en workedHours, completando el total
  const base = getRegimeHours(emp.regime);
  return emp.reduction > 0
    ? Math.round(base * (1 - emp.reduction / 100))
    : base;
}
