package com.nospam.japan;

import android.telecom.Call;
import android.telecom.CallScreeningService;
import android.database.sqlite.SQLiteDatabase;
import android.database.Cursor;
import android.util.Log;
import android.net.Uri;

public class CallScreeningService extends android.telecom.CallScreeningService {

    private static final String TAG = "SOS_Japan_Service";
    private static final String DB_NAME = "sos_japan.db";

    @Override
    public void onScreenCall(Call.Details callDetails) {
        // 1. استخراج رقم المتصل
        String incomingNumber = "";
        Uri handle = callDetails.getHandle();
        if (handle != null) {
            incomingNumber = handle.getSchemeSpecificPart();
        }

        Log.d(TAG, "فحص مكالمة واردة من: " + incomingNumber);

        // 2. البحث في قاعدة بيانات SQLite مباشرة
        if (isNumberBlocked(incomingNumber)) {
            Log.d(TAG, "تم العثور على الرقم في القائمة السوداء! جاري الحظر...");
            
            // 3. بناء استجابة الحظر (رفض المكالمة + عدم تسجيلها في سجل النظام + عدم إخطار المستخدم برنين)
            CallResponse response = new CallResponse.Builder()
                    .setDisallowCall(true) // منع المكالمة
                    .setRejectCall(true)   // رفضها
                    .setSkipCallLog(false) // نتركها في سجل المكالمات ليعرف المستخدم أنها حُظرت
                    .setSkipNotification(true) // لا تظهر إشعار النظام المزعج
                    .build();

            respondToCall(callDetails, response);
        } else {
            // السماح بالمكالمة إذا لم تكن في القائمة
            respondToCall(callDetails, new CallResponse.Builder().build());
        }
    }

    // دالة البحث السريع في SQLite
    private boolean isNumberBlocked(String phoneNumber) {
        SQLiteDatabase db = null;
        Cursor cursor = null;
        boolean exists = false;

        try {
            // فتح قاعدة البيانات (نفس المسار الذي يستخدمه Cordova SQLite Plugin)
            String dbPath = getDatabasePath(DB_NAME).getPath();
            db = SQLiteDatabase.openDatabase(dbPath, null, SQLiteDatabase.OPEN_READONLY);

            // استعلام البحث السريع
            String query = "SELECT 1 FROM blocked_numbers WHERE phone = ?";
            cursor = db.rawQuery(query, new String[]{phoneNumber});

            exists = (cursor.getCount() > 0);
        } catch (Exception e) {
            Log.e(TAG, "خطأ أثناء القراءة من SQLite: " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
            if (db != null) db.close();
        }

        return exists;
    }
}
