package org.librebaby.livetimer

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "running-timers"
private const val NOTIFICATION_ID = 7001
private const val WIDGET_REQUEST_CODE = 7100

/**
 * What expo-notifications and the widget library can't do:
 * - an ongoing notification for a running sleep/feed timer, counting up with Android's own
 *   chronometer (so it stays live with the app closed, at no cost);
 * - refreshing the home-screen widget more often than Android's 30-minute minimum, with a
 *   non-waking alarm (it only fires while the phone is awake anyway).
 */
class LiveTimerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("LiveTimer")

    // `startAt`: unix ms the chronometer counts from. When `running` is false the
    // notification shows `text` without a ticking clock (e.g. a paused breastfeed).
    Function("show") { key: String, title: String, text: String, startAt: Double, running: Boolean ->
      show(key, title, text, startAt.toLong(), running)
    }

    Function("hide") { key: String ->
      manager().cancel(key, NOTIFICATION_ID)
    }

    Function("scheduleWidgetRefresh") { minutes: Int ->
      scheduleWidgetRefresh(minutes)
    }
  }

  private fun manager() = context.getSystemService(NotificationManager::class.java)

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Running timers", NotificationManager.IMPORTANCE_LOW)
    channel.description = "Shows a running sleep or feeding timer"
    channel.setShowBadge(false)
    manager().createNotificationChannel(channel)
  }

  private fun show(key: String, title: String, text: String, startAt: Long, running: Boolean) {
    ensureChannel()
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val open = PendingIntent.getActivity(
      context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
    // The monochrome icon the expo-notifications plugin installs; the app icon otherwise.
    val icon = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 } ?: context.applicationInfo.icon

    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      Notification.Builder(context).setPriority(Notification.PRIORITY_LOW)
    }
    val notification = builder
      .setSmallIcon(icon)
      .setColor(0xFF2B3A8F.toInt())
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(open)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_STOPWATCH)
      .setShowWhen(running)
      .setWhen(startAt)
      .setUsesChronometer(running)
      .build()
    manager().notify(key, NOTIFICATION_ID, notification)
  }

  private fun scheduleWidgetRefresh(minutes: Int) {
    val alarms = context.getSystemService(AlarmManager::class.java)
    val widgets = AppWidgetManager.getInstance(context)
    val ours = widgets.installedProviders.filter { it.provider.packageName == context.packageName }
    ours.forEachIndexed { index, info ->
      val ids = widgets.getAppWidgetIds(info.provider)
      val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
        .setComponent(info.provider)
        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      val pending = PendingIntent.getBroadcast(
        context,
        WIDGET_REQUEST_CODE + index,
        intent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
      if (ids.isEmpty() || minutes <= 0) {
        alarms.cancel(pending)
      } else {
        val interval = minutes * 60_000L
        // ELAPSED_REALTIME (not _WAKEUP): never wakes the phone just to redraw a widget.
        alarms.setInexactRepeating(
          AlarmManager.ELAPSED_REALTIME,
          SystemClock.elapsedRealtime() + interval,
          interval,
          pending
        )
      }
    }
  }
}
