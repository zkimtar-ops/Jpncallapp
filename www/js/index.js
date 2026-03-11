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

    // إعداد قاعدة البيانات المحلية SQL لضمان العمل بدون إنترنت
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    });

    // 1. طلب كافة الأذونات فوراً
    requestAllPermissions();

    // 2. التحقق من المرة الأولى لإظهار شاشة الشرح
    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    // 3. مزامنة بيانات الفيرباس
    syncFirebase(db);
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

function firstTimeActivate() {
    // حفظ أن الشرح تم رؤيته
    localStorage.setItem('first_run_done', 'true');
    document.getElementById('welcome-overlay').classList.add('hidden');
    
    // فتح الإعدادات فوراً
    goToSettings();
}

function goToSettings() {
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
            // مسح القائمة القديمة لتحديثها بالجديدة من الفيرباس
            tx.executeSql('DELETE FROM blocked_numbers');
            
            snap.forEach((child) => {
                let num = child.key;
                container.innerHTML += `<div class="notif-card">📞 محظور: ${num}</div>`;
                
                // حفظ الرقم في SQL ليتمكن ملف CallBlockerService.java من قراءته بدون إنترنت
                tx.executeSql('INSERT INTO blocked_numbers (number) VALUES (?)', [num]);
            });
        });
    });
}
