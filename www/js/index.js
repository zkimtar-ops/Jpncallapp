// ربط الدوال بـ Window لضمان استدعائها من الـ HTML
window.loadRealCallLogs = loadRealCallLogs;
window.firstTimeActivate = firstTimeActivate;
window.goToSettings = goToSettings;
window.manualBlock = manualBlock;

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

    // إعداد قاعدة البيانات المحلية SQL
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    }, null, () => loadNumbersFromSQL());

    // طلب الأذونات
    requestAllPermissions();

    // التحقق من المرة الأولى
    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    // تشغيل المزامنة والتنبيهات
    syncFirebase(db);
    loadAdminMessages(db);
}

function loadRealCallLogs() {
    const container = document.getElementById('call-logs-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-20 text-blue-500 animate-pulse text-xs">جاري الوصول لسجل الهاتف...</div>';

    // استخدام اسم الإضافة الصحيح
    const callLogManager = window.plugins.calllog;

    if (!callLogManager) {
        container.innerHTML = '<div class="bg-red-50 text-red-500 p-4 rounded-2xl text-[10px] text-center font-bold">خطأ: إضافة السجل غير مثبتة. تأكد من استخدام cordova-plugin-calllog في main.yml</div>';
        return;
    }

    // جلب آخر 20 مكالمة
    callLogManager.getCallLog([], function(data) {
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="text-center py-20 text-slate-400 text-xs">سجل الهاتف فارغ</div>';
            return;
        }

        container.innerHTML = "";
        data.slice(0, 20).forEach(call => {
            const d = new Date(call.date).toLocaleString('ar-EG', {hour:'2-digit', minute:'2-digit'});
            let icon = call.type == 3 ? "phone-missed" : (call.type == 2 ? "phone-outgoing" : "phone-incoming");
            let iconColor = call.type == 3 ? "text-red-500" : (call.type == 2 ? "text-blue-500" : "text-slate-400");

            container.innerHTML += `
                <div class="bg-white p-4 rounded-3xl border border-slate-50 flex items-center justify-between shadow-sm mb-3 animate-fade-in">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                            <i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-slate-700 text-sm tracking-wider">${call.number || 'رقم خاص'}</p>
                            <p class="text-[9px] text-slate-400 font-bold">${d}</p>
                        </div>
                    </div>
                    <button onclick="window.manualBlock('${call.number}')" class="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-bold active:scale-90 transition-transform">حظر</button>
                </div>`;
        });
        if (window.lucide) lucide.createIcons();
    }, (err) => {
        container.innerHTML = '<div class="text-center text-red-500 py-10 text-xs">فشل الوصول للسجل: ' + err + '</div>';
    });
}

function loadAdminMessages(db) {
    db.ref('admin_alerts').on('value', (snap) => {
        const container = document.getElementById('admin-messages');
        if (snap.exists() && container) {
            container.innerHTML = "";
            snap.forEach(child => {
                container.innerHTML += `<div class="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-orange-800 shadow-sm animate-pulse">📢 ${child.val()}</div>`;
            });
        }
    });
}

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
                        <div class="bg-white p-4 rounded-2xl border-r-4 border-blue-600 shadow-sm flex justify-between items-center mb-2">
                            <span class="text-slate-800 font-bold text-sm tracking-widest">${num}</span>
                            <i data-lucide="shield-check" class="text-blue-100 w-5 h-5"></i>
                        </div>`;
                }
                if (window.lucide) lucide.createIcons();
            }
        });
    });
}

function syncFirebase(db) {
    db.ref('spam_numbers').on('value', (snap) => {
        db_local.transaction(function(tx) {
            tx.executeSql('DELETE FROM blocked_numbers'); 
            snap.forEach((child) => {
                tx.executeSql('INSERT OR REPLACE INTO blocked_numbers (number) VALUES (?)', [child.key]);
            });
        }, null, () => loadNumbersFromSQL());
    });
}

function manualBlock(num) {
    if (!num) return;
    db_local.transaction(function(tx) {
        tx.executeSql('INSERT OR REPLACE INTO blocked_numbers (number) VALUES (?)', [num], function() {
            alert("تم حظر " + num);
            loadNumbersFromSQL();
        });
    });
}

function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    const list = [permissions.READ_PHONE_STATE, permissions.READ_CALL_LOG, permissions.ANSWER_PHONE_CALLS, permissions.SYSTEM_ALERT_WINDOW];
    permissions.requestPermissions(list, null, null);
}

function firstTimeActivate() {
    localStorage.setItem('first_run_done', 'true');
    document.getElementById('welcome-overlay').classList.add('hidden');
    goToSettings();
}

function goToSettings() {
    if (window.plugins && window.plugins.intentShim) {
        window.plugins.intentShim.startActivity({ action: "android.settings.MANAGE_DEFAULT_APPS_SETTINGS" }, () => {}, () => {});
    }
}
