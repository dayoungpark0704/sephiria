/** script.js **/

const baseSlots = 30;
const maxSlots = 39; // 6x6 그리드 + 3개 추가 슬롯
const grid = document.getElementById('main-grid');
const checkboxes = document.querySelectorAll('.option'); // 슬롯 설정 체크박스
const itemList = document.getElementById('item-list');
const tabArtifacts = document.getElementById('tab-artifacts');
const tabSlates = document.getElementById('tab-slates');
const selectedArtifactsEl = document.getElementById('selected-artifacts');
const selectedSlatesEl = document.getElementById('selected-slates');
const priorityList = document.getElementById('priority-list');
const autoArrangeBtn = document.getElementById('auto-arrange-btn'); // 자동 배치 버튼

// 검색 및 필터링 관련 DOM 요소
const itemSearchInput = document.getElementById('item-search');
const tagFiltersContainer = document.getElementById('tag-filters');

let artifacts = [];
let slates = [];
let selectedArtifacts = [];
let selectedSlates = [];
let currentGridItems = new Array(maxSlots).fill(null); // 그리드 슬롯의 현재 상태를 저장하는 배열

let currentActiveTab = 'artifacts'; // 현재 활성화된 탭 ('artifacts' 또는 'slates')
let allTags = new Set(); // 모든 아이템의 태그를 저장할 Set

// ==========================
// 슬롯 관련 함수
// ==========================

function createSlot(index) {
  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.dataset.index = index; // 슬롯 인덱스 추가

  // 드래그 앤 드롭 이벤트 리스너 추가
  slot.addEventListener('dragover', e => {
    e.preventDefault(); // 드롭 허용
    const draggingItem = document.querySelector('.selection-list .item.dragging');
    if (draggingItem && !slot.classList.contains('disabled')) { // 비활성화된 슬롯에는 드롭 불가
      slot.classList.add('drag-over');
    }
  });

  slot.addEventListener('dragleave', () => {
    slot.classList.remove('drag-over');
  });

  slot.addEventListener('drop', e => {
    e.preventDefault();
    slot.classList.remove('drag-over');

    if (slot.classList.contains('disabled')) return; // 비활성화된 슬롯에는 드롭 불가

    const itemId = e.dataTransfer.getData('itemId');
    const isArtifactStr = e.dataTransfer.getData('isArtifact');
    const isArtifact = isArtifactStr === 'true'; // 문자열을 boolean으로 변환

    let draggedItem;
    let sourceList;
    if (isArtifact) {
      draggedItem = selectedArtifacts.find(item => item.id === itemId);
      sourceList = selectedArtifacts;
    } else {
      draggedItem = selectedSlates.find(item => item.id === itemId);
      sourceList = selectedSlates;
    }

    if (draggedItem) {
      // 기존에 아이템이 있던 슬롯을 비움 (만약 있다면)
      const oldSlotIndex = currentGridItems.findIndex(item => item && item.id === draggedItem.id);
      if (oldSlotIndex !== -1) {
        currentGridItems[oldSlotIndex] = null;
        document.querySelector(`.slot[data-index="${oldSlotIndex}"]`).innerHTML = `<div class="name">빈 슬롯 ${oldSlotIndex + 1}</div>`;
      }

      // 새 슬롯에 아이템 배치 및 상태 업데이트
      const targetIndex = parseInt(slot.dataset.index);
      currentGridItems[targetIndex] = draggedItem;
      renderItemInSlot(slot, draggedItem);
    }
  });

  // 초기 빈 슬롯 텍스트
  slot.innerHTML = `<div class="name">빈 슬롯 ${index + 1}</div>`;
  return slot;
}

function renderItemInSlot(slotElement, item) {
    slotElement.innerHTML = `
        <div class="item-in-slot" data-item-id="${item.id}"> <img src="images/${item.icon}" alt="${item.name}" />
            <div class="item-name">${item.name}</div>
            <div class="item-level">★${item.level || 0}/${item.maxUpgrade}</div>
        </div>
    `;
}

function renderSlots(count) {
  grid.innerHTML = '';
  // currentGridItems 초기화 (새로운 슬롯 수에 맞춰)
  // 기존에 배치된 아이템은 유지되어야 하므로 완전히 비우지 않고, disabled 처리만
  const previousGridItems = [...currentGridItems]; // 현재 배치 상태 저장
  currentGridItems = new Array(maxSlots).fill(null); // 새 배열 생성

  for (let i = 0; i < maxSlots; i++) {
    const slot = createSlot(i);
    if (i >= count) {
        slot.classList.add('disabled');
    } else {
        // 이전 배치 상태에서 아이템이 있었다면 다시 그리기
        if (previousGridItems[i]) {
            currentGridItems[i] = previousGridItems[i]; // 새 배열에 아이템 복사
            renderItemInSlot(slot, previousGridItems[i]);
        }
    }
    grid.appendChild(slot);
  }
}

