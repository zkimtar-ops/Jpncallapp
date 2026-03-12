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

    // 1. فتح قاعدة البيانات المحلية
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    }, function(error) {
        console.error('SQL Error: ' + error.message);
    }, function() {
        // 2. بمجرد جاهزية القاعدة، نعرض الأرقام المخزنة "أوفلاين" أولاً
        loadNumbersFromSQL();
    });

    // 3. طلب كافة الأذونات المستخلصة من مشروعك
    requestAllPermissions();

    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    // 4. محاولة التحديث من الفيرباس إذا وجد إنترنت
    syncFirebase(db);
}

// دالة عرض الأرقام من الذاكرة المحلية (تضمن ظهور الأرقام بدون إنترنت)
function loadNumbersFromSQL() {
    const container = document.getElementById('list-content');
    
    db_local.transaction(function(tx) {
        tx.executeSql('SELECT number FROM blocked_numbers', [], function(tx, rs) {
            if (rs.rows.length > 0) {
                container.innerHTML = ""; // مسح رسالة "جاري الجلب"
                for (var i = 0; i < rs.rows.length; i++) {
                    let num = rs.rows.item(i).number;
                    container.innerHTML += `<div class="notif-card">🚫 حماية نشطة (محلي): ${num}</div>`;
                }
            }
        });
    });
}

function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    const list = [
        permissions.READ_PHONE_STATE,
        permissions.READ_CALL_LOG,
        permissions.ANSWER_PHONE_CALLS,
        permissions.READ_PHONE_NUMBERS,
        permissions.MODIFY_PHONE_STATE,
        permissions.SYSTEM_ALERT_WINDOW,
        permissions.POST_NOTIFICATIONS,
        permissions.VIBRATE,
        permissions.ACCESS_NETWORK_STATE
    ];
    permissions.requestPermissions(list, (s) => console.log("Permissions OK"), (e) => console.error(e));
}

function syncFirebase(db) {
    db.ref('spam_numbers').on('value', (snap) => {
        const container = document.getElementById('list-content');
        
        db_local.transaction(function(tx) {
            // تحديث القاعدة المحلية بالبيانات الجديدة من السحابة
            tx.executeSql('DELETE FROM blocked_numbers'); 
            
            snap.forEach((child) => {
                let num = child.key;
                tx.executeSql('INSERT OR REPLACE INTO blocked_numbers (number) VALUES (?)', [num]);
            });
        }, function(err) {
            console.error("Sync Transaction Error: " + err.message);
        }, function() {
            // بعد انتهاء التحديث بنجاح، أعد عرض القائمة المحدثة
            loadNumbersFromSQL();
        });
    }, (error) => {
        console.log("Firebase Offline: سيتم الاعتماد على البيانات المحلية.");
    });
}
صيف
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
