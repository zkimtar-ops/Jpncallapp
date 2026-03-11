var db_sqlite;
var firebaseConfig = {
    // ضع إعدادات الفيرباس الخاصة بك هنا
    apiKey: "YOUR_API_KEY",
    databaseURL: "YOUR_DB_URL",
    projectId: "YOUR_PROJECT_ID",
};

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // 1. إعداد قاعدة البيانات المحلية SQLite
    db_sqlite = window.sqlitePlugin.openDatabase({name: 'sos_japan.db', location: 'default'});
    db_sqlite.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (phone TEXT PRIMARY KEY)');
    });

    // 2. قراءة البيانات المحلية فوراً (لإخفاء رسالة الجلب)
    updateUIFromSQLite();

    // 3. التحقق من الإنترنت لجلب تحديثات Firebase
    if (navigator.onLine) {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            syncFirebaseToLocal(firebase.database());
        }
    }

    // 4. طلب الأذونات وإظهار السلايدر بتأخير بسيط
    setTimeout(() => {
        requestAllPermissions();
        if (!localStorage.getItem('first_run_done')) {
            document.getElementById('welcome-overlay').classList.remove('hidden');
        }
    }, 1500);
}

// دالة تحديث الواجهة من التخزين المحلي (أوفلاين)
function updateUIFromSQLite() {
    db_sqlite.executeSql('SELECT phone FROM blocked_numbers', [], function(res) {
        const container = document.getElementById('list-content');
        const loadingMsg = document.getElementById('loading-message');
        
        // إخفاء رسالة "جاري جلب البيانات"
        if (loadingMsg) loadingMsg.style.display = 'none';

        let html = "";
        if (res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                html += `<div class="notif-card">📞 محظور: ${res.rows.item(i).phone}</div>`;
            }
        } else {
            html = '<div style="text-align:center">لا توجد أرقام في القائمة المحلية حالياً.</div>';
        }
        container.innerHTML = html;
    });
}

// دالة مزامنة Firebase مع التخزين المحلي
function syncFirebaseToLocal(db) {
    db.ref('spam_numbers').on('value', (snapshot) => {
        db_sqlite.transaction(function(tx) {
            tx.executeSql('DELETE FROM blocked_numbers'); // تنظيف القديم
            snapshot.forEach((child) => {
                tx.executeSql('INSERT OR REPLACE INTO blocked_numbers (phone) VALUES (?)', [child.key]);
            });
        }, function(error) {
            console.error('Transaction Error: ' + error.message);
        }, updateUIFromSQLite); // تحديث الواجهة بعد الحفظ
    });
}

// دالة طلب الأذونات (ضرورية لعمل الحظر)
function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    const list = [
        permissions.READ_PHONE_STATE,
        permissions.CALL_PHONE,
        permissions.ANSWER_PHONE_CALLS
    ];

    permissions.requestPermissions(list, (status) => {
        if (!status.hasPermission) console.warn("Permissions denied");
    }, () => console.error("Permissions error"));
}

function closeWelcome() {
    document.getElementById('welcome-overlay').classList.add('hidden');
    localStorage.setItem('first_run_done', 'true');
}
