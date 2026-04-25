import ConfigServiceBox from "./ConfigServiceBox";
import ConfigShiftOffsets from "./ConfigShiftOffsets";
import ConfigCustomCells from "./ConfigCustomCells";
import ConfigHolidays from "./ConfigHolidays";
import ConfigRegimeHours from "./ConfigRegimeHours";
import ConfigHoursBalance from "./ConfigHoursBalance";
import ConfigRules from "./ConfigRules";
import ConfigGuardia from "./ConfigGuardia";

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
      <ConfigServiceBox
        service={service}
        setService={setService}
        beds={beds}
        setBeds={setBeds}
        year={year}
        setYear={setYear}
      />
      <ConfigShiftOffsets
        earlyOffsets={earlyOffsets}
        setEarlyOffsets={setEarlyOffsets}
        lateOffsets={lateOffsets}
        setLateOffsets={setLateOffsets}
      />
      <ConfigCustomCells
        customCellTypes={customCellTypes}
        setCustomCellTypes={setCustomCellTypes}
        newCustom={newCustom}
        setNewCustom={setNewCustom}
      />
      <ConfigHolidays
        month={month}
        year={year}
        holidays={holidays}
        setHolidays={setHolidays}
        newHoliday={newHoliday}
        setNewHoliday={setNewHoliday}
        daysInMonth={daysInMonth}
      />
      <ConfigRegimeHours
        regimeHours={regimeHours}
        setRegimeHours={setRegimeHours}
      />
      <ConfigHoursBalance
        month={month}
        year={year}
        employees={employees}
        schedule={schedule}
        daysInMonth={daysInMonth}
        targetHours={targetHours}
        earlyHsForEmp={earlyHsForEmp}
        lateHsForEmp={lateHsForEmp}
        reducedDailyHsForEmp={reducedDailyHsForEmp}
      />
      <ConfigRules />
      <ConfigGuardia
        month={month}
        year={year}
        employees={employees}
        schedule={schedule}
        dayInfo={dayInfo}
        daysInMonth={daysInMonth}
      />
    </>
  );
}
