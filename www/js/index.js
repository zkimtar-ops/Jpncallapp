// ربط جميع الوظائف بنافذة المتصفح لضمان استدعائها من HTML
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
    // تشغيل Firebase
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // إعداد قاعدة البيانات المحلية SQL (Offline Support)
    db_local = window.sqlitePlugin.openDatabase({name: 'nospam.db', location: 'default'});
    db_local.transaction(function(tx) {
        tx.executeSql('CREATE TABLE IF NOT EXISTS blocked_numbers (number TEXT PRIMARY KEY)');
    }, null, () => loadNumbersFromSQL());

    // 1. طلب القائمة الكاملة للأذونات (شاملة)
    requestAllPermissions();

    // 2. استعادة حالة مفتاح التبديل الدولي
    restoreIntlState();

    // 3. التحقق من المرة الأولى
    if (!localStorage.getItem('first_run_done')) {
        const welcome = document.getElementById('welcome-overlay');
        if (welcome) welcome.classList.remove('hidden');
    }

    // 4. تشغيل المزامنة والرسائل
    syncFirebase(db);
    loadAdminMessages(db);
}

// القائمة الكاملة للأذونات المطلوبة لأندرويد 10-14
function requestAllPermissions() {
    const permissions = cordova.plugins.permissions;
    const list = [
        permissions.READ_PHONE_STATE,      // مراقبة حالة المكالمة
        permissions.READ_PHONE_NUMBERS,    // قراءة الرقم الوارد (أندرويد حديث)
        permissions.ANSWER_PHONE_CALLS,    // رفض المكالمة (أندرويد حديث)
        permissions.MODIFY_PHONE_STATE,    // التحكم بحالة الهاتف (قديم/حديث)
        permissions.SYSTEM_ALERT_WINDOW,   // الظهور فوق التطبيقات
        permissions.POST_NOTIFICATIONS,    // التنبيهات (أندرويد 13+)
        permissions.READ_CALL_LOG,         // الوصول لسجل المكالمات (للفحص الدقيق)
        permissions.FOREGROUND_SERVICE     // العمل في الخلفية (أندرويد 14)
    ];

    permissions.requestPermissions(list, (s) => {
        if (s.hasPermission) console.log("All Permissions Granted Successfully");
    }, (e) => console.error("Permission Request Failed", e));
}

// منطق حظر المكالمات الدولية (On/Off)
function toggleIntlBlock(isEnabled) {
    localStorage.setItem('intl_block', isEnabled);
    updateIntlUI(isEnabled);
    
    showToast(isEnabled ? "تم تفعيل حظر المكالمات الدولية ✅" : "تم إيقاف حظر المكالمات الدولية ⚠️");
}

function restoreIntlState() {
    const isEnabled = localStorage.getItem('intl_block') === 'true';
    const checkbox = document.getElementById('intl-toggle');
    if (checkbox) checkbox.checked = isEnabled;
    updateIntlUI(isEnabled);
}

function updateIntlUI(isEnabled) {
    const label = document.getElementById('intl-status-label');
    if (label) {
        label.innerText = isEnabled ? "الحالة: نـشـط الآن" : "الحالة: غير نشط";
        label.className = isEnabled ? 
            "text-[9px] font-bold py-1 px-3 rounded-full inline-block bg-green-50 text-green-600 mt-2" : 
            "text-[9px] font-bold py-1 px-3 rounded-full inline-block bg-slate-100 text-slate-400 mt-2";
    }
}

// مزامنة الأرقام وعرضها
function loadNumbersFromSQL() {
    const container = document.getElementById('list-content');
    const countBadge = document.getElementById('block-count');
    if (!container) return;

    db_local.transaction(function(tx) {
        tx.executeSql('SELECT number FROM blocked_numbers', [], function(tx, rs) {
            if (rs.rows.length > 0) {
                container.innerHTML = "";
                if (countBadge) countBadge.innerText = rs.rows.length;
                for (var i = 0; i < rs.rows.length; i++) {
                    let num = rs.rows.item(i).number;
                    container.innerHTML += `
                        <div class="bg-white p-5 rounded-[30px] border-r-8 border-blue-600 shadow-sm flex justify-between items-center mb-1">
                            <div>
                                <p class="font-bold text-slate-800 text-lg tracking-widest">${num}</p>
                                <p class="text-[9px] text-blue-500 font-bold italic opacity-70 uppercase tracking-tighter">محمي محلياً</p>
                            </div>
                            <i data-lucide="shield-check" class="text-blue-100 w-7 h-7"></i>
                        </div>`;
                }
                if (window.lucide) lucide.createIcons();
            } else {
                container.innerHTML = '<p class="text-center py-10 text-slate-300 text-xs italic">لا توجد أرقام محظورة حالياً</p>';
                if (countBadge) countBadge.innerText = "0";
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
                container.innerHTML += `
                    <div class="bg-white border-2 border-orange-100 p-5 rounded-[30px] text-orange-900 text-[11px] font-bold shadow-sm mb-2 leading-relaxed">
                        <span class="bg-orange-500 text-white px-2 py-0.5 rounded-lg text-[8px] ml-2">هام</span>
                        ${child.val()}
                    </div>`;
            });
        }
    });
}

function showToast(msg) {
    const toast = document.getElementById('toast-msg');
    if (toast) {
        toast.innerText = msg;
        toast.style.opacity = "1";
        setTimeout(() => toast.style.opacity = "0", 2500);
    }
}

function firstTimeActivate() {
    localStorage.setItem('first_run_done', 'true');
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) overlay.classList.add('hidden');
    goToSettings();
}

function goToSettings() {
    if (window.plugins && window.plugins.intentShim) {
        window.plugins.intentShim.startActivity({
            action: "android.settings.MANAGE_DEFAULT_APPS_SETTINGS"
        }, () => {}, (e) => console.error(e));
    }
}
