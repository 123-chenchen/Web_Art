export const MAX_IMAGES = 20
export const SINGLE_PRICE = 99_000

export type PriceOption = {
  size: number
  label: string
  price: number
  badge?: string
  featured?: boolean
  note: string
}

export type PlanPart = {
  size: number
  label: string
  price: number
  count: number
}

export type PricePlan = {
  imageCount: number
  total: number
  label: string
  parts: PlanPart[]
}

export const PRICE_OPTIONS: PriceOption[] = [
  {
    size: 1,
    label: 'Giá lẻ',
    price: SINGLE_PRICE,
    note: 'Linh hoạt cho số ảnh nhỏ',
  },
  {
    size: 3,
    label: 'Combo 3 tấm',
    price: 290_000,
    note: 'Gọn cho góc làm việc',
  },
  {
    size: 5,
    label: 'Combo 5 tấm',
    price: 465_000,
    note: 'Bố cục ngang tinh tế',
  },
  {
    size: 9,
    label: 'Combo 9 tấm',
    price: 810_000,
    badge: 'Bán chạy',
    featured: true,
    note: 'Đủ nổi bật cho phòng khách',
  },
  {
    size: 10,
    label: 'Combo 10 tấm',
    price: 900_000,
    note: 'Cân đối cho tường lớn',
  },
  {
    size: 15,
    label: 'Combo 15 tấm',
    price: 1_350_000,
    badge: 'Đẹp nhất',
    featured: true,
    note: 'Hiệu ứng gallery rõ nét',
  },
  {
    size: 20,
    label: 'Combo 20 tấm',
    price: 1_800_000,
    badge: 'Full wall',
    featured: true,
    note: 'Một mảng decor trọn vẹn',
  },
]

const BUYABLE_OPTIONS = PRICE_OPTIONS.map((option) => ({
  size: option.size,
  label: option.size === 1 ? 'Tấm lẻ' : option.label,
  price: option.price,
}))

const comboSizes = new Set(PRICE_OPTIONS.filter((option) => option.size > 1).map((option) => option.size))

export function formatMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`
}

export function formatCompactPrice(value: number) {
  if (value % 1000 === 0) {
    return `${new Intl.NumberFormat('vi-VN').format(value / 1000)}k`
  }

  return formatMoney(value)
}

function mergeParts(parts: PlanPart[]) {
  const byLabel = new Map<string, PlanPart>()

  for (const part of parts) {
    const existing = byLabel.get(part.label)

    if (existing) {
      existing.count += part.count
      existing.price += part.price
      continue
    }

    byLabel.set(part.label, { ...part })
  }

  return Array.from(byLabel.values()).sort((a, b) => b.size - a.size)
}

function comparePlan(a: PricePlan | null, b: PricePlan | null) {
  if (!a) return b
  if (!b) return a
  if (a.total !== b.total) return a.total < b.total ? a : b

  const aParts = a.parts.reduce((sum, part) => sum + part.count, 0)
  const bParts = b.parts.reduce((sum, part) => sum + part.count, 0)

  return aParts <= bParts ? a : b
}

export function getBestPricePlan(imageCount: number): PricePlan {
  if (imageCount <= 0) {
    return {
      imageCount: 0,
      total: 0,
      label: 'Chưa chọn ảnh',
      parts: [],
    }
  }

  const dp: Array<PricePlan | null> = Array.from({ length: imageCount + 1 }, () => null)
  dp[0] = {
    imageCount: 0,
    total: 0,
    label: '',
    parts: [],
  }

  for (let count = 1; count <= imageCount; count += 1) {
    for (const option of BUYABLE_OPTIONS) {
      if (count < option.size || !dp[count - option.size]) continue

      const parts = mergeParts([
        ...(dp[count - option.size]?.parts ?? []),
        {
          size: option.size,
          label: option.label,
          price: option.price,
          count: 1,
        },
      ])

      const candidate: PricePlan = {
        imageCount: count,
        total: (dp[count - option.size]?.total ?? 0) + option.price,
        label: parts
          .map((part) => (part.count > 1 ? `${part.count} x ${part.label}` : part.label))
          .join(' + '),
        parts,
      }

      dp[count] = comparePlan(dp[count], candidate)
    }
  }

  return (
    dp[imageCount] ?? {
      imageCount,
      total: imageCount * SINGLE_PRICE,
      label: `Tấm lẻ x ${imageCount}`,
      parts: [
        {
          size: 1,
          label: 'Tấm lẻ',
          price: imageCount * SINGLE_PRICE,
          count: imageCount,
        },
      ],
    }
  )
}

export function getComboSuggestion(imageCount: number) {
  if (imageCount <= 0) {
    return {
      title: 'Upload ảnh để tự tính combo',
      detail: 'Bảng giá sẽ tự đổi theo số ảnh còn lại trong đơn.',
      targetSize: null,
    }
  }

  if (comboSizes.has(imageCount)) {
    const plan = getBestPricePlan(imageCount)

    return {
      title: `Đang khớp ${plan.label}`,
      detail: `Tổng hiện tại ${formatMoney(plan.total)} cho ${imageCount} ảnh.`,
      targetSize: imageCount,
    }
  }

  const currentPlan = getBestPricePlan(imageCount)
  const nextCombo = PRICE_OPTIONS.find((option) => option.size > imageCount)

  if (!nextCombo) {
    return {
      title: 'Đã đủ bộ 20 tấm',
      detail: 'Bố cục full wall đã sẵn sàng để đặt.',
      targetSize: 20,
    }
  }

  const delta = nextCombo.size - imageCount
  const extra = nextCombo.price - currentPlan.total
  const extraText = extra > 0 ? `, thêm ${formatMoney(extra)}` : ''

  return {
    title: `Gợi ý lên ${nextCombo.label}`,
    detail: `Thêm ${delta} ảnh${extraText} để có bố cục ${nextCombo.size} tấm.`,
    targetSize: nextCombo.size,
  }
}

export function planUsesSize(plan: PricePlan, size: number) {
  return plan.parts.some((part) => part.size === size)
}
