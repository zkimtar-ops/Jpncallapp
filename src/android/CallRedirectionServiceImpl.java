package com.nospam.japan;

import android.telecom.CallRedirectionService;
import android.net.Uri;
import android.telecom.PhoneAccountHandle;
import android.content.SharedPreferences;
import android.database.sqlite.SQLiteDatabase;
import android.database.Cursor;
import androidx.annotation.NonNull;
import android.util.Log;
import java.io.File;

/**
 * محرك الحماية المتقدم: يفحص قائمة الأرقام المحظورة في SQL قبل إجراء أي مكالمة.
 */
public class CallRedirectionServiceImpl extends CallRedirectionService {

    @Override
    public void onPlaceCall(@NonNull Uri handle, @NonNull PhoneAccountHandle initialPhoneAccount, boolean allowContinuation) {
        try {
            // 1. استخراج الرقم الذي تحاول الاتصال به وتطهيره من المسافات
            String phoneNumber = handle.getSchemeSpecificPart().replaceAll("\\s+", "");
            Log.d("SOS_JAPAN", "جاري فحص الاتصال بالرقم: " + phoneNumber);

            // 2. فحص الأرقام المحظورة في قاعدة بيانات SQL المحلية
            if (isNumberBlockedInSQL(phoneNumber)) {
                Log.d("SOS_JAPAN", "تم حظر المكالمة لأن الرقم موجود في قائمة الحظر!");
                cancelCall(); // قطع الاتصال فوراً
                return;
            }

            // 3. فحص خيار "حظر المكالمات الدولية" من الإعدادات
            SharedPreferences prefs = getSharedPreferences("com.nospam.japan_preferences", MODE_PRIVATE);
            boolean isIntlBlockActive = prefs.getBoolean("intl_block", false);

            if (isIntlBlockActive && (phoneNumber.startsWith("+") || phoneNumber.startsWith("00"))) {
                if (!phoneNumber.startsWith("+81") && !phoneNumber.startsWith("0081")) {
                    Log.d("SOS_JAPAN", "تم حظر المكالمة لأنها دولية والدرع مفعل.");
                    cancelCall();
                    return;
                }
            }

        } catch (Exception e) {
            Log.e("SOS_JAPAN", "خطأ في محرك الفحص: " + e.getMessage());
        }

        // السماح للمكالمة إذا لم تكن محظورة
        placeCallUnmodified();
    }

    /**
     * دالة تبحث عن الرقم داخل قاعدة بيانات SQLite التي أنشأها التطبيق
     */
    private boolean isNumberBlockedInSQL(String number) {
        SQLiteDatabase db = null;
        Cursor cursor = null;
        boolean blocked = false;
        try {
            // مسار قاعدة البيانات الافتراضي في Cordova
            File dbFile = getDatabasePath("nospam.db");
            if (dbFile.exists()) {
                db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
                // البحث عن الرقم في جدول blocked_numbers
                cursor = db.rawQuery("SELECT number FROM blocked_numbers WHERE number = ?", new String[]{number});
                blocked = (cursor != null && cursor.getCount() > 0);
            }
        } catch (Exception e) {
            Log.e("SOS_JAPAN", "فشل الوصول لقاعدة البيانات: " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
            if (db != null) db.close();
        }
        return blocked;
    }
}
