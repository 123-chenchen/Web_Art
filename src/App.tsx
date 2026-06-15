import {
  Camera,
  Check,
  DollarSign,
  ImagePlus,
  Images,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type PointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_TEMPLATE_ID,
  type DemoTemplate,
  frameOptions,
  loadDemoTemplates,
  singleSizeOptions,
} from "./lib/demoTemplates";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  uploadImageToCloudinary,
  validateImageFile,
} from "./lib/cloudinary";
import {
  MAX_IMAGES,
  formatMoney,
  getBestPricePlan,
  getComboSuggestion,
} from "./lib/pricing";

type PhotoStatus = "ready" | "uploading" | "uploaded" | "error";

type PhotoItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: PhotoStatus;
  secureUrl?: string;
  error?: string;
  demoScale: number;
  demoOffsetX: number;
  demoOffsetY: number;
};

type Notice = {
  type: "success" | "error" | "info";
  message: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  address: string;
  note: string;
  website: string;
};

type TemplateCanvasProps = {
  template: DemoTemplate;
  photos: PhotoItem[];
  activePhoto: PhotoItem | null;
  className?: string;
};

type DragSession = {
  originX: number;
  originY: number;
  photoId: string;
  pointerId: number;
  startX: number;
  startY: number;
};

type PinchSession = {
  originOffsetX: number;
  originOffsetY: number;
  photoId: string;
  startCenterX: number;
  startCenterY: number;
  startDistance: number;
  startScale: number;
};

const initialForm: CustomerForm = {
  name: "",
  phone: "",
  address: "",
  note: "",
  website: "",
};

const trustedSignals = [
  "Preview khung ngay trên web",
  "Upload tối đa 21 ảnh",
  "Giữ nguyên flow gửi đơn",
];

const MAX_DEMO_SCALE = 1.8;
const MAX_DEMO_OFFSET = 220;
const MIN_DEMO_SCALE = 1;
const WHEEL_ZOOM_SENSITIVITY = 0.0012;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPointerDistance(
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getPointerCenter(
  first: { x: number; y: number },
  second: { x: number; y: number },
) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function makeId() {
  if ("randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAppsScriptEndpoint() {
  return (
    import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL as string | undefined
  )?.trim();
}

function getStatusText(status: PhotoStatus) {
  switch (status) {
    case "uploading":
      return "Đang upload";
    case "uploaded":
      return "Đã upload";
    case "error":
      return "Lỗi";
    default:
      return "Sẵn sàng";
  }
}

function getPreviewImageStyle(photo: PhotoItem): CSSProperties {
  return {
    objectPosition: `calc(50% + ${photo.demoOffsetX}px) calc(50% + ${photo.demoOffsetY}px)`,
    transform: `scale(${photo.demoScale})`,
  };
}

function getOverlayViewportStyle(
  overlay: DemoTemplate["overlays"][number] | null,
): CSSProperties {
  if (!overlay || overlay.shapeType !== "polygon") {
    return {};
  }

  return {
    WebkitClipPath: overlay.clipPath,
    clipPath: overlay.clipPath,
  };
}

function getOverlayStyle(
  template: DemoTemplate,
  overlay: DemoTemplate["overlays"][number],
): CSSProperties {
  return {
    left: `${(overlay.bounds.x / template.width) * 100}%`,
    top: `${(overlay.bounds.y / template.height) * 100}%`,
    width: `${(overlay.bounds.width / template.width) * 100}%`,
    height: `${(overlay.bounds.height / template.height) * 100}%`,
    clipPath: overlay.clipPath,
  };
}

function getTemplatePhotos(
  template: DemoTemplate,
  photos: PhotoItem[],
  activePhoto: PhotoItem | null,
) {
  if (photos.length === 0) {
    return [];
  }

  if (template.kind === "single") {
    return [activePhoto ?? photos[0]];
  }

  return template.overlays.map((_, index) => photos[index % photos.length]);
}

function TemplateCanvas({
  template,
  photos,
  activePhoto,
  className,
}: TemplateCanvasProps) {
  const assignedPhotos = getTemplatePhotos(template, photos, activePhoto);

  return (
    <div
      className={`studio-demo-canvas ${className ?? ""}`}
      style={{ aspectRatio: `${template.width} / ${template.height}` }}
    >
      <img
        src={template.previewSrc}
        alt={template.title}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      {assignedPhotos.map((photo, index) => {
        if (!photo) return null;

        return (
          <div
            key={`${template.id}-${photo.id}-${index}`}
            className="studio-demo-slot"
            style={getOverlayStyle(template, template.overlays[index])}
          >
            <img
              src={photo.previewUrl}
              alt=""
              className="studio-demo-slot__image"
              style={getPreviewImageStyle(photo)}
              loading="lazy"
              decoding="async"
            />
          </div>
        );
      })}
    </div>
  );
}

async function submitOrder(payload: unknown) {
  const endpoint = getAppsScriptEndpoint();

  if (!endpoint) {
    throw new Error("Thiếu VITE_GOOGLE_APPS_SCRIPT_URL trong biến môi trường.");
  }

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      'Không gọi được Google Apps Script. Kiểm tra Web App đã deploy quyền "Anyone", dùng URL /exec mới nhất và khởi động lại Vite sau khi sửa .env.local.',
      { cause: error },
    );
  }

  const text = await response.text();
  let data: { ok?: boolean; message?: string };

  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  if (!response.ok || data.ok !== true) {
    if (!data.message) {
      throw new Error(
        'Google Apps Script không trả về JSON hợp lệ. Nếu URL mở ra trang đăng nhập Google, hãy deploy Web App với quyền "Anyone".',
      );
    }

    throw new Error(data.message || "Không gửi được đơn hàng. Vui lòng thử lại.");
  }

  return data;
}

