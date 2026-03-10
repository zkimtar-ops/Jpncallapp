var db_sqlite;

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

function onDeviceReady() {
    // 1. إعداد قاعدة بيانات SQLite
    setupSQLite();

    // 2. تهيئة Firebase
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // 3. طلب كافة الأذونات
    requestAllPermissions();

    // 4. فحص المرة الأولى لإظهار الشرح
    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    // 5. مزامنة البيانات من الفيرباس إلى SQLite
    syncFirebaseToSQLite(db);

    // 6. الاستماع لإشعارات الحظر القادمة من ملف Java (CallScreeningService)
    setupBroadcastListener();
}

function setupSQLite() {
    // فتح قاعدة البيانات في المسار الافتراضي للنظام لكي يراها ملف Java
    db_sqlite = window.sqlitePlugin.openDatabase({
        name: 'sos_japan.db',
        location: 'default',
        androidDatabaseProvider: 'system'
    });

    // إنشاء الجدول إذا لم يكن موجوداً
    db_sqlite.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (phone TEXT PRIMARY KEY)');
    }, function(error) {
        console.error('SQLite Error: ' + error.message);
    }, function() {
        console.log('SQLite Ready');
        updateUIFromSQLite(); // تحديث القائمة في الواجهة فور الفتح
    });
}

function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    const list = [
        permissions.READ_PHONE_STATE,
        permissions.READ_CALL_LOG,
        permissions.ANSWER_PHONE_CALLS,
        permissions.READ_PHONE_NUMBERS,
        permissions.POST_NOTIFICATIONS,
        permissions.SYSTEM_ALERT_WINDOW
    ];
    permissions.requestPermissions(list, (s) => console.log("Permissions OK"), (e) => console.error(e));
}

function syncFirebaseToSQLite(db) {
    db.ref('spam_numbers').on('value', (snap) => {
        if (snap.exists()) {
            db_sqlite.transaction(function(tx) {
                // مسح البيانات القديمة وتحديثها بالجديدة
                tx.executeSql('DELETE FROM blocked_numbers');
                snap.forEach((child) => {
                    tx.executeSql('INSERT INTO blocked_numbers (phone) VALUES (?)', [child.key]);
                });
            }, function(error) {
                console.error('Sync Error: ' + error.message);
            }, function() {
                console.log('SQLite Updated from Firebase');
                updateUIFromSQLite(); // تحديث الواجهة بعد المزامنة
            });
        }
    });
}

function updateUIFromSQLite() {
    db_sqlite.executeSql('SELECT phone FROM blocked_numbers', [], function(res) {
        const container = document.getElementById('list-content');
        let html = "";
        for (let i = 0; i < res.rows.length; i++) {
            html += `<div class="notif-card">📞 محظور: ${res.rows.item(i).phone}</div>`;
        }
        container.innerHTML = html || "لا توجد أرقام محظورة حالياً.";
    });
}

function setupBroadcastListener() {
    // الاستماع لحدث الحظر المرسل من CallScreeningService.java
    window.addEventListener("com.nospam.japan.CALL_BLOCKED", function(event) {
        // تأكد أن البلاجن يدعم استقبال البيانات في event.detail أو استقبلها مباشرة
        const blockedNum = event.blocked_number || "رقم مجهول";
        showLocalNotification(blockedNum);
    }, false);
}

function showLocalNotification(num) {
    if (window.cordova && cordova.plugins.notification.local) {
        cordova.plugins.notification.local.schedule({
            title: '🚫 تم الحظر تلقائياً',
            text: 'تم حظر مكالمة من: ' + num,
            priority: 2,
            foreground: true
        });
    }
}

function firstTimeActivate() {
    localStorage.setItem('first_run_done', 'true');
    document.getElementById('welcome-overlay').classList.add('hidden');
    goToSettings();
}

function goToSettings() {
    if (window.plugins && window.plugins.intentShim) {
        window.plugins.intentShim.startActivity({
            action: "android.settings.MANAGE_DEFAULT_APPS_SETTINGS"
        }, () => {}, (e) => alert("خطأ في فتح الإعدادات"));
    }
}
