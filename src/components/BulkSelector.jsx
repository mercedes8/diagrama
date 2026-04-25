import { CELL_TYPES } from "../constants";
import { S } from "../styles";

const BULK_OPTS = [
  {
    type: "LIC",
    label: "Lic  — Licencia",
    bg: "#fef9c3",
    fg: "#7c2d12",
    border: "#d97706",
  },
  {
    type: "LAR",
    label: "LAR — Largo",
    bg: "#fef3c7",
    fg: "#92400e",
    border: "#fbbf24",
  },
  {
    type: "FE",
    label: "F°  — Franco Especial",
    bg: "#fff",
    fg: "#dc2626",
    border: "#fca5a5",
  },
];

export default function BulkSelector({
  bulkMode,
  setBulkMode,
  bulkSelected,
  setBulkSelected,
  onApplyBulk,
  onCancelBulk,
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 10,
        flexWrap: "wrap",
        padding: "8px 12px",
        background: bulkMode ? "#f8fafc" : "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
      }}
      className="no-print"
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#475569",
          marginRight: 4,
        }}
      >
        Marcar múltiples días:
      </span>
      {BULK_OPTS.map((opt) => (
        <button
          key={opt.type}
          onClick={() => {
            setBulkMode(bulkMode === opt.type ? null : opt.type);
            setBulkSelected(new Set());
          }}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: `2px solid ${opt.border}`,
            background: bulkMode === opt.type ? opt.fg : opt.bg,
            color: bulkMode === opt.type ? "#fff" : opt.fg,
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
            fontFamily:
              opt.type === "FE"
                ? "'Georgia',serif"
                : "'Barlow Condensed',sans-serif",
            fontStyle: opt.type === "FE" ? "italic" : "normal",
          }}
        >
          {opt.label}
        </button>
      ))}
      {bulkMode && (
        <>
          <span style={{ fontSize: 10, color: "#64748b", fontStyle: "italic" }}>
            ✅ {bulkSelected.size} celda{bulkSelected.size !== 1 ? "s" : ""}{" "}
            seleccionada{bulkSelected.size !== 1 ? "s" : ""} — hacé clic en las
            celdas
          </span>
          <button
            style={{ ...S.btn("#059669"), fontSize: 11 }}
            onClick={onApplyBulk}
            disabled={bulkSelected.size === 0}
          >
            ✔ Aplicar {CELL_TYPES[bulkMode]?.label}
          </button>
          <button
            style={{ ...S.btn("#e2e8f0", "#475569"), fontSize: 11 }}
            onClick={onCancelBulk}
          >
            ✕ Cancelar
          </button>
        </>
      )}
      {!bulkMode && (
        <span style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>
          · Botón derecho sobre celda para cambiar turno individual
        </span>
      )}
    </div>
  );
}
