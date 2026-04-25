import { WDAYS } from "../../constants";
import { S } from "../../styles";

export default function GridHeader({ dayInfo }) {
  return (
    <thead>
      <tr style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <th
          style={{
            ...S.thMeta,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#f1f5f9",
            minWidth: 36,
            fontSize: 9,
            fontWeight: 900,
            borderRight: "1px solid #000",
          }}
        >
          Mens.
        </th>
        <th
          style={{
            ...S.thName,
            position: "sticky",
            top: 0,
            left: 0,
            zIndex: 20,
            background: "#f8fafc",
          }}
        >
          APELLIDO Y NOMBRE
        </th>
        <th
          style={{
            ...S.thMeta,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#f8fafc",
          }}
        >
          Rég.
        </th>
        <th
          style={{
            ...S.thMeta,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#f8fafc",
          }}
        >
          T.
        </th>
        {dayInfo.map((d) => {
          const isYellow = d.isSunday || d.isHoliday;
          const bg = isYellow ? "#ffff00" : "#f8fafc";
          return (
            <th
              key={d.day}
              style={{
                ...S.thMeta,
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: bg,
                color: d.isHoliday
                  ? "#dc2626"
                  : d.isSunday
                    ? "#1d4ed8"
                    : "#374151",
                minWidth: 30,
                maxWidth: 34,
                padding: "4px 2px",
                fontSize: 9,
                border: d.isWeekend ? "2px solid #000" : "1px solid #cbd5e1",
                fontWeight: 900,
              }}
            >
              <div style={{ fontSize: 8 }}>{WDAYS[d.dow]}</div>
              <div style={{ fontSize: 11, fontWeight: 900 }}>{d.day}</div>
              {d.isHoliday && (
                <div style={{ fontSize: 7, color: "#dc2626", fontWeight: 700 }}>
                  FER
                </div>
              )}
            </th>
          );
        })}
        <th
          style={{
            ...S.thMeta,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#f1f5f9",
            minWidth: 36,
            fontSize: 9,
            fontWeight: 900,
          }}
        >
          Carg.
        </th>
        <th
          style={{
            ...S.thMeta,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#e0f2fe",
            minWidth: 36,
            fontSize: 9,
            fontWeight: 900,
            color: "#0369a1",
          }}
        >
          H Trab
        </th>
        <th
          style={{
            ...S.thMeta,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#fff7ed",
            minWidth: 30,
            fontSize: 9,
            fontWeight: 900,
            color: "#92400e",
          }}
        >
          Sáb
        </th>
        <th
          style={{
            ...S.thMeta,
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#ffff00",
            minWidth: 30,
            fontSize: 9,
            fontWeight: 900,
            color: "#1d4ed8",
          }}
        >
          Dom
        </th>
      </tr>
    </thead>
  );
}
