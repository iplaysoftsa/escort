export function getProfileViewRank(profileId, views, profiles) {
  if (!profileId || !Number.isSafeInteger(views) || views < 0) return null;
  const eligible = profiles.filter((profile) =>
    profile && typeof profile.id === "string" && Number.isSafeInteger(profile.views) && profile.views >= 0
  );
  if (!eligible.some((profile) => profile.id === profileId)) return null;
  return {
    rank: 1 + eligible.filter((profile) => profile.id !== profileId && profile.views > views).length,
    total: eligible.length
  };
}

export const NEW_CREATOR_REWARD_MS = 48 * 60 * 60 * 1000;

export function profileCreatedAtMs(profile) {
  const createdAt = profile?.createdAt;
  if (createdAt?.toMillis) return createdAt.toMillis();
  if (createdAt?.seconds) return createdAt.seconds * 1000;
  if (createdAt instanceof Date) return createdAt.getTime();
  if (typeof createdAt === "string" || typeof createdAt === "number") {
    const parsed = new Date(createdAt).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function isNewCreatorReward(profile, now = Date.now()) {
  const createdAt = profileCreatedAtMs(profile);
  return createdAt > 0 && now - createdAt >= 0 && now - createdAt <= NEW_CREATOR_REWARD_MS;
}

export function sortProfilesByRewardAndViews(left, right) {
  const leftNew = isNewCreatorReward(left);
  const rightNew = isNewCreatorReward(right);
  if (leftNew !== rightNew) return leftNew ? -1 : 1;
  if (leftNew && rightNew) return profileCreatedAtMs(right) - profileCreatedAtMs(left);

  const leftViews = Number.isSafeInteger(left?.views) && left.views > 0 ? left.views : 0;
  const rightViews = Number.isSafeInteger(right?.views) && right.views > 0 ? right.views : 0;
  if (leftViews !== rightViews) return rightViews - leftViews;
  return String(left?.name || "").localeCompare(String(right?.name || ""), "en");
}