function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [demoTemplates, setDemoTemplates] = useState<DemoTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] =
    useState<string>(DEFAULT_TEMPLATE_ID);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isDraggingAdjustPhoto, setIsDraggingAdjustPhoto] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef(new Set<string>());
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragSessionRef = useRef<DragSession | null>(null);
  const pinchSessionRef = useRef<PinchSession | null>(null);

  const imageCount = photos.length;
  const remainingSlots = MAX_IMAGES - imageCount;
  const plan = useMemo(() => getBestPricePlan(imageCount), [imageCount]);
  const suggestion = useMemo(
    () => getComboSuggestion(imageCount),
    [imageCount],
  );
  const canSubmit = imageCount > 0 && !isSubmitting;
  const hasUploadErrors = photos.some((photo) => photo.status === "error");
  const templateMap = useMemo(
    () => new Map(demoTemplates.map((template) => [template.id, template])),
    [demoTemplates],
  );
  const activeTemplate =
    templateMap.get(activeTemplateId) ??
    templateMap.get(DEFAULT_TEMPLATE_ID) ??
    demoTemplates[0] ??
    null;
  const activePrimaryOverlay = activeTemplate?.overlays[0] ?? null;
  const activeFrameAspectRatio = activePrimaryOverlay
    ? activePrimaryOverlay.bounds.width / activePrimaryOverlay.bounds.height
    : 4 / 5;
  const activeFrameViewportStyle = getOverlayViewportStyle(activePrimaryOverlay);
  const isActiveFramePolygon = activePrimaryOverlay?.shapeType === "polygon";
  const activePhoto =
    photos.find((photo) => photo.id === activePhotoId) ?? photos[0] ?? null;
  const activeFrameFamilyId = activeTemplate?.familyId ?? "single";

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadDemoTemplates()
      .then((templates) => {
        if (!isMounted) return;
        setDemoTemplates(templates);
        setTemplateError(null);
      })
      .catch((error) => {
        if (!isMounted) return;

        setTemplateError(
          error instanceof Error
            ? error.message
            : "Không tải được thư viện khung demo.",
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingTemplates(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdjustModalOpen) {
      return;
    }

    const htmlElement = document.documentElement;
    const previousHtmlOverflow = htmlElement.style.overflow;
    const previousOverflow = document.body.style.overflow;

    htmlElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      htmlElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
    };
  }, [isAdjustModalOpen]);

  useEffect(() => {
    if (!isAdjustModalOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAdjustModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isAdjustModalOpen]);

  function addObjectUrl(url: string) {
    objectUrlsRef.current.add(url);
  }

  function revokeObjectUrl(url: string) {
    if (!objectUrlsRef.current.has(url)) return;

    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }

  function clearAllPhotos() {
    photos.forEach((photo) => revokeObjectUrl(photo.previewUrl));
    setPhotos([]);
    setActivePhotoId(null);
    closeAdjustModal();
  }

  function updatePhotoDemo(
    id: string,
    updates: Partial<Pick<PhotoItem, "demoScale" | "demoOffsetX" | "demoOffsetY">>,
  ) {
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, ...updates } : photo)),
    );
  }

  function resetPhotoDemo(id: string) {
    updatePhotoDemo(id, {
      demoScale: 1,
      demoOffsetX: 0,
      demoOffsetY: 0,
    });
  }

  function closeAdjustModal() {
    setIsAdjustModalOpen(false);
    setIsDraggingAdjustPhoto(false);
    activePointersRef.current.clear();
    dragSessionRef.current = null;
    pinchSessionRef.current = null;
  }

  function openAdjustModal(photoId?: string) {
    if (photoId) {
      setActivePhotoId(photoId);
    }

    setIsAdjustModalOpen(true);
  }

  function updateActivePhotoScale(nextScale: number) {
    if (!activePhoto) return;

    updatePhotoDemo(activePhoto.id, {
      demoScale: clamp(nextScale, MIN_DEMO_SCALE, MAX_DEMO_SCALE),
    });
  }

  function handleAdjustPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!activePhoto) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const activePointers = Array.from(activePointersRef.current.entries());

    if (activePointers.length >= 2) {
      const [, firstPointer] = activePointers[0];
      const [, secondPointer] = activePointers[1];
      const center = getPointerCenter(firstPointer, secondPointer);

      pinchSessionRef.current = {
        originOffsetX: activePhoto.demoOffsetX,
        originOffsetY: activePhoto.demoOffsetY,
        photoId: activePhoto.id,
        startCenterX: center.x,
        startCenterY: center.y,
        startDistance: getPointerDistance(firstPointer, secondPointer),
        startScale: activePhoto.demoScale,
      };
      dragSessionRef.current = null;
      setIsDraggingAdjustPhoto(false);
      return;
    }

    dragSessionRef.current = {
      originX: activePhoto.demoOffsetX,
      originY: activePhoto.demoOffsetY,
      photoId: activePhoto.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    pinchSessionRef.current = null;
    setIsDraggingAdjustPhoto(true);
  }

  function handleAdjustPointerMove(event: PointerEvent<HTMLDivElement>) {
    const activePointer = activePointersRef.current.get(event.pointerId);

    if (!activePointer) return;

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pinchSession = pinchSessionRef.current;

    if (pinchSession && activePointersRef.current.size >= 2) {
      event.preventDefault();

      const activePointers = Array.from(activePointersRef.current.values());
      const firstPointer = activePointers[0];
      const secondPointer = activePointers[1];
      const nextDistance = getPointerDistance(firstPointer, secondPointer);
      const nextCenter = getPointerCenter(firstPointer, secondPointer);
      const distanceRatio =
        pinchSession.startDistance > 0
          ? nextDistance / pinchSession.startDistance
          : 1;

      updatePhotoDemo(pinchSession.photoId, {
        demoOffsetX: clamp(
          pinchSession.originOffsetX +
            (nextCenter.x - pinchSession.startCenterX),
          -MAX_DEMO_OFFSET,
          MAX_DEMO_OFFSET,
        ),
        demoOffsetY: clamp(
          pinchSession.originOffsetY +
            (nextCenter.y - pinchSession.startCenterY),
          -MAX_DEMO_OFFSET,
          MAX_DEMO_OFFSET,
        ),
        demoScale: clamp(
          pinchSession.startScale * distanceRatio,
          MIN_DEMO_SCALE,
          MAX_DEMO_SCALE,
        ),
      });
      return;
    }

    const dragSession = dragSessionRef.current;

    if (!dragSession || dragSession.pointerId !== event.pointerId) return;

    event.preventDefault();
    updatePhotoDemo(dragSession.photoId, {
      demoOffsetX: clamp(
        dragSession.originX + (event.clientX - dragSession.startX),
        -MAX_DEMO_OFFSET,
        MAX_DEMO_OFFSET,
      ),
      demoOffsetY: clamp(
        dragSession.originY + (event.clientY - dragSession.startY),
        -MAX_DEMO_OFFSET,
        MAX_DEMO_OFFSET,
      ),
    });
  }

  function handleAdjustPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activePointersRef.current.delete(event.pointerId);

    const pinchSession = pinchSessionRef.current;

    if (pinchSession) {
      if (activePointersRef.current.size === 1 && activePhoto) {
        const [pointerId, pointer] = Array.from(
          activePointersRef.current.entries(),
        )[0];

        dragSessionRef.current = {
          originX: activePhoto.demoOffsetX,
          originY: activePhoto.demoOffsetY,
          photoId: activePhoto.id,
          pointerId,
          startX: pointer.x,
          startY: pointer.y,
        };
        setIsDraggingAdjustPhoto(true);
      } else if (activePointersRef.current.size === 0) {
        dragSessionRef.current = null;
        setIsDraggingAdjustPhoto(false);
      }

      pinchSessionRef.current = null;
      return;
    }

    const dragSession = dragSessionRef.current;

    if (dragSession?.pointerId === event.pointerId) {
      dragSessionRef.current = null;
      setIsDraggingAdjustPhoto(false);
    }
  }

  function handleAdjustWheel(event: WheelEvent<HTMLDivElement>) {
    if (!activePhoto) return;

    event.preventDefault();

    const wheelDelta = clamp(
      -event.deltaY * WHEEL_ZOOM_SENSITIVITY,
      -0.18,
      0.18,
    );

    updateActivePhotoScale(activePhoto.demoScale + wheelDelta);
  }

  function handleFileSelection(fileList: FileList | File[]) {
    const files = Array.from(fileList);

    if (!files.length) return;

    if (remainingSlots <= 0) {
      setNotice({
        type: "error",
        message: `Bạn đã đủ ${MAX_IMAGES} ảnh. Xóa bớt ảnh nếu muốn đổi mẫu.`,
      });
      return;
    }

    const accepted: PhotoItem[] = [];
    const rejected: string[] = [];
    let overflowCount = 0;

    for (const file of files) {
      if (accepted.length >= remainingSlots) {
        overflowCount += 1;
        continue;
      }

      const error = validateImageFile(file);

      if (error) {
        rejected.push(`${file.name}: ${error}`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      addObjectUrl(previewUrl);
      accepted.push({
        id: makeId(),
        file,
        previewUrl,
        status: "ready",
        demoScale: 1,
        demoOffsetX: 0,
        demoOffsetY: 0,
      });
    }

    if (accepted.length > 0) {
      setPhotos((current) => [...current, ...accepted]);
      setActivePhotoId(accepted[0].id);
      setIsAdjustModalOpen(true);
    }

    if (overflowCount > 0 || rejected.length > 0) {
      const parts = [];

      if (overflowCount > 0) {
        parts.push(
          `Mình chỉ thêm ${accepted.length} ảnh để không vượt ${MAX_IMAGES} ảnh.`,
        );
      }

      if (rejected.length > 0) {
        parts.push(rejected[0]);
      }

      setNotice({
        type: "error",
        message: parts.join(" "),
      });
      return;
    }

    setNotice({
      type: "success",
      message: `Đã thêm ${accepted.length} ảnh. Modal căn chỉnh đã mở để bạn kéo ảnh, cuộn chuột hoặc chụm 2 ngón để zoom.`,
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      handleFileSelection(event.target.files);
      event.target.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isSubmitting) return;

    handleFileSelection(event.dataTransfer.files);
  }

  function removePhoto(id: string) {
    const photo = photos.find((item) => item.id === id);
    const nextPhotos = photos.filter((item) => item.id !== id);

    if (photo) {
      revokeObjectUrl(photo.previewUrl);
    }

    setPhotos(nextPhotos);

    if (activePhotoId === id) {
      setActivePhotoId(nextPhotos[0]?.id ?? null);
    }

    if (nextPhotos.length === 0) {
      closeAdjustModal();
    }
  }

  function updateForm<K extends keyof CustomerForm>(
    key: K,
    value: CustomerForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateForm() {
    if (!form.name.trim()) return "Vui lòng nhập họ tên.";
    if (!/^[0-9+\s().-]{8,16}$/.test(form.phone.trim()))
      return "Số điện thoại chưa hợp lệ.";
    if (!form.address.trim()) return "Vui lòng nhập địa chỉ nhận hàng.";
    if (imageCount <= 0) return "Vui lòng upload ít nhất 1 ảnh.";
    if (imageCount > MAX_IMAGES)
      return `Đơn chỉ nhận tối đa ${MAX_IMAGES} ảnh.`;

    return null;
  }

  async function uploadPhotosForOrder(currentPhotos: PhotoItem[]) {
    const uploadedUrls: string[] = [];

    for (const photo of currentPhotos) {
      if (photo.secureUrl) {
        uploadedUrls.push(photo.secureUrl);
        continue;
      }

      setPhotos((items) =>
        items.map((item) =>
          item.id === photo.id
            ? { ...item, status: "uploading", error: undefined }
            : item,
        ),
      );

      try {
        const result = await uploadImageToCloudinary(photo.file);
        uploadedUrls.push(result.secureUrl);
        setPhotos((items) =>
          items.map((item) =>
            item.id === photo.id
              ? {
                  ...item,
                  status: "uploaded",
                  secureUrl: result.secureUrl,
                  error: undefined,
                }
              : item,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload ảnh thất bại.";
        setPhotos((items) =>
          items.map((item) =>
            item.id === photo.id
              ? { ...item, status: "error", error: message }
              : item,
          ),
        );
        throw new Error(`Ảnh "${photo.file.name}" chưa upload được: ${message}`, {
          cause: error,
        });
      }
    }

    return uploadedUrls;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    if (form.website.trim()) {
      setNotice({
        type: "success",
        message: "Cảm ơn bạn. Đơn hàng đã được ghi nhận.",
      });
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setNotice({
        type: "error",
        message: validationError,
      });
      return;
    }

    setIsSubmitting(true);
    setNotice({
      type: "info",
      message: "Đang upload ảnh và gửi đơn...",
    });

    const currentPhotos = photos.slice();
    const currentPlan = getBestPricePlan(currentPhotos.length);

    try {
      const imageUrls = await uploadPhotosForOrder(currentPhotos);

      await submitOrder({
        orderedAt: new Date().toISOString(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        note: form.note.trim(),
        imageCount: currentPhotos.length,
        combo: currentPlan.label,
        total: currentPlan.total,
        totalText: formatMoney(currentPlan.total),
        imageUrls,
      });

      currentPhotos.forEach((photo) => revokeObjectUrl(photo.previewUrl));
      setPhotos([]);
      setForm(initialForm);
      setActivePhotoId(null);
      closeAdjustModal();
      setNotice({
        type: "success",
        message:
          "Đặt tranh thành công. Admin sẽ nhận Gmail báo đơn mới ngay khi Apps Script chạy xong.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Có lỗi khi gửi đơn hàng.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectFrameOption(id: string) {
    if (id === "single") {
      const fallbackSingleId =
        activeTemplate?.kind === "single" ? activeTemplate.id : "single-3";
      setActiveTemplateId(fallbackSingleId);
      return;
    }

    setActiveTemplateId(id);
  }

  return (
    <main className="min-h-screen bg-[#080808] text-zinc-50">
      <section className="hero-bg relative overflow-hidden">
        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-white"
          >
            <span className="grid size-9 place-items-center rounded-full border border-amber-300/50 bg-black/40 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            Hexa Metal
          </a>
        </nav>

        <div
          id="top"
          className="relative z-10 mx-auto grid min-h-[calc(82svh-76px)] w-full max-w-7xl items-center px-4 pb-12 pt-8 sm:px-6 lg:px-8"
        >
          <div className="max-w-2xl">
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
              Biến ảnh của bạn thành decor sắc nét.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-200 sm:text-lg">
              Upload ảnh, thử ngay trên khung demo, rồi gửi đơn mà không cần đổi
              flow Cloudinary hay Google Sheet.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#order-studio"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-6 py-3 text-sm font-bold text-zinc-950 shadow-[0_18px_60px_rgba(245,158,11,0.35)] transition hover:bg-amber-200"
              >
                <Upload className="size-5" aria-hidden="true" />
                Upload ảnh của bạn
              </a>
              <a
                href="#studio-gallery"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
              >
                <Camera className="size-5" aria-hidden="true" />
                Xem demo
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-zinc-300">
              {trustedSignals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur"
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="order-studio"
        className="relative overflow-hidden bg-[#0b0b0d] px-4 py-16 text-white sm:px-6 lg:px-8"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.14),transparent_20%),linear-gradient(180deg,#111114_0%,#09090b_100%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-300/90">
              Upload studio
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Thêm ảnh vào khung demo
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
              Chọn ảnh, đổi layout từ thư viện có sẵn trong `single_image` và
              `multi_image`, rồi căn lại ảnh trước khi gửi đơn.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 font-semibold text-white">
              {imageCount}/{MAX_IMAGES} ảnh
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-zinc-200">
              {activeTemplate ? activeTemplate.title : "Đang tải thư viện khung"}
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-zinc-200">
              {suggestion.title}
            </div>
          </div>

          {notice && (
            <div
              className={`mt-6 rounded-2xl border px-4 py-3 text-sm font-medium ${
                notice.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : notice.type === "error"
                    ? "border-red-500/30 bg-red-500/10 text-red-100"
                    : "border-amber-400/30 bg-amber-400/10 text-amber-100"
              }`}
              role="status"
            >
              {notice.message}
            </div>
          )}

          <div className="studio-shell mt-8">
            <aside className="studio-shell__sidebar rounded-[32px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur sm:p-5">
              <div>
                <p className="text-xl font-semibold text-white">
                  1. Tải ảnh lên
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Dùng chính ảnh này để thay vào khung demo. Bạn vẫn có thể giữ
                  nhiều ảnh trong đơn hàng như hiện tại.
                </p>
              </div>

              <div
                className={`upload-zone mt-4 ${isDragging ? "is-dragging" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(",")}
                  multiple
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />

                <div className="grid gap-4">
                  <div className="grid size-14 place-items-center rounded-2xl bg-white text-zinc-950 shadow-[0_16px_40px_rgba(255,255,255,0.18)]">
                    <ImagePlus className="size-7" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {isDragging ? "Thả ảnh vào đây" : "Upload ảnh của bạn"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      JPG, PNG, WEBP. Mỗi ảnh tối đa{" "}
                      {formatFileSize(MAX_FILE_SIZE_BYTES)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || remainingSlots <= 0}
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Chọn ảnh khác
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-[26px] border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
                      Ảnh đang căn
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {activePhoto
                        ? activePhoto.file.name
                        : "Chưa có ảnh nào được chọn"}
                    </p>
                  </div>
                  {activePhoto && (
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-100">
                      {getStatusText(activePhoto.status)}
                    </span>
                  )}
                </div>

                <div
                  className={`studio-photo-viewport mt-4 ${
                    isActiveFramePolygon ? "is-polygon" : ""
                  }`}
                  style={{
                    aspectRatio: `${activeFrameAspectRatio}`,
                    ...activeFrameViewportStyle,
                  }}
                >
                  {activePhoto ? (
                    <img
                      src={activePhoto.previewUrl}
                      alt={activePhoto.file.name}
                      className="h-full w-full object-cover"
                      style={getPreviewImageStyle(activePhoto)}
                    />
                  ) : (
                    <div className="grid h-full place-items-center px-6 text-center text-sm text-zinc-400">
                      Chọn ảnh để xem trước trong khung demo.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-orange-300/40 bg-orange-300/10 px-4 py-2.5 text-sm font-semibold text-orange-100 transition hover:border-orange-200 hover:bg-orange-300/16 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => activePhoto && openAdjustModal(activePhoto.id)}
                    disabled={!activePhoto}
                  >
                    Mở modal căn ảnh
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-white/25 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => activePhoto && resetPhotoDemo(activePhoto.id)}
                    disabled={!activePhoto}
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Thư viện ảnh đã chọn
                  </p>
                  {imageCount > 0 && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-zinc-300 transition hover:text-white"
                      onClick={clearAllPhotos}
                      disabled={isSubmitting}
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                {imageCount === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
                    Ảnh upload sẽ hiện ở đây để bạn chọn và căn chỉnh.
                  </div>
                ) : (
                  <div className="studio-photo-grid mt-4">
                    {photos.map((photo, index) => (
                      <div className="relative" key={photo.id}>
                        <button
                          type="button"
                          className={`group block w-full overflow-hidden rounded-2xl border transition ${
                            activePhoto?.id === photo.id
                              ? "border-orange-300 shadow-[0_0_0_1px_rgba(253,186,116,0.6)]"
                              : "border-white/10 hover:border-white/30"
                          }`}
                          onClick={() => setActivePhotoId(photo.id)}
                        >
                          <div className="aspect-[4/5] bg-zinc-900">
                            <img
                              src={photo.previewUrl}
                              alt={`Ảnh upload ${index + 1}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 bg-black/50 px-2 py-2 text-[11px]">
                            <span className="truncate text-left text-zinc-200">
                              #{index + 1}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${
                                photo.status === "error"
                                  ? "bg-red-500/20 text-red-100"
                                  : photo.status === "uploaded"
                                    ? "bg-emerald-500/20 text-emerald-100"
                                    : photo.status === "uploading"
                                      ? "bg-amber-500/20 text-amber-100"
                                      : "bg-white/10 text-zinc-100"
                              }`}
                            >
                              {photo.status === "uploading" ? (
                                <Loader2
                                  className="size-3 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : photo.status === "uploaded" ? (
                                <Check className="size-3" aria-hidden="true" />
                              ) : photo.status === "error" ? (
                                <RefreshCw className="size-3" aria-hidden="true" />
                              ) : (
                                "OK"
                              )}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="absolute right-2 top-2 grid size-7 place-items-center rounded-full border border-white/15 bg-black/70 text-white transition hover:bg-red-600"
                          onClick={() => removePhoto(photo.id)}
                          disabled={isSubmitting}
                          aria-label={`Xóa ảnh ${index + 1}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <p className="text-xl font-semibold text-white">
                  2. Chọn layout demo
                </p>
                <div className="mt-4 grid gap-3">
                  {frameOptions.map((option) => {
                    const isActive =
                      option.id === "single"
                        ? activeFrameFamilyId === "single"
                        : activeTemplate?.id === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-orange-300 bg-orange-300/10 text-white shadow-[0_0_0_1px_rgba(253,186,116,0.35)]"
                            : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.05]"
                        }`}
                        onClick={() => selectFrameOption(option.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{option.label}</p>
                            <p className="mt-1 text-sm text-zinc-400">
                              {option.description}
                            </p>
                          </div>
                          {isActive && (
                            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-200">
                              Active
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xl font-semibold text-white">
                  3. Căn chỉnh ảnh
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Khi upload xong, modal căn ảnh sẽ tự hiện trên web. Bạn có
                  thể bấm giữ ảnh để di chuyển, cuộn chuột trên desktop hoặc
                  chụm 2 ngón trên mobile để phóng to thu nhỏ.
                </p>

                {activeTemplate?.kind === "single" && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-200">
                        Kích thước khung dọc
                      </p>
                      <p className="text-sm text-zinc-400">
                        {activeTemplate.variantLabel ?? "L"}
                      </p>
                    </div>
                    <div className="studio-size-grid mt-3">
                      {singleSizeOptions.map((option) => (
                        <button
                          key={option.templateId}
                          type="button"
                          className={`rounded-xl border px-0 py-2 text-sm font-semibold transition ${
                            activeTemplate.id === option.templateId
                              ? "border-orange-300 bg-orange-300/10 text-white"
                              : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20"
                          }`}
                          onClick={() => setActiveTemplateId(option.templateId)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-4">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl border border-orange-300/40 bg-orange-300/10 px-4 py-3 text-sm font-semibold text-orange-100 transition hover:border-orange-200 hover:bg-orange-300/16 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => activePhoto && openAdjustModal(activePhoto.id)}
                    disabled={!activePhoto}
                  >
                    Mở trình căn ảnh dạng modal
                  </button>
                </div>

                <p className="mt-4 text-xs leading-5 text-zinc-500">
                  Mẹo: chọn từng ảnh trong thư viện bên trên để căn riêng. Giữ
                  chuột để kéo ảnh, cuộn bánh xe để zoom hoặc chụm 2 ngón trên
                  mobile, nhấn đúp trong modal để reset nhanh. Việc căn chỉnh
                  này chỉ áp dụng cho preview phía client, không thay đổi logic
                  upload Cloudinary hay gửi Google Sheet.
                </p>

                {activePhoto?.error && (
                  <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100">
                    {activePhoto.error}
                  </p>
                )}
              </div>
            </aside>

            <div id="studio-gallery" className="studio-shell__gallery space-y-6">
              <div className="rounded-[34px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Layout đang xem
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                      {activeTemplate?.title ?? "Đang tải thư viện khung"}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
                      {activeTemplate
                        ? `${activeTemplate.caption}. ${
                            imageCount > 1 && activeTemplate.kind === "multi"
                              ? "Nhiều ảnh sẽ tự lặp theo thứ tự upload."
                              : "Ảnh đang chọn sẽ được thay trực tiếp vào khung demo."
                          }`
                        : "Mình đang tải ảnh nền và toạ độ khung từ thư viện public."}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-zinc-100">
                    <Images className="size-4" aria-hidden="true" />
                    {activeTemplate?.overlayCountLabel ?? "Khung demo"}
                  </div>
                </div>

                <div className="mt-5 rounded-[30px] border border-white/10 bg-black/25 p-4 sm:p-6">
                  {isLoadingTemplates ? (
                    <div className="grid min-h-[280px] place-items-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] text-zinc-400 sm:min-h-[340px] lg:min-h-[420px]">
                      Đang tải thư viện khung demo...
                    </div>
                  ) : templateError ? (
                    <div className="grid min-h-[280px] place-items-center rounded-[26px] border border-red-500/30 bg-red-500/10 px-6 text-center text-sm text-red-100 sm:min-h-[340px] lg:min-h-[420px]">
                      {templateError}
                    </div>
                  ) : activeTemplate ? (
                    <div
                      className={
                        activeTemplate.kind === "single"
                          ? "studio-preview-single"
                          : ""
                      }
                    >
                      <TemplateCanvas
                        template={activeTemplate}
                        photos={photos}
                        activePhoto={activePhoto}
                      />
                    </div>
                  ) : (
                    <div className="grid min-h-[280px] place-items-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] text-zinc-400 sm:min-h-[340px] lg:min-h-[420px]">
                      Chưa có mẫu nào để hiển thị.
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {activePhoto
                      ? `Ảnh đang căn: ${activePhoto.file.name}`
                      : "Chưa có ảnh upload nên đang hiển thị ảnh mẫu gốc."}
                  </p>
                  {activeTemplate?.kind === "multi" && imageCount > 0 && (
                    <p>
                      Nếu số ô nhiều hơn số ảnh, hệ thống sẽ lặp ảnh theo thứ tự
                      đã upload.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Các mẫu khác
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Chạm vào từng card để đổi layout mà không ảnh hưởng tới
                      logic đặt hàng hiện có.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-zinc-100">
                    {demoTemplates.length} mẫu
                  </div>
                </div>

                <div className="studio-template-rail mt-5">
                  <div className="studio-template-rail__track">
                    {demoTemplates.map((template) => {
                      const isActive = activeTemplate?.id === template.id;

                      return (
                        <button
                          key={template.id}
                          type="button"
                          className={`rounded-[28px] border p-3 text-left transition ${
                            isActive
                              ? "border-orange-300 bg-orange-300/10 shadow-[0_0_0_1px_rgba(253,186,116,0.35)]"
                              : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
                          }`}
                          onClick={() => setActiveTemplateId(template.id)}
                        >
                          <div className="rounded-[22px] border border-white/10 bg-black/20 p-3">
                            <div
                              className={
                                template.kind === "single"
                                  ? "mx-auto max-w-[150px]"
                                  : ""
                              }
                            >
                              <TemplateCanvas
                                template={template}
                                photos={photos}
                                activePhoto={activePhoto}
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">
                                {template.title}
                              </p>
                              <p className="mt-1 text-sm text-zinc-400">
                                {template.caption}
                              </p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-100">
                              {template.badge}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-50 px-4 pb-16 pt-10 text-zinc-950 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,15,15,0.08)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">
                  Combo đề xuất
                </p>
                <h3 className="mt-2 text-2xl font-semibold">{plan.label}</h3>
              </div>
              <div className="grid size-12 place-items-center rounded-2xl bg-zinc-950 text-amber-200">
                <Package className="size-6" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-zinc-950 p-5 text-white">
              <p className="text-sm text-zinc-400">Tổng tiền tự tính</p>
              <p className="mt-1 text-4xl font-semibold text-amber-200">
                {formatMoney(plan.total)}
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {suggestion.detail}
              </p>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">Số lượng ảnh</span>
                <strong>{imageCount} ảnh</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">Khung demo đang xem</span>
                <strong className="text-right">
                  {activeTemplate?.title ?? "Chưa chọn"}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-zinc-500">
                  <DollarSign className="size-4" aria-hidden="true" />
                  Tổng tiền
                </span>
                <strong className="text-lg text-amber-700">
                  {formatMoney(plan.total)}
                </strong>
              </div>
            </div>
          </div>

          <form
            className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,15,15,0.08)] sm:p-6"
            onSubmit={handleSubmit}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">
                  Form đặt hàng
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  Thông tin nhận tranh
                </h3>
              </div>
              <Mail className="size-6 text-zinc-400" aria-hidden="true" />
            </div>

            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(event) => updateForm("website", event.target.value)}
              />
            </div>

            <div className="grid gap-4">
              <label className="field-label">
                <span>Họ tên</span>
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="Nguyễn Minh Anh"
                  autoComplete="name"
                />
              </label>

              <label className="field-label">
                <span>Số điện thoại</span>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                    aria-hidden="true"
                  />
                  <input
                    className="pl-10"
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    placeholder="09xx xxx xxx"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </label>

              <label className="field-label">
                <span>Địa chỉ nhận hàng</span>
                <div className="relative">
                  <MapPin
                    className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-400"
                    aria-hidden="true"
                  />
                  <textarea
                    className="min-h-24 pl-10"
                    value={form.address}
                    onChange={(event) =>
                      updateForm("address", event.target.value)
                    }
                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                    autoComplete="street-address"
                  />
                </div>
              </label>

              <label className="field-label">
                <span>Ghi chú thêm</span>
                <textarea
                  className="min-h-20"
                  value={form.note}
                  onChange={(event) => updateForm("note", event.target.value)}
                  placeholder="Tone màu, yêu cầu bố cục, thời gian giao..."
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">Số lượng ảnh</span>
                <strong>{imageCount} ảnh</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">Combo chọn</span>
                <strong className="text-right">{plan.label}</strong>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-zinc-500">
                  <DollarSign className="size-4" aria-hidden="true" />
                  Tổng tiền
                </span>
                <strong className="text-lg text-amber-700">
                  {formatMoney(plan.total)}
                </strong>
              </div>
            </div>

            {hasUploadErrors && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                Có ảnh upload lỗi. Bấm đặt lại sau khi kiểm tra cấu hình
                Cloudinary hoặc thay ảnh khác.
              </p>
            )}

            <button
              type="submit"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-4 text-sm font-bold text-white shadow-[0_20px_50px_rgba(0,0,0,0.25)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-5" aria-hidden="true" />
              )}
              Đặt tranh ngay
            </button>
          </form>
        </div>
      </section>

      {isAdjustModalOpen && (
        <div
          className="studio-adjust-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="studio-adjust-title"
        >
          <button
            type="button"
            className="studio-adjust-modal__backdrop"
            onClick={closeAdjustModal}
            aria-label="Đóng modal căn ảnh"
          />

          <div className="studio-adjust-modal__panel">
            <div className="studio-adjust-modal__header flex items-start justify-between gap-4">
              

              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.08]"
                onClick={closeAdjustModal}
                aria-label="Đóng"
              >
                <X className="size-2" aria-hidden="true" />
              </button>
            </div>

            <div className="studio-adjust-workspace mt-6">
              <div className="studio-adjust-stage-card rounded-[30px] border border-white/10 bg-black/25 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="mt-1 text-sm text-zinc-200">
                      {activeTemplate?.title ?? "Khung demo"}
                    </p>
                  </div>
                </div>

                <div className="studio-adjust-stage mt-5">
                  <div
                    className={`studio-adjust-surface ${
                      isActiveFramePolygon ? "is-polygon" : ""
                    } ${isDraggingAdjustPhoto ? "is-grabbing" : ""}`}
                    style={{
                      aspectRatio: `${activeFrameAspectRatio}`,
                      ...activeFrameViewportStyle,
                    }}
                    onPointerDown={handleAdjustPointerDown}
                    onPointerMove={handleAdjustPointerMove}
                    onPointerUp={handleAdjustPointerEnd}
                    onPointerCancel={handleAdjustPointerEnd}
                    onWheel={handleAdjustWheel}
                    onDoubleClick={() =>
                      activePhoto && resetPhotoDemo(activePhoto.id)
                    }
                  >
                    {activePhoto ? (
                      <img
                        src={activePhoto.previewUrl}
                        alt={activePhoto.file.name}
                        className="studio-adjust-surface__image"
                        style={getPreviewImageStyle(activePhoto)}
                        draggable={false}
                      />
                    ) : (
                      <div className="grid h-full place-items-center px-6 text-center text-sm text-zinc-400">
                        Chọn ảnh để bắt đầu căn chỉnh.
                      </div>
                    )}
                    <div className="studio-adjust-surface__hint">
                      1 ngón hoặc giữ chuột để kéo • 2 ngón hoặc cuộn để zoom
                    </div>
                  </div>
                </div>
              </div>

              <div className="studio-adjust-sidebar studio-adjust-sidebar-panel rounded-[30px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
               

                {activeTemplate?.kind === "single" && (
                  <div className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-200">
                        Kích thước khung dọc
                      </p>
                      <p className="text-sm text-zinc-400">
                        {activeTemplate.variantLabel ?? "L"}
                      </p>
                    </div>
                    <div className="studio-size-grid mt-3">
                      {singleSizeOptions.map((option) => (
                        <button
                          key={option.templateId}
                          type="button"
                          className={`rounded-xl border px-0 py-2 text-sm font-semibold transition ${
                            activeTemplate.id === option.templateId
                              ? "border-orange-300 bg-orange-300/10 text-white"
                              : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20"
                          }`}
                          onClick={() => setActiveTemplateId(option.templateId)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                

                <p className="mt-4 text-sm leading-6 text-zinc-400 sm:hidden">
                  Kéo để di chuyển ảnh, cuộn hoặc chụm để zoom.
                </p>

                <div className="mt-5">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-zinc-100"
                    onClick={closeAdjustModal}
                  >
                    Xong, quay lại preview
                  </button>
                </div>
              </div>
            </div>

            {photos.length > 1 && (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    Chọn ảnh khác để căn
                  </p>
                  <p className="text-sm text-zinc-500">{photos.length} ảnh</p>
                </div>

                <div className="studio-adjust-thumbnail-strip mt-3">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      className={`studio-adjust-thumbnail overflow-hidden rounded-2xl border transition ${
                        activePhoto?.id === photo.id
                          ? "border-orange-300 shadow-[0_0_0_1px_rgba(253,186,116,0.5)]"
                          : "border-white/10 hover:border-white/25"
                      }`}
                      onClick={() => setActivePhotoId(photo.id)}
                    >
                      <div className="aspect-[4/5] bg-zinc-900">
                        <img
                          src={photo.previewUrl}
                          alt={`Ảnh chỉnh ${index + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <div className="bg-black/50 px-2 py-2 text-center text-[11px] font-semibold text-zinc-100">
                        Ảnh #{index + 1}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
