import { MONTHS } from "../constants";
import { S } from "../styles";

export default function AppHeader({
  service,
  beds,
  month,
  year,
  onPrevMonth,
  onNextMonth,
  onExportExcel,
  onExportPDF,
  onSave,
  savedOk,
  currentUser,
  onLogout,
}) {
  return (
    <div style={S.hdr} className="no-print">
      <div>
        <div style={S.hdrTitle}>🏥 CRONOGRAMA MENSUAL DE TURNOS</div>
        <div style={S.hdrSub}>
          {service} · {beds} CAMAS · TM 07-14 | TT 14-21 | TN 21-07
        </div>
      </div>
      <div style={S.monthNav}>
        <button style={S.navBtn} onClick={onPrevMonth}>
          ◀
        </button>
        <div style={S.monthLbl}>
          {MONTHS[month].toUpperCase()} {year}
        </div>
        <button style={S.navBtn} onClick={onNextMonth}>
          ▶
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button style={S.btn("#059669")} onClick={onExportExcel}>
          📊 Excel
        </button>
        <button style={S.btn("#4f46e5")} onClick={onExportPDF}>
          🖨️ PDF
        </button>
        <button
          onClick={onSave}
          style={{
            ...S.btn(savedOk ? "#059669" : "#0f172a"),
            transition: "background .3s",
            minWidth: 110,
          }}
        >
          {savedOk ? "✅ Guardado!" : "💾 Guardar"}
        </button>
        {currentUser && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 4,
              padding: "4px 12px",
              background: "rgba(255,255,255,.1)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,.2)",
            }}
          >
            <span style={{ fontSize: 11, color: "#bfdbfe", fontWeight: 600 }}>
              👤 {currentUser.name}
            </span>
            <button
              onClick={onLogout}
              style={{
                background: "rgba(239,68,68,.2)",
                border: "1px solid rgba(239,68,68,.4)",
                color: "#fca5a5",
                padding: "3px 10px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              SALIR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