function calculateSlots() {
  let total = baseSlots;
  checkboxes.forEach(chk => {
    if (chk.checked) total += parseInt(chk.value);
  });
  return Math.max(0, Math.min(maxSlots, total));
}

// ==========================
// 아이템 목록 및 선택 관련 함수
// ==========================

function renderItemList(itemsToRender, isArtifact = true) { // itemsToRender로 이름 변경
  itemList.innerHTML = '';
  const currentSelectedList = isArtifact ? selectedArtifacts : selectedSlates;

  itemsToRender.forEach(item => { // 필터링된 아이템만 렌더링
    const div = document.createElement('div');
    div.className = 'item';
    // 선택된 아이템인 경우 'selected' 클래스 추가
    if (currentSelectedList.some(sItem => sItem.id === item.id)) {
      div.classList.add('selected');
    }
    div.innerHTML = `
      <img src="images/${item.icon}" alt="${item.name}" />
      <div>${item.name}</div>
    `;
    div.addEventListener('click', () => {
      // 아이템 목록에서 클릭 시 선택/해제 토글
      if (isArtifact) {
        toggleItemSelection(item, selectedArtifacts, selectedArtifactsEl, true);
      } else {
        toggleItemSelection(item, selectedSlates, selectedSlatesEl, false);
      }
      // 선택/해제 후 현재 탭의 아이템 목록을 다시 렌더링하여 'selected' 클래스를 업데이트
      applyFilterAndRenderList(); // 필터링 상태를 유지하며 다시 렌더링
      updatePriorityList();
    });
    itemList.appendChild(div);
  });
}

function toggleItemSelection(item, selectedList, container, isArtifact) {
  const foundIndex = selectedList.findIndex(i => i.id === item.id);
  if (foundIndex !== -1) {
    // 이미 선택된 아이템이면 제거
    selectedList.splice(foundIndex, 1);
  } else {
    // 선택되지 않은 아이템이면 추가
    selectedList.push({ ...item, level: 0 }); // level 초기값 설정
  }
  renderSelectedItems(selectedList, container, isArtifact);
}

function renderSelectedItems(list, container, isArtifact) {
  container.innerHTML = '';
  list.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item';
    div.draggable = true; // 선택된 아이템을 드래그 가능하게 설정
    div.dataset.itemId = item.id;
    div.dataset.isArtifact = isArtifact; // 아티팩트인지 석판인지 구분

    // 드래그 시작 이벤트
    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('itemId', item.id);
      e.dataTransfer.setData('isArtifact', isArtifact);
      e.currentTarget.classList.add('dragging');
    });

    // 드래그 종료 이벤트
    div.addEventListener('dragend', e => {
      e.currentTarget.classList.remove('dragging');
      // 드래그 드롭 후 그리드 상태를 다시 렌더링하여 비어있는 슬롯을 업데이트
      // (이 부분은 슬롯 드롭 이벤트에서 처리되므로 중복될 수 있음. 필요 시 제거)
      // renderSlots(calculateSlots()); // 이전에 있던 이 부분은 필요 없을 수 있음.
    });

    const tags = item.tags ? (Array.isArray(item.tags) ? item.tags.map(tag => `#${tag}`).join(' ') : `#${item.tags}`) : '';

    div.innerHTML = `
      <img src="images/${item.icon}" />
      <div style="flex: 1">
        <div><strong>${item.name}</strong></div>
        <div class="tags">${tags}</div>
      </div>
      <div class="controls">
        <button onclick="adjustLevel('${item.id}', ${isArtifact}, -1)">-</button>
        <span>${item.level || 0} / ${item.maxUpgrade}</span>
        <button onclick="adjustLevel('${item.id}', ${isArtifact}, 1)">+</button>
      </div>
      <button class="remove-btn" onclick="removeItemFromSelection('${item.id}', ${isArtifact})">x</button>
    `;
    container.appendChild(div);
  });
}

