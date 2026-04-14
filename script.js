let devices = [
    { id: 1, name: 'جهاز 1', status: 'available' },
    { id: 2, name: 'جهاز 2', status: 'available' }
];

let reservations = [];
let activeDeviceId = null;
let totalRevenue = 0;

// إضافة جهاز جديد
function addNewDevice() {
    const newId = devices.length + 1;
    devices.push({ id: newId, name: `جهاز ${newId}`, status: 'available' });
    renderAll();
}

// تحديث الواجهة بالكامل
function renderAll() {
    renderDevices();
    renderReservations();
    document.getElementById('stat-revenue').innerText = totalRevenue.toLocaleString() + ' ل.س';
}

function renderDevices() {
    const grid = document.getElementById('devices-grid');
    grid.innerHTML = devices.map(device => `
        <div onclick="${device.status === 'available' ? `openModal(${device.id})` : ''}" 
             class="device-card glass-panel p-6 rounded-3xl flex items-center justify-between cursor-pointer ${device.status === 'occupied' ? 'occupied' : ''}">
            <div class="flex items-center gap-4">
                <div class="p-3 bg-white/5 rounded-2xl">
                    <i data-lucide="monitor" class="${device.status === 'available' ? 'text-blue-500' : 'text-red-500'}"></i>
                </div>
                <div>
                    <h3 class="font-bold">${device.name}</h3>
                    <span class="text-[10px] uppercase font-black ${device.status === 'available' ? 'text-green-500' : 'text-red-500'}">
                        ${device.status === 'available' ? 'متاح للعب' : 'مشغول الآن'}
                    </span>
                </div>
            </div>
            ${device.status === 'available' ? '<i data-lucide="chevron-left" class="text-gray-600"></i>' : ''}
        </div>
    `).join('');
    lucide.createIcons();
}

function renderReservations() {
    const list = document.getElementById('reservations-list');
    if (reservations.length === 0) {
        list.innerHTML = '<div class="glass-panel p-10 text-center text-gray-600 rounded-3xl">لا توجد حجوزات نشطة</div>';
        return;
    }
    list.innerHTML = reservations.map((res, index) => `
        <div class="glass-panel p-5 rounded-2xl border-r-4 border-purple-500 flex justify-between items-center">
            <div>
                <h4 class="font-bold text-sm text-blue-400">${res.deviceName} - ${res.playerName}</h4>
                <p class="text-[10px] text-gray-500 mt-1">ينتهي: ${res.endTime}</p>
            </div>
            <button onclick="endBooking(${index})" class="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-lg transition-all">
                <i data-lucide="log-out" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    lucide.createIcons();
}

function openModal(id) {
    activeDeviceId = id;
    const device = devices.find(d => d.id === id);
    document.getElementById('modal-device-name').innerText = device.name;
    document.getElementById('booking-modal').classList.replace('hidden', 'flex');
    calculateBooking();
}

function closeModal() {
    document.getElementById('booking-modal').classList.replace('flex', 'hidden');
    document.getElementById('player-name').value = '';
}

function calculateBooking() {
    const price = parseInt(document.getElementById('global-price').value) || 0;
    const hours = parseInt(document.getElementById('hours-count').value);
    document.getElementById('total-price-display').innerText = (price * hours).toLocaleString();
}

function confirmBooking() {
    const name = document.getElementById('player-name').value;
    if (!name) return alert("يرجى إدخال اسم اللاعب");

    const price = parseInt(document.getElementById('global-price').value) || 0;
    const hours = parseInt(document.getElementById('hours-count').value);
    const device = devices.find(d => d.id === activeDeviceId);
    
    const end = new Date(new Date().getTime() + hours * 60 * 60 * 1000);
    const endTimeStr = end.toLocaleTimeString('ar-SY', {hour:'2-digit', minute:'2-digit'});

    reservations.push({
        deviceId: device.id,
        deviceName: device.name,
        playerName: name,
        endTime: endTimeStr,
        price: price * hours
    });

    device.status = 'occupied';
    totalRevenue += (price * hours);
    
    closeModal();
    renderAll();
}

function endBooking(index) {
    const res = reservations[index];
    const device = devices.find(d => d.id === res.deviceId);
    device.status = 'available';
    reservations.splice(index, 1);
    renderAll();
}

document.addEventListener('DOMContentLoaded', renderAll);