document.addEventListener('deviceready', onDeviceReady, false);

// إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC8ABk0QLlocOBaUF7a_HeiQoMyOw9eDZc",
    authDomain: "nospam-9a4af.firebaseapp.com",
    databaseURL: "https://nospam-9a4af-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "nospam-9a4af",
    storageBucket: "nospam-9a4af.firebasestorage.app",
    messagingSenderId: "1000207356900",
    appId: "1:1000207356900:web:d1797e103304ce82aa2df1"
};

var db_local = null;

function onDeviceReady() {
    // تشغيل Firebase
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // 1. إعداد قاعدة البيانات المحلية SQL لضمان العمل بدون إنترنت (Offline)
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    }, function(error) {
        console.error('SQL Error: ' + error.message);
    }, function() {
        // بمجرد جاهزية القاعدة، نعرض الأرقام المخزنة محلياً فوراً
        loadNumbersFromSQL();
    });

    // 2. طلب كافة الأذونات المطلوبة لنظام أندرويد
    requestAllPermissions();

    // 3. التحقق من المرة الأولى لإظهار شاشة الترحيب والشرح
    if (!localStorage.getItem('first_run_done')) {
        const overlay = document.getElementById('welcome-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    // 4. ربط الدوال الأساسية بمصادر البيانات
    syncFirebase(db);      // مزامنة أرقام الحظر من السحابة
    loadAdminMessages(db); // جلب تنبيهات الإدارة الحية
}

// دالة طلب الأذونات مع جلب السجل فور الموافقة
function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    const list = [
        permissions.READ_PHONE_STATE,
        permissions.READ_CALL_LOG,      // ضروري لعرض السجل الحقيقي
        permissions.ANSWER_PHONE_CALLS, // ضروري لعملية الحظر
        permissions.READ_PHONE_NUMBERS,
        permissions.SYSTEM_ALERT_WINDOW,
        permissions.POST_NOTIFICATIONS
    ];

    permissions.requestPermissions(list, (status) => {
        if (status.hasPermission) {
            console.log("تم منح كافة الأذونات بنجاح");
            // الانتظار قليلاً لضمان استقرار نظام التشغيل قبل جلب السجل
            setTimeout(loadRealCallLogs, 1000);
        }
    }, (err) => console.error("Permission error: ", err));
}

// دالة جلب سجل المكالمات الحقيقي من الهاتف (تظهر المكالمات القديمة والجديدة)
function loadRealCallLogs() {
    const callLogManager = window.plugins.calllog || window.plugins.callLog;
    const container = document.getElementById('call-logs-list');

    if (!callLogManager) {
        if (container) container.innerHTML = '<div class="text-center text-red-500 py-10 text-xs font-bold">عذراً، إضافة السجل غير مثبتة بشكل صحيح</div>';
        return;
    }

    // جلب آخر 20 مكالمة مخزنة في ذاكرة الهاتف
    callLogManager.getCallLog([], function(data) {
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="text-center text-slate-400 py-20 text-sm">سجل المكالمات في الهاتف فارغ حالياً</div>';
            return;
        }

        container.innerHTML = "";
        const top20 = data.slice(0, 20);

        top20.forEach(call => {
            const dateStr = new Date(call.date).toLocaleString('ar-EG', { hour: '2-digit', minute:'2-digit', day:'numeric', month:'short' });
            let icon = "phone-incoming"; 
            let iconColor = "text-slate-400";
            
            if (call.type == 3) { icon = "phone-missed"; iconColor = "text-red-500"; }
            if (call.type == 2) { icon = "phone-outgoing"; iconColor = "text-blue-500"; }

            container.innerHTML += `
                <div class="bg-white p-4 rounded-3xl border border-slate-50 flex items-center justify-between shadow-sm animate-fade-in mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                            <i data-lucide="${icon}" class="w-6 h-6 ${iconColor}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-slate-800 tracking-wider">${call.number || 'رقم خاص'}</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase">${dateStr}</p>
                        </div>
                    </div>
                    <button onclick="manualBlock('${call.number}')" class="bg-red-50 text-red-600 px-4 py-2 rounded-2xl text-[10px] font-bold active:scale-90 transition-transform">حظر</button>
                </div>`;
        });
        if (window.lucide) lucide.createIcons();
    }, (err) => {
        if (container) container.innerHTML = '<div class="text-center text-red-400 py-10 text-xs">فشل الوصول للسجل. تأكد من منح إذن Call Log.</div>';
    });
}