function adjustLevel(id, isArtifact, delta) {
  const list = isArtifact ? selectedArtifacts : selectedSlates;
  const item = list.find(i => i.id === id);
  if (!item) return;
  item.level = Math.max(0, Math.min(item.maxUpgrade, (item.level || 0) + delta));
  renderSelectedItems(list, isArtifact ? selectedArtifactsEl : selectedSlatesEl, isArtifact);

  // 슬롯에 배치된 아이템의 레벨이 변경될 경우 그리드를 다시 렌더링합니다.
  const slotElementInGrid = document.querySelector(`.slot .item-in-slot[data-item-id="${id}"]`);
  if (slotElementInGrid) { // 슬롯에 이미 배치된 아이템인 경우
      renderItemInSlot(slotElementInGrid.closest('.slot'), item);
  }
}

function removeItemFromSelection(id, isArtifact) {
    const list = isArtifact ? selectedArtifacts : selectedSlates;
    // 선택 목록에서 제거
    const updatedList = list.filter(item => item.id !== id);
    if (isArtifact) {
        selectedArtifacts = updatedList;
        renderSelectedItems(selectedArtifacts, selectedArtifactsEl, true);
    } else {
        selectedSlates = updatedList;
        renderSelectedItems(selectedSlates, selectedSlatesEl, false);
    }

    // 그리드에서 제거 (만약 배치되어 있었다면)
    const slotIndexToRemove = currentGridItems.findIndex(item => item && item.id === id);
    if (slotIndexToRemove !== -1) {
        currentGridItems[slotIndexToRemove] = null;
        document.querySelector(`.slot[data-index="${slotIndexToRemove}"]`).innerHTML = `<div class="name">빈 슬롯 ${slotIndexToRemove + 1}</div>`;
    }

    // 아이템 목록에서 'selected' 클래스 제거를 위해 현재 탭 다시 렌더링
    applyFilterAndRenderList(); // 필터링 상태를 유지하며 다시 렌더링
    updatePriorityList();
}


// ==========================
// 우선순위 목록 (드래그 앤 드롭 정렬)
// ==========================

function updatePriorityList() {
  priorityList.innerHTML = '';
  selectedArtifacts.forEach(item => { // 아티팩트만 우선순위 리스트에 추가 (석판은 현재 포함하지 않음)
    const li = document.createElement('li');
    li.textContent = `${item.name} (★${item.maxUpgrade})`;
    li.dataset.id = item.id;
    li.draggable = true;

    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('priorityItemId', item.id); // 우선순위 리스트에서 드래그 중임을 알림
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      // 드래그 종료 후 순서 업데이트 (실제 배열에 반영)
      const newOrder = [...priorityList.querySelectorAll('li')].map(li => li.dataset.id);
      selectedArtifacts.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      // 순서가 변경되었으므로 자동 배치 다시 실행
      // autoArrange(); // 알고리즘 구현 후에 주석 해제
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = document.querySelector('.priority-list .dragging');
      if (dragging && dragging !== li) {
        const afterElement = getDragAfterElement(priorityList, e.clientY);
        if (afterElement == null) {
          priorityList.appendChild(dragging);
        } else {
          priorityList.insertBefore(dragging, afterElement);
        }
      }
    });

    priorityList.appendChild(li);
  });
}

// 드래그 오버 시 요소 위치 판단 헬퍼 함수
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('li:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: -Infinity }).element;
}

// ==========================
// 아이템 필터링/검색 기능
// ==========================

let activeTags = new Set(); // 현재 활성화된 태그 필터

function generateTagFilters() {
    tagFiltersContainer.innerHTML = ''; // 기존 태그 버튼 초기화
    const tagsArray = Array.from(allTags).sort(); // Set을 배열로 변환하고 정렬

    tagsArray.forEach(tag => {
        const button = document.createElement('button');
        button.className = 'tag-button';
        button.textContent = `#${tag}`;
        if (activeTags.has(tag)) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
            } else {
                activeTags.add(tag);
            }
            button.classList.toggle('active');
            applyFilterAndRenderList();
        });
        tagFiltersContainer.appendChild(button);
    });
}

function applyFilterAndRenderList() {
    const searchTerm = itemSearchInput.value.toLowerCase().trim();
    let filteredItems = [];

    if (currentActiveTab === 'artifacts') {
        filteredItems = artifacts.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm);
            const tagMatch = activeTags.size === 0 || item.tags.some(tag => activeTags.has(tag));
            return nameMatch && tagMatch;
        });
        renderItemList(filteredItems, true);
    } else { // currentActiveTab === 'slates'
        filteredItems = slates.filter(item => {
            const nameMatch = item.name.toLowerCase().includes(searchTerm);
            // 석판에는 tags 필드가 현재 artifacts.json처럼 명시적으로 있지 않으므로
            // slates.json에 tags가 추가되면 이 부분도 활성화
            const tagMatch = activeTags.size === 0 || item.tags.some(tag => activeTags.has(tag));
            return nameMatch && tagMatch;
        });
        renderItemList(filteredItems, false);
    }
}


