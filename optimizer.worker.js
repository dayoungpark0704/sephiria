// optimizer.worker.js

// Worker의 전역 스코프에 최적화에 필요한 변수들을 한 번만 선언합니다.
let bestGrid = null;
let maxScore = -1;
let maxPossibleScoreCache = new Map();

/**
 * 그리드의 특정 슬롯이 아이템의 조건을 만족하는지 확인합니다.
 */
function isSlotAvailable(slotIndex, condition, currentGrid, calculateSlotsFunc) {
    const row = Math.floor(slotIndex / 6);
    const col = slotIndex % 6;
    const totalRows = Math.ceil(calculateSlotsFunc() / 6);
    const totalCols = 6;

    switch (condition) {
        case "최상단": 
            return row === 0;
        case "최하단":
            const slotBelowIndex = slotIndex + 6;
            return slotBelowIndex >= calculateSlotsFunc();
        case "가장자리": 
            return row === 0 || row === totalRows - 1 || col === 0 || col === totalCols - 1;
        case "안쪽": 
            return row > 0 && row < totalRows - 1 && col > 0 && col < totalCols - 1;
        case "양쪽칸이 공백":
            const leftSlotIndex = slotIndex - 1;
            const rightSlotIndex = slotIndex + 1;
            const isLeftInBounds = (col > 0);
            const isRightInBounds = (col < totalCols - 1);
            const isLeftEmpty = !isLeftInBounds || currentGrid[leftSlotIndex] === null;
            const isRightEmpty = !isRightInBounds || currentGrid[rightSlotIndex] === null;
            return isLeftEmpty && isRightEmpty;
        default: 
            return true;
    }
}

/**
 * 석판으로 인한 추가 강화 수치를 계산합니다.
 */
function calculateSlotBuffs(currentGridItemsState, maxSlotsConst, calculateSlotsFunc) {
    const slotBuffs = new Array(maxSlotsConst).fill(0);

    for (let slotIndex = 0; slotIndex < currentGridItemsState.length; slotIndex++) {
        const itemInstance = currentGridItemsState[slotIndex];
        if (itemInstance && itemInstance.isSlate) { // isSlate 속성 활용
            const baseRow = Math.floor(slotIndex / 6);
            const baseCol = slotIndex % 6;
            const rotation = itemInstance.rotation || 0;

            itemInstance.buffcoords.forEach(buff => {
                let transformedX = buff.x || 0;
                let transformedY = buff.y || 0;

                if (rotation === 90) { [transformedX, transformedY] = [-transformedY, transformedX]; }
                else if (rotation === 180) { [transformedX, transformedY] = [-transformedX, -transformedY]; }
                else if (rotation === 270) { [transformedX, transformedY] = [transformedY, -transformedX]; }

                const targetRow = baseRow + transformedY;
                const targetCol = baseCol + transformedX;
                const targetIndex = targetRow * 6 + targetCol;

                const currentActiveSlotsCount = calculateSlotsFunc();
                if (targetIndex >= 0 && targetIndex < currentActiveSlotsCount &&
                    targetRow >= 0 && targetRow < Math.ceil(currentActiveSlotsCount / 6) &&
                    targetCol >= 0 && targetCol < 6) {

                    let buffValue = 0;
                    if (buff.type) {
                        if (buff.type === 'edge' && isSlotAvailable(targetIndex, '가장자리', currentGridItemsState, calculateSlotsFunc)) {
                            buffValue = !isNaN(parseInt(buff.value)) ? parseInt(buff.value) : 0;
                        } 
                        else if (buff.type === 'downside' && isSlotAvailable(targetIndex, '최하단', currentGridItemsState, calculateSlotsFunc)) {
                            buffValue = !isNaN(parseInt(buff.value)) ? parseInt(buff.value) : 0;
                        }
                    } 
                    else if (buff.value !== undefined) {
                        if (buff.value === "limitUnlock") buffValue = 1;
                        else if (!isNaN(parseInt(buff.value))) buffValue = parseInt(buff.value);
                    }
                    slotBuffs[targetIndex] += buffValue;
                }
            });
        }
    }
    return slotBuffs;
}

/**
 * 현재 그리드 배치의 '점수'를 계산하는 함수.
 */
function calculateScore(gridState, calculateSlotsFunc) {
    let score = 0;
    const slotBuffs = calculateSlotBuffs(gridState, gridState.length, calculateSlotsFunc);
    
    for (let index = 0; index < gridState.length; index++) {
        const item = gridState[index];
        if (item && !item.isSlate) { // isSlate 속성 활용
            const buff = slotBuffs[index] || 0;
            const currentLevel = (item.level || 0) + buff;
            score += Math.min(currentLevel, item.maxUpgrade);
        }
    }
    return score;
}

