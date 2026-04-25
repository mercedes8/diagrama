import { useState, useEffect } from "react";

// Usuarios predefinidos — podés ampliar esta lista
const USERS = [
  {
    username: "admin",
    password: "admin123",
    role: "Administrador",
    name: "Administrador",
  },
  {
    username: "jefa",
    password: "Sabumclaus112715",
    role: "Jefa de Servicio",
    name: "Jefa de Servicio",
  },
  {
    username: "enf1",
    password: "enfermeria",
    role: "Enfermería",
    name: "Enfermería",
  },
];

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  const handleSubmit = () => {
    if (!username.trim() || !password.trim()) {
      setError("Completá usuario y contraseña.");
      return;
    }
    setLoading(true);
    setError("");
    setTimeout(() => {
      const user = USERS.find(
        (u) =>
          u.username === username.trim().toLowerCase() &&
          u.password === password,
      );
      if (user) {
        onLogin(user);
      } else {
        setError("Usuario o contraseña incorrectos.");
        setLoading(false);
      }
    }, 700);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div style={styles.overlay}>
      {/* Background grid */}
      <div style={styles.grid} />

      {/* Glowing orbs */}
      <div style={{ ...styles.orb, ...styles.orb1 }} />
      <div style={{ ...styles.orb, ...styles.orb2 }} />

      {/* Card */}
      <div
        style={{
          ...styles.card,
          opacity: mounted ? 1 : 0,
          transform: mounted
            ? "translateY(0) scale(1)"
            : "translateY(24px) scale(0.97)",
          transition: "opacity .5s ease, transform .5s ease",
        }}
      >
        {/* Header */}
        <div style={styles.cardHeader}>
          <div style={styles.iconWrap}>
            <span style={{ fontSize: 32 }}>🏥</span>
          </div>
          <div style={styles.title}>CRONOGRAMA DE TURNOS</div>
          <div style={styles.subtitle}>SIP 5 · Sistema de Gestión</div>
          <div style={styles.divider} />
        </div>

        {/* Form */}
        <div style={styles.form}>
          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>USUARIO</label>
            <div
              style={{
                ...styles.inputWrap,
                borderColor:
                  focused === "user"
                    ? "#60a5fa"
                    : error
                      ? "#ef4444"
                      : "#334155",
                boxShadow:
                  focused === "user"
                    ? "0 0 0 3px rgba(96,165,250,.18)"
                    : "none",
              }}
            >
              <span style={styles.inputIcon}>👤</span>
              <input
                style={styles.input}
                type="text"
                placeholder="Ingresá tu usuario"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                onFocus={() => setFocused("user")}
                onBlur={() => setFocused(null)}
                onKeyDown={handleKey}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>CONTRASEÑA</label>
            <div
              style={{
                ...styles.inputWrap,
                borderColor:
                  focused === "pass"
                    ? "#60a5fa"
                    : error
                      ? "#ef4444"
                      : "#334155",
                boxShadow:
                  focused === "pass"
                    ? "0 0 0 3px rgba(96,165,250,.18)"
                    : "none",
              }}
            >
              <span style={styles.inputIcon}>🔒</span>
              <input
                style={styles.input}
                type={showPass ? "text" : "password"}
                placeholder="Ingresá tu contraseña"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onFocus={() => setFocused("pass")}
                onBlur={() => setFocused(null)}
                onKeyDown={handleKey}
                autoComplete="current-password"
              />
              <button
                style={styles.eyeBtn}
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
                title={showPass ? "Ocultar" : "Mostrar"}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Error */}
          <div
            style={{
              ...styles.errorBox,
              opacity: error ? 1 : 0,
              transform: error ? "translateY(0)" : "translateY(-6px)",
              transition: "opacity .2s, transform .2s",
              pointerEvents: "none",
            }}
          >
            ⚠️ {error}
          </div>

          {/* Submit */}
          <button
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              transform: loading ? "scale(0.98)" : "scale(1)",
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.spinner} />
            ) : (
              <>
                <span>INGRESAR</span>
                <span style={{ fontSize: 16 }}>→</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerDot} /> Acceso restringido al personal
          autorizado
        </div>
      </div>

      {/* Version */}
      <div style={styles.version}>v1.0 · 2025</div>
    </div>
  );
}

