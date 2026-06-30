const STEPS = [
  "分析你的描述...",
  "規劃構圖與光影...",
  "繪製初步草稿...",
  "渲染細節與材質...",
  "調整色彩與對比...",
  "最後修飾與輸出...",
];

const STEP_INTERVAL_SECONDS = 4;

/**
 * Purely cosmetic step labels — there is no real per-step progress signal
 * from the providers, this just gives the user a sense of forward motion
 * while they wait for the actual (single) generation request to finish.
 */
export function GeneratingPlaceholder({ elapsedSeconds }: { elapsedSeconds: number }) {
  const stepIndex = Math.min(Math.floor(elapsedSeconds / STEP_INTERVAL_SECONDS), STEPS.length - 1);

  return (
    <div className="generating-placeholder">
      <div className="generating-placeholder-shimmer" />
      <div className="generating-placeholder-overlay">
        <span className="generating-placeholder-step">{STEPS[stepIndex]}</span>
        <span className="generating-placeholder-timer">已等待 {elapsedSeconds} 秒</span>
      </div>
    </div>
  );
}
