package org.librebaby.backgroundsync

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BackgroundSyncModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var wakeLock: PowerManager.WakeLock? = null

  override fun definition() = ModuleDefinition {
    Name("BackgroundSync")

    /** Start the service (only allowed while the app is in the foreground) and keep it on. */
    Function("start") {
      setEnabled(context, true)
      startSyncService(context)
    }

    Function("stop") {
      setEnabled(context, false)
      context.stopService(Intent(context, SyncForegroundService::class.java))
    }

    /** Keep the CPU awake for at most `ms` while a sync is under way. */
    Function("holdAwake") { ms: Int ->
      lock().acquire(ms.toLong())
    }

    Function("release") {
      wakeLock?.takeIf { it.isHeld }?.release()
    }

    /** Whether Android exempts the app from battery optimization (it can then sync in deep sleep). */
    Function("isIgnoringBatteryOptimizations") {
      val power = context.getSystemService(PowerManager::class.java)
      power.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** Shows Android's "Allow LibreBaby to run in the background?" prompt. */
    Function("requestIgnoreBatteryOptimizations") {
      @SuppressLint("BatteryLife")
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private fun lock(): PowerManager.WakeLock {
    wakeLock?.let { return it }
    val power = context.getSystemService(PowerManager::class.java)
    return power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "LibreBaby:sync").also {
      it.setReferenceCounted(false)
      wakeLock = it
    }
  }
}
