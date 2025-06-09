// optimizer.worker.js

// =============== 💡 추가된 부분 시작 💡 ===============
// Worker의 전역 스코프에 최적화에 필요한 변수들을 선언합니다.
let bestGrid = null;
let maxScore = -1;
let maxPossibleScoreCache = new Map();
// =============== 💡 추가된 부분 끝 💡 ===============


// [ 여기에 이전에 제공된 algorithms.js 의 모든 함수(isSlotAvailable, calculateSlotBuffs 등)를 붙여넣으세요. ]
// 아래는 해당 함수들의 내용입니다.

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

    currentGridItemsState.forEach((itemInstance, slotIndex) => {
        if (itemInstance && itemInstance.id.startsWith('slate_') && itemInstance.buffcoords && itemInstance.buffcoords.length > 0) {
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
    });
    return slotBuffs;
}

/**
 * 현재 그리드 배치의 '점수'를 계산하는 함수.
 */
function calculateScore(gridState, calculateSlotsFunc) {
    let score = 0;
    const slotBuffs = calculateSlotBuffs(gridState, gridState.length, calculateSlotsFunc);
    
    gridState.forEach((item, index) => {
        if (item && item.id.startsWith('aritifact_')) {
            const buff = slotBuffs[index] || 0;
            const currentLevel = (item.level || 0) + buff;
            score += Math.min(currentLevel, item.maxUpgrade);
        }
    });
    return score;
}

/**
 * 백트래킹으로 '최고 점수'의 배치를 찾는 최적화 함수.
 */
function findBestSolution(itemIndex, currentGridState, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc, calculateScoreFunc) {
    if (maxScore > -1) {
        let remainingMaxScore = 0;
        if (maxPossibleScoreCache.has(itemIndex)) {
            remainingMaxScore = maxPossibleScoreCache.get(itemIndex);
        } else {
            for (let i = itemIndex; i < allItemsToPlace.length; i++) {
                if(allItemsToPlace[i].id.startsWith('aritifact_')) {
                    remainingMaxScore += allItemsToPlace[i].maxUpgrade;
                }
            }
            maxPossibleScoreCache.set(itemIndex, remainingMaxScore);
        }
        
        const currentPartialScore = calculateScoreFunc(currentGridState, ()=>totalActiveSlots);
        if (currentPartialScore + remainingMaxScore <= maxScore) {
            return;
        }
    }

    if (itemIndex === allItemsToPlace.length) {
        const currentScore = calculateScoreFunc(currentGridState, ()=>totalActiveSlots);
        if (currentScore > maxScore) {
            maxScore = currentScore;
            bestGrid = [...currentGridState];
        }
        return;
    }

    const currentItemInstance = allItemsToPlace[itemIndex];
    const itemCondition = currentItemInstance.condition && Array.isArray(currentItemInstance.condition) && currentItemInstance.condition.length > 0 ? currentItemInstance.condition[0] : '';

    for (let slotCandidateIndex = 0; slotCandidateIndex < totalActiveSlots; slotCandidateIndex++) {
        if (currentGridState[slotCandidateIndex] === null &&
            isSlotAvailableFunc(slotCandidateIndex, itemCondition, currentGridState, ()=>totalActiveSlots)) {

            currentGridState[slotCandidateIndex] = currentItemInstance;
            
            findBestSolution(itemIndex + 1, currentGridState, allItemsToPlace, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc, calculateScoreFunc);
            
            currentGridState[slotCandidateIndex] = null;
        }
    }
}

/**
 * 특정 아이템을 배치할 수 있는 빈 슬롯의 개수를 계산합니다.
 */
function getNumberOfAvailableSlots(item, currentGrid, totalActiveSlots, isSlotAvailableFunc, calculateSlotsFunc) {
    let count = 0;
    const itemCondition = item.condition && Array.isArray(item.condition) && item.condition.length > 0 ? item.condition[0] : '';
    for (let i = 0; i < totalActiveSlots; i++) {
        if (currentGrid[i] === null && isSlotAvailableFunc(i, itemCondition, currentGrid, calculateSlotsFunc)) {
            count++;
        }
    }
    return count;
}


// Web Worker의 메인 로직
self.onmessage = function(e) {
    console.log('Worker: 메시지 수신', e.data);
    const { allItemsToPlace, totalActiveSlots, maxSlots, timeout } = e.data;

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

    findBestSolution(0, new Array(maxSlots).fill(null), allItemsToPlace, totalActiveSlots, isSlotAvailable, calculateSlotsInWorker, calculateScore);

    calculationFinished = true;
    clearTimeout(timeoutId);

    console.log('Worker: 계산 완료, 결과 전송', { bestGrid, maxScore });
    self.postMessage({ bestGrid, maxScore, timeout: false });
};