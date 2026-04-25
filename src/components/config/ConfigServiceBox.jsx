import { S } from "../../styles";

export default function ConfigServiceBox({
  service,
  setService,
  beds,
  setBeds,
  year,
  setYear,
}) {
  return (
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
  );
}
