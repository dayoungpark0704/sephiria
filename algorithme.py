import json
import random
import copy

# --- 1. 설정 및 데이터 로딩 ---

# 희귀도별 가중치 정의
RARITY_WEIGHTS = {
    "Common": 1.0,
    "UnCommon": 1.2,
    "Rare": 1.5,
    "Legendary": 2.5
}

# JSON 파일 로딩
try:
    with open('artifacts.json', 'r', encoding='utf-8') as f:
        artifact_list = json.load(f)
        artifact_db = {item['id']: item for item in artifact_list}

    with open('slates.json', 'r', encoding='utf-8') as f:
        slate_list = json.load(f)
        slate_db = {item['id']: item for item in slate_list}
except FileNotFoundError:
    print("오류: artifacts.json 또는 slates.json 파일을 찾을 수 없습니다.")
    exit()

# --- 2. 핵심 함수: 점수 계산기 ---

def calculate_score(board, board_width, board_height):
    """
    현재 배치(board)의 최종 점수를 계산합니다.
    (회전, 가중치, 모든 페널티 시스템 포함)
    """
    total_score = 0
    
    # 2-1. 석판 효과를 먼저 계산하여 '효과 맵' 생성
    effect_map = [[0 for _ in range(board_width)] for _ in range(board_height)]
    
    for y in range(board_height):
        for x in range(board_width):
            cell = board[y][x]
            if cell and cell['id'] in slate_db:
                slate_id = cell['id']
                rotation = str(cell.get('rotation', 0))
                slate = slate_db[slate_id]
                
                # 석판 자체의 조건 페널티
                condition = slate.get('condition')
                is_slate_violated = False
                if condition == 'bottom_row' and y != board_height - 1: is_slate_violated = True
                elif condition == 'top_row' and y != 0: is_slate_violated = True
                elif condition == 'horizontal_ends' and not (x == 0 or x == board_width - 1): is_slate_violated = True
                
                if is_slate_violated:
                    total_score -= 500
                    continue

                buffcoords_data = slate.get('buffcoords', [])
                if slate.get('rotatable'):
                    buffcoords = buffcoords_data.get(rotation, [])
                else:
                    buffcoords = buffcoords_data

                for buff in buffcoords:
                    eff_x, eff_y = x + buff[0], y - buff[1]
                    
                    if 0 <= eff_y < board_height and 0 <= eff_x < board_width:
                        if buff[3] == "none":
                           effect_map[eff_y][eff_x] += buff[2]
                        # 여기에 'limitUnlock' 등 다른 특수 효과 처리 로직 추가 가능

    # 2-2. 아티팩트 점수 및 제약 조건 페널티 계산
    for y in range(board_height):
        for x in range(board_width):
            cell = board[y][x]
            if cell and cell['id'] in artifact_db:
                artifact_id = cell['id']
                artifact = artifact_db[artifact_id]
                
                # 사용자 설정값
                upgrade_level = cell.get('upgrade', 0)
                user_priority = cell.get('priority', 1.0)

                # 강화로 인한 추가 레벨 (예시: 강화 1당 +1 레벨)
                additional_level_from_upgrade = upgrade_level * 1
                
                artifact_level = effect_map[y][x] + additional_level_from_upgrade
                condition = artifact.get('condition')
                is_violated = False
                
                if condition == 'top_row' and y != 0: is_violated = True
                elif condition == 'bottom_row' and y != board_height - 1: is_violated = True
                elif condition == 'edge' and not (x == 0 or x == board_width - 1 or y == 0 or y == board_height - 1): is_violated = True
                elif condition == 'inner' and (x == 0 or x == board_width - 1 or y == 0 or y == board_height - 1): is_violated = True
                elif condition == 'adjacent_horizontal_empty':
                    if (x > 0 and board[y][x-1] is not None) or (x < board_width - 1 and board[y][x+1] is not None):
                        is_violated = True
                elif condition == 'requires_grimoire_right':
                    is_violated = True
                    if x < board_width - 1:
                        right_cell = board[y][x+1]
                        if right_cell and right_cell['id'] in artifact_db:
                            right_artifact = artifact_db[right_cell['id']]
                            if "마법서" in right_artifact.get("tags", []):
                                is_violated = False
                
                if is_violated:
                    artifact_level -= 1000

                if artifact_level >= 0:
                    rarity = artifact.get('rarity', 'Common')
                    weight = RARITY_WEIGHTS.get(rarity, 1.0)
                    total_score += (artifact_level * weight * user_priority)
                    
    return total_score

