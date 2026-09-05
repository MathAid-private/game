export interface ImageCoords {
  dx: number;
  dy: number;
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
  dw?: number;
  dh?: number;
}
export type SetCompositing = CanvasCompositing;
export interface DrawImage {
  payload: CanvasImageSource;
  coords?: ImageCoords;
}
export interface DrawPath2D {
  payload: Path2D;
  action: 'fill' | 'stroke' | 'clip' | 'begin'; // defaults to fill
  fillRule?: CanvasFillRule;
}
export interface SetStyle {
  action: 'fill' | 'stroke' | 'gradient' | 'pattern';
  style?: CanvasFillStrokeStyles['fillStyle'];
  gradient?: CreateGradient;
  pattern?: CreatePattern;
}
export interface CreatePattern {
  image: ImageBitmapSource;
  repetition?: string;
}
export interface CreateGradient {
  p0: CommonPoint2D;
  p1?: CommonPoint2D;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
}
export interface CommonPoint2D {
  x: number;
  y: number;
}
export interface SetFilter {
  filter: number;
}
export interface CreateImage {
  action: 'create' | 'put';
  payload?: ImageData;
  dimension?: CommonDimension2D;
  dirty?: CommonPoint2D;
  dst?: CommonPoint2D; // destination
  settings?: ImageDataSettings;
}
export interface CommonDimension2D {
  width: number;
  height: number;
}
export type SetImageSmoothing = CanvasImageSmoothing;
export interface DrawPath {
  action: keyof CanvasPath;
  p1?: CommonPoint2D;
  p2?: CommonPoint2D;
  radii: (number | CommonPoint2D)[];
  startAngle?: number;
  endAngle?: number;
  rotation?: number;
  counterclockwise?: boolean;
  controlPoint1?: CommonPoint2D;
  controlPoint2?: CommonPoint2D;
  dimension?: CommonDimension2D;
}
export interface SetPathDrawingStyles extends Omit<
  CanvasPathDrawingStyles,
  'getLineDash' | 'setLineDash'
> {
  lineDash?: number[];
}
export interface DrawRect {
  action: 'fill' | 'stroke' | 'clear';
  point: CommonPoint2D;
  dimension: CommonDimension2D;
}
export type SetShadow = CanvasShadowStyles;
export interface PersistCanvasState {
  action: 'save' | 'restore' | 'reset';
}
export interface DrawText {
  action: 'fill' | 'stroke';
  payload: string;
  point: CommonPoint2D;
  maxWith?: number;
}
export type SetTextDrawingStyles = CanvasTextDrawingStyles;
export interface DrawTransform {
  action: keyof Omit<CanvasTransform, 'getTransform'>;
  data: number[] | DOMMatrix2DInit;
}

export type CanvasRenderingContext2DDriverWrite =
  | SetCompositing
  | DrawImage
  | DrawPath2D
  | SetStyle
  | SetFilter
  | CreateImage
  | SetImageSmoothing
  | DrawPath
  | SetPathDrawingStyles
  | DrawRect
  | SetShadow
  | DrawText
  | SetTextDrawingStyles;

export interface CanvasRenderingContext2DDriverWriteOptions {
  /** ordered sequence of drawings/renderings to do */
  data?: CanvasRenderingContext2DDriverWrite[];
}
