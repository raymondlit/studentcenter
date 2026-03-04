/**
 * QR code parsing and answer detection utilities.
 */

export const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

export interface ScanEvent {
  cardNo: number;
  studentNo: string;
  answer: number;
  answerLabel: string;
}

/**
 * Detect answer (A/B/C/D) from QR code corner orientation.
 * Uses the angle between top-left and top-right corners.
 */
export function detectAnswerFromPoints(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  // zbar returns points as polygon; first two points approximate top-left → top-right
  const p0 = points[0];
  const p1 = points[1];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  if (angle < 45 || angle >= 315) return 0; // A
  if (angle < 135) return 1; // B
  if (angle < 225) return 2; // C
  return 3; // D
}

/**
 * Parse QR code value string into student number and card number.
 * Supports both legacy (STU-<no>-<card>) and compact (S:<no>:<card>) formats.
 */
export function parseQRValue(value: string): { studentNo: string; cardNo: number } | null {
  const legacy = value.match(/^STU-(.+)-(\d+)$/);
  if (legacy) return { studentNo: legacy[1], cardNo: parseInt(legacy[2], 10) };

  const compact = value.match(/^S:([^:]+):(\d+)$/);
  if (compact) return { studentNo: compact[1], cardNo: parseInt(compact[2], 10) };

  return null;
}
