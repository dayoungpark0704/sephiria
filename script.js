document.addEventListener('DOMContentLoaded', async () => {
    // DB 로딩
    let artifactDB, slateDB;
    try {
        const artifactResponse = await fetch('artifacts.json');
        artifactDB = await artifactResponse.json();
        const slateResponse = await fetch('slates.json');
        slateDB = await slateResponse.json();
    } catch (error) {
        console.error("데이터 파일을 불러오는 데 실패했습니다:", error);
        return;
    }

    const itemList = document.getElementById('item-list');
    const inventoryGrid = document.getElementById('inventory-grid');

    // 1. 아이템 목록 생성 함수 (희귀도 클래스 추가)
    function renderItems(type) {
        itemList.innerHTML = '';
        const db = (type === 'artifacts') ? artifactDB : slateDB;

        db.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.draggable = true;
            card.dataset.itemId = item.id;

            const img = document.createElement('img');
            img.src = `images/${item.icon}`;
            
            const name = document.createElement('p');
            name.textContent = item.name;
            // ★★★ 희귀도에 따라 이름에 색상 클래스 적용 ★★★
            if (item.rarity) {
                name.classList.add(`rarity-${item.rarity}`);
            }

            // 아티팩트인 경우에만 중요도 설정 UI 추가
            if (type === 'artifacts') {
                const priorityControl = document.createElement('div');
                priorityControl.className = 'priority-overlay';
                priorityControl.innerHTML = `
                    <button class="priority-btn" data-change="-0.1">▼</button>
                    <span class="priority-value">1.0</span>
                    <button class="priority-btn" data-change="0.1">▲</button>
                `;
                card.appendChild(priorityControl);
            }

            card.appendChild(img);
            card.appendChild(name);
            itemList.appendChild(card);
        });
    }

    // 2. 인벤토리 슬롯 생성 및 드래그 앤 드롭 로직 (이전과 동일)
    function createSlots(count) {
        inventoryGrid.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotId = i;
            // 드롭 이벤트 리스너 추가
            slot.addEventListener('dragover', e => e.preventDefault());
            slot.addEventListener('drop', handleDrop);
            inventoryGrid.appendChild(slot);
        }
    }

    let draggedItemId = null;
    itemList.addEventListener('dragstart', e => {
        if (e.target.classList.contains('item-card')) {
            draggedItemId = e.target.dataset.itemId;
        }
    });

    function handleDrop(e) {
        e.preventDefault();
        if (draggedItemId) {
            const targetSlot = e.target.closest('.inventory-slot');
            // 아이템 복제하여 인벤토리에 추가
            const originalItemCard = itemList.querySelector(`[data-item-id='${draggedItemId}']`);
            targetSlot.innerHTML = originalItemCard.innerHTML;
            targetSlot.querySelector('.priority-overlay')?.remove(); // 인벤토리 안에서는 중요도 UI 제거
        }
    }

    // 3. 중요도 변경 로직 (이전과 동일)
    itemList.addEventListener('click', (e) => {
        if (e.target.classList.contains('priority-btn')) {
            const card = e.target.closest('.item-card');
            const valueSpan = card.querySelector('.priority-value');
            let currentValue = parseFloat(valueSpan.textContent);
            const change = parseFloat(e.target.dataset.change);
            
            currentValue = Math.max(0.1, currentValue + change);
            valueSpan.textContent = currentValue.toFixed(1);

            const artifactId = card.dataset.itemId;
            const artifact = artifactDB.find(a => a.id === artifactId);
            if(artifact) {
                artifact.priority = currentValue;
            }
        }
    });

    // 4. '최적 배치' 버튼 클릭 이벤트 (이전과 동일)
    document.getElementById('optimize-button').addEventListener('click', () => {
        console.log("최적 배치 요청. 현재 아티팩트 DB:", artifactDB);
        // 백엔드 API와 통신하는 로직
    });
    
    // 5. 탭, 필터 등 나머지 UI 컨트롤 로직 (이전과 동일)
    // ...

    // 초기화
    createSlots(30);
    renderItems('slates'); // 기본으로 석판 목록 표시
});