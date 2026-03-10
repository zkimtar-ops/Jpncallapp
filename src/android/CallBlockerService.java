package com.nospam.japan;

import android.content.Intent;
import android.telecom.Call;
import android.telecom.CallScreeningService;
import android.database.sqlite.SQLiteDatabase;
import android.database.Cursor;
import android.util.Log;
import android.net.Uri;
import java.io.File;

public class CallScreeningService extends android.telecom.CallScreeningService {

    private static final String TAG = "SOS_Japan_Service";
    private static final String DB_NAME = "sos_japan.db";

    @Override
    public void onScreenCall(Call.Details callDetails) {
        // 1. استخراج رقم المتصل الوارد
        String incomingNumber = "";
        Uri handle = callDetails.getHandle();
        if (handle != null) {
            //SchemeSpecificPart يستخرج الرقم بدون كلمة "tel:"
            incomingNumber = handle.getSchemeSpecificPart();
        }

        Log.d(TAG, "فحص مكالمة واردة من الرقم: " + incomingNumber);

        // 2. التحقق من وجود الرقم في قاعدة بيانات SQLite المحلية
        if (isNumberInBlacklist(incomingNumber)) {
            Log.d(TAG, "الرقم موجود في القائمة السوداء! يتم الحظر الآن...");

            // 3. بناء استجابة الحظر (رفض كامل وصامت)
            CallResponse response = new CallResponse.Builder()
                    .setDisallowCall(true)      // منع المكالمة من الوصول للهاتف
                    .setRejectCall(true)        // رفض المكالمة برنة "مشغول" للمتصل
                    .setSkipCallLog(false)      // إبقاء المكالمة في سجل الهاتف لتوثيق الحظر
                    .setSkipNotification(true)  // عدم إظهار نافذة الاتصال المزعجة
                    .build();

            respondToCall(callDetails, response);

            // 4. إرسال إشارة (Broadcast) لـ index.js لإظهار إشعار مخصص للمستخدم
            sendBlockedBroadcast(incomingNumber);
        } else {
            // السماح بالمكالمة العادية إذا لم يكن الرقم محظوراً
            respondToCall(callDetails, new CallResponse.Builder().build());
        }
    }

    /**
     * دالة البحث في قاعدة بيانات SQLite التي أنشأها Cordova
     */
    private boolean isNumberInBlacklist(String phoneNumber) {
        SQLiteDatabase db = null;
        Cursor cursor = null;
        boolean isBlocked = false;

        try {
            // الحصول على المسار الصحيح لقاعدة البيانات التي أنشأها البلاجن
            File dbFile = getDatabasePath(DB_NAME);
            
            if (dbFile.exists()) {
                db = SQLiteDatabase.openDatabase(dbFile.getPath(), null, SQLiteDatabase.OPEN_READONLY);
                
                // البحث عن الرقم في جدول blocked_numbers
                String query = "SELECT 1 FROM blocked_numbers WHERE phone = ?";
                cursor = db.rawQuery(query, new String[]{phoneNumber});

                isBlocked = (cursor.getCount() > 0);
            } else {
                Log.e(TAG, "قاعدة البيانات غير موجودة في المسار: " + dbFile.getPath());
            }
        } catch (Exception e) {
            Log.e(TAG, "خطأ أثناء محاولة القراءة من SQLite: " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
            if (db != null) db.close();
        }

        return isBlocked;
    }

    /**
     * دالة إرسال تنبيه للتطبيق (WebView) لإظهار Notification
     */
    private void sendBlockedBroadcast(String number) {
        Intent intent = new Intent("com.nospam.japan.CALL_BLOCKED");
        intent.putExtra("blocked_number", number);
        // إرسال البث لكي يستقبله نظام Cordova
        sendBroadcast(intent);
        Log.d(TAG, "تم إرسال Broadcast للرقم: " + number);
    }
}
