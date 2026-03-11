document.addEventListener('deviceready', onDeviceReady, false);

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
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // 1. إعداد قاعدة البيانات المحلية SQL (للحفظ الدائم والعمل بدون إنترنت)
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    });

    // 2. طلب كافة الأذونات (تم فحص الكود القديم وإضافة كل ما يلزم)
    requestAllPermissions();

    // 3. التحقق من المرة الأولى لإظهار شاشة الشرح
    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    // 4. مزامنة بيانات الفيرباس وحفظها في SQL
    syncFirebase(db);
}

function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    
    // قائمة شاملة لكافة الأذونات المطلوبة بناءً على ملفات مشروعك
    const list = [
        permissions.READ_PHONE_STATE,      // لمراقبة حالة الهاتف
        permissions.READ_CALL_LOG,        // للوصول لسجل المكالمات
        permissions.ANSWER_PHONE_CALLS,   // لإنهاء المكالمات (أندرويد 8+)
        permissions.READ_PHONE_NUMBERS,   // لقراءة رقم المتصل بدقة
        permissions.MODIFY_PHONE_STATE,   // للتحكم في حالة الاتصال
        permissions.SYSTEM_ALERT_WINDOW,  // لإظهار تنبيهات فوق التطبيقات الأخرى
        permissions.POST_NOTIFICATIONS,   // لإرسال إشعارات الحظر (أندرويد 13+)
        permissions.CALL_PHONE            // لإدارة عمليات الاتصال
    ];

    permissions.requestPermissions(list, (status) => {
        if (status.hasPermission) {
            console.log("تم الحصول على كافة الأذونات بنجاح");
        } else {
            console.warn("بعض الأذونات تم رفضها، قد لا يعمل الحظر بشكل صحيح");
        }
    }, (error) => {
        console.error("خطأ أثناء طلب الأذونات: ", error);
    });
}

function firstTimeActivate() {
    localStorage.setItem('first_run_done', 'true');
    document.getElementById('welcome-overlay').classList.add('hidden');
    goToSettings();
}

function goToSettings() {
    // فتح إعدادات التطبيقات الافتراضية لاختيار التطبيق كـ Spam App
    if (window.plugins && window.plugins.intentShim) {
        window.plugins.intentShim.startActivity({
            action: "android.settings.MANAGE_DEFAULT_APPS_SETTINGS"
        }, () => {}, (e) => alert("خطأ في فتح الإعدادات"));
    }
}

function syncFirebase(db) {
    db.ref('spam_numbers').on('value', (snap) => {
        const container = document.getElementById('list-content');
        container.innerHTML = "";
        
        db_local.transaction(function(tx) {
            // مسح البيانات القديمة لضمان تحديث القائمة
            tx.executeSql('DELETE FROM blocked_numbers');
            
            snap.forEach((child) => {
                let num = child.key;
                container.innerHTML += `<div class="notif-card">📞 محظور: ${num}</div>`;
                
                // حفظ الرقم في SQL (هذا يضمن أن يعمل الحظر حتى لو انقطع الإنترنت)
                tx.executeSql('INSERT OR REPLACE INTO blocked_numbers (number) VALUES (?)', [num]);
            });
        });
    }, (error) => {
        console.error("خطأ في مزامنة Firebase: ", error);
    });
}