// ==========================
// 배치 알고리즘 (Condition 고려) - UI/UX 개선 후 이 부분에 구현할 예정
// ==========================

function isSlotAvailable(slotIndex, condition, currentGrid) {
    const row = Math.floor(slotIndex / 6); // 그리드 열이 6개
    const col = slotIndex % 6;
    const totalRows = Math.ceil(calculateSlots() / 6); // 현재 활성화된 슬롯 수에 기반한 전체 행 수
    const totalCols = 6;

    switch (condition) {
        case "최상단": // 그리드의 첫 번째 행
            return row === 0;
        case "최하단": // 그리드의 마지막 행
            return row === totalRows - 1;
        case "가장자리": // 그리드의 가장 외각 슬롯 (첫행, 마지막행, 첫열, 마지막열)
            return row === 0 || row === totalRows - 1 || col === 0 || col === totalCols - 1;
        case "안쪽": // 가장자리를 제외한 내부
            return row > 0 && row < totalRows - 1 && col > 0 && col < totalCols - 1;
        case "양쪽칸이 공백": // 아이템의 좌우 슬롯이 비어있어야 함(석판도 불가능)
            // 현재 슬롯의 좌우 인덱스
            const leftSlotIndex = slotIndex - 1;
            const rightSlotIndex = slotIndex + 1;

            // 같은 행에 있고, 좌우 슬롯이 그리드 범위 내에 있는지 확인
            const isSameRowLeft = (col > 0);
            const isSameRowRight = (col < totalCols - 1);

            // 좌우 슬롯이 비어있는지 확인
            // 그리드 범위를 벗어나면 빈 것으로 간주 (즉, 벽 옆이면 공백으로 취급)
            const isLeftEmpty = !isSameRowLeft || currentGrid[leftSlotIndex] === null;
            const isRightEmpty = !isSameRowRight || currentGrid[rightSlotIndex] === null;

            return isLeftEmpty && isRightEmpty;
        default: // 조건이 없거나 알 수 없는 조건은 항상 가능
            return true;
    }
}


function autoArrange() {
  const currentSlotsCount = calculateSlots();
  const availableSlots = [...document.querySelectorAll('.slot')].filter((slot, index) => index < currentSlotsCount);

  // 모든 슬롯을 일단 비움
  availableSlots.forEach(slot => {
    slot.innerHTML = `<div class="name">빈 슬롯 ${parseInt(slot.dataset.index) + 1}</div>`;
  });
  currentGridItems.fill(null); // 그리드 상태 배열도 완전히 비움

  // 선택된 아티팩트와 석판을 우선순위에 따라 정렬 (현재 아티팩트만 우선순위 리스트에서 정렬 가능)
  const allPrioritizedItems = [...selectedArtifacts].sort((a, b) => {
    // 우선순위 리스트의 순서를 따르므로, 이 부분은 실제 드래그 순서에 따라 정렬됨
    // (updatePriorityList에서 selectedArtifacts 배열 자체가 정렬됨)
    return 0;
  });

  // 선택된 석판을 아티팩트 뒤에 추가
  selectedSlates.forEach(slate => {
      allPrioritizedItems.push(slate);
  });

  let placedCount = 0;
  for (const item of allPrioritizedItems) {
    if (placedCount >= currentSlotsCount) break; // 사용 가능한 슬롯을 초과하면 중단

    let placed = false;
    // 아이템의 condition을 고려하여 슬롯 탐색
    for (let i = 0; i < currentSlotsCount; i++) {
        if (currentGridItems[i] === null) { // 슬롯이 비어있는 경우
            if (isSlotAvailable(i, item.condition, currentGridItems)) {
                const slotElement = document.querySelector(`.slot[data-index="${i}"]`);
                if (slotElement) {
                    renderItemInSlot(slotElement, item);
                    currentGridItems[i] = item;
                    placed = true;
                    placedCount++;
                    break; // 아이템을 배치했으므로 다음 아이템으로
                }
            }
        }
    }
  }
  // currentGridItems는 이미 배치 결과를 담고 있음
}


// ==========================
// 이벤트 리스너 및 초기화
// ==========================

