// ربط الدوال بـ window لضمان وصول الـ HTML إليها
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

    // إعداد SQL
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    }, null, () => loadNumbersFromSQL());

    requestAllPermissions();

    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    syncFirebase(db);
    loadAdminMessages(db);
}

function loadRealCallLogs() {
    const container = document.getElementById('call-logs-list');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-10 animate-pulse text-blue-500">جاري البحث في سجل الهاتف...</div>';

    // محاولة الوصول للإضافة بكل المسميات الممكنة
    const callLogManager = window.plugins.calllog || window.plugins.callLog;

    if (!callLogManager) {
        container.innerHTML = '<div class="bg-red-50 text-red-500 p-4 rounded-xl text-xs text-center font-bold">خطأ: لم يتم تثبيت إضافة السجل بشكل صحيح في الـ Build</div>';
        return;
    }

    callLogManager.getCallLog([], function(data) {
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="text-center py-20 text-slate-400">سجل المكالمات فارغ تماماً</div>';
            return;
        }

        container.innerHTML = "";
        data.slice(0, 20).forEach(call => {
            const dateStr = new Date(call.date).toLocaleString('ar-EG', { hour: '2-digit', minute:'2-digit' });
            let icon = call.type == 3 ? "phone-missed" : (call.type == 2 ? "phone-outgoing" : "phone-incoming");
            let iconColor = call.type == 3 ? "text-red-500" : (call.type == 2 ? "text-blue-500" : "text-green-500");

            container.innerHTML += `
                <div class="bg-white p-4 rounded-3xl border border-slate-50 flex items-center justify-between shadow-sm mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                            <i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i>
                        </div>
                        <div>
                            <p class="font-bold text-slate-700 text-sm tracking-wider">${call.number || 'رقم مخفي'}</p>
                            <p class="text-[9px] text-slate-400 font-bold">${dateStr}</p>
                        </div>
                    </div>
                    <button onclick="window.manualBlock('${call.number}')" class="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-bold">حظر</button>
                </div>`;
        });
        if (window.lucide) lucide.createIcons();
    }, (err) => {
        container.innerHTML = '<div class="text-center text-red-500 py-10">فشل الوصول للسجل: ' + err + '</div>';
    });
}

function loadAdminMessages(db) {
    db.ref('admin_alerts').on('value', (snap) => {
        const container = document.getElementById('admin-messages');
        if (snap.exists() && container) {
            container.innerHTML = "";
            snap.forEach(child => {
                container.innerHTML += `<div class="bg-orange-100 p-3 rounded-2xl mb-2 shadow-sm animate-pulse">📢 ${child.val()}</div>`;
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
                        <div class="bg-white p-4 rounded-2xl border-r-4 border-blue-600 shadow-sm flex justify-between items-center mb-2 font-bold">
                            <span class="text-slate-800 tracking-widest text-sm">${num}</span>
                            <i data-lucide="shield-check" class="text-blue-200 w-5 h-5"></i>
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
            alert("تم حظر الرقم " + num);
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
