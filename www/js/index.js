// ربط الدوال بالنافذة لضمان الوصول إليها من HTML
window.firstTimeActivate = firstTimeActivate;
window.goToSettings = goToSettings;
window.toggleIntlBlock = toggleIntlBlock;

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

    // طلب الصلاحيات الأساسية
    requestAllPermissions();

    // التحقق من حالة التبديل الدولية المحفوظة
    checkIntlToggleState();

    if (!localStorage.getItem('first_run_done')) {
        document.getElementById('welcome-overlay').classList.remove('hidden');
    }

    syncFirebase(db);
    loadAdminMessages(db);
}

// دالة فحص حالة زر المكالمات الدولية وتحديث الواجهة
function checkIntlToggleState() {
    const isIntlBlocked = localStorage.getItem('intl_block') === 'true';
    const toggle = document.getElementById('intl-toggle');
    if (toggle) toggle.checked = isIntlBlocked;
}

// دالة التحكم في خيار حظر المكالمات الدولية
function toggleIntlBlock(isEnabled) {
    localStorage.setItem('intl_block', isEnabled);
    
    const message = isEnabled ? "تفعيل حظر المكالمات الدولية (+)" : "إيقاف حظر المكالمات الدولية";
    
    // إظهار تنبيه للمستخدم
    const toast = document.createElement('div');
    toast.className = "fixed bottom-24 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-bold z-[5000] shadow-xl animate-bounce";
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);

    // ملاحظة تقنية: الحظر الفعلي يتم برمجياً عند ورود المكالمة بفحص الرقم إذا كان يبدأ بـ + أو 00
}

function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    const list = [
        permissions.READ_PHONE_STATE,     // ضروري لمعرفة وجود مكالمة
        permissions.READ_PHONE_NUMBERS,   // ضروري لمعرفة رقم المتصل وفحصه
        permissions.ANSWER_PHONE_CALLS,   // ضروري لقطع المكالمة (أندرويد 8+)
        permissions.SYSTEM_ALERT_WINDOW,  // للظهور فوق التطبيقات
        permissions.POST_NOTIFICATIONS    // للتنبيهات (أندرويد 13+)
    ];

    permissions.requestPermissions(list, (s) => console.log("Permissions Granted"), (e) => console.error(e));
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
                        <div class="bg-white p-4 rounded-2xl border-r-4 border-blue-500 shadow-sm flex justify-between items-center mb-2 animate-fade-in">
                            <span class="text-slate-800 font-bold text-sm tracking-widest">${num}</span>
                            <i data-lucide="shield-check" class="text-blue-100 w-5 h-5"></i>
                        </div>`;
                }
                if (window.lucide) lucide.createIcons();
            } else {
                container.innerHTML = '<p class="text-center py-6 text-slate-300 text-xs italic">القائمة فارغة حالياً</p>';
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

function loadAdminMessages(db) {
    db.ref('admin_alerts').on('value', (snap) => {
        const container = document.getElementById('admin-messages');
        if (snap.exists() && container) {
            container.innerHTML = "";
            snap.forEach(child => {
                container.innerHTML += `<div class="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-orange-900 text-[10px] font-bold shadow-sm mb-2">📢 ${child.val()}</div>`;
            });
        }
    });
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
