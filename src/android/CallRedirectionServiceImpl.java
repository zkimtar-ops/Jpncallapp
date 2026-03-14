package com.nospam.japan;

import android.telecom.CallScreeningService;
import android.telecom.Call;
import android.util.Log;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.io.File;

/**
 * محرك حظر المكالمات الواردة
 */
public class CallBlockerService extends CallScreeningService {

    @Override
    public void onScreenCall(Call.Details callDetails) {
        try {
            // استخراج الرقم الوارد
            String phoneNumber = callDetails.getHandle().getSchemeSpecificPart().replaceAll("\\s+", "");
            
            if (checkIsSpam(phoneNumber)) {
                CallResponse.Builder response = new CallResponse.Builder();
                response.setDisallowCall(true);
                response.setRejectCall(true);
                response.setSkipNotification(true);
                respondToCall(callDetails, response.build());
                return;
            }
        } catch (Exception e) {
            Log.e("SOS_JAPAN", "Inbound Error: " + e.getMessage());
        }
        respondToCall(callDetails, new CallResponse.Builder().build());
    }

    private boolean checkIsSpam(String number) {
        SQLiteDatabase db = null;
        Cursor cursor = null;
        boolean exists = false;
        try {
            File dbFile = getDatabasePath("nospam.db");
            if (dbFile.exists()) {
                db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READONLY);
                cursor = db.rawQuery("SELECT number FROM blocked_numbers WHERE number = ?", new String[]{number});
                exists = (cursor != null && cursor.getCount() > 0);
            }
        } catch (Exception e) {
            Log.e("SOS_JAPAN", "DB Read Error: " + e.getMessage());
        } finally {
            if (cursor != null) cursor.close();
            if (db != null) db.close();
        }
        return exists;
    }
}
