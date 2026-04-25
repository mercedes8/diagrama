import { useState, useRef, useEffect } from "react";
import { CELL_TYPES, TURN_LABEL } from "../../constants";

export default function CellContextMenu({
  empId,
  day,
  current,
  onSelect,
  children,
  empTurn = "TM",
  customCellTypes = [],
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef();
  const tl = TURN_LABEL[empTurn] ?? "M";
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const allTypes = [
    ...Object.entries(CELL_TYPES).map(([k, v]) => ({
      key: k,
      bg: v.bg,
      fg: v.fg,
      label: k === "EARLY" ? tl : k === "LATE" ? tl : v.label,
      desc:
        k === "TM"
          ? "07:00–14:00"
          : k === "TT"
            ? "14:00–21:00"
            : k === "TN"
              ? "21:00–07:00"
              : k === "F"
                ? "Franco"
                : k === "FE"
                  ? "Franco Especial"
                  : k === "LIC"
                    ? "Licencia"
                    : k === "LAR"
                      ? "Largo"
                      : k === "PM"
                        ? "PM"
                        : k === "EARLY"
                          ? "Sale antes (rosado)"
                          : k === "LATE"
                            ? "Sale después (verde)"
                            : "Vacío",
      isCustom: false,
      isFE: k === "FE",
    })),
    ...customCellTypes.map((c) => ({
      key: c.key,
      bg: c.bg,
      fg: c.fg,
      label: c.label,
      desc: c.desc || c.label,
      isCustom: true,
      isFE: false,
    })),
  ];

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
        setOpen(true);
      }}
    >
      {children}
      {open && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos.y,
            left: pos.x,
            zIndex: 9999,
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,.75)",
            minWidth: 230,
          }}
        >
          {allTypes.map(({ key, bg, fg, label, desc, isCustom, isFE }) => (
            <button
              key={key}
              onClick={() => {
                onSelect(key);
                setOpen(false);
              }}
              style={{
                background: current === key ? "#f1f5f9" : bg,
                color: fg,
                border: isCustom ? "1px solid " + fg : "none",
                borderRadius: 5,
                padding: "5px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                textAlign: "left",
                opacity: current === key ? 0.5 : 1,
                fontFamily: isFE
                  ? "'Georgia',serif"
                  : "'Barlow Condensed',sans-serif",
                letterSpacing: ".5px",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span style={{ fontStyle: isFE ? "italic" : "normal" }}>
                {label}
              </span>
              <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>
                {desc}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
