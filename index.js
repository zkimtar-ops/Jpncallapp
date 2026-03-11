// إضافة دالة لفتح قاعدة البيانات في بداية الملف
var db_local = null;

function onDeviceReady() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    
    // فتح أو إنشاء قاعدة البيانات المحلية
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    });

    requestAllPermissions();
    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }
    syncFirebase(db);
}

function syncFirebase(db) {
    db.ref('spam_numbers').on('value', (snap) => {
        const container = document.getElementById('list-content');
        container.innerHTML = "";
        
        db_local.transaction(function(tx) {
            // مسح القائمة القديمة لتحديثها بالجديدة
            tx.executeSql('DELETE FROM blocked_numbers');
            
            snap.forEach((child) => {
                let num = child.key;
                container.innerHTML += `<div class="notif-card">📞 محظور: ${num}</div>`;
                // حفظ الرقم في SQL
                tx.executeSql('INSERT INTO blocked_numbers (number) VALUES (?)', [num]);
            });
        });
    });
}