/**
 * [최적화] 백트래킹으로 '최고 점수'의 배치를 찾는 함수.
 */
function findBestSolution(itemIndex, currentGridState, currentScore, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc, calculateScoreFunc) {
    // 가지치기: 현재 점수와 남은 아이템의 최대 잠재 점수를 더해도 maxScore를 넘을 수 없다면 탐색 중단
    if (maxScore > -1) {
        let remainingMaxScore = maxPossibleScoreCache.get(itemIndex);
        if (remainingMaxScore === undefined) {
            remainingMaxScore = 0;
            for (let i = itemIndex; i < allItemsToPlace.length; i++) {
                if (!allItemsToPlace[i].isSlate) {
                    remainingMaxScore += allItemsToPlace[i].maxUpgrade;
                }
            }
            maxPossibleScoreCache.set(itemIndex, remainingMaxScore);
        }
        if (currentScore + remainingMaxScore <= maxScore) {
            return;
        }
    }

    // 모든 아이템 배치 완료: 최고 점수 갱신
    if (itemIndex === allItemsToPlace.length) {
        if (currentScore > maxScore) {
            maxScore = currentScore;
            bestGrid = [...currentGridState];
        }
        return;
    }

    const currentItemInstance = allItemsToPlace[itemIndex];
    const itemCondition = currentItemInstance.condition && Array.isArray(currentItemInstance.condition) && currentItemInstance.condition.length > 0 ? currentItemInstance.condition[0] : '';

    for (let slotIdx = 0; slotIdx < totalActiveSlots; slotIdx++) {
        if (currentGridState[slotIdx] === null && isSlotAvailableFunc(slotIdx, itemCondition, currentGridState, calculateSlotsFunc)) {
            currentGridState[slotIdx] = currentItemInstance;

            // =============== 💡 점진적 점수 계산 로직 💡 ===============
            if (currentItemInstance.isSlate) {
                // 석판이 배치되면 버프가 바뀌므로, 전체 점수를 재계산해야 함
                const newScore = calculateScoreFunc(currentGridState, calculateSlotsFunc);
                findBestSolution(itemIndex + 1, currentGridState, newScore, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc, calculateScoreFunc);
            } else {
                // 아티팩트가 배치되면, 기존 점수에 해당 아티팩트 점수만 더함 (매우 빠름)
                const slotBuffs = calculateSlotBuffs(currentGridState, totalActiveSlots, calculateSlotsFunc);
                const buff = slotBuffs[slotIdx] || 0;
                const artifactScore = Math.min((currentItemInstance.level || 0) + buff, currentItemInstance.maxUpgrade);
                findBestSolution(itemIndex + 1, currentGridState, currentScore + artifactScore, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc, calculateScoreFunc);
            }
            // =======================================================
            
            currentGridState[slotIdx] = null; // 백트래킹
        }
    }
}


// Web Worker의 메인 로직
self.onmessage = function(e) {
    console.log('Worker: 메시지 수신', e.data);
    const { allItemsToPlace, totalActiveSlots, maxSlots, timeout } = e.data;

    // isSlate 속성을 미리 추가하여 루프 안에서 반복적인 문자열 검사를 피함
    allItemsToPlace.forEach(item => item.isSlate = item.id.startsWith('slate_'));

    bestGrid = new Array(maxSlots).fill(null);
    maxScore = -1;
    maxPossibleScoreCache.clear();

    const calculateSlotsInWorker = () => totalActiveSlots;

    let calculationFinished = false;
    const timeoutId = setTimeout(() => {
        if (!calculationFinished) {
            console.log(`Worker: ${timeout/1000}초 시간 초과! 현재까지의 최선의 결과 전송.`);
            self.postMessage({ bestGrid, maxScore, timeout: true });
            self.close(); 
        }
    }, timeout);

    // 재귀 시작! 초기 점수는 0
    findBestSolution(0, new Array(maxSlots).fill(null), 0, allItemsToPlace, totalActiveSlots, isSlotAvailable, calculateSlotsInWorker, calculateScore);

    calculationFinished = true;
    clearTimeout(timeoutId);

    console.log('Worker: 계산 완료, 결과 전송', { bestGrid, maxScore });
    self.postMessage({ bestGrid, maxScore, timeout: false });
};