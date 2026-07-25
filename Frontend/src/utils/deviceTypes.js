/**
 * Device type catalog — drives create/edit fields and table columns.
 */

export const DEVICE_TYPES = [
  { value: "laptop", label: "Laptop / PC", category: "computing" },
  { value: "tablet", label: "Tablet", category: "computing" },
  { value: "phone", label: "Phone", category: "computing" },
  { value: "monitor", label: "Monitor", category: "computing" },
  { value: "camera", label: "Camera", category: "camera" },
  { value: "motorcycle", label: "Motorcycle", category: "motorcycle" },
  { value: "other", label: "Other", category: "other" },
];

export const DEVICE_CATEGORIES = [
  { value: "all", label: "All types" },
  { value: "computing", label: "PC & electronics" },
  { value: "camera", label: "Cameras" },
  { value: "motorcycle", label: "Motorcycles" },
  { value: "other", label: "Other" },
];

export function getDeviceTypeMeta(type) {
  return (
    DEVICE_TYPES.find((t) => t.value === String(type || "").toLowerCase()) || {
      value: type || "laptop",
      label: type || "Device",
      category: "computing",
    }
  );
}

export function getCategoryForType(type) {
  return getDeviceTypeMeta(type).category;
}

/** Fields shown in create/edit forms per type (beyond shared name/condition/notes). */
export function getFormFieldsForType(type) {
  const t = String(type || "laptop").toLowerCase();
  if (t === "camera") {
    return [
      { key: "brand", label: "Brand", placeholder: "e.g., Canon, Sony" },
      { key: "model", label: "Model", placeholder: "e.g., EOS R6" },
      { key: "serialNumber", label: "Serial number", placeholder: "Camera serial" },
      { key: "megapixels", label: "Megapixels", placeholder: "e.g., 24MP" },
      { key: "resolution", label: "Resolution", placeholder: "e.g., 4K / 6000×4000" },
      { key: "lens", label: "Lens", placeholder: "e.g., 24-70mm f/2.8" },
    ];
  }
  if (t === "motorcycle") {
    return [
      { key: "brand", label: "Make / Brand", placeholder: "e.g., Honda, Yamaha" },
      { key: "model", label: "Model", placeholder: "e.g., CB500X" },
      { key: "plateNumber", label: "Plate number", placeholder: "License plate" },
      { key: "chassisNumber", label: "Chassis / VIN", placeholder: "Frame / VIN" },
      { key: "engineCc", label: "Engine (cc)", placeholder: "e.g., 500cc" },
      { key: "color", label: "Color", placeholder: "e.g., Black" },
      { key: "year", label: "Year", placeholder: "e.g., 2024" },
    ];
  }
  if (t === "other") {
    return [
      { key: "otherType", label: "Device kind", placeholder: "e.g., Projector, Printer" },
      { key: "brand", label: "Brand", placeholder: "e.g., Epson, HP" },
      { key: "model", label: "Model", placeholder: "Model name / number" },
      { key: "serialNumber", label: "Serial number", placeholder: "Asset serial" },
      { key: "specs", label: "Specifications", placeholder: "Key specs / details" },
    ];
  }
  // computing defaults (laptop, tablet, phone, monitor)
  const fields = [
    { key: "brand", label: "Brand", placeholder: "e.g., Apple, Dell" },
    { key: "model", label: "Model", placeholder: "e.g., MacBook Pro M2" },
    { key: "serialNumber", label: "Serial number", placeholder: "Asset serial" },
  ];
  if (t !== "monitor") {
    fields.push({ key: "ram", label: "RAM", placeholder: "e.g., 16GB" });
  }
  fields.push({
    key: "storage",
    label: t === "monitor" ? "Screen size" : "Storage",
    placeholder: t === "monitor" ? "e.g., 27 inch" : "e.g., 512GB SSD",
  });
  return fields;
}

