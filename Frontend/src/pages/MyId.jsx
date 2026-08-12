import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Button } from "../components/ui/button";
import {
  CreditCard,
  Download,
  Printer,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  Loader2,
} from "lucide-react";
import EmployeeIdCard, { ID_CARD_MM } from "../components/id/EmployeeIdCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  downloadIdCardPdf,
  downloadIdCardPng,
} from "../utils/idCardExport";
import { toast } from "react-toastify";

const API_BASE = import.meta.env.VITE_API_URL;

/**
 * My ID — official GammoDA employee ID card at real CR80 size.
 * Template text/layout matches TEMP.jpg exactly; employee fields come from DB.
 */
export default function MyId() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const cardRef = useRef(null);
  const [remote, setRemote] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Fresh employee record so profile photo / DOB / etc. match the database
  useEffect(() => {
    const id = user?.id || user?._id;
    const token = localStorage.getItem("authToken");
    if (!id || !token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/employees/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.data?.status && res.data?.data) {
          setRemote(res.data.data);
        }
      } catch (err) {
        console.error("MyId: failed to load employee", err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?._id]);

  const employee = useMemo(() => {
    const src = remote || user || {};
    return {
      name: src.name || user?.name || "",
      dateOfBirth: src.dateOfBirth || user?.dateOfBirth || null,
      gender: src.gender || user?.gender || "",
      position: src.position || user?.position || "",
      nationality: src.nationality || user?.nationality || "Ethiopian",
      address: src.address || user?.address || "",
      phone: src.phone || user?.phone || "",
      employeeId: src.employeeId || user?.employeeId || "",
      // API maps photo to `avatar`; DB field is `profileImage`
      profileImage: src.profileImage || user?.profileImage || "",
      avatar: src.avatar || user?.avatar || "",
    };
  }, [remote, user]);

  const handleDownloadPdf = async (format = "card") => {
    if (!cardRef.current) {
      toast.error("ID card is not ready");
      return;
    }
    try {
      setExporting(true);
      toast.info(
        format === "a4"
          ? "Generating printable A4 sheet with cut guides..."
          : "Generating high-resolution ID card PDF..."
      );
      await downloadIdCardPdf({
        element: cardRef.current,
        employee,
        format,
      });
      toast.success("ID Card PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPng = async () => {
    if (!cardRef.current) {
      toast.error("ID card is not ready");
      return;
    }
    try {
      setExporting(true);
      toast.info("Generating high-resolution PNG image...");
      await downloadIdCardPng({
        element: cardRef.current,
        employee,
      });
      toast.success("ID Card PNG downloaded successfully!");
    } catch (err) {
      console.error("PNG export failed", err);
      toast.error("Failed to generate PNG image.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    if (!cardRef.current) {
      toast.error("ID card not ready yet.");
      return;
    }
    const cardHtml = cardRef.current.outerHTML;
    const w = `${ID_CARD_MM.width}mm`;
    const h = `${ID_CARD_MM.height}mm`;
    const win = window.open("", "_blank", "width=600,height=450");
    if (!win) {
      toast.error("Pop-up blocked — please allow pop-ups and try again.");
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Employee ID – ${employee.name || ""}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${w}; height: ${h};
      background: #fff;
      overflow: hidden;
    }
    .employee-id-card {
      transform: scale(calc(${w} / 1015px)) !important;
      transform-origin: top left !important;
      box-shadow: none !important;
    }
    @page { size: ${w} ${h}; margin: 0; }
  </style>
</head>
<body>${cardHtml}</body>
</html>`);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
    setTimeout(() => {
      try { win.focus(); win.print(); } catch (_) {}
    }, 800);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 my-id-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            {t("myId.title") || "My ID"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("myId.subtitle") ||
              "Your official GammoDA employee ID card (standard CR80 size)."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={exporting}>
            <Printer className="w-4 h-4 mr-2" />
            {t("myId.print") || "Print"}
          </Button>

          {/* Download Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={exporting} className="gap-1.5">
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                {t("myId.download") || "Download ID"}
                <ChevronDown className="w-4 h-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Choose Download Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDownloadPdf("card")}
                className="flex items-start gap-2.5 py-2.5 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Card PDF (CR80 Standard)</p>
                  <p className="text-xs text-muted-foreground">
                    Exact 85.6mm × 56mm size for plastic badge printers
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleDownloadPdf("a4")}
                className="flex items-start gap-2.5 py-2.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Printable A4 Sheet PDF</p>
                  <p className="text-xs text-muted-foreground">
                    Centered on A4 with cut marks & instructions
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleDownloadPng}
                className="flex items-start gap-2.5 py-2.5 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">High-Res Image (PNG)</p>
                  <p className="text-xs text-muted-foreground">
                    Crystal-clear 300+ DPI digital badge image
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4 sm:p-8 flex justify-center overflow-auto print:border-0 print:bg-transparent print:p-0">
        <div
          className="id-card-preview-wrap"
          style={{
            width: `calc(${ID_CARD_MM.width}mm * 2.6)`,
            height: `calc(${ID_CARD_MM.height}mm * 2.6)`,
            overflow: "hidden",
          }}
        >
          <div
            className="id-card-preview-scale"
            style={{
              transform: "scale(calc((85.6mm * 2.6) / 1015px))",
              transformOrigin: "top left",
              width: "1015px",
              height: "665px",
            }}
          >
            <EmployeeIdCard ref={cardRef} employee={employee} />
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center print:hidden">
        {t("myId.sizeNote") ||
          `Card size: ${ID_CARD_MM.width}mm × ${ID_CARD_MM.height}mm (official GammoDA ID template proportions).`}
      </p>
    </div>
  );
}