# --- 3. 핵심 함수: 최적 배치 탐색기 ---

def find_optimal_placement(items_with_settings, board_width, board_height, iterations=10000):
    """아이템과 그 설정을 받아 최적의 배치를 찾습니다."""
    
    current_board = [[None for _ in range(board_width)] for _ in range(board_height)]
    empty_cells = [(y, x) for y in range(board_height) for x in range(board_width)]
    random.shuffle(empty_cells)
    
    placed_items_coords = []
    for i, item_data in enumerate(items_with_settings):
        if i < len(empty_cells):
            y, x = empty_cells[i]
            # 기본 회전값 추가
            item_data['rotation'] = 0
            current_board[y][x] = item_data
            placed_items_coords.append((y,x))

    current_score = calculate_score(current_board, board_width, board_height)

    for _ in range(iterations):
        temp_board = copy.deepcopy(current_board)
        
        action = random.choice([0, 0, 0, 1])
        
        if action == 0 and len(placed_items_coords) >= 2:
            (y1, x1), (y2, x2) = random.sample(placed_items_coords, 2)
            temp_board[y1][x1], temp_board[y2][x2] = temp_board[y2][x2], temp_board[y1][x1]
        
        elif action == 1 and placed_items_coords:
            y, x = random.choice(placed_items_coords)
            cell = temp_board[y][x]
            if cell and cell['id'] in slate_db and slate_db[cell['id']].get('rotatable'):
                cell['rotation'] = random.choice([0, 90, 180, 270])

        new_score = calculate_score(temp_board, board_width, board_height)
        
        if new_score > current_score:
            current_board = temp_board
            current_score = new_score
            
    return current_board, current_score

# --- 4. 실행 예시 ---
if __name__ == '__main__':
    # 프론트엔드에서 넘어올 데이터 형식의 예시
    my_items_data = [
        {"id": "artifact_115", "priority": 1.5, "upgrade": 2}, # 빛나는 모래시계 (중요도 1.5, 강화 2)
        {"id": "artifact_127", "priority": 1.0, "upgrade": 0}, # 번개 부메랑 (마법서)
        {"id": "slate_2", "priority": 1.0, "upgrade": 0},      # 근사
        {"id": "slate_7", "priority": 1.0, "upgrade": 0}       # 악수
    ]
    
    inventory_width = 5
    inventory_height = 5
    
    item_names = [artifact_db.get(i['id'], slate_db.get(i['id'], {})).get('name', 'N/A') for i in my_items_data]
    print(f"'{', '.join(item_names)}' 아이템으로 최적 배치를 탐색합니다...")
    
    # 최적 배치 탐색 실행
    optimal_board, best_score = find_optimal_placement(my_items_data, inventory_width, inventory_height, iterations=20000)
    
    print("\n[ 최적 배치 결과 ]")
    print(f"최고 점수: {best_score:.2f}")
    print("-" * (inventory_width * 25))
    for row in optimal_board:
        display_row = []
        for cell in row:
            if cell:
                item_db = artifact_db if cell['id'] in artifact_db else slate_db
                item_name = item_db.get(cell['id'], {}).get('name', 'N/A')
                
                details = []
                if cell['id'] in slate_db and slate_db[cell['id']].get('rotatable'):
                    details.append(f"{cell.get('rotation', 0)}°")
                if cell['id'] in artifact_db and cell.get('upgrade', 0) > 0:
                    details.append(f"+{cell.get('upgrade')}")
                
                detail_str = f"({', '.join(details)})" if details else ""
                display_row.append(f"{item_name} {detail_str}".ljust(23))
            else:
                display_row.append(f"{'---':<23}")
        print(" ".join(display_row))
    print("-" * (inventory_width * 25))