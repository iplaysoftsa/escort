export const PROFILE_VIEW_CPM_USD = 0.1;
export const PAYOUT_THRESHOLD_ZAR = 1000;

const roundCurrency = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

const sumAmounts = (records, field) => records.reduce((sum, record) => {
  const amount = Number(record?.[field]);
  return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
}, 0);

export function calculateCreatorPayoutSummary(profileViews, earnings, payouts, usdZarRate) {
  const views = Number.isSafeInteger(profileViews) && profileViews > 0 ? profileViews : 0;
  const bookingEarningsZar = roundCurrency(sumAmounts(earnings, "creatorAmount"));
  const payoutsSentZar = roundCurrency(sumAmounts(payouts, "amount"));
  const viewEarningsUsd = views * PROFILE_VIEW_CPM_USD / 1000;
  const hasExchangeRate = Number.isFinite(usdZarRate) && usdZarRate > 0;
  const viewEarningsZar = hasExchangeRate ? roundCurrency(viewEarningsUsd * usdZarRate) : null;
  const totalEarningsZar = viewEarningsZar === null
    ? null
    : roundCurrency(bookingEarningsZar + viewEarningsZar);
  const pendingZar = totalEarningsZar === null
    ? null
    : roundCurrency(Math.max(0, totalEarningsZar - payoutsSentZar));

  return {
    profileViews: views,
    bookingEarningsZar,
    viewEarningsUsd,
    viewEarningsZar,
    totalEarningsZar,
    payoutsSentZar,
    pendingZar
  };
}

export async function fetchLatestUsdZarRate() {
  const response = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=ZAR", { cache: "no-store" });
  if (!response.ok) throw new Error(`Exchange-rate service returned HTTP ${response.status}.`);
  const result = await response.json();
  const rate = result?.rates?.ZAR;
  if (!Number.isFinite(rate) || rate <= 0 || typeof result.date !== "string") {
    throw new Error("Exchange-rate service returned an invalid USD/ZAR rate.");
  }
  return { rate, date: result.date };
}