// دالة حظر رقم يدوياً من السجل وحفظه في الذاكرة المحلية
function manualBlock(num) {
    if (!num || num === 'null' || num === 'undefined') {
        alert("لا يمكن حظر رقم غير معروف");
        return;
    }
    db_local.transaction(function(tx) {
        tx.executeSql('INSERT OR REPLACE INTO blocked_numbers (number) VALUES (?)', [num], function() {
            alert("تم إضافة " + num + " لقائمة الحظر المحلية");
            loadNumbersFromSQL(); // تحديث القائمة الرئيسية فوراً
        });
    });
}

// دالة عرض الأرقام من الذاكرة المحلية (تضمن ظهور الأرقام بدون إنترنت)
function loadNumbersFromSQL() {
    const container = document.getElementById('list-content');
    if (!container) return;

    db_local.transaction(function(tx) {
        tx.executeSql('SELECT number FROM blocked_numbers', [], function(tx, rs) {
            if (rs.rows.length > 0) {
                container.innerHTML = "";
                for (var i = 0; i < rs.rows.length; i++) {
                    let num = rs.rows.item(i).number;
                    container.innerHTML += `
                        <div class="bg-white p-5 rounded-[30px] border-r-8 border-blue-600 shadow-sm flex justify-between items-center mb-3">
                            <div>
                                <p class="font-bold text-slate-900 text-lg tracking-widest">${num}</p>
                                <p class="text-[10px] text-blue-600 font-bold italic opacity-70">محمي محلياً 🛡️</p>
                            </div>
                            <i data-lucide="shield-check" class="text-blue-100 w-8 h-8"></i>
                        </div>`;
                }
                if (window.lucide) lucide.createIcons();
            }
        });
    });
}

// دالة جلب تنبيهات المدير من Firebase وعرضها فوراً
function loadAdminMessages(db) {
    db.ref('admin_alerts').on('value', (snap) => {
        const container = document.getElementById('admin-messages');
        if (container) {
            if (snap.exists()) {
                container.innerHTML = "";
                snap.forEach(child => {
                    container.innerHTML += `
                        <div class="bg-orange-100 border-2 border-orange-200 p-4 rounded-[25px] text-orange-900 text-xs font-bold shadow-sm mb-3 animate-pulse">
                            📢 ${child.val()}
                        </div>`;
                });
            } else {
                container.innerHTML = '<div class="text-center py-4 text-slate-300 text-xs">لا توجد رسائل إدارية حالياً</div>';
            }
        }
    });
}

// مزامنة قائمة الأرقام المزعجة العامة من Firebase
function syncFirebase(db) {
    db.ref('spam_numbers').on('value', (snap) => {
        db_local.transaction(function(tx) {
            tx.executeSql('DELETE FROM blocked_numbers'); // مسح القديم للتحديث
            snap.forEach((child) => {
                tx.executeSql('INSERT OR REPLACE INTO blocked_numbers (number) VALUES (?)', [child.key]);
            });
        }, function(err) {
            console.error("Sync Error: " + err.message);
        }, function() {
            // بعد نجاح المزامنة، نعرض القائمة المحدثة
            loadNumbersFromSQL();
        });
    });
}

// دالة التفعيل لأول مرة وحفظ الحالة
function firstTimeActivate() {
    localStorage.setItem('first_run_done', 'true');
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) overlay.classList.add('hidden');
    goToSettings();
}

// فتح إعدادات النظام لتعيين التطبيق كافتراضي
function goToSettings() {
    if (window.plugins && window.plugins.intentShim) {
        window.plugins.intentShim.startActivity({
            action: "android.settings.MANAGE_DEFAULT_APPS_SETTINGS"
        }, () => {}, (e) => console.error("Settings Intent Error"));
    }
}
