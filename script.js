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
        alert("데이터 파일을 불러오는 데 실패했습니다. 파일 경로를 확인해주세요.");
        return;
    }

    // --- DOM 요소 ---
    const itemList = document.getElementById('item-list');
    const inventoryGrid = document.getElementById('inventory-grid');
    const selectedSlatesList = document.getElementById('selected-slates-list');
    const selectedArtifactsList = document.getElementById('selected-artifacts-list');
    const slotCountLabel = document.getElementById('slot-count-label');
    const typeTabs = document.getElementById('type-tabs');
    const rarityFilter = document.getElementById('rarity-filter');
    const nameSearch = document.getElementById('name-search');

    // --- 상태 관리 변수 ---
    let inventoryState = [];
    let ownedItems = {};
    let currentItemType = 'artifacts';
    let draggedItem = null;
    let nextUniqueId = 0;

    // --- 함수 정의 ---

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
            const count = ownedItems[item.id] || 0;
            
            const card = document.createElement('div');
            card.className = 'item-card';
            if (count === 0) card.classList.add('disabled');
            card.draggable = count > 0;
            card.dataset.itemId = item.id;

            card.innerHTML = `
                <img src="images/${item.icon}" alt="${item.name}">
                <p class="rarity-${item.rarity}">${item.name}</p>
                <div class="stack-display">${count}</div>
                <div class="item-controls-overlay">
                    <div class="control-wrap-stack">
                        <button class="control-btn stack-btn" data-change="-1">-</button>
                        <span>보유</span>
                        <button class="control-btn stack-btn" data-change="1">+</button>
                    </div>
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
                slot.dataset.itemId = oldState[i].id;
                slot.innerHTML = `<img src="images/${dbItem.icon}" alt="${dbItem.name}">`;
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
        selectedSlatesList.innerHTML = '';
        selectedArtifactsList.innerHTML = '';

        inventoryState.forEach((itemState, index) => {
            if (!itemState) return;

            const isArtifact = !!artifactDB.find(d => d.id === itemState.id);

            if (!isArtifact) {
                const dbItem = slateDB.find(d => d.id === itemState.id);
                const icon = document.createElement('img');
                icon.src = `images/${dbItem.icon}`;
                icon.alt = dbItem.name;
                selectedSlatesList.appendChild(icon);
            } else {
                const dbItem = artifactDB.find(d => d.id === itemState.id);
                const card = document.createElement('div');
                card.className = 'selected-item-card';
                card.dataset.inventoryIndex = index;

                card.innerHTML = `
                    <img src="images/${dbItem.icon}" alt="${dbItem.name}">
                    <div class="item-info">
                        <p class="rarity-${dbItem.rarity}">${dbItem.name}</p>
                        <div class="item-controls-group">
                            <div class="item-controls">
                                <span>강화:</span>
                                <button class="control-btn enchant-btn" data-change="-1">-</button>
                                <span>${itemState.upgrade}</span>
                                <button class="control-btn enchant-btn" data-change="1">+</button>
                            </div>
                            <div class="item-controls">
                                <span>중요도:</span>
                                <button class="control-btn priority-btn" data-change="-1">-</button>
                                <span>${itemState.priority}</span>
                                <button class="control-btn priority-btn" data-change="1">+</button>
                            </div>
                        </div>
                    </div>
                `;
                selectedArtifactsList.appendChild(card);
            }
        });
    }
    
    // --- 이벤트 리스너 ---

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
    
    document.getElementById('slot-increase-btn').addEventListener('click', () => updateSlots(Math.min(60, inventoryState.length + 1)));
    document.getElementById('slot-decrease-btn').addEventListener('click', () => updateSlots(Math.max(6, inventoryState.length - 1)));

    itemList.addEventListener('click', (e) => {
        if (e.target.classList.contains('stack-btn')) {
            const card = e.target.closest('.item-card');
            const itemId = card.dataset.itemId;
            const change = parseInt(e.target.dataset.change);
            ownedItems[itemId] = Math.max(0, (ownedItems[itemId] || 0) + change);
            renderItems();
        }
    });

    itemList.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.item-card');
        if (card && !card.classList.contains('disabled')) {
            draggedItem = { id: card.dataset.itemId };
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

            if (inventoryState[slotId]) {
                 ownedItems[inventoryState[slotId].id]++;
            }

            ownedItems[itemId]--;
            inventoryState[slotId] = { id: itemId, uniqueId: nextUniqueId++, priority: 1, upgrade: 0 };
            
            const dbItem = artifactDB.find(i => i.id === itemId) || slateDB.find(i => i.id === itemId);
            slot.innerHTML = `<img src="images/${dbItem.icon}" alt="${dbItem.name}">`;
            slot.dataset.itemId = itemId;
            
            updateSelectedItems();
            renderItems();
        }
    });

    inventoryGrid.addEventListener('click', (e) => {
        const slot = e.target.closest('.inventory-slot');
        if (slot && inventoryState[slot.dataset.slotId]) {
            const slotId = parseInt(slot.dataset.slotId);
            const itemId = inventoryState[slotId].id;
            
            ownedItems[itemId] = (ownedItems[itemId] || 0) + 1;
            inventoryState[slotId] = null;

            slot.innerHTML = '';
            delete slot.dataset.itemId;
            
            updateSelectedItems();
            renderItems();
        }
    });

    selectedArtifactsList.addEventListener('click', (e) => {
        const target = e.target;
        if (!target.classList.contains('control-btn')) return;

        const card = target.closest('.selected-item-card');
        const inventoryIndex = parseInt(card.dataset.inventoryIndex);
        const itemState = inventoryState[inventoryIndex];
        const dbItem = artifactDB.find(a => a.id === itemState.id);
        const change = parseInt(target.dataset.change);

        if (target.classList.contains('enchant-btn')) {
            itemState.upgrade = Math.max(0, Math.min(dbItem.maxUpgrade, itemState.upgrade + change));
        } else if (target.classList.contains('priority-btn')) {
            itemState.priority = Math.min(10, Math.max(1, itemState.priority + change));
        }
        
        const slot = inventoryGrid.querySelector(`[data-slot-id='${inventoryIndex}']`);
        const enchantDisplay = slot.querySelector('.enchant-display');
        if (enchantDisplay) enchantDisplay.remove();
        if (itemState.upgrade > 0) {
            slot.innerHTML += `<div class="enchant-display">+${itemState.upgrade}</div>`;
        }
        
        updateSelectedItems();
    });
    
    document.getElementById('clear-btn').addEventListener('click', () => {
        ownedItems = {};
        updateSlots(30);
    });

    document.getElementById('optimize-btn').addEventListener('click', () => {
        const itemsForApi = inventoryState.filter(item => item !== null);
        if (itemsForApi.length === 0) {
            alert("인벤토리에 아이템을 먼저 배치해주세요.");
            return;
        }
        console.log("백엔드로 전송될 데이터:", JSON.stringify(itemsForApi, null, 2));
        alert("최적 배치 요청! 콘솔(F12)에서 전송될 데이터를 확인하세요.");
    });

    // --- 초기 실행 ---
    updateSlots(30);
    renderItems();
});