tabArtifacts.addEventListener('click', () => {
  tabArtifacts.classList.add('active');
  tabSlates.classList.remove('active');
  currentActiveTab = 'artifacts'; // 현재 활성화된 탭 상태 업데이트
  itemSearchInput.value = ''; // 탭 변경 시 검색어 초기화
  activeTags.clear(); // 탭 변경 시 태그 필터 초기화
  generateTagFilters(); // 태그 필터 다시 생성
  applyFilterAndRenderList(); // 아이템 목록 렌더링
});

tabSlates.addEventListener('click', () => {
  tabSlates.classList.add('active');
  tabArtifacts.classList.remove('active');
  currentActiveTab = 'slates'; // 현재 활성화된 탭 상태 업데이트
  itemSearchInput.value = ''; // 탭 변경 시 검색어 초기화
  activeTags.clear(); // 탭 변경 시 태그 필터 초기화
  generateTagFilters(); // 태그 필터 다시 생성
  applyFilterAndRenderList(); // 아이템 목록 렌더링
});

checkboxes.forEach(chk => {
  chk.addEventListener('change', () => {
    renderSlots(calculateSlots()); // 슬롯 수 변경 시 전체 그리드 다시 그리기
    // autoArrange(); // 자동 배치를 원하면 주석 해제 (UX상 자동 실행은 혼란 줄 수 있음)
  });
});

autoArrangeBtn.addEventListener('click', autoArrange); // 자동 배치 버튼에 이벤트 리스너 추가

// 검색 입력 필드 이벤트 리스너
itemSearchInput.addEventListener('input', applyFilterAndRenderList);


async function loadData() {
  const res1 = await fetch('artifacts.json');
  artifacts = await res1.json();
  const res2 = await fetch('slates.json');
  slates = await res2.json();

  // artifact의 tags가 문자열인 경우 배열로 변환 및 upgrade 필드 공백 제거
  artifacts.forEach(item => {
    if (typeof item.tags === 'string' && item.tags.includes(',')) {
      item.tags = item.tags.split(',').map(tag => tag.trim());
    } else if (typeof item.tags === 'string' && item.tags !== '') {
      item.tags = [item.tags];
    } else {
      item.tags = []; // 태그가 없는 경우 빈 배열
    }
    // upgrade, maxUpgrade의 공백 제거 (JSON 파싱 문제 방지)
    if (item['upgrade '] !== undefined) {
        item.upgrade = item['upgrade '];
        delete item['upgrade '];
    } else if (item.upgrade === undefined) { // upgrade 필드가 아예 없는 경우 0으로 초기화
        item.upgrade = 0;
    }
    if (item['maxUpgrade '] !== undefined) {
        item.maxUpgrade = item['maxUpgrade '];
        delete item['maxUpgrade '];
    } else if (item.maxUpgrade === undefined) { // maxUpgrade 필드가 아예 없는 경우 (기본값 설정 필요 시)
        item.maxUpgrade = 0; // 혹은 적절한 기본값
    }

    // 모든 아티팩트 태그 수집
    item.tags.forEach(tag => allTags.add(tag));
  });

  // slate의 tags 처리 (slates.json에 tags가 현재 없지만, 미래 확장 대비)
  slates.forEach(item => {
    if (typeof item.tags === 'string' && item.tags.includes(',')) {
      item.tags = item.tags.split(',').map(tag => tag.trim());
    } else if (typeof item.tags === 'string' && item.tags !== '') {
      item.tags = [item.tags];
    } else {
      item.tags = [];
    }
    // upgrade, maxUpgrade 필드가 slates.json에도 있을 수 있으므로 추가
    if (item['upgrade '] !== undefined) {
        item.upgrade = item['upgrade '];
        delete item['upgrade '];
    } else if (item.upgrade === undefined) {
        item.upgrade = 0;
    }
    if (item['maxUpgrade '] !== undefined) {
        item.maxUpgrade = item['maxUpgrade '];
        delete item['maxUpgrade '];
    } else if (item.maxUpgrade === undefined) {
        item.maxUpgrade = 0;
    }

    // 모든 석판 태그 수집 (만약 slates.json에 tags가 있다면)
    item.tags.forEach(tag => allTags.add(tag));
  });


  // 초기 로드 시 아티팩트 목록 렌더링 및 슬롯 렌더링
  renderSlots(calculateSlots());
  generateTagFilters(); // 태그 필터 버튼 생성
  applyFilterAndRenderList(); // 초기 아이템 목록 렌더링 (필터링 적용)
}

loadData();
