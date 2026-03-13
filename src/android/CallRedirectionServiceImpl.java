package com.nospam.japan;

import android.telecom.CallScreeningService;
import android.telecom.CallScreeningService.CallResponse;
import android.database.sqlite.SQLiteDatabase;
import android.database.Cursor;
import android.util.Log;
import java.io.File;

/**
 * المحرك المسؤول عن حظر المكالمات الواردة (Incoming)
 */
public class CallBlockerService extends CallScreeningService {

    @Override
    public void onScreenCall(CallSummary callSummary) {
        try {
            // 1. الحصول على الرقم الوارد وتطهيره
            String phoneNumber = callSummary.getHandle().getSchemeSpecificPart().replaceAll("\\s+", "");
            
            // 2. فحص الرقم في قاعدة البيانات المحلية
            if (isNumberBlocked(phoneNumber)) {
                respondToCall(callSummary, new CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(false)
                    .setSkipNotification(false)
                    .build());
                return;
            }
        } catch (Exception e) {
            Log.e("SOS_JAPAN", "Error in CallBlocker: " + e.getMessage());
        }
        
        // السماح بالمكالمة إذا لم تكن محظورة
        respondToCall(callSummary, new CallResponse.Builder().build());
    }

    private boolean isNumberBlocked(String number) {
        SQLiteDatabase db = null;
        Cursor cursor = null;
        boolean blocked = false;
        try {
            File dbFile = getDatabasePath("nospam.db");
            if (dbFile.exists()) {
                db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
                cursor = db.rawQuery("SELECT number FROM blocked_numbers WHERE number = ?", new String[]{number});
                blocked = (cursor != null && cursor.getCount() > 0);
            }
        } catch (Exception e) {
            Log.e("SOS_JAPAN", "DB Access Error: " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
            if (db != null) db.close();
        }
        return blocked;
    }
}
