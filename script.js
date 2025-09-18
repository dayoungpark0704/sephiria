document.addEventListener('DOMContentLoaded', async () => {
    // --- 데이터 로딩 ---
    let artifactDB = [];
    let slateDB = [];
    
    try {
        const artifactResponse = await fetch('artifacts.json');
        artifactDB = await artifactResponse.json();
        const slateResponse = await fetch('slates.json');
        slateDB = await slateResponse.json();
    } catch (error) {
        console.error("데이터 파일을 불러오는 데 실패했습니다:", error);
        alert("데이터 파일을 불러오는 데 실패했습니다. artifacts.json 또는 slates.json 파일이 있는지, 경로가 올바른지 확인해주세요.");
        return;
    }

    // --- DOM 요소 ---
    const itemList = document.getElementById('item-list');
    const inventoryGrid = document.getElementById('inventory-grid');
    const selectedItemsList = document.getElementById('selected-items-list');
    const slotCountLabel = document.getElementById('slot-count-label');
    const typeTabs = document.getElementById('type-tabs');
    const rarityFilter = document.getElementById('rarity-filter');
    const nameSearch = document.getElementById('name-search');

    // --- 상태 관리 변수 ---
    let inventoryState = [];
    let ownedItems = {}; // { "itemId": count }
    let userItemSettings = {}; // { "itemId": { priority: 1.0, upgrade: 0 } }
    let currentItemType = 'artifacts';
    let draggedItem = null;

    // --- 함수 ---

    // 아이템 목록 렌더링
    function renderItems() {
        const db = (currentItemType === 'artifacts') ? artifactDB : slateDB;
        const rarityValue = rarityFilter.value;
        const searchValue = nameSearch.value.toLowerCase();
        
        itemList.innerHTML = '';
        db.filter(item => {
            const rarityMatch = rarityValue === 'all' || item.rarity === rarityValue;
            const nameMatch = item.name.toLowerCase().includes(searchValue);
            return rarityMatch && nameMatch;
        }).forEach(item => {
            const settings = userItemSettings[item.id] || { priority: 1.0, upgrade: 0 };
            const count = ownedItems[item.id] || 0;
            
            const card = document.createElement('div');
            card.className = 'item-card';
            if (count === 0) card.classList.add('disabled');
            card.draggable = count > 0;
            card.dataset.itemId = item.id;

            card.innerHTML = `
                <img src="image/${item.icon}" alt="${item.name}">
                <p class="rarity-${item.rarity}">${item.name}</p>
                <div class="stack-display">${count}</div>
                <div class="item-controls-overlay">
                    <div class="control-wrap">
                        <span>보유:</span>
                        <div>
                            <button class="control-btn stack-btn" data-change="-1">-</button>
                            <button class="control-btn stack-btn" data-change="1">+</button>
                        </div>
                    </div>
                    ${currentItemType === 'artifacts' ? `
                    <div class="control-wrap">
                        <span>강화:</span>
                        <div>
                            <button class="control-btn enchant-btn" data-change="-1">-</button>
                            <span class="enchant-value">${settings.upgrade}</span>
                            <button class="control-btn enchant-btn" data-change="1">+</button>
                        </div>
                    </div>
                    <div class="control-wrap">
                        <span>중요도:</span>
                        <div>
                            <button class="control-btn priority-btn" data-change="-0.1">▼</button>
                            <span class="priority-value">${settings.priority.toFixed(1)}</span>
                            <button class="control-btn priority-btn" data-change="0.1">▲</button>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            itemList.appendChild(card);
        });
    }

    // 인벤토리 슬롯 생성 및 업데이트
    function updateSlots(count) {
        slotCountLabel.textContent = count;
        const oldState = [...inventoryState];
        inventoryState = new Array(count).fill(null);
        
        inventoryGrid.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotId = i;
            if (oldState[i]) {
                inventoryState[i] = oldState[i];
                const dbItem = artifactDB.find(d => d.id === oldState[i].id) || slateDB.find(d => d.id === oldState[i].id);
                slot.innerHTML = `<img src="image/${dbItem.icon}" alt="${dbItem.name}">`;
                if (oldState[i].upgrade > 0) {
                     slot.innerHTML += `<div class="enchant-display">+${oldState[i].upgrade}</div>`;
                }
            }
            inventoryGrid.appendChild(slot);
        }
        updateSelectedItems();
    }

    // 선택된 아이템 목록 UI 업데이트
    function updateSelectedItems() {
        selectedItemsList.innerHTML = '';
        inventoryState.forEach(item => {
            if (item) {
                const dbItem = artifactDB.find(d => d.id === item.id) || slateDB.find(d => d.id === item.id);
                const elem = document.createElement('div');
                elem.className = 'selected-item';
                elem.innerHTML = `<img src="image/${dbItem.icon}" alt="${dbItem.name}"> <span class="rarity-${dbItem.rarity}">${dbItem.name} ${item.upgrade > 0 ? `+${item.upgrade}`:''}</span>`;
                selectedItemsList.appendChild(elem);
            }
        });
    }
    
    // --- 이벤트 리스너 ---

    // 탭, 필터, 검색
    typeTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            typeTabs.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentItemType = e.target.dataset.type;
            renderItems();
        }
    });
    rarityFilter.addEventListener('change', renderItems);
    nameSearch.addEventListener('input', renderItems);
    
    // 인벤토리 크기 조절
    document.getElementById('slot-increase-btn').addEventListener('click', () => updateSlots(Math.min(60, inventoryState.length + 1)));
    document.getElementById('slot-decrease-btn').addEventListener('click', () => updateSlots(Math.max(6, inventoryState.length - 1)));

    // 아이템 컨트롤 (보유, 강화, 중요도)
    itemList.addEventListener('click', (e) => {
        const target = e.target;
        if (!target.classList.contains('control-btn')) return;

        const card = target.closest('.item-card');
        const itemId = card.dataset.itemId;

        if (!userItemSettings[itemId]) userItemSettings[itemId] = { priority: 1.0, upgrade: 0 };
        const settings = userItemSettings[itemId];
        const change = parseFloat(target.dataset.change);

        if (target.classList.contains('stack-btn')) {
            ownedItems[itemId] = Math.max(0, (ownedItems[itemId] || 0) + change);
        } else if (target.classList.contains('enchant-btn')) {
            const itemData = artifactDB.find(a => a.id === itemId);
            settings.upgrade = Math.max(0, Math.min(itemData.maxUpgrade, settings.upgrade + change));
        } else if (target.classList.contains('priority-btn')) {
            settings.priority = Math.max(0.1, parseFloat((settings.priority + change).toFixed(1)));
        }
        renderItems();
    });

    // 드래그 앤 드롭
    itemList.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.item-card');
        if (card && !card.classList.contains('disabled')) {
            draggedItem = { id: card.dataset.itemId, type: currentItemType };
            e.dataTransfer.effectAllowed = 'copy';
        } else {
            e.preventDefault();
        }
    });

    inventoryGrid.addEventListener('dragover', (e) => e.preventDefault());
    inventoryGrid.addEventListener('drop', (e) => {
        e.preventDefault();
        const slot = e.target.closest('.inventory-slot');
        if (draggedItem && slot) {
            const slotId = parseInt(slot.dataset.slotId);
            const itemId = draggedItem.id;

            // 이미 아이템이 있다면 원래 소유량으로 되돌림
            if (inventoryState[slotId]) {
                 ownedItems[inventoryState[slotId].id]++;
            }

            ownedItems[itemId]--;
            inventoryState[slotId] = { id: itemId, ...(userItemSettings[itemId] || { priority: 1.0, upgrade: 0 }) };
            
            const dbItem = (draggedItem.type === 'artifacts' ? artifactDB : slateDB).find(i => i.id === itemId);
            slot.innerHTML = `<img src="image/${dbItem.icon}" alt="${dbItem.name}">`;
            if (draggedItem.type === 'artifacts' && inventoryState[slotId].upgrade > 0) {
                 slot.innerHTML += `<div class="enchant-display">+${inventoryState[slotId].upgrade}</div>`;
            }
            
            updateSelectedItems();
            renderItems();
        }
    });

    // 인벤토리 아이템 제거 (클릭)
    inventoryGrid.addEventListener('click', (e) => {
        const slot = e.target.closest('.inventory-slot');
        if (slot && inventoryState[slot.dataset.slotId]) {
            const slotId = parseInt(slot.dataset.slotId);
            const itemId = inventoryState[slotId].id;
            
            ownedItems[itemId] = (ownedItems[itemId] || 0) + 1;
            inventoryState[slotId] = null;

            slot.innerHTML = '';
            
            updateSelectedItems();
            renderItems();
        }
    });
    
    // 초기화 버튼
    document.getElementById('clear-btn').addEventListener('click', () => {
        ownedItems = {};
        userItemSettings = {};
        updateSlots(30);
    });

    // 최적 배치 버튼
    document.getElementById('optimize-btn').addEventListener('click', () => {
        const itemsForApi = inventoryState.filter(item => item !== null);
        if (itemsForApi.length === 0) {
            alert("인벤토리에 아이템을 먼저 배치해주세요.");
            return;
        }
        console.log("백엔드로 전송될 데이터:", JSON.stringify(itemsForApi, null, 2));
        alert("최적 배치 요청! 콘솔(F12)에서 전송될 데이터를 확인하세요.");
        // 이곳에 fetch()를 사용하여 Python 백엔드 API로 데이터를 전송하는 코드를 추가합니다.
    });

    // --- 초기 실행 ---
    updateSlots(30);
    renderItems();

});
