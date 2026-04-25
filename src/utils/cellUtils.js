import { TURN_LABEL } from "../constants";

export function getCellStyle(
  ct,
  isFrancoWeekendPair,
  empTurn = "TM",
  customCellTypes = [],
) {
  const border = isFrancoWeekendPair ? "2px solid #000" : "1px solid #e2e8f0";
  const tl = TURN_LABEL[empTurn] ?? "M";

  const custom = customCellTypes.find((c) => c.key === ct);
  if (custom)
    return {
      label: custom.label,
      textColor: custom.fg,
      bg: custom.bg,
      bold: true,
      border: `2px solid ${custom.border}`,
    };

  switch (ct) {
    case "TM":
      return {
        label: "M",
        textColor: "#1d4ed8",
        bg: "#fff",
        bold: true,
        border,
      };
    case "TT":
      return {
        label: "T",
        textColor: "#15803d",
        bg: "#fff",
        bold: true,
        border,
      };
    case "TN":
      return { label: "N", textColor: "#000", bg: "#fff", bold: true, border };
    case "F":
      return {
        label: "F",
        textColor: "#374151",
        bg: "#fff",
        bold: false,
        border,
      };
    case "FE":
      return {
        label: "F°",
        textColor: "#dc2626",
        bg: "#fff",
        bold: true,
        border,
        specialFont: true,
      };
    case "LIC":
      return {
        label: tl,
        textColor: "#7c2d12",
        bg: "#fef9c3",
        bold: true,
        border: "1px solid #d97706",
      };
    case "EARLY":
      return {
        label: tl,
        textColor: "#9d174d",
        bg: "#fce7f3",
        bold: true,
        border: "2px solid #f9a8d4",
      };
    case "LATE":
      return {
        label: tl,
        textColor: "#166534",
        bg: "#dcfce7",
        bold: true,
        border: "2px solid #86efac",
      };
    case "LAR":
      return {
        label: tl,
        textColor: "#92400e",
        bg: "#fef3c7",
        bold: true,
        border: "1px solid #fbbf24",
      };
    case "PM":
      return {
        label: "PM",
        textColor: "#1e3a8a",
        bg: "#dbeafe",
        bold: true,
        border: "1px solid #93c5fd",
      };
    default:
      return {
        label: "",
        textColor: "#94a3b8",
        bg: "#fff",
        bold: false,
        border,
      };
  }
}
