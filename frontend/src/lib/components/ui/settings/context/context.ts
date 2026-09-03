// Manager of the account-settings surface.
//
// Same split as the other regions: the `ui/settings/user/` components render
// stores and call primitives, and every `usersApi` call lives here. The user
// itself is not duplicated — it stays in the app-wide `auth` store, which these
// primitives write back through `auth.setUser`.

import { get, writable } from "svelte/store";
import { auth } from "$lib/stores/auth";
import { notifications } from "$lib/stores/notifications";
import { usersApi } from "$lib/services/api";

export const savingDisplayName = writable(false);
export const savingAvatar = writable(false);
export const savingPassword = writable(false);

/**
 * Bumped after every avatar write. The profile picture lives at a stable URL,
 * so without a changing cache-buster the browser keeps showing the old one.
 */
export const avatarVersion = writable(Date.now());

function report(error: unknown, fallback: string): void {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  notifications.show(
    typeof detail === "string" ? detail : fallback,
    "error",
    5000,
  );
}

/** Returns `true` when the name was saved (or needed no saving). */
export async function updateDisplayName(name: string): Promise<boolean> {
  const user = get(auth).user;
  const trimmed = name.trim();
  if (!user || get(savingDisplayName)) return false;

  if (!trimmed) {
    notifications.show("Display name cannot be empty", "error", 2500);
    return false;
  }
  if (trimmed === user.display_name) return true;

  savingDisplayName.set(true);
  try {
    auth.setUser(await usersApi.updateMe({ display_name: trimmed }));
    notifications.show("Display name updated", "info", 2000);
    return true;
  } catch (error) {
    report(error, "Failed to update the display name");
    return false;
  } finally {
    savingDisplayName.set(false);
  }
}

export async function uploadAvatar(file: globalThis.File): Promise<void> {
  if (get(savingAvatar)) return;
  savingAvatar.set(true);
  try {
    auth.setUser(await usersApi.uploadProfilePicture(file));
    avatarVersion.set(Date.now());
    notifications.show("Profile picture updated", "info", 2000);
  } catch (error) {
    report(error, "Failed to upload the profile picture");
  } finally {
    savingAvatar.set(false);
  }
}

export async function removeAvatar(): Promise<void> {
  if (get(savingAvatar)) return;
  savingAvatar.set(true);
  try {
    auth.setUser(await usersApi.deleteProfilePicture());
    avatarVersion.set(Date.now());
    notifications.show("Profile picture removed", "info", 2000);
  } catch (error) {
    report(error, "Failed to remove the profile picture");
  } finally {
    savingAvatar.set(false);
  }
}

/** Returns `true` when the password was changed, so the form can clear itself. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<boolean> {
  if (get(savingPassword)) return false;

  if (!currentPassword || !newPassword) {
    notifications.show("Fill in both passwords", "error", 3000);
    return false;
  }
  if (newPassword !== confirmPassword) {
    notifications.show("The new passwords do not match", "error", 3000);
    return false;
  }

  savingPassword.set(true);
  try {
    await usersApi.changePassword(currentPassword, newPassword);
    notifications.show("Password updated", "info", 2000);
    return true;
  } catch (error) {
    report(error, "Failed to change the password");
    return false;
  } finally {
    savingPassword.set(false);
  }
}
