import { S } from "../../styles";

export default function ConfigRules() {
  return (
    <div style={S.cfgBox}>
      <div style={S.cfgTitle}>📏 REGLAS</div>
      {[
        "Franco obligatorio: 1 finde completo (sáb+dom juntos) + 1 sábado libre adicional + 1 domingo libre adicional",
        "FE en sábado + F/FE en domingo siguiente = cuenta como finde completo",
        "FE = F° (Franco Especial) — se carga manualmente antes del auto-completar",
        "Personal por guardia: mínimo 4 · máximo 8 enfermeros",
        "TM y TT: máximo 4 guardias consecutivas · TN: máximo 2 guardias consecutivas",
        "Click derecho → menú individual · Botones Lic/LAR/F° → selección múltiple · Ctrl+Z → deshacer",
      ].map((t, i) => (
        <div
          key={i}
          style={{
            fontSize: 12,
            color: "#475569",
            padding: "5px 0",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            gap: 8,
          }}
        >
          <span style={{ color: "#1e40af", fontWeight: 700 }}>•</span> {t}
        </div>
      ))}
    </div>
  );
}
