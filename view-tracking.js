import { auth, db } from "./firebase-client.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { doc, getDoc, increment, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

let anonymousSignIn;
const pendingViews = new Map();
const pendingVideoViews = new Map();

async function saveProfileView(profileId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(profileId)) {
    throw new Error("A valid Firestore profile ID is required to record a view.");
  }
  if (!auth.currentUser) {
    if (!anonymousSignIn) {
      anonymousSignIn = signInAnonymously(auth).finally(() => {
        anonymousSignIn = null;
      });
    }
    await anonymousSignIn;
  }
  const viewerUid = auth.currentUser.uid;
  const eventRef = doc(db, "profileViewEvents", `${profileId}_${viewerUid}`);
  const profileRef = doc(db, "companions", profileId);
  const previousEvent = await getDoc(eventRef);
  const lastViewedAt = previousEvent.exists() ? previousEvent.data().viewedAt?.toMillis?.() : 0;
  if (lastViewedAt && Date.now() - lastViewedAt < 24 * 60 * 60 * 1000) {
    const profileSnapshot = await getDoc(profileRef);
    const currentViews = profileSnapshot.data()?.views;
    return { counted: false, views: Number.isSafeInteger(currentViews) ? currentViews : 0 };
  }

  const batch = writeBatch(db);
  batch.update(profileRef, { views: increment(1) });
  batch.set(eventRef, { profileId, viewerUid, viewedAt: serverTimestamp() });
  try {
    await batch.commit();
  } catch (error) {
    const latestEvent = await getDoc(eventRef);
    const latestViewedAt = latestEvent.exists() ? latestEvent.data().viewedAt?.toMillis?.() : 0;
    if (!latestViewedAt || Date.now() - latestViewedAt >= 24 * 60 * 60 * 1000) throw error;
    const profileSnapshot = await getDoc(profileRef);
    const currentViews = profileSnapshot.data()?.views;
    return { counted: false, views: Number.isSafeInteger(currentViews) ? currentViews : 0 };
  }
  const profileSnapshot = await getDoc(profileRef);
  const currentViews = profileSnapshot.data()?.views;
  return { counted: true, views: Number.isSafeInteger(currentViews) ? currentViews : 0 };
}

export function recordProfileView(profileId) {
  if (pendingViews.has(profileId)) return pendingViews.get(profileId);
  const pending = saveProfileView(profileId).finally(() => pendingViews.delete(profileId));
  pendingViews.set(profileId, pending);
  return pending;
}

async function saveVideoView(profileId, videoId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(profileId) || !/^[A-Za-z0-9_-]{1,128}$/.test(videoId)) {
    throw new Error("Valid Firestore profile and video IDs are required to record a video view.");
  }
  if (!auth.currentUser) {
    if (!anonymousSignIn) {
      anonymousSignIn = signInAnonymously(auth).finally(() => {
        anonymousSignIn = null;
      });
    }
    await anonymousSignIn;
  }
  const viewerUid = auth.currentUser.uid;
  const eventRef = doc(db, "videoViewEvents", `${profileId}_${videoId}_${viewerUid}`);
  const profileRef = doc(db, "companions", profileId);
  const previousEvent = await getDoc(eventRef);
  const lastViewedAt = previousEvent.exists() ? previousEvent.data().viewedAt?.toMillis?.() : 0;
  if (lastViewedAt && Date.now() - lastViewedAt < 24 * 60 * 60 * 1000) {
    const profileSnapshot = await getDoc(profileRef);
    const views = profileSnapshot.data()?.videoViews?.[videoId];
    return { counted: false, views: Number.isSafeInteger(views) && views >= 0 ? views : 0 };
  }

  const batch = writeBatch(db);
  batch.update(profileRef, { [`videoViews.${videoId}`]: increment(1), videoViewId: videoId });
  batch.set(eventRef, { profileId, videoId, viewerUid, viewedAt: serverTimestamp() });
  try {
    await batch.commit();
  } catch (error) {
    const latestEvent = await getDoc(eventRef);
    const latestViewedAt = latestEvent.exists() ? latestEvent.data().viewedAt?.toMillis?.() : 0;
    if (!latestViewedAt || Date.now() - latestViewedAt >= 24 * 60 * 60 * 1000) throw error;
    const profileSnapshot = await getDoc(profileRef);
    const views = profileSnapshot.data()?.videoViews?.[videoId];
    return { counted: false, views: Number.isSafeInteger(views) && views >= 0 ? views : 0 };
  }
  const profileSnapshot = await getDoc(profileRef);
  const views = profileSnapshot.data()?.videoViews?.[videoId];
  return { counted: true, views: Number.isSafeInteger(views) && views >= 0 ? views : 0 };
}

export function recordVideoView(profileId, videoId) {
  const key = `${profileId}:${videoId}`;
  if (pendingVideoViews.has(key)) return pendingVideoViews.get(key);
  const pending = saveVideoView(profileId, videoId).finally(() => pendingVideoViews.delete(key));
  pendingVideoViews.set(key, pending);
  return pending;
}
