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
 * محرك حظر المكالمات الصادرة
 */
public class CallRedirectionServiceImpl extends CallRedirectionService {

    @Override
    public void onPlaceCall(@NonNull Uri handle, @NonNull PhoneAccountHandle initialPhoneAccount, boolean allowContinuation) {
        try {
            String phoneNumber = handle.getSchemeSpecificPart().replaceAll("\\s+", "");
            
            // 1. فحص قاعدة البيانات للأرقام المحظورة
            if (isNumberBlocked(phoneNumber)) {
                cancelCall();
                return;
            }

            // 2. فحص الحظر الدولي
            SharedPreferences prefs = getSharedPreferences("com.nospam.japan_preferences", MODE_PRIVATE);
            boolean isIntlBlockActive = prefs.getBoolean("intl_block", false);

            if (isIntlBlockActive && (phoneNumber.startsWith("+") || phoneNumber.startsWith("00"))) {
                if (!phoneNumber.startsWith("+81") && !phoneNumber.startsWith("0081")) {
                    cancelCall();
                    return;
                }
            }
        } catch (Exception e) {
            Log.e("SOS_JAPAN", "Outbound Error: " + e.getMessage());
        }
        placeCallUnmodified();
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
            Log.e("SOS_JAPAN", "DB Read Error: " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
            if (db != null) db.close();
        }
        return blocked;
    }
}
