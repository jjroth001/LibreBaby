package org.librebaby.backgroundsync

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext

/** Must match AppRegistry.registerHeadlessTask in index.js. */
const val SYNC_TASK_KEY = "LibreBabySync"
private const val CHANNEL_ID = "background-sync"
private const val NOTIFICATION_ID = 7201
private const val PREFS = "librebaby-background-sync"
private const val KEY_ENABLED = "enabled"

internal fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

internal fun isEnabled(context: Context) = prefs(context).getBoolean(KEY_ENABLED, false)

internal fun setEnabled(context: Context, enabled: Boolean) =
  prefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply()

internal fun startSyncService(context: Context) {
  val intent = Intent(context, SyncForegroundService::class.java)
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
  else context.startService(intent)
}

/**
 * Keeps family sync running while the app is closed: a foreground service (with a quiet,
 * minimized notification, as Android requires) that runs the app's JavaScript sync task
 * headless. Unlike React Native's HeadlessJsTaskService it holds no permanent wake lock —
 * the phone sleeps normally; the JS side holds a short one only while a sync is under way.
 */
class SyncForegroundService : Service() {
  private var taskId: Int? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startInForeground()
    if (taskId == null) startJsTask()
    // If Android kills the process, recreate the service when it can.
    return START_STICKY
  }

  private fun startInForeground() {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Background sync", NotificationManager.IMPORTANCE_MIN)
      channel.description = "Lets LibreBaby sync with your family's phones while it's closed"
      channel.setShowBadge(false)
      manager.createNotificationChannel(channel)
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val open = PendingIntent.getActivity(
      this, 1, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName)
      .takeIf { it != 0 } ?: applicationInfo.icon

    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      Notification.Builder(this).setPriority(Notification.PRIORITY_MIN)
    }
    val notification = builder
      .setSmallIcon(icon)
      .setColor(0xFF2B3A8F.toInt())
      .setContentTitle("Family sync is on")
      .setContentText("Syncs with your family's phones on the same Wi-Fi")
      .setContentIntent(open)
      .setOngoing(true)
      .setShowWhen(false)
      .setCategory(Notification.CATEGORY_SERVICE)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  /** Runs the JS task, starting React Native first if the app isn't open. */
  private fun startJsTask() {
    val host = (application as? ReactApplication)?.reactHost ?: return
    val context = host.currentReactContext
    if (context != null) {
      run(context)
      return
    }
    host.addReactInstanceEventListener(object : ReactInstanceEventListener {
      override fun onReactContextInitialized(context: ReactContext) {
        host.removeReactInstanceEventListener(this)
        run(context)
      }
    })
    host.start()
  }

  private fun run(context: ReactContext) {
    UiThreadUtil.runOnUiThread {
      if (taskId != null) return@runOnUiThread
      // No timeout (it runs until stopped), and allowed while the app is in the foreground.
      val config = HeadlessJsTaskConfig(SYNC_TASK_KEY, Arguments.createMap(), 0, true)
      taskId = HeadlessJsTaskContext.getInstance(context).startTask(config)
    }
  }

  override fun onDestroy() {
    val id = taskId
    val context = (application as? ReactApplication)?.reactHost?.currentReactContext
    if (id != null && context != null) {
      UiThreadUtil.runOnUiThread {
        val tasks = HeadlessJsTaskContext.getInstance(context)
        if (tasks.isTaskRunning(id)) tasks.finishTask(id)
      }
    }
    taskId = null
    super.onDestroy()
  }
}
