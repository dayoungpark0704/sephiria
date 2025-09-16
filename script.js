document.addEventListener('DOMContentLoaded', async () => {
    // --- 데이터 로딩 ---
    let artifactDB = [];
    let slateDB = [];
    // 사용자 정의 가중치 및 강화 상태를 저장할 맵
    let userArtifactSettings = {}; 

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

    // --- DOM 요소 가져오기 ---
    const itemList = document.getElementById('item-list');
    const inventoryGrid = document.getElementById('inventory-grid');
    const selectedItemsList = document.getElementById('selected-items-list');
    const slotCountSpan = document.getElementById('slot-count');
    
    // --- 상태 변수 ---
    let inventoryState = [];
    let ownedItems = {};
    let currentItemType = 'slates'; // 'slates' 또는 'artifacts'

    // --- 함수 정의 ---

    // 1. 아이템 목록 렌더링
    function renderItems() {
        const db = (currentItemType === 'artifacts') ? artifactDB : slateDB;
        const rarityFilter = document.getElementById('rarity-filter').value;
        const nameSearch = document.getElementById('name-search').value.toLowerCase();

        itemList.innerHTML = '';
        db.filter(item => {
            const rarityMatch = rarityFilter === 'all' || item.rarity === rarityFilter;
            const nameMatch = item.name.toLowerCase().includes(nameSearch);
            return rarityMatch && nameMatch;
        }).forEach(item => {
            const settings = userArtifactSettings[item.id] || { priority: 1.0, upgrade: 0 };
            
            const card = document.createElement('div');
            card.className = 'item-card';
            card.draggable = true;
            card.dataset.itemId = item.id;

            // 아이템 이미지
            const img = document.createElement('img');
            img.src = `images/${item.icon}`;
            img.alt = item.name;

            // 아이템 이름 (희귀도 색상 적용)
            const name = document.createElement('p');
            name.textContent = item.name;
            if (item.rarity) name.classList.add(`rarity-${item.rarity}`);

            // 보유 개수 표시
            const stackDisplay = document.createElement('div');
            stackDisplay.className = 'stack-display';
            stackDisplay.textContent = ownedItems[item.id] || 0;
            
            // 컨트롤 오버레이
            const controlsOverlay = document.createElement('div');
            controlsOverlay.className = 'item-controls-overlay';

            // 컨트롤: 보유 개수
            const stackWrap = document.createElement('div');
            stackWrap.className = 'control-wrap';
            stackWrap.innerHTML = `
                <span>보유:</span>
                <div>
                    <button class="control-btn stack-btn" data-change="-1">-</button>
                    <button class="control-btn stack-btn" data-change="1">+</button>
                </div>
            `;
            controlsOverlay.appendChild(stackWrap);

            // 컨트롤: 강화 (아티팩트 전용)
            if (currentItemType === 'artifacts') {
                const enchantWrap = document.createElement('div');
                enchantWrap.className = 'control-wrap';
                enchantWrap.innerHTML = `
                    <span>강화:</span>
                    <div>
                        <button class="control-btn enchant-btn" data-change="-1">-</button>
                        <span class="enchant-value">${settings.upgrade}</span>
                        <button class="control-btn enchant-btn" data-change="1">+</button>
                    </div>
                `;
                controlsOverlay.appendChild(enchantWrap);
            
                // 컨트롤: 중요도 (아티팩트 전용)
                const priorityWrap = document.createElement('div');
                priorityWrap.className = 'control-wrap';
                priorityWrap.innerHTML = `
                    <span>중요도:</span>
                    <div>
                        <button class="control-btn priority-btn" data-change="-0.1">▼</button>
                        <span class="priority-value">${settings.priority.toFixed(1)}</span>
                        <button class="control-btn priority-btn" data-change="0.1">▲</button>
                    </div>
                `;
                controlsOverlay.appendChild(priorityWrap);
            }

            card.append(img, name, stackDisplay, controlsOverlay);
            itemList.appendChild(card);
        });
    }

    // 2. 인벤토리 슬롯 생성/관리
    function updateSlots(count) {
        slotCountSpan.textContent = count;
        inventoryState = new Array(count).fill(null);
        inventoryGrid.innerHTML = '';
        inventoryGrid.style.gridTemplateColumns = `repeat(${Math.min(count, 5)}, 1fr)`;

        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotId = i;
            inventoryGrid.appendChild(slot);
        }
    }

    // 3. 선택된 아이템 목록 업데이트
    function updateSelectedItems() {
        selectedItemsList.innerHTML = '';
        inventoryState.forEach(item => {
            if (item) {
                const dbItem = artifactDB.find(d => d.id === item.id) || slateDB.find(d => d.id === item.id);
                const elem = document.createElement('div');
                elem.className = 'selected-item';
                elem.innerHTML = `<img src="images/${dbItem.icon}" alt="${dbItem.name}"> <span>${dbItem.name}</span>`;
                selectedItemsList.appendChild(elem);
            }
        });
    }

    // --- 이벤트 리스너 설정 ---

    // 탭 전환
    document.querySelector('.tabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentItemType = e.target.dataset.type;
            renderItems();
        }
    });

    // 필터 및 검색
    document.getElementById('rarity-filter').addEventListener('change', renderItems);
    document.getElementById('name-search').addEventListener('input', renderItems);

    // 인벤토리 크기 조절
    document.getElementById('slot-increase').addEventListener('click', () => updateSlots(Math.min(50, inventoryState.length + 5)));
    document.getElementById('slot-decrease').addEventListener('click', () => updateSlots(Math.max(5, inventoryState.length - 5)));

    // 컨트롤 오버레이 버튼 이벤트 (이벤트 위임)
    itemList.addEventListener('click', (e) => {
        const target = e.target;
        if (!target.classList.contains('control-btn')) return;

        const card = target.closest('.item-card');
        const itemId = card.dataset.itemId;

        if (!userArtifactSettings[itemId]) {
            userArtifactSettings[itemId] = { priority: 1.0, upgrade: 0 };
        }
        const settings = userArtifactSettings[itemId];

        // 보유 개수
        if (target.classList.contains('stack-btn')) {
            const count = ownedItems[itemId] || 0;
            ownedItems[itemId] = Math.max(0, count + parseInt(target.dataset.change));
        }
        // 강화
        else if (target.classList.contains('enchant-btn')) {
            const itemData = artifactDB.find(a => a.id === itemId);
            settings.upgrade = Math.max(0, Math.min(itemData.maxUpgrade, settings.upgrade + parseInt(target.dataset.change)));
        }
        // 중요도
        else if (target.classList.contains('priority-btn')) {
            settings.priority = Math.max(0.1, settings.priority + parseFloat(target.dataset.change));
        }
        
        renderItems(); // 변경사항 반영하여 다시 렌더링
    });

    // 드래그 앤 드롭
    let draggedItem = null;
    itemList.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.item-card');
        if (card && (ownedItems[card.dataset.itemId] || 0) > 0) {
            draggedItem = {
                id: card.dataset.itemId,
                type: currentItemType
            };
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
            
            // 데이터 업데이트
            ownedItems[itemId]--;
            inventoryState[slotId] = {
                id: itemId,
                ...(userArtifactSettings[itemId] || { priority: 1.0, upgrade: 0 })
            };

            // UI 업데이트
            const dbItem = (draggedItem.type === 'artifacts' ? artifactDB : slateDB).find(i => i.id === itemId);
            slot.innerHTML = `<img src="images/${dbItem.icon}" alt="${dbItem.name}">`;
            if (draggedItem.type === 'artifacts' && inventoryState[slotId].upgrade > 0) {
                slot.innerHTML += `<div class="enchant-display">+${inventoryState[slotId].upgrade}</div>`;
            }
            slot.dataset.itemId = itemId; // 슬롯에 아이템 ID 저장
            
            updateSelectedItems();
            renderItems();
        }
    });
    
    // 인벤토리에서 아이템 제거
    inventoryGrid.addEventListener('click', (e) => {
        const slot = e.target.closest('.inventory-slot');
        if (slot && slot.dataset.itemId) {
            const slotId = parseInt(slot.dataset.slotId);
            const itemId = inventoryState[slotId].id;

            ownedItems[itemId]++;
            inventoryState[slotId] = null;

            slot.innerHTML = '';
            delete slot.dataset.itemId;
            
            updateSelectedItems();
            renderItems();
        }
    });

    // 초기화 버튼
    document.getElementById('clear-button').addEventListener('click', () => {
        ownedItems = {};
        userArtifactSettings = {};
        updateSlots(30);
        updateSelectedItems();
        renderItems();
    });

    // 최적 배치 버튼
    document.getElementById('optimize-button').addEventListener('click', () => {
        const itemsForApi = inventoryState.filter(item => item !== null);
        console.log("API로 전송할 데이터:", itemsForApi);
        alert("최적 배치 요청!\n콘솔(F12)에서 전송될 데이터를 확인하세요.");
        // 여기에 백엔드 API와 통신하는 fetch() 코드를 추가하면 됩니다.
    });

    // --- 초기 실행 ---
    updateSlots(30);
    renderItems();
});