import { REGIMES } from "../../constants";
import { S } from "../../styles";

export default function StaffTab({
  employees,
  setEmployees,
  editEmpId,
  setEditEmpId,
  editData,
  setEditData,
  newEmp,
  setNewEmp,
  targetHours,
}) {
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
          flexWrap: "wrap",
          padding: 12,
          background: "#fff",
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        {[
          [
            "NOMBRE",
            <input
              key="n"
              style={{ ...S.formInput, width: 200 }}
              placeholder="Apellido, Nombre"
              value={newEmp.name}
              onChange={(e) =>
                setNewEmp((p) => ({ ...p, name: e.target.value }))
              }
            />,
          ],
          [
            "RÉGIMEN",
            <select
              key="r"
              style={S.formSel}
              value={newEmp.regime}
              onChange={(e) =>
                setNewEmp((p) => ({ ...p, regime: e.target.value }))
              }
            >
              {Object.entries(REGIMES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>,
          ],
          [
            "TURNO",
            <select
              key="t"
              style={S.formSel}
              value={newEmp.turn}
              onChange={(e) =>
                setNewEmp((p) => ({ ...p, turn: e.target.value }))
              }
            >
              <option value="TM">TM — Mañana</option>
              <option value="TT">TT — Tarde</option>
              <option value="TN">TN — Noche</option>
            </select>,
          ],
          [
            "REDUCCIÓN %",
            <input
              key="rd"
              style={{ ...S.formInput, width: 70 }}
              type="number"
              min={0}
              max={50}
              value={newEmp.reduction}
              onChange={(e) =>
                setNewEmp((p) => ({ ...p, reduction: +e.target.value }))
              }
            />,
          ],
          [
            "NOTA",
            <input
              key="nt"
              style={{ ...S.formInput, width: 120 }}
              placeholder="Prest./Ingr./..."
              value={newEmp.note}
              onChange={(e) =>
                setNewEmp((p) => ({ ...p, note: e.target.value }))
              }
            />,
          ],
        ].map(([lbl, ctrl]) => (
          <div key={lbl} style={{ display: "flex", flexDirection: "column" }}>
            <span style={S.formLabel}>{lbl}</span>
            {ctrl}
          </div>
        ))}
        <button
          style={S.btn("#059669")}
          onClick={() => {
            if (!newEmp.name.trim()) return;
            setEmployees((prev) => [...prev, { ...newEmp, id: Date.now() }]);
            setNewEmp({
              name: "",
              regime: "R15",
              turn: "TM",
              reduction: 0,
              note: "",
            });
          }}
        >
          + Agregar
        </button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {[
              "#",
              "Nombre",
              "Régimen",
              "Turno",
              "Hs Objetivo",
              "Reducción",
              "Nota",
              "Acciones",
            ].map((h) => (
              <th
                key={h}
                style={{
                  background: "#fff",
                  color: "#1e293b",
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  border: "1px solid #cbd5e1",
                  borderBottom: "2px solid #000",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const isEdit = editEmpId === emp.id;
            const tc =
              emp.turn === "TM"
                ? "#60a5fa"
                : emp.turn === "TT"
                  ? "#fbbf24"
                  : "#a78bfa";
            const td = {
              border: "1px solid #e2e8f0",
              padding: "7px 12px",
              fontSize: 12,
              color: "#cbd5e1",
              background: "#fff",
            };
            return (
              <tr key={emp.id}>
                <td style={{ ...td, color: "#94a3b8", width: 30 }}>{i + 1}</td>
                <td style={td}>
                  {isEdit ? (
                    <input
                      style={{ ...S.formInput, width: 180 }}
                      value={editData.name}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, name: e.target.value }))
                      }
                    />
                  ) : (
                    emp.name
                  )}
                </td>
                <td style={td}>
                  {isEdit ? (
                    <select
                      style={S.formSel}
                      value={editData.regime}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, regime: e.target.value }))
                      }
                    >
                      {Object.entries(REGIMES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      style={{
                        background: "#e0e7ff",
                        padding: "2px 7px",
                        borderRadius: 4,
                        fontSize: 10,
                        color: "#1e40af",
                      }}
                    >
                      {REGIMES[emp.regime]?.label}
                    </span>
                  )}
                </td>
                <td style={td}>
                  {isEdit ? (
                    <select
                      style={S.formSel}
                      value={editData.turn}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, turn: e.target.value }))
                      }
                    >
                      <option value="TM">TM</option>
                      <option value="TT">TT</option>
                      <option value="TN">TN</option>
                    </select>
                  ) : (
                    <span style={{ color: tc, fontWeight: 700 }}>
                      {emp.turn}
                    </span>
                  )}
                </td>
                <td style={{ ...td, color: "#059669", fontWeight: 700 }}>
                  {targetHours(emp)}hs
                </td>
                <td style={td}>
                  {isEdit ? (
                    <input
                      style={{ ...S.formInput, width: 60 }}
                      type="number"
                      min={0}
                      max={50}
                      value={editData.reduction}
                      onChange={(e) =>
                        setEditData((p) => ({
                          ...p,
                          reduction: +e.target.value,
                        }))
                      }
                    />
                  ) : emp.reduction > 0 ? (
                    <span style={{ color: "#fb923c", fontWeight: 700 }}>
                      -{emp.reduction}%
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </td>
                <td style={{ ...td, fontSize: 10, color: "#475569" }}>
                  {isEdit ? (
                    <input
                      style={{ ...S.formInput, width: 100 }}
                      value={editData.note}
                      onChange={(e) =>
                        setEditData((p) => ({ ...p, note: e.target.value }))
                      }
                    />
                  ) : (
                    emp.note || "—"
                  )}
                </td>
                <td style={{ ...td, display: "flex", gap: 4 }}>
                  {isEdit ? (
                    <>
                      <button
                        style={S.btn("#059669")}
                        onClick={() => {
                          setEmployees((prev) =>
                            prev.map((e) =>
                              e.id === emp.id ? { ...e, ...editData } : e,
                            ),
                          );
                          setEditEmpId(null);
                        }}
                      >
                        ✓
                      </button>
                      <button
                        style={S.btn("#e2e8f0", "#475569")}
                        onClick={() => setEditEmpId(null)}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        style={S.btn("#f59e0b", "#000")}
                        onClick={() => {
                          setEditEmpId(emp.id);
                          setEditData({ ...emp });
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        style={S.btn("#dc2626")}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar a ${emp.name}?`))
                            setEmployees((prev) =>
                              prev.filter((e) => e.id !== emp.id),
                            );
                        }}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
