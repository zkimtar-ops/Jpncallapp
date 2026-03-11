package com.nospam.japan;

import android.telecom.Call;
// تم حذف سطر import android.telecom.CallScreeningService لمنع التضارب
import android.database.sqlite.SQLiteDatabase;
import android.database.Cursor;
import android.net.Uri;
import java.io.File;

// نستخدم المسار الكامل هنا لتجنب خطأ "already defined"
public class MyCallScreeningService extends android.telecom.CallScreeningService {
    
    @Override
    public void onScreenCall(Call.Details callDetails) {
        String incomingNumber = "";
        Uri handle = callDetails.getHandle();
        if (handle != null) {
            incomingNumber = handle.getSchemeSpecificPart();
        }

        if (isNumberBlocked(incomingNumber)) {
            // نستخدم المسار الكامل للاستجابة أيضاً
            respondToCall(callDetails, new android.telecom.CallScreeningService.CallResponse.Builder()
                .setDisallowCall(true)
                .setRejectCall(true)
                .setSkipNotification(true)
                .build());
        } else {
            respondToCall(callDetails, new android.telecom.CallScreeningService.CallResponse.Builder().build());
        }
    }

    private boolean isNumberBlocked(String number) {
        try {
            File dbFile = getDatabasePath("sos_japan.db");
            if (dbFile.exists()) {
                SQLiteDatabase db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READONLY);
                Cursor cursor = db.rawQuery("SELECT 1 FROM blocked_numbers WHERE phone = ?", new String[]{number});
                boolean exists = cursor.getCount() > 0;
                cursor.close();
                db.close();
                return exists;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return false;
    }
}
