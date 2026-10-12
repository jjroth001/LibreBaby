package org.librebaby.backgroundsync

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * After a reboot or an app update, Android has stopped everything; start background sync
 * again if the user had it on. (Both broadcasts are allowed to start a foreground service.)
 */
class SyncRestartReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!isEnabled(context)) return
    try {
      startSyncService(context)
    } catch (_: Exception) {
      // Not allowed right now; it starts again the next time the app is opened.
    }
  }
}