// ── Keyframe via <style> tag injected once ──────────────────
const styleTag = document.createElement("style");
styleTag.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse-orb { 0%,100% { opacity:.35; transform:scale(1); } 50% { opacity:.55; transform:scale(1.08); } }
`;
if (!document.head.querySelector("[data-login-styles]")) {
  styleTag.setAttribute("data-login-styles", "1");
  document.head.appendChild(styleTag);
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#060d1f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Barlow Condensed', sans-serif",
    overflow: "hidden",
    zIndex: 9999,
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(30,64,175,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,.1) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  orb: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(80px)",
    animation: "pulse-orb 6s ease-in-out infinite",
    pointerEvents: "none",
  },
  orb1: {
    width: 420,
    height: 420,
    background:
      "radial-gradient(circle, rgba(30,64,175,.4) 0%, transparent 70%)",
    top: "-100px",
    left: "-80px",
    animationDelay: "0s",
  },
  orb2: {
    width: 340,
    height: 340,
    background:
      "radial-gradient(circle, rgba(5,150,105,.25) 0%, transparent 70%)",
    bottom: "-80px",
    right: "-60px",
    animationDelay: "-3s",
  },

  card: {
    position: "relative",
    background: "linear-gradient(160deg, #0f1f3d 0%, #0c1829 100%)",
    border: "1px solid #1e3a6e",
    borderRadius: 16,
    width: "100%",
    maxWidth: 420,
    boxShadow:
      "0 32px 80px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)",
    overflow: "hidden",
  },

  cardHeader: {
    padding: "32px 32px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    background: "linear-gradient(135deg, #1e40af, #1d4ed8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    boxShadow: "0 8px 32px rgba(30,64,175,.5)",
    border: "1px solid rgba(96,165,250,.3)",
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: 2,
    color: "#f0f6ff",
    lineHeight: 1.1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 3,
    color: "#60a5fa",
    textTransform: "uppercase",
    marginBottom: 24,
  },
  divider: {
    width: "100%",
    height: 1,
    background:
      "linear-gradient(90deg, transparent, #1e3a6e 30%, #1e3a6e 70%, transparent)",
  },

  form: {
    padding: "28px 32px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    color: "#64748b",
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    background: "#091629",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "0 14px",
    transition: "border-color .2s, box-shadow .2s",
    gap: 10,
  },
  inputIcon: { fontSize: 14, flexShrink: 0 },
  input: {
    flex: 1,
    background: "none",
    border: "none",
    outline: "none",
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 600,
    padding: "13px 0",
    fontFamily: "'Barlow', sans-serif",
    letterSpacing: ".5px",
  },
  eyeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: 4,
    lineHeight: 1,
    flexShrink: 0,
  },

  errorBox: {
    fontSize: 12,
    color: "#fca5a5",
    fontWeight: 600,
    background: "rgba(239,68,68,.12)",
    border: "1px solid rgba(239,68,68,.25)",
    borderRadius: 8,
    padding: "8px 14px",
    letterSpacing: ".3px",
  },

  submitBtn: {
    marginTop: 4,
    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "14px 24px",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: 2,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    boxShadow: "0 4px 20px rgba(37,99,235,.4)",
    transition: "opacity .2s, transform .15s, box-shadow .2s",
  },
  spinner: {
    width: 18,
    height: 18,
    border: "2px solid rgba(255,255,255,.3)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin .7s linear infinite",
  },

  footer: {
    borderTop: "1px solid #1e3a6e",
    padding: "14px 32px",
    fontSize: 11,
    color: "#475569",
    fontWeight: 600,
    letterSpacing: ".5px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "'Barlow', sans-serif",
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#ef4444",
    display: "inline-block",
    flexShrink: 0,
    boxShadow: "0 0 6px #ef4444",
  },

  version: {
    position: "fixed",
    bottom: 16,
    right: 20,
    fontSize: 10,
    color: "#1e3a6e",
    fontWeight: 700,
    letterSpacing: 2,
    fontFamily: "'Barlow Condensed', sans-serif",
  },
};
