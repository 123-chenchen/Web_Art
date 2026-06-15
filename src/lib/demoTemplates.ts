export type DemoTemplateKind = "single" | "multi";
export type DemoShapeType = "polygon" | "rectangle";

export type DemoPoint = [number, number];

export type DemoTemplateOverlay = {
  id: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  clipPath: string;
  points: DemoPoint[];
  shapeType: DemoShapeType;
};

export type DemoTemplate = {
  badge: string;
  caption: string;
  familyId: string;
  id: string;
  kind: DemoTemplateKind;
  overlayCountLabel: string;
  overlays: DemoTemplateOverlay[];
  previewSrc: string;
  title: string;
  variantLabel?: string;
  width: number;
  height: number;
};

type RawShape = {
  label?: string;
  points: number[][];
  shape_type: DemoShapeType;
};

type RawTemplateAnnotation = {
  imageHeight: number;
  imagePath: string;
  imageWidth: number;
  shapes: RawShape[];
};

type TemplateConfig = {
  badge: string;
  caption: string;
  familyId: string;
  id: string;
  jsonSrc: string;
  kind: DemoTemplateKind;
  overlayCountLabel: string;
  previewSrc: string;
  sortOrder: number;
  title: string;
  variantLabel?: string;
};

export const DEFAULT_TEMPLATE_ID = "multi-3";

export const frameOptions = [
  {
    id: "single",
    label: "Tranh dọc",
    description: "5 size từ S đến XXL",
  },
  {
    id: "multi-1",
    label: "Combo 3",
    description: "Cụm 3 khung lục giác",
  },
  {
    id: "multi-2",
    label: "Combo 5",
    description: "Bố cục gọn cho bàn làm việc",
  },
  {
    id: "multi-3",
    label: "Combo 9",
    description: "Layout nổi bật cho mảng tường chính",
  },
  {
    id: "multi-4",
    label: "Combo 13",
    description: "Bố cục đứng cho không gian cao",
  },
  {
    id: "multi-5",
    label: "Combo 20",
    description: "Full wall cho không gian lớn",
  },
] as const;

export const singleSizeOptions = [
  { label: "S", templateId: "single-1" },
  { label: "M", templateId: "single-2" },
  { label: "L", templateId: "single-3" },
  { label: "XL", templateId: "single-4" },
  { label: "XXL", templateId: "single-5" },
] as const;

