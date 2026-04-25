import { CELL_TYPES } from "../../constants";
import { S } from "../../styles";

export default function ConfigCustomCells({
  customCellTypes,
  setCustomCellTypes,
  newCustom,
  setNewCustom,
}) {
  return (
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
              style={{ ...S.formInput, width: 70, textTransform: "uppercase" }}
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
  );
}
