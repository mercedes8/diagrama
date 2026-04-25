import { S } from "../../styles";

export default function ScheduleToolbar({
  filterTurn,
  filterEmpId,
  setFilterTurn,
  setFilterEmpId,
  employees,
  history,
  onUndo,
  onAutoFill,
  onClearAll,
  onOpenHours,
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 8,
        flexWrap: "wrap",
      }}
      className="no-print"
    >
      {[
        ["ALL", "Todos", "#cbd5e1"],
        ["TM", "Mañana", "#1d4ed8"],
        ["TT", "Tarde", "#92400e"],
        ["TN", "Noche", "#3b0764"],
      ].map(([k, l, c]) => (
        <button
          key={k}
          onClick={() => {
            setFilterTurn(k);
            setFilterEmpId(null);
          }}
          style={{
            padding: "5px 14px",
            borderRadius: 20,
            border: "1px solid #cbd5e1",
            background: filterTurn === k && !filterEmpId ? c : "#fff",
            color: filterTurn === k && !filterEmpId ? "#fff" : "#475569",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {l}
        </button>
      ))}
      <select
        value={filterEmpId || ""}
        onChange={(e) => {
          const v = e.target.value;
          setFilterEmpId(v ? +v : null);
          if (v) setFilterTurn("ALL");
        }}
        style={{ ...S.formSel, fontSize: 11, maxWidth: 200 }}
      >
        <option value="">— Ver todos —</option>
        {["TM", "TT", "TN"].map((turn) => (
          <optgroup
            key={turn}
            label={turn === "TM" ? "Mañana" : turn === "TT" ? "Tarde" : "Noche"}
          >
            {employees
              .filter((e) => e.turn === turn)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <div style={{ flex: 1 }} />
      <button
        style={{
          ...S.btn(
            history.length > 0 ? "#f59e0b" : "#e2e8f0",
            history.length > 0 ? "#000" : "#94a3b8",
          ),
          fontSize: 11,
        }}
        onClick={onUndo}
        disabled={history.length === 0}
        title="Deshacer última acción (Ctrl+Z)"
      >
        ↩ Deshacer{history.length > 0 ? ` (${history.length})` : ""}
      </button>
      <button style={S.btn("#f59e0b", "#000")} onClick={onAutoFill}>
        ⚡ Auto-completar
      </button>
      <button style={S.btn("#e2e8f0", "#475569")} onClick={onClearAll}>
        🗑️ Limpiar todo
      </button>
      <button
        style={{ ...S.btn("#e0f2fe", "#0369a1"), fontSize: 11 }}
        onClick={onOpenHours}
      >
        ⏱ Horas mensuales
      </button>
    </div>
  );
}
