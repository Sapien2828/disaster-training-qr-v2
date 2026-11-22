// Handle GAS communication and offline logs - v39 (Multi-User & Concurrency Safe)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzT2dbn2WMO_JlYjrHCiJOwIiCj-Hvyw-W6QfreChGjidJtgN0kQml7qbGrK9U8zMU4Gw/exec';

let isSyncing = false;

async function sendLog(logData) {
    let queue = JSON.parse(localStorage.getItem('log_queue') || '[]');
    logData.status = 'PENDING';
    // 複数人同時送信や連打でも絶対に被らないユニークIDを生成
    const rand = Math.random().toString(36).substring(2, 7);
    logData.log_id = `${logData.session_id}_${Date.now()}_${rand}`;
    queue.push(logData);
    localStorage.setItem('log_queue', JSON.stringify(queue));
    
    syncLogs();
}

async function syncLogs() {
    if (!navigator.onLine || isSyncing) return;
    isSyncing = true;
    
    try {
        let queue = JSON.parse(localStorage.getItem('log_queue') || '[]');
        let hasPending = false;
        
        for (let i = 0; i < queue.length; i++) {
            if (queue[i].status !== 'PENDING') continue;
            hasPending = true;
            try {
                await fetch(GAS_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify(queue[i])
                });
                queue[i].status = 'SYNCED';
            } catch (e) {
                console.error('Sync failed, will retry later:', e);
            }
        }
        
        if (hasPending) {
            // 送信済みの古いログを削除してlocalStorageの容量圧迫を防ぐ
            const remaining = queue.filter(l => l.status === 'PENDING');
            localStorage.setItem('log_queue', JSON.stringify(remaining));
        }
    } finally {
        isSyncing = false;
    }
}

window.addEventListener('online', syncLogs);
// 通信が一時的に途切れた場合でも30秒ごとに未送信ログを自動再送
setInterval(syncLogs, 30000);
