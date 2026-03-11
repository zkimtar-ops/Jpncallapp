package com.nospam.japan;

import android.telecom.CallScreeningService;
import android.telecom.Call;
import android.util.Log;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import androidx.core.app.NotificationCompat;
import java.io.File;

public class CallBlockerService extends CallScreeningService {

    @Override
    public void onScreenCall(Call.Details callDetails) {
        String phoneNumber = callDetails.getHandle().getSchemeSpecificPart();
        
        if (checkIsSpam(phoneNumber)) {
            // 1. اتخاذ قرار الحظر (مثل تروكولر)
            CallResponse.Builder response = new CallResponse.Builder();
            response.setDisallowCall(true);
            response.setRejectCall(true);
            response.setSkipNotification(true);
            respondToCall(callDetails, response.build());

            // 2. إرسال تنبيه للمستخدم
            sendSpamNotification(phoneNumber);
        }
    }

    private boolean checkIsSpam(String number) {
        boolean exists = false;
        SQLiteDatabase db = null;
        try {
            File dbFile = getDatabasePath("nospam.db");
            if (dbFile.exists()) {
                db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
                // فحص الرقم المباشر والرقم بدون رموز
                String clean = number.replaceAll("[^0-9]", "");
                Cursor cursor = db.rawQuery("SELECT 1 FROM blocked_numbers WHERE number=? OR number=?", new String[]{number, clean});
                exists = cursor.getCount() > 0;
                cursor.close();
            }
        } catch (Exception e) {
            Log.e("SOS_PRO", "Database Error: " + e.getMessage());
        } finally {
            if (db != null) db.close();
        }
        return exists;
    }

    private void sendSpamNotification(String number) {
        String channelId = "spam_alerts";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(channelId, "Spam Alerts", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("تم حظر مكالمة مزعجة")
            .setContentText("الرقم: " + number)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);

        nm.notify((int) System.currentTimeMillis(), builder.build());
    }
}