/** One-line specs summary for “All types” table. */
export function formatDeviceSpecs(device) {
  const t = String(device.deviceType || device.type || "").toLowerCase();
  if (t === "camera") {
    return (
      [device.megapixels, device.resolution, device.lens]
        .filter(Boolean)
        .join(" · ") || "—"
    );
  }
  if (t === "motorcycle") {
    return (
      [device.plateNumber, device.engineCc, device.color, device.year]
        .filter(Boolean)
        .join(" · ") || "—"
    );
  }
  if (t === "other") {
    return (
      [device.otherType, device.specs, device.model]
        .filter(Boolean)
        .join(" · ") || "—"
    );
  }
  return (
    [device.ram, device.storage, device.model].filter(Boolean).join(" · ") || "—"
  );
}

/**
 * Table column defs for a category filter.
 * Each col: { key, label, render?: (device) => ReactNode | string }
 * render is handled in the page; here we only declare keys/labels.
 */
export function getTableColumnsForCategory(category) {
  if (category === "camera") {
    return [
      { key: "device", label: "Camera" },
      { key: "brand", label: "Brand" },
      { key: "megapixels", label: "Megapixels" },
      { key: "resolution", label: "Resolution" },
      { key: "lens", label: "Lens" },
      { key: "assigned", label: "Assigned to" },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Actions" },
    ];
  }
  if (category === "motorcycle") {
    return [
      { key: "device", label: "Motorcycle" },
      { key: "brand", label: "Make" },
      { key: "plateNumber", label: "Plate" },
      { key: "engineCc", label: "Engine" },
      { key: "color", label: "Color" },
      { key: "year", label: "Year" },
      { key: "assigned", label: "Assigned to" },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Actions" },
    ];
  }
  if (category === "computing") {
    return [
      { key: "device", label: "Device" },
      { key: "type", label: "Type" },
      { key: "model", label: "Model" },
      { key: "ram", label: "RAM" },
      { key: "storage", label: "Storage" },
      { key: "assigned", label: "Assigned to" },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Actions" },
    ];
  }
  if (category === "other") {
    return [
      { key: "device", label: "Device" },
      { key: "otherType", label: "Kind" },
      { key: "brand", label: "Brand" },
      { key: "specs", label: "Specs" },
      { key: "assigned", label: "Assigned to" },
      { key: "condition", label: "Condition" },
      { key: "status", label: "Status" },
      { key: "actions", label: "Actions" },
    ];
  }
  // all
  return [
    { key: "device", label: "Device" },
    { key: "type", label: "Type" },
    { key: "specs", label: "Specs" },
    { key: "assigned", label: "Assigned to" },
    { key: "condition", label: "Condition" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];
}

export function emptyCreateForm(type = "laptop") {
  return {
    name: "",
    type,
    brand: "",
    model: "",
    serialNumber: "",
    ram: "",
    storage: "",
    megapixels: "",
    resolution: "",
    lens: "",
    plateNumber: "",
    chassisNumber: "",
    engineCc: "",
    color: "",
    year: "",
    otherType: "",
    specs: "",
    purchaseDate: "",
    condition: "excellent",
    notes: "",
  };
}

export function buildCreatePayload(form) {
  const type = form.type || "laptop";
  const base = {
    name: form.name,
    type,
    brand: form.brand || "",
    model: form.model || "",
    condition: form.condition || "good",
    notes: form.notes || "",
    purchaseDate: form.purchaseDate || undefined,
    status: "available",
  };
  if (type === "camera") {
    return {
      ...base,
      serialNumber: form.serialNumber || undefined,
      megapixels: form.megapixels || "",
      resolution: form.resolution || "",
      lens: form.lens || "",
    };
  }
  if (type === "motorcycle") {
    return {
      ...base,
      plateNumber: form.plateNumber || "",
      chassisNumber: form.chassisNumber || "",
      engineCc: form.engineCc || "",
      color: form.color || "",
      year: form.year || "",
      // use chassis as unique serial when present
      serialNumber: form.chassisNumber || form.plateNumber || form.serialNumber || undefined,
    };
  }
  if (type === "other") {
    return {
      ...base,
      serialNumber: form.serialNumber || undefined,
      otherType: form.otherType || "",
      specs: form.specs || "",
    };
  }
  return {
    ...base,
    serialNumber: form.serialNumber || undefined,
    ram: form.ram || "",
    storage: form.storage || "",
  };
}
