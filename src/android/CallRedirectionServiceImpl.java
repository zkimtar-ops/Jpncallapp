package com.nospam.japan;

import android.telecom.CallRedirectionService;
import android.net.Uri;
import android.telecom.PhoneAccountHandle;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;

/**
 * خدمة إعادة توجيه المكالمات الصادرة (Call Redirection)
 * وظيفتها فحص الرقم الذي تطلبه أنت قبل أن يخرج الاتصال من الهاتف.
 */
public class CallRedirectionServiceImpl extends CallRedirectionService {

    @Override
    public void onPlaceCall(@NonNull Uri handle, @NonNull PhoneAccountHandle initialPhoneAccount, boolean allowContinuation) {
        // الحصول على الرقم الذي يحاول المستخدم الاتصال به
        String phoneNumber = handle.getSchemeSpecificPart();
        
        // جلب الإعدادات المحفوظة من واجهة التطبيق (JavaScript)
        // ملاحظة: نستخدم SharedPreferences للوصول للقيم المخزنة محلياً
        SharedPreferences prefs = getSharedPreferences("com.nospam.japan_preferences", MODE_PRIVATE);
        
        // التحقق مما إذا كان خيار "حظر المكالمات الدولية" مفعلاً (On)
        boolean isIntlBlockActive = prefs.getBoolean("intl_block", false);

        // منطق الفحص: إذا كان الحظر مفعلاً والرقم يبدأ بـ (+) أو (00)
        if (isIntlBlockActive && (phoneNumber.startsWith("+") || phoneNumber.startsWith("00"))) {
            
            // استثناء أرقام اليابان (+81) لكي لا يتم حظر المكالمات المحلية
            if (!phoneNumber.startsWith("+81") && !phoneNumber.startsWith("0081")) {
                
                // إلغاء المكالمة فوراً ومنع خروجها من الهاتف
                cancelCall();
                return;
            }
        }

        // إذا كان الرقم آمناً أو الحظر غير مفعل، نسمح للمكالمة بالخروج بشكل طبيعي
        placeCallUnmodified();
    }
}
