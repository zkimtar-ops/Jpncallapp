var db_sqlite;

document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log("Device is ready");

    // 1. إعداد قاعدة البيانات المحلية
    db_sqlite = window.sqlitePlugin.openDatabase({name: 'sos_japan.db', location: 'default'});
    
    db_sqlite.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (phone TEXT PRIMARY KEY)');
        // إضافة أرقام تجريبية إذا كانت القاعدة فارغة لأول مرة
        tx.executeSql('INSERT OR IGNORE INTO blocked_numbers (phone) VALUES ("0123456789")');
    }, function(error) {
        console.error('DB Error: ' + error.message);
    }, function() {
        // بعد إعداد القاعدة، نجلب البيانات للواجهة
        updateUIFromSQLite();
    });

    // 2. تفعيل زر "ابدأ الآن" يدوياً لضمان العمل
    var startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            requestAllPermissions(); // طلب الأذونات عند الضغط
            closeWelcome();
        });
    }

    // 3. إظهار السلايدر إذا كانت أول مرة
    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    // 4. طلب الأذونات تلقائياً أيضاً للتأكيد
    setTimeout(requestAllPermissions, 2000);
}

function updateUIFromSQLite() {
    db_sqlite.executeSql('SELECT phone FROM blocked_numbers', [], function(res) {
        // إخفاء رسالة التحميل
        var loading = document.getElementById('loading-message');
        if (loading) loading.classList.add('hidden');

        var container = document.getElementById('list-content');
        var html = "";
        
        if (res.rows.length > 0) {
            for (let i = 0; i < res.rows.length; i++) {
                html += `<div class="notif-card">📞 رقم محظور: ${res.rows.item(i).phone}</div>`;
            }
        } else {
            html = '<p>لا توجد أرقام محظورة حالياً في الذاكرة.</p>';
        }
        container.innerHTML = html;
    });
}

function requestAllPermissions() {
    var permissions = cordova.plugins.permissions;
    var list = [
        permissions.READ_PHONE_STATE,
        permissions.CALL_PHONE,
        permissions.ANSWER_PHONE_CALLS,
        permissions.READ_CALL_LOG,
        permissions.MODIFY_PHONE_STATE // مهم لبعض نسخ أندرويد
    ];

    permissions.requestPermissions(list, function(status) {
        if (status.hasPermission) {
            console.log("تم تفعيل كافة الأذونات");
        } else {
            console.warn("بعض الأذونات تم رفضها");
        }
    }, function() {
        console.error("خطأ في طلب الأذونات");
    });
}

function closeWelcome() {
    document.getElementById('welcome-overlay').classList.add('hidden');
    localStorage.setItem('first_run_done', 'true');
}
