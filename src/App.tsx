import {
  ArrowDown,
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
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { type ChangeEvent, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  uploadImageToCloudinary,
  validateImageFile,
} from './lib/cloudinary'
import {
  MAX_IMAGES,
  PRICE_OPTIONS,
  formatCompactPrice,
  formatMoney,
  getBestPricePlan,
  getComboSuggestion,
  planUsesSize,
} from './lib/pricing'

type PhotoStatus = 'ready' | 'uploading' | 'uploaded' | 'error'

type PhotoItem = {
  id: string
  file: File
  previewUrl: string
  status: PhotoStatus
  secureUrl?: string
  error?: string
}

type Notice = {
  type: 'success' | 'error' | 'info'
  message: string
}

type CustomerForm = {
  name: string
  phone: string
  address: string
  note: string
  website: string
}

const initialForm: CustomerForm = {
  name: '',
  phone: '',
  address: '',
  note: '',
  website: '',
}

const demoTiles = [
  'center',
  '20% 30%',
  '80% 34%',
  '28% 72%',
  '72% 78%',
  '50% 18%',
  '50% 88%',
]

const trustedSignals = ['Upload tối đa 20 ảnh', 'JPG, PNG, WEBP', 'Lưu link Cloudinary an toàn']

function makeId() {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getAppsScriptEndpoint() {
  return (import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL as string | undefined)?.trim()
}

async function submitOrder(payload: unknown) {
  const endpoint = getAppsScriptEndpoint()

  if (!endpoint) {
    throw new Error('Thiếu VITE_GOOGLE_APPS_SCRIPT_URL trong biến môi trường.')
  }

  let response: Response

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new Error(
      'Khong goi duoc Google Apps Script. Kiem tra Web App da deploy quyen "Anyone", dung URL /exec moi nhat va khoi dong lai Vite sau khi sua .env.local.',
      { cause: error },
    )
  }
  const text = await response.text()
  let data: { ok?: boolean; message?: string }

  try {
    data = JSON.parse(text)
  } catch {
    data = {}
  }

  if (!response.ok || data.ok !== true) {
    if (!data.message) {
      throw new Error(
        'Google Apps Script khong tra ve JSON hop le. Neu URL mo ra trang dang nhap Google, hay deploy Web App voi quyen "Anyone".',
      )
    }
    throw new Error(data.message || 'Không gửi được đơn hàng. Vui lòng thử lại.')
  }

  return data
}

function App() {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [form, setForm] = useState<CustomerForm>(initialForm)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef(new Set<string>())

  const imageCount = photos.length
  const remainingSlots = MAX_IMAGES - imageCount
  const plan = useMemo(() => getBestPricePlan(imageCount), [imageCount])
  const suggestion = useMemo(() => getComboSuggestion(imageCount), [imageCount])
  const canSubmit = imageCount > 0 && !isSubmitting
  const hasUploadErrors = photos.some((photo) => photo.status === 'error')

  useEffect(() => {
    const objectUrls = objectUrlsRef.current

    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.clear()
    }
  }, [])

  function addObjectUrl(url: string) {
    objectUrlsRef.current.add(url)
  }

  function revokeObjectUrl(url: string) {
    if (!objectUrlsRef.current.has(url)) return

    URL.revokeObjectURL(url)
    objectUrlsRef.current.delete(url)
  }

  function handleFileSelection(fileList: FileList | File[]) {
    const files = Array.from(fileList)

    if (!files.length) return

    if (remainingSlots <= 0) {
      setNotice({
        type: 'error',
        message: `Bạn đã đủ ${MAX_IMAGES} ảnh. Xóa bớt ảnh nếu muốn đổi mẫu.`,
      })
      return
    }

    const accepted: PhotoItem[] = []
    const rejected: string[] = []
    let overflowCount = 0

    for (const file of files) {
      if (accepted.length >= remainingSlots) {
        overflowCount += 1
        continue
      }

      const error = validateImageFile(file)

      if (error) {
        rejected.push(`${file.name}: ${error}`)
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      addObjectUrl(previewUrl)
      accepted.push({
        id: makeId(),
        file,
        previewUrl,
        status: 'ready',
      })
    }

    if (accepted.length > 0) {
      setPhotos((current) => [...current, ...accepted])
    }

    if (overflowCount > 0 || rejected.length > 0) {
      const parts = []

      if (overflowCount > 0) {
        parts.push(`Mình chỉ thêm ${accepted.length} ảnh để không vượt ${MAX_IMAGES} ảnh.`)
      }

      if (rejected.length > 0) {
        parts.push(rejected[0])
      }

      setNotice({
        type: 'error',
        message: parts.join(' '),
      })
      return
    }

    setNotice({
      type: 'success',
      message: `Đã thêm ${accepted.length} ảnh. Preview lục giác đã sẵn sàng.`,
    })
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      handleFileSelection(event.target.files)
      event.target.value = ''
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)

    if (isSubmitting) return

    handleFileSelection(event.dataTransfer.files)
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id)

      if (photo) {
        revokeObjectUrl(photo.previewUrl)
      }

      return current.filter((item) => item.id !== id)
    })
  }

  function updateForm<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function validateForm() {
    if (!form.name.trim()) return 'Vui lòng nhập họ tên.'
    if (!/^[0-9+\s().-]{8,16}$/.test(form.phone.trim())) return 'Số điện thoại chưa hợp lệ.'
    if (!form.address.trim()) return 'Vui lòng nhập địa chỉ nhận hàng.'
    if (imageCount <= 0) return 'Vui lòng upload ít nhất 1 ảnh.'
    if (imageCount > MAX_IMAGES) return `Đơn chỉ nhận tối đa ${MAX_IMAGES} ảnh.`

    return null
  }

  async function uploadPhotosForOrder(currentPhotos: PhotoItem[]) {
    const uploadedUrls: string[] = []

    for (const photo of currentPhotos) {
      if (photo.secureUrl) {
        uploadedUrls.push(photo.secureUrl)
        continue
      }

      setPhotos((items) =>
        items.map((item) =>
          item.id === photo.id ? { ...item, status: 'uploading', error: undefined } : item,
        ),
      )

      try {
        const result = await uploadImageToCloudinary(photo.file)
        uploadedUrls.push(result.secureUrl)
        setPhotos((items) =>
          items.map((item) =>
            item.id === photo.id
              ? { ...item, status: 'uploaded', secureUrl: result.secureUrl, error: undefined }
              : item,
          ),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload ảnh thất bại.'
        setPhotos((items) =>
          items.map((item) =>
            item.id === photo.id ? { ...item, status: 'error', error: message } : item,
          ),
        )
        throw new Error(`Ảnh "${photo.file.name}" chưa upload được: ${message}`, {
          cause: error,
        })
      }
    }

    return uploadedUrls
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) return

    if (form.website.trim()) {
      setNotice({
        type: 'success',
        message: 'Cảm ơn bạn. Đơn hàng đã được ghi nhận.',
      })
      return
    }

    const validationError = validateForm()

    if (validationError) {
      setNotice({
        type: 'error',
        message: validationError,
      })
      return
    }

    setIsSubmitting(true)
    setNotice({
      type: 'info',
      message: 'Đang upload ảnh và gửi đơn...',
    })

    const currentPhotos = photos.slice()
    const currentPlan = getBestPricePlan(currentPhotos.length)

    try {
      const imageUrls = await uploadPhotosForOrder(currentPhotos)

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
      })

      currentPhotos.forEach((photo) => revokeObjectUrl(photo.previewUrl))
      setPhotos([])
      setForm(initialForm)
      setNotice({
        type: 'success',
        message: 'Đặt tranh thành công. Admin sẽ nhận Gmail báo đơn mới ngay khi Apps Script chạy xong.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Có lỗi khi gửi đơn hàng.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] text-zinc-50">
      <section className="hero-bg relative overflow-hidden">
        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-white">
            <span className="grid size-9 place-items-center rounded-full border border-amber-300/50 bg-black/40 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            Hexa Metal
          </a>
          <a
            href="#order-studio"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:border-amber-200/70 hover:bg-amber-200/15"
          >
            Upload ảnh
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </nav>

        <div id="top" className="relative z-10 mx-auto grid min-h-[calc(82svh-76px)] w-full max-w-7xl items-center px-4 pb-12 pt-8 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-black/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100 backdrop-blur">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Tranh kim loại lục giác custom
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
              Biến ảnh của bạn thành decor lục giác sắc nét.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-200 sm:text-lg">
              Upload ảnh, xem ngay preview dạng tranh lục giác, chọn combo tối ưu và gửi đơn về Google Sheet trong một luồng gọn trên mobile.
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
                href="#demo"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
              >
                <Camera className="size-5" aria-hidden="true" />
                Xem demo
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-zinc-300">
              {trustedSignals.map((signal) => (
                <span key={signal} className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 backdrop-blur">
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="border-y border-white/10 bg-[#111111] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Preview glossy metal</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Bố cục lục giác tạo cảm giác gallery liền mạch trên tường.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
              Mỗi ảnh được cắt trong khung lục giác bằng CSS clip-path, có viền mảnh và lớp bóng nhẹ để mô phỏng bề mặt kim loại.
            </p>
          </div>

          <div className="demo-wall">
            {demoTiles.map((position, index) => (
              <div className="hex-frame demo-hex" key={position}>
                <div className="hex-inner">
                  <img
                    src="/hero-hex-wall.png"
                    alt={`Mẫu tranh lục giác ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: position }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="order-studio" className="bg-zinc-50 px-4 py-14 text-zinc-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Upload studio</p>
                  <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Tải ảnh và xem trước toàn bộ.</h2>
                </div>
                <div className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm">
                  {imageCount}/{MAX_IMAGES} ảnh
                </div>
              </div>

              <div
                className={`upload-zone ${isDragging ? 'is-dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                }}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  multiple
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                <div className="grid gap-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <div className="grid size-14 place-items-center rounded-2xl bg-zinc-950 text-amber-200 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
                    <ImagePlus className="size-7" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{isDragging ? 'Thả ảnh vào đây' : 'Upload ảnh của bạn'}</p>
                    <p className="mt-1 text-sm text-zinc-600">
                      JPG, PNG, WEBP - mỗi ảnh tối đa {formatFileSize(MAX_FILE_SIZE_BYTES)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || remainingSlots <= 0}
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Thêm ảnh
                  </button>
                </div>
              </div>

              {notice && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
                    notice.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : notice.type === 'error'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                  role="status"
                >
                  {notice.message}
                </div>
              )}

              <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,15,15,0.08)] sm:p-6">
                <div className="flex flex-col gap-3 border-b border-zinc-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      <Images className="size-4" aria-hidden="true" />
                      Preview ảnh đã chọn
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">{suggestion.title}. {suggestion.detail}</p>
                  </div>
                  {imageCount > 0 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      onClick={() => {
                        photos.forEach((photo) => revokeObjectUrl(photo.previewUrl))
                        setPhotos([])
                      }}
                      disabled={isSubmitting}
                    >
                      <X className="size-4" aria-hidden="true" />
                      Xóa tất cả
                    </button>
                  )}
                </div>

                {imageCount === 0 ? (
                  <div className="grid min-h-64 place-items-center text-center text-zinc-500">
                    <div>
                      <div className="mx-auto grid size-16 place-items-center rounded-full bg-zinc-100 text-zinc-500">
                        <Images className="size-7" aria-hidden="true" />
                      </div>
                      <p className="mt-4 text-sm font-medium">Preview lục giác sẽ xuất hiện tại đây.</p>
                    </div>
                  </div>
                ) : (
                  <div className="hex-preview-grid pt-6">
                    {photos.map((photo, index) => (
                      <div className="relative" key={photo.id}>
                        <div className="hex-frame">
                          <div className="hex-inner">
                            <img
                              src={photo.previewUrl}
                              alt={`Ảnh upload ${index + 1}`}
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="status-pill">
                              {photo.status === 'uploading' && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                              {photo.status === 'uploaded' && <Check className="size-3" aria-hidden="true" />}
                              {photo.status === 'error' && <RefreshCw className="size-3" aria-hidden="true" />}
                              {photo.status === 'ready' ? `#${index + 1}` : photo.status}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="absolute right-1 top-1 grid size-9 place-items-center rounded-full border border-white/70 bg-zinc-950/80 text-white shadow-lg backdrop-blur transition hover:bg-red-600 disabled:opacity-50"
                          onClick={() => removePhoto(photo.id)}
                          disabled={isSubmitting}
                          aria-label={`Xóa ảnh ${index + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                        {photo.error && <p className="mt-2 text-xs font-medium text-red-600">{photo.error}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,15,15,0.08)] sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">Combo đề xuất</p>
                    <h3 className="mt-2 text-2xl font-semibold">{plan.label}</h3>
                  </div>
                  <div className="grid size-12 place-items-center rounded-2xl bg-zinc-950 text-amber-200">
                    <Package className="size-6" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-zinc-950 p-5 text-white">
                  <p className="text-sm text-zinc-400">Tổng tiền tự tính</p>
                  <p className="mt-1 text-4xl font-semibold text-amber-200">{formatMoney(plan.total)}</p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{suggestion.detail}</p>
                </div>
              </div>

              <form className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,15,15,0.08)] sm:p-6" onSubmit={handleSubmit}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">Form đặt hàng</p>
                    <h3 className="mt-2 text-2xl font-semibold">Thông tin nhận tranh</h3>
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
                    onChange={(event) => updateForm('website', event.target.value)}
                  />
                </div>

                <div className="grid gap-4">
                  <label className="field-label">
                    <span>Họ tên</span>
                    <input
                      value={form.name}
                      onChange={(event) => updateForm('name', event.target.value)}
                      placeholder="Nguyễn Minh Anh"
                      autoComplete="name"
                    />
                  </label>

                  <label className="field-label">
                    <span>Số điện thoại</span>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                      <input
                        className="pl-10"
                        value={form.phone}
                        onChange={(event) => updateForm('phone', event.target.value)}
                        placeholder="09xx xxx xxx"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>
                  </label>

                  <label className="field-label">
                    <span>Địa chỉ nhận hàng</span>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-400" aria-hidden="true" />
                      <textarea
                        className="min-h-24 pl-10"
                        value={form.address}
                        onChange={(event) => updateForm('address', event.target.value)}
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
                      onChange={(event) => updateForm('note', event.target.value)}
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
                    <strong className="text-lg text-amber-700">{formatMoney(plan.total)}</strong>
                  </div>
                </div>

                {hasUploadErrors && (
                  <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    Có ảnh upload lỗi. Bấm đặt lại sau khi kiểm tra cấu hình Cloudinary hoặc thay ảnh khác.
                  </p>
                )}

                <button
                  type="submit"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-4 text-sm font-bold text-white shadow-[0_20px_50px_rgba(0,0,0,0.25)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canSubmit}
                >
                  {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
                  Đặt tranh ngay
                </button>
              </form>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-[#101010] px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">Bảng giá</p>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Combo rõ ràng, nổi bật bộ 9, 15, 20 tấm.</h2>
            </div>
            <a
              href="#order-studio"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/40 px-5 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-200 hover:text-zinc-950"
            >
              Upload để tính giá
              <Upload className="size-4" aria-hidden="true" />
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRICE_OPTIONS.map((option) => {
              const isActive = option.size === 1 ? plan.parts.some((part) => part.size === 1) : planUsesSize(plan, option.size)
              const isSuggested = suggestion.targetSize === option.size

              return (
                <div
                  className={`price-card ${option.featured ? 'is-featured' : ''} ${isActive || isSuggested ? 'is-active' : ''}`}
                  key={option.label}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-300">{option.label}</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{formatCompactPrice(option.price)}</p>
                    </div>
                    {option.badge ? (
                      <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-zinc-950">
                        {option.badge}
                      </span>
                    ) : (
                      <Star className="size-5 text-zinc-600" aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-5 text-sm leading-6 text-zinc-400">{option.note}</p>
                  <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">
                    <Check className="size-4" aria-hidden="true" />
                    {option.size === 1 ? '99k/tấm' : `${option.size} ảnh`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
