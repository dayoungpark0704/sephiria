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
            card.dataset.itemId = item.id;
            card.innerHTML = `
                <img src="images/${item.icon}" alt="${item.name}">
                <p class="rarity-${item.rarity}">${item.name}</p>
                <div class="stack-display">${count}</div>
            `;
            itemList.appendChild(card);
        });
    }

    // 인벤토리 슬롯 생성 및 업데이트
    function updateSlots(count) {
        const oldState = [...inventoryState];
        const oldCount = oldState.length;

        if (count < oldCount) {
            for (let i = count; i < oldCount; i++) {
                if (oldState[i]) {
                    const itemId = oldState[i].id;
                    ownedItems[itemId] = (ownedItems[itemId] || 0) + 1;
                }
            }
        }

        slotCountLabel.textContent = count;
        inventoryState = new Array(count).fill(null);
        inventoryGrid.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotId = i;
            if (oldState[i]) {
                inventoryState[i] = oldState[i];
                renderSlot(slot, oldState[i]);
            }
            inventoryGrid.appendChild(slot);
        }
        updateSelectedItems();
        renderItems();
    }
    
    // 개별 슬롯 UI 렌더링
    function renderSlot(slotElement, itemState) {
        if (!itemState) {
            slotElement.innerHTML = '';
            delete slotElement.dataset.itemId;
            return;
        }
        const dbItem = artifactDB.find(d => d.id === itemState.id) || slateDB.find(d => d.id === itemState.id);
        slotElement.dataset.itemId = itemState.id;
        
        let badgeHTML = '';
        if (dbItem.rarity) {
            badgeHTML = `<div class="item-badge badge-artifact">${itemState.upgrade}/${dbItem.maxUpgrade}</div>`;
        } else {
            const slate = slateDB.find(s => s.id === itemState.id);
            let totalBoost = 0;
            const buffcoords = slate.rotatable ? slate.buffcoords[itemState.rotation] : slate.buffcoords;
            if (buffcoords) {
                buffcoords.forEach(coord => {
                    if (coord[2] > 0) totalBoost += coord[2];
                });
            }
            if (totalBoost > 0) badgeHTML = `<div class="item-badge badge-slate">+${totalBoost}</div>`;
        }
        slotElement.innerHTML = `<img src="images/${dbItem.icon}" alt="${dbItem.name}" style="transform: rotate(${itemState.rotation || 0}deg);"> ${badgeHTML}`;
    }

    // 선택된 아이템 목록 UI 업데이트
    function updateSelectedItems() {
        selectedSlatesList.innerHTML = '';
        selectedArtifactsList.innerHTML = '';

        inventoryState.forEach((itemState, index) => {
            if (!itemState) return;
            const dbItem = artifactDB.find(d => d.id === itemState.id) || slateDB.find(d => d.id === itemState.id);
            const isArtifact = !!dbItem.rarity;

            if (!isArtifact) {
                const icon = document.createElement('img');
                icon.src = `images/${dbItem.icon}`;
                icon.alt = dbItem.name;
                selectedSlatesList.appendChild(icon);
            } else {
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
                    </div>`;
                selectedArtifactsList.appendChild(card);
            }
        });
    }
    
    // --- 이벤트 리스너 ---

    typeTabs.addEventListener('click', e => {
        if (e.target.classList.contains('tab-button')) {
            typeTabs.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentItemType = e.target.dataset.type;
            renderItems();
        }
    });
    rarityFilter.addEventListener('change', renderItems);
    nameSearch.addEventListener('input', renderItems);
    
    document.getElementById('slot-increase-btn').addEventListener('click', () => updateSlots(inventoryState.length + 1));
    document.getElementById('slot-decrease-btn').addEventListener('click', () => updateSlots(inventoryState.length - 1));

    // 아이템 목록에서 좌클릭: 보유량 1 증가 및 자동 배치
    itemList.addEventListener('click', e => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        
        const itemId = card.dataset.itemId;
        ownedItems[itemId] = (ownedItems[itemId] || 0) + 1;
        
        const emptySlotIndex = inventoryState.findIndex(slot => slot === null);
        if (emptySlotIndex !== -1) {
            ownedItems[itemId]--;
            inventoryState[emptySlotIndex] = {
                id: itemId,
                uniqueId: nextUniqueId++,
                priority: 1,
                upgrade: 0,
                rotation: 0
            };
            const slotElement = inventoryGrid.querySelector(`[data-slot-id='${emptySlotIndex}']`);
            renderSlot(slotElement, inventoryState[emptySlotIndex]);
            updateSelectedItems();
        }
        renderItems();
    });

    // 아이템 목록에서 우클릭: 보유량 1 감소
    itemList.addEventListener('contextmenu', e => {
        e.preventDefault();
        const card = e.target.closest('.item-card');
        if (!card) return;
        const itemId = card.dataset.itemId;
        ownedItems[itemId] = Math.max(0, (ownedItems[itemId] || 0) - 1);
        renderItems();
    });
    
    // 인벤토리에서 우클릭: 아이템 제거
    inventoryGrid.addEventListener('contextmenu', e => {
        e.preventDefault();
        const slot = e.target.closest('.inventory-slot');
        if (slot && inventoryState[slot.dataset.slotId]) {
            const slotId = parseInt(slot.dataset.slotId);
            const itemId = inventoryState[slotId].id;
            
            ownedItems[itemId] = (ownedItems[itemId] || 0) + 1;
            inventoryState[slotId] = null;

            renderSlot(slot, null);
            updateSelectedItems();
            renderItems();
        }
    });

    // 인벤토리에서 좌클릭: 석판 회전
    inventoryGrid.addEventListener('click', e => {
        const slot = e.target.closest('.inventory-slot');
        if (slot && inventoryState[slot.dataset.slotId]) {
            const slotId = parseInt(slot.dataset.slotId);
            const itemState = inventoryState[slotId];
            const dbItem = slateDB.find(s => s.id === itemState.id);

            if (dbItem && dbItem.rotatable) {
                const rotations = [0, 90, 180, 270];
                const currentIndex = rotations.indexOf(itemState.rotation);
                itemState.rotation = rotations[(currentIndex + 1) % 4];
                renderSlot(slot, itemState);
            }
        }
    });
    
    // 선택된 아티팩트 목록에서 강화/중요도 조절
    selectedArtifactsList.addEventListener('click', e => {
        const target = e.target;
        if (!target.classList.contains('control-btn')) return;

        const card = target.closest('.selected-item-card');
        const inventoryIndex = parseInt(card.dataset.inventoryIndex);
        const itemState = inventoryState[inventoryIndex];
        const dbItem = artifactDB.find(a => a.id === itemState.id);
        
        if (target.classList.contains('enchant-btn')) {
            const change = parseInt(target.dataset.change);
            itemState.upgrade = Math.max(0, Math.min(dbItem.maxUpgrade, itemState.upgrade + change));
        } else if (target.classList.contains('priority-btn')) {
            const change = parseInt(target.dataset.change);
            itemState.priority = Math.min(10, Math.max(1, itemState.priority + change));
        }
        
        const slot = inventoryGrid.querySelector(`[data-slot-id='${inventoryIndex}']`);
        renderSlot(slot, itemState);
        updateSelectedItems();
    });
    
    // 초기화 및 최적배치 버튼
    document.getElementById('clear-btn').addEventListener('click', () => {
        ownedItems = {};
        updateSlots(30);
    });

    document.getElementById('optimize-btn').addEventListener('click', async () => {
        const itemsForApi = inventoryState.filter(item => item !== null);
        if (itemsForApi.length === 0) {
            alert("인벤토리에 아이템을 먼저 배치해주세요.");
            return;
        }
        
        try {
            const response = await fetch('http://127.0.0.1:5000/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: itemsForApi,
                    width: 6,
                    height: Math.ceil(inventoryState.length / 6)
                })
            });

            if (!response.ok) throw new Error(`서버 오류: ${response.status}`);
            
            const result = await response.json();
            const flatBoard = result.board.flat();
            
            updateSlots(flatBoard.length);
            inventoryState = flatBoard;
            
            inventoryState.forEach((item, index) => {
                const slot = inventoryGrid.querySelector(`[data-slot-id='${index}']`);
                if(slot) renderSlot(slot, item);
            });
            updateSelectedItems();

        } catch (error) {
            console.error("최적 배치 요청 실패:", error);
            alert("최적 배치에 실패했습니다. Python 백엔드 서버가 실행 중인지 확인해주세요.");
        }
    });

    // --- 초기 실행 ---
    updateSlots(30);
    renderItems();
});