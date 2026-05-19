import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { fetchPublicEventData, publicEventDataKey } from "@/api/publicEventData";
import { Button } from "@/components/ui/button";
import { AlertCircle, Download, FileText, Loader2, Map, MapPin, Move, Upload, X } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const ROLE_COLORS = {
  "受付": "#3b82f6",
  "誘導": "#10b981",
  "警備": "#ef4444",
  "その他": "#94a3b8",
};

const TIME_SLOTS = ["開場中", "開演中", "終演後"];
const PIN_RADIUS_PX = 11;

async function renderPDFFileToImageFile(file) {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).href;

  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("PDF preview image creation failed"));
    }, "image/jpeg", 0.92);
  });

  const baseName = file.name.replace(/\.pdf$/i, "") || "venue-map";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

function getPinColor(pos) {
  return pos.color || ROLE_COLORS[pos.role] || "#6366f1";
}

function getStaffLabel(pos) {
  return (pos.staff_names || []).join("・");
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function UnplacedPanel({ positions, draggingPin, onSelectPin, onDragStart, disabled }) {
  const notOnMap = positions.filter((p) => p.map_x == null || p.map_y == null);

  return (
    <div className="w-full lg:w-56 shrink-0">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground">
        <MapPin className="w-3.5 h-3.5" />
        未配置ポジション
      </div>
      {notOnMap.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
          すべて配置済みです
        </div>
      ) : (
        <div className="space-y-1.5">
          {notOnMap.map((pos) => (
            <button
              key={pos.id}
              draggable={!disabled}
              onDragStart={(e) => onDragStart(e, pos)}
              onClick={() => onSelectPin(pos)}
              disabled={disabled}
              className={`w-full flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${
                draggingPin?.id === pos.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              } ${disabled ? "opacity-60 cursor-default" : "cursor-grab active:cursor-grabbing"}`}
            >
              <span
                className="w-4 h-4 rounded-full border-2 border-white shadow shrink-0"
                style={{ backgroundColor: getPinColor(pos) }}
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium truncate">{pos.name}</span>
                {getStaffLabel(pos) && (
                  <span className="block text-[10px] text-muted-foreground truncate">{getStaffLabel(pos)}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VenueMap({ eventId }) {
  const queryClient = useQueryClient();
  const { canEdit } = useUserRole();
  const fileInputRef = useRef(null);
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const dragPinRef = useRef(null);

  const [slotFilter, setSlotFilter] = useState(TIME_SLOTS[0]);
  const [draggingPin, setDraggingPin] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfSize, setPdfSize] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [localPdfUrl, setLocalPdfUrl] = useState("");
  const [localMapImageUrl, setLocalMapImageUrl] = useState("");

  const { data: positions = [] } = useQuery({
    queryKey: publicEventDataKey(eventId),
    queryFn: () => fetchPublicEventData(eventId),
    select: (data) => data.positions || [],
  });

  const { data: event } = useQuery({
    queryKey: publicEventDataKey(eventId),
    queryFn: () => fetchPublicEventData(eventId),
    select: (data) => data.event,
  });

  const updatePosition = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Position.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
      queryClient.invalidateQueries({ queryKey: publicEventDataKey(eventId) });
    },
  });

  const filteredPositions = positions.filter((p) => (p.time_slot || TIME_SLOTS[0]) === slotFilter);
  const positionsOnMap = filteredPositions.filter((p) => p.map_x != null && p.map_y != null);
  const storedMapImageUrl = event?.map_image_url && event.map_image_url !== event?.map_pdf_url ? event.map_image_url : "";
  const effectivePdfUrl = localPdfUrl || event?.map_pdf_url || "";
  const effectiveMapImageUrl = localMapImageUrl || storedMapImageUrl;
  const hasPDF = Boolean(effectiveMapImageUrl || effectivePdfUrl);

  useEffect(() => {
    let cancelled = false;
    const renderMap = async () => {
      const canvas = canvasRef.current;
      if (!canvas || (!effectiveMapImageUrl && !effectivePdfUrl)) {
        setPdfSize(null);
        setPdfError("");
        return;
      }

      setLoadingPDF(true);
      setPdfError("");
      try {
        const context = canvas.getContext("2d");
        if (effectiveMapImageUrl) {
          const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = effectiveMapImageUrl;
          });
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          context.drawImage(image, 0, 0);
        } else {
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).href;
          const pdf = await pdfjsLib.getDocument({ url: effectivePdfUrl }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, canvasContext: context, viewport }).promise;
        }
        if (!cancelled) {
          setPdfSize({ width: canvas.width, height: canvas.height });
        }
      } catch (error) {
        console.error("Venue map render error:", error);
        if (!cancelled) {
          setPdfError("会場マップを表示できませんでした。PDFをもう一度読み込んでください。");
          setPdfSize(null);
        }
      } finally {
        if (!cancelled) setLoadingPDF(false);
      }
    };

    renderMap();
    return () => {
      cancelled = true;
    };
  }, [effectiveMapImageUrl, effectivePdfUrl]);

  const getMapCoords = useCallback((clientX, clientY) => {
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }, []);

  const placePin = (pos, x, y) => {
    updatePosition.mutate({ id: pos.id, data: { map_x: x, map_y: y } });
    setDraggingPin(null);
    setTooltip(null);
  };

  const handleMapClick = (e) => {
    if (!canEdit || !draggingPin || !hasPDF) return;
    const { x, y } = getMapCoords(e.clientX, e.clientY);
    placePin(draggingPin, x, y);
  };

  const handleMapDrop = (e) => {
    e.preventDefault();
    if (!canEdit || !dragPinRef.current || !hasPDF) return;
    const { x, y } = getMapCoords(e.clientX, e.clientY);
    placePin(dragPinRef.current, x, y);
    dragPinRef.current = null;
  };

  const handlePinDragStart = (e, pos) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", pos.id);
    dragPinRef.current = pos;
    setDraggingPin(pos);
    setTooltip(null);
  };

  const handleTouchEnd = (e) => {
    if (!canEdit || !draggingPin || !hasPDF) return;
    const touch = e.changedTouches[0];
    const { x, y } = getMapCoords(touch.clientX, touch.clientY);
    placePin(draggingPin, x, y);
  };

  const handleMapFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!isPDF && !isImage) {
      alert("PDFまたは画像ファイルを選択してください。");
      e.target.value = "";
      return;
    }

    setUploadingPDF(true);
    try {
      setPdfError("");
      const previewFile = isPDF ? await renderPDFFileToImageFile(file) : file;
      const uploadTasks = [base44.integrations.Core.UploadFile({ file: previewFile })];
      if (isPDF) uploadTasks.unshift(base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadTasks);
      const pdfUrl = isPDF ? results[0].file_url : null;
      const imageUrl = isPDF ? results[1].file_url : results[0].file_url;
      setLocalPdfUrl(pdfUrl);
      setLocalMapImageUrl(imageUrl);
      await base44.entities.Event.update(eventId, {
        map_pdf_url: pdfUrl,
        map_image_url: imageUrl,
      });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: publicEventDataKey(eventId) });
    } catch (error) {
      console.error("Map file upload error:", error);
      alert("ファイルの読み込みに失敗しました: " + error.message);
    } finally {
      setUploadingPDF(false);
      e.target.value = "";
    }
  };

  const handlePDFRemove = async () => {
    if (!confirm("会場マップPDFを削除しますか？ピンの座標は残ります。")) return;
    setLocalPdfUrl("");
    setLocalMapImageUrl("");
    await base44.entities.Event.update(eventId, { map_pdf_url: null, map_image_url: null });
    queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    queryClient.invalidateQueries({ queryKey: publicEventDataKey(eventId) });
  };

  const handleExportPDF = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfSize) {
      alert("PDFの読み込み完了後に出力してください。");
      return;
    }

    setExportingPDF(true);
    try {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, 0);

      positionsOnMap.forEach((pos) => {
        const x = (Number(pos.map_x) / 100) * exportCanvas.width;
        const y = (Number(pos.map_y) / 100) * exportCanvas.height;
        const color = getPinColor(pos);
        const label = getStaffLabel(pos) ? `${pos.name} / ${getStaffLabel(pos)}` : pos.name;
        const fontSize = Math.max(18, Math.round(exportCanvas.width * 0.014));
        ctx.font = `600 ${fontSize}px "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif`;
        const paddingX = Math.round(fontSize * 0.45);
        const labelHeight = Math.round(fontSize * 1.55);
        const labelWidth = Math.min(
          Math.round(exportCanvas.width * 0.42),
          Math.ceil(ctx.measureText(label).width + paddingX * 2)
        );
        const labelX = Math.min(x + PIN_RADIUS_PX + 8, exportCanvas.width - labelWidth - 8);
        const labelY = Math.max(8, Math.min(y - labelHeight / 2, exportCanvas.height - labelHeight - 8));

        ctx.save();
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
        ctx.strokeStyle = "rgba(17, 24, 39, 0.18)";
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, labelX, labelY, labelWidth, labelHeight, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#111827";
        ctx.fillText(label, labelX + paddingX, labelY + labelHeight / 2, labelWidth - paddingX * 2);

        ctx.beginPath();
        ctx.arc(x, y, PIN_RADIUS_PX, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.restore();
      });

      const { jsPDF } = await import("jspdf");
      const isLandscape = exportCanvas.width > exportCanvas.height;
      const doc = new jsPDF(isLandscape ? "l" : "p", "mm", "a4");
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const scale = Math.min(pageW / exportCanvas.width, pageH / exportCanvas.height);
      const imgW = exportCanvas.width * scale;
      const imgH = exportCanvas.height * scale;
      const offsetX = (pageW - imgW) / 2;
      const offsetY = (pageH - imgH) / 2;

      doc.addImage(exportCanvas.toDataURL("image/jpeg", 0.95), "JPEG", offsetX, offsetY, imgW, imgH);

      const safeName = (event?.name || "venue-map").replace(/[\\/:*?"<>|]/g, "_");
      doc.save(`${safeName}_会場マップ_${slotFilter}.pdf`);
    } catch (error) {
      console.error("Venue map PDF export error:", error);
      alert("PDF出力に失敗しました: " + error.message);
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-3">
        <h2 className="text-sm font-bold flex items-center gap-1.5 flex-1">
          <Map className="w-4 h-4 text-primary" />
          会場マップ
        </h2>
        <div className="flex gap-1.5 flex-wrap justify-end sm:ml-auto">
          {canEdit && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPDF}
                className="gap-1 h-7 text-xs"
              >
                {uploadingPDF ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                PDF/画像読込
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleMapFileUpload}
              />
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPDF}
            disabled={!hasPDF || loadingPDF || exportingPDF || positionsOnMap.length === 0}
            className="gap-1 h-7 text-xs"
          >
            {exportingPDF ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            PDF出力
          </Button>
          {canEdit && hasPDF && (
            <Button size="sm" variant="outline" onClick={handlePDFRemove} className="gap-1 h-7 text-xs">
              <X className="w-3 h-3" />
              PDF削除
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-0 border-b border-border mb-3">
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot}
            onClick={() => {
              setSlotFilter(slot);
              setTooltip(null);
              setDraggingPin(null);
            }}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              slotFilter === slot
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {slot}
          </button>
        ))}
      </div>

      {draggingPin && (
        <div className="mb-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary flex items-center gap-2">
          <Move className="w-3.5 h-3.5 shrink-0" />
          「{draggingPin.name}」をPDF上の配置したい場所にクリック、またはドラッグしてください。
          <button className="ml-auto" onClick={() => setDraggingPin(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 -mx-4 lg:mx-0 overflow-x-auto lg:overflow-visible">
          <div className="px-4 lg:px-0 lg:max-w-[560px] lg:mx-auto" style={{ minWidth: 320 }}>
            <div
              ref={mapRef}
              onClick={handleMapClick}
              onTouchEnd={handleTouchEnd}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={handleMapDrop}
              className={`relative overflow-hidden rounded-lg border-2 bg-white ${
                draggingPin ? "border-primary cursor-crosshair" : "border-border"
              }`}
              style={{
                aspectRatio: pdfSize ? `${pdfSize.width} / ${pdfSize.height}` : "210 / 297",
                minHeight: 280,
              }}
            >
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

              {(loadingPDF || uploadingPDF) && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  PDFを読み込んでいます
                </div>
              )}

              {!hasPDF && !loadingPDF && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                  <FileText className="w-10 h-10 opacity-40" />
                  <div>
                    <p className="text-sm font-medium text-foreground">A4サイズのPDFまたは画像を読み込んでください</p>
                    <p className="text-xs mt-1">読み込んだマップ上にポジションのピンを配置できます。</p>
                  </div>
                  {canEdit && (
                    <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      PDF/画像読込
                    </Button>
                  )}
                </div>
              )}

              {pdfError && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 px-6 text-center text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                  {pdfError}
                </div>
              )}

              {positionsOnMap.map((pos) => {
                const isActive = tooltip?.id === pos.id;
                return (
                  <div
                    key={pos.id}
                    className="absolute z-20"
                    style={{
                      left: `${pos.map_x}%`,
                      top: `${pos.map_y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <button
                      draggable={canEdit}
                      onDragStart={(e) => handlePinDragStart(e, pos)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTooltip(isActive ? null : pos);
                      }}
                      className={`flex flex-col items-center select-none ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ backgroundColor: getPinColor(pos) }}
                      >
                        {(pos.name || "?").charAt(0)}
                      </span>
                      <span className="mt-0.5 max-w-[96px] rounded bg-white/95 px-1 py-0.5 text-center text-[9px] font-medium leading-tight shadow pointer-events-none">
                        <span className="block truncate">{pos.name}</span>
                        {getStaffLabel(pos) && <span className="block truncate text-muted-foreground">{getStaffLabel(pos)}</span>}
                      </span>
                    </button>

                    {isActive && (
                      <div
                        className="absolute z-40 w-44 rounded-lg border border-border bg-card p-2.5 shadow-xl"
                        style={{
                          left: Number(pos.map_x) > 60 ? "auto" : "50%",
                          right: Number(pos.map_x) > 60 ? "110%" : "auto",
                          top: Number(pos.map_y) > 70 ? "auto" : "100%",
                          bottom: Number(pos.map_y) > 70 ? "110%" : "auto",
                          transform: Number(pos.map_x) > 60 ? "none" : "translateX(-50%)",
                          marginTop: Number(pos.map_y) <= 70 ? 4 : 0,
                        }}
                      >
                        <button onClick={() => setTooltip(null)} className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" />
                        </button>
                        <div className="pr-4 text-xs font-semibold">{pos.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {getStaffLabel(pos) || "担当スタッフ未設定"}
                        </div>
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updatePosition.mutate({ id: pos.id, data: { map_x: null, map_y: null } });
                              setTooltip(null);
                            }}
                            className="mt-2 text-xs text-destructive hover:underline"
                          >
                            マップから外す
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <UnplacedPanel
          positions={filteredPositions}
          draggingPin={draggingPin}
          disabled={!canEdit || !hasPDF}
          onSelectPin={(pos) => {
            if (!canEdit || !hasPDF) return;
            setDraggingPin(pos);
            setTooltip(null);
          }}
          onDragStart={(e, pos) => handlePinDragStart(e, pos)}
        />
      </div>
    </div>
  );
}
