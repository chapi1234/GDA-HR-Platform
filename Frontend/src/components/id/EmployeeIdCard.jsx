import { forwardRef } from "react";
import { User } from "lucide-react";

/** Served from Frontend/public/id-card */
const idTemplate = "/id-card/template.jpg?v=16";
const idStamp = "/id-card/stamp.png?v=16";

/**
 * Official printed template aspect (TEMP.jpg = 3045×1995).
 * Width matches CR80; height keeps the template proportions (no stretch).
 */
export const ID_CARD_MM = {
  width: 85.6,
  height: Number(((85.6 * 1995) / 3045).toFixed(3)), // ~56.08mm
};

/**
 * Design canvas (matches template aspect). Preview/print/download all
 * scale from this size so fonts stay consistent.
 */
export const ID_CARD_PX = {
  width: 1015,
  height: 665,
};

/**
 * Field values — just above TEMP.jpg underlines.
 * height:auto + overflow:visible so download/print never clip glyphs.
 */
const CARD_H = 665;
const LINE_GAP_PX = 8;

function fieldAbove(left, underlinePct, width, size) {
  // top so approximate text bottom (size px) clears the underline by LINE_GAP_PX
  const top = underlinePct - ((size + LINE_GAP_PX) / CARD_H) * 100;
  return { left, top: Number(top.toFixed(2)), width, size };
}

const LINES = {
  idNo: fieldAbove(79.5, 27.47, 16, 15),
  name: fieldAbove(43.4, 36.29, 30, 17),
  dob: fieldAbove(42.8, 47.67, 12, 15),
  sex: fieldAbove(58.9, 47.67, 12, 15),
  occupation: fieldAbove(40.3, 56.19, 32, 16),
  nationality: fieldAbove(40.1, 64.71, 32, 16),
  address: fieldAbove(40.4, 73.23, 32, 15),
  phone: fieldAbove(38.8, 83.21, 33, 16),
};

const PHOTO_FRAME = {
  left: 75.862,
  top: 42.105,
  width: 19.836,
  height: 43.358,
};

const STAMP = {
  left: 68.41,
  top: 58.8,
  width: 19.84,
};

const FIELD_FONT =
  'Arial, Helvetica, "Segoe UI", "Noto Sans", sans-serif';

function formatDob(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatSex(gender) {
  const g = String(gender || "").toUpperCase();
  if (g === "M" || g === "MALE") return "Male";
  if (g === "F" || g === "FEMALE") return "Female";
  return gender || "";
}

function resolvePhoto(employee) {
  const candidates = [
    employee?.profileImage,
    employee?.avatar,
    employee?.photo,
  ];
  for (const src of candidates) {
    if (!src || typeof src !== "string") continue;
    if (/ui-avatars\.com/i.test(src)) continue;
    if (/^https?:\/\//i.test(src) || src.startsWith("data:image")) return src;
    if (src.startsWith("/")) {
      const base = import.meta.env.VITE_API_URL || "";
      return base ? `${base.replace(/\/$/, "")}${src}` : src;
    }
    if (src.includes("cloudinary") || src.includes("res.cloudinary")) {
      return src;
    }
  }
  return "";
}

function Field({ box, children }) {
  if (!children) return null;
  return (
    <div
      className="id-card-field"
      style={{
        position: "absolute",
        left: `${box.left}%`,
        top: `${box.top}%`,
        width: `${box.width}%`,
        fontSize: `${box.size}px`,
        fontFamily: FIELD_FONT,
        fontWeight: 600,
        fontStyle: "normal",
        color: "#111111",
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        overflow: "visible",
        letterSpacing: "0.01em",
        textDecoration: "none",
        pointerEvents: "none",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Exact GammoDA employee ID card — TEMP.jpg as background.
 * Overlays live employee values on the printed underlines + photo box.
 */
const EmployeeIdCard = forwardRef(function EmployeeIdCard(
  { employee, className = "" },
  ref
) {
  const photo = resolvePhoto(employee);
  const fullName = employee?.name || "";
  const dob = formatDob(employee?.dateOfBirth);
  const sex = formatSex(employee?.gender);
  const occupation = employee?.position || "";
  const nationality = employee?.nationality || "Ethiopian";
  const address = employee?.address || "";
  const phone = employee?.phone || "";
  const idNo = employee?.employeeId || "";

  return (
    <div
      ref={ref}
      className={`employee-id-card ${className}`}
      style={{
        width: `${ID_CARD_PX.width}px`,
        height: `${ID_CARD_PX.height}px`,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#ffffff",
        boxShadow: "0 8px 28px rgba(42, 33, 28, 0.22)",
        fontFamily: FIELD_FONT,
      }}
    >
      <img
        src={idTemplate}
        alt="GammoDA Employee ID Card"
        draggable={false}
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: `${PHOTO_FRAME.left}%`,
          top: `${PHOTO_FRAME.top}%`,
          width: `${PHOTO_FRAME.width}%`,
          height: `${PHOTO_FRAME.height}%`,
          boxSizing: "border-box",
          border: "2px solid #000000",
          backgroundColor: "#f1f5f9",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
      >
        {photo ? (
          <img
            src={photo}
            alt={fullName ? `${fullName} photo` : "Employee photo"}
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              color: "#94a3b8",
              backgroundColor: "#f8fafc",
            }}
          >
            <User style={{ width: "80px", height: "80px", strokeWidth: 1.5 }} />
            <span style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
              PHOTO
            </span>
          </div>
        )}
      </div>

      <img
        src={idStamp}
        alt=""
        draggable={false}
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          left: `${STAMP.left}%`,
          top: `${STAMP.top}%`,
          width: `${STAMP.width}%`,
          height: "auto",
          opacity: 0.92,
          zIndex: 3,
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />

      <div style={{ position: "absolute", inset: 0, zIndex: 4 }}>
        <Field box={LINES.idNo}>{idNo}</Field>
        <Field box={LINES.name}>{fullName}</Field>
        <Field box={LINES.dob}>{dob}</Field>
        <Field box={LINES.sex}>{sex}</Field>
        <Field box={LINES.occupation}>{occupation}</Field>
        <Field box={LINES.nationality}>{nationality}</Field>
        <Field box={LINES.address}>{address}</Field>
        <Field box={LINES.phone}>{phone}</Field>
      </div>
    </div>
  );
});

export default EmployeeIdCard;
