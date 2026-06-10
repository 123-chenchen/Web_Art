export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ACCEPTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export type CloudinaryUploadResult = {
  secureUrl: string
  publicId: string
  width?: number
  height?: number
}

type CloudinaryResponse = {
  secure_url?: string
  public_id?: string
  width?: number
  height?: number
  error?: {
    message?: string
  }
}

export function formatFileSize(bytes: number) {
  const mb = bytes / (1024 * 1024)

  return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`
}

export function isAllowedImageFile(file: File) {
  const fileName = file.name.toLowerCase()
  const hasAllowedType = ACCEPTED_IMAGE_TYPES.includes(file.type)
  const hasAllowedExtension = ACCEPTED_IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension))

  return hasAllowedType || hasAllowedExtension
}

export function validateImageFile(file: File) {
  if (!isAllowedImageFile(file)) {
    return 'Chỉ nhận JPG, PNG hoặc WEBP.'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Ảnh vượt ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`
  }

  return null
}

export async function uploadImageToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Thiếu cấu hình Cloudinary trong biến môi trường.')
  }

  const validationError = validateImageFile(file)

  if (validationError) {
    throw new Error(validationError)
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = (await response.json().catch(() => ({}))) as CloudinaryResponse

  if (!response.ok) {
    throw new Error(data.error?.message || 'Không thể upload ảnh lên Cloudinary.')
  }

  if (!data.secure_url || !data.secure_url.startsWith('https://')) {
    throw new Error('Cloudinary không trả về secure URL hợp lệ.')
  }

  return {
    secureUrl: data.secure_url,
    publicId: data.public_id || '',
    width: data.width,
    height: data.height,
  }
}
