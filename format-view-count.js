const fullViewCount = new Intl.NumberFormat("en-ZA");
const compactViewCount = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1
});

export function formatViewCount(value) {
  const views = Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return views < 1000 ? fullViewCount.format(views) : compactViewCount.format(views).toLowerCase();
}
