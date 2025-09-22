document.addEventListener('DOMContentLoaded', async () => {
    // --- 데이터 로딩 및 변수 선언 (이전과 동일) ---
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

    const itemList = document.getElementById('item-list');
    const inventoryGrid = document.getElementById('inventory-grid');
    const selectedSlatesList = document.getElementById('selected-slates-list');
    const selectedArtifactsList = document.getElementById('selected-artifacts-list');
    const slotCountLabel = document.getElementById('slot-count-label');
    const typeTabs = document.getElementById('type-tabs');
    const rarityFilter = document.getElementById('rarity-filter');
    const nameSearch = document.getElementById('name-search');

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
    
    // 개별 슬롯 UI 렌더링 (뱃지, 회전 포함)
    function renderSlot(slotElement, itemState) {
        // ... (이전과 동일) ...
    }

    // 선택된 아이템 목록 UI 업데이트
    function updateSelectedItems() {
        // ... (이전과 동일) ...
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

    // ★★★ 아이템 목록 클릭/우클릭 이벤트 (수정된 최종 로직) ★★★
    // 보유량 추가(좌클릭) 및 자동 배치
    itemList.addEventListener('click', (e) => {
        const card = e.target.closest('.item-card');
        if (!card) return;
        
        const itemId = card.dataset.itemId;
        
        // 보유량 1 증가
        ownedItems[itemId] = (ownedItems[itemId] || 0) + 1;
        
        // 빈 슬롯 찾아 자동 배치
        const emptySlotIndex = inventoryState.findIndex(slot => slot === null);
        if (emptySlotIndex !== -1) {
            ownedItems[itemId]--; // 배치했으므로 보유량 다시 차감
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
        
        renderItems(); // 보유량 표시 업데이트
    });

    // 보유량 감소(우클릭)
    itemList.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const card = e.target.closest('.item-card');
        if (!card) return;

        const itemId = card.dataset.itemId;
        ownedItems[itemId] = Math.max(0, (ownedItems[itemId] || 0) - 1);
        renderItems();
    });
    
    // 인벤토리 아이템 제거 (우클릭)
    inventoryGrid.addEventListener('contextmenu', (e) => {
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

    // 인벤토리 석판 회전 (좌클릭)
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
    
    // 선택된 아티팩트 목록 컨트롤 (이전과 동일)
    selectedArtifactsList.addEventListener('click', (e) => {
        // ...
    });
    
    // 초기화 및 최적배치 버튼 (이전과 동일)
    document.getElementById('clear-btn').addEventListener('click', () => {
        ownedItems = {};
        updateSlots(30);
    });

    document.getElementById('optimize-btn').addEventListener('click', async () => {
        // ...
    });

    // --- 초기 실행 ---
    updateSlots(30);
    renderItems();
});