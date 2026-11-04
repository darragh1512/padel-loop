// Glassy UI is written against TypeScript 6, whose browser types include
// ViewTimeline. TypeScript 5 doesn't have it, so the build fails without this.
// It only describes the browser feature for the type check; nothing here runs.
// Delete this file when the project moves to TypeScript 6.
declare class ViewTimeline extends AnimationTimeline {
  constructor(options?: { subject?: Element; axis?: "block" | "inline" | "x" | "y" });
  readonly source: Element | null;
  readonly startOffset: { to(unit: string): { value: number } };
  readonly endOffset: { to(unit: string): { value: number } };
}