const templateConfigs: TemplateConfig[] = [
  {
    id: "single-1",
    familyId: "single",
    kind: "single",
    title: "Tranh dọc Size S",
    badge: "Khung đơn",
    caption: "20 x 30 cm",
    overlayCountLabel: "1 ảnh",
    previewSrc: "/single_image/1.png",
    jsonSrc: "/single_image/1.json",
    variantLabel: "S",
    sortOrder: 1,
  },
  {
    id: "single-2",
    familyId: "single",
    kind: "single",
    title: "Tranh dọc Size M",
    badge: "Khung đơn",
    caption: "30 x 45 cm",
    overlayCountLabel: "1 ảnh",
    previewSrc: "/single_image/2.png",
    jsonSrc: "/single_image/2.json",
    variantLabel: "M",
    sortOrder: 2,
  },
  {
    id: "single-3",
    familyId: "single",
    kind: "single",
    title: "Tranh dọc Size L",
    badge: "Khung đơn",
    caption: "40 x 60 cm",
    overlayCountLabel: "1 ảnh",
    previewSrc: "/single_image/3.png",
    jsonSrc: "/single_image/3.json",
    variantLabel: "L",
    sortOrder: 3,
  },
  {
    id: "single-4",
    familyId: "single",
    kind: "single",
    title: "Tranh dọc Size XL",
    badge: "Khung đơn",
    caption: "50 x 70 cm",
    overlayCountLabel: "1 ảnh",
    previewSrc: "/single_image/4.png",
    jsonSrc: "/single_image/4.json",
    variantLabel: "XL",
    sortOrder: 4,
  },
  {
    id: "single-5",
    familyId: "single",
    kind: "single",
    title: "Tranh dọc Size XXL",
    badge: "Khung đơn",
    caption: "60 x 90 cm",
    overlayCountLabel: "1 ảnh",
    previewSrc: "/single_image/5.png",
    jsonSrc: "/single_image/5.json",
    variantLabel: "XXL",
    sortOrder: 5,
  },
  {
    id: "multi-1",
    familyId: "multi-1",
    kind: "multi",
    title: "Combo 3",
    badge: "Lục giác",
    caption: "Layout gọn cho góc làm việc",
    overlayCountLabel: "3 ảnh",
    previewSrc: "/multi_image/1.png",
    jsonSrc: "/multi_image/1.json",
    sortOrder: 6,
  },
  {
    id: "multi-2",
    familyId: "multi-2",
    kind: "multi",
    title: "Combo 5",
    badge: "Lục giác",
    caption: "Bố cục cân đối dễ treo",
    overlayCountLabel: "5 ảnh",
    previewSrc: "/multi_image/2.png",
    jsonSrc: "/multi_image/2.json",
    sortOrder: 7,
  },
  {
    id: "multi-3",
    familyId: "multi-3",
    kind: "multi",
    title: "Combo 9",
    badge: "Lục giác",
    caption: "Điểm nhấn nổi bật cho mảng tường chính",
    overlayCountLabel: "9 ảnh",
    previewSrc: "/multi_image/3.png",
    jsonSrc: "/multi_image/3.json",
    sortOrder: 8,
  },
  {
    id: "multi-4",
    familyId: "multi-4",
    kind: "multi",
    title: "Combo 13",
    badge: "Lục giác",
    caption: "Bố cục cao cho không gian sâu",
    overlayCountLabel: "13 ảnh",
    previewSrc: "/multi_image/4.png",
    jsonSrc: "/multi_image/4.json",
    sortOrder: 9,
  },
  {
    id: "multi-5",
    familyId: "multi-5",
    kind: "multi",
    title: "Combo 20",
    badge: "Lục giác",
    caption: "Full wall cho không gian lớn",
    overlayCountLabel: "20 ảnh",
    previewSrc: "/multi_image/5.png",
    jsonSrc: "/multi_image/5.json",
    sortOrder: 10,
  },
];

function getBounds(points: DemoPoint[]) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function toClipPath(points: DemoPoint[], bounds: ReturnType<typeof getBounds>) {
  return `polygon(${points
    .map(([x, y]) => {
      const xPercent = ((x - bounds.x) / bounds.width) * 100;
      const yPercent = ((y - bounds.y) / bounds.height) * 100;
      return `${xPercent}% ${yPercent}%`;
    })
    .join(", ")})`;
}

function toDemoPoint(point: number[]): DemoPoint {
  return [point[0], point[1]];
}

function normalizeOverlay(shape: RawShape, index: number): DemoTemplateOverlay {
  const points = shape.points.map(toDemoPoint);
  const bounds = getBounds(points);

  return {
    id: `${shape.label ?? "slot"}-${index + 1}`,
    bounds,
    clipPath: toClipPath(points, bounds),
    points,
    shapeType: shape.shape_type,
  };
}

export async function loadDemoTemplates() {
  const templates = await Promise.all(
    templateConfigs.map(async (config) => {
      const response = await fetch(config.jsonSrc);

      if (!response.ok) {
        throw new Error(`Khong tai duoc template ${config.id}.`);
      }

      const raw = (await response.json()) as RawTemplateAnnotation;

      return {
        badge: config.badge,
        caption: config.caption,
        familyId: config.familyId,
        id: config.id,
        kind: config.kind,
        overlayCountLabel: config.overlayCountLabel,
        overlays: raw.shapes.map(normalizeOverlay),
        previewSrc: config.previewSrc,
        title: config.title,
        variantLabel: config.variantLabel,
        width: raw.imageWidth,
        height: raw.imageHeight,
        sortOrder: config.sortOrder,
      };
    }),
  );

  return templates
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((template) => ({
      badge: template.badge,
      caption: template.caption,
      familyId: template.familyId,
      height: template.height,
      id: template.id,
      kind: template.kind,
      overlayCountLabel: template.overlayCountLabel,
      overlays: template.overlays,
      previewSrc: template.previewSrc,
      title: template.title,
      variantLabel: template.variantLabel,
      width: template.width,
    }));
}
