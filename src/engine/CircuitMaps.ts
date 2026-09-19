// src/engine/CircuitMaps.ts
import { CircuitMapData, CircuitThemeId, Obstacle, ItemBox } from '@/types/game';
import { THEMES } from '@/constants/themes';

export class CircuitMaps {
  static getMap(themeId: CircuitThemeId): CircuitMapData {
    const theme = THEMES[themeId] || THEMES.classic;
    const CELL_SIZE = 175; // 카트 3대가 가로로 나란히 주행할 수 있는 최적 폭
    const WALL_THICK = 24;

    const worldWidth = 2450;
    const worldHeight = 1750;

    // 테마별 고유 트랙 셀 경로 [col, row] 및 교실 영역 정의
    const { trackCells, classroomArea, startHeading } = this.getThemeLayout(themeId, CELL_SIZE);

    // 1. 출발선: 트랙의 첫 번째 셀 내부
    const firstCell = trackCells[0];
    const startLine = {
      x: firstCell.col * CELL_SIZE + 10,
      y: firstCell.row * CELL_SIZE + CELL_SIZE / 2,
      width: CELL_SIZE - 20,
      height: 35,
      angle: startHeading
    };

    // 2. 결승선: 트랙의 마지막 셀과 교실 사이의 경계
    const lastCell = trackCells[trackCells.length - 1];
    const finishLine = {
      x: lastCell.col * CELL_SIZE + 10,
      y: lastCell.row * CELL_SIZE + 10,
      width: CELL_SIZE - 20,
      height: 35
    };

    // 3. 벽(가드레일) 자동 생성 알고리즘:
    // 도로 타일들의 바깥 경계선에만 벽을 세우고, 도로 내부 연결부는 100% 뚫어두어 
    // "중간에 벽으로 가로막히는 현상"을 수학적으로 완벽 차단!
    const cellSet = new Set(trackCells.map(c => `${c.col},${c.row}`));

    // 교실 영역에 속하는 셀 집합 (교실도 벽으로 둘러싸이되 트랙 입구는 뚫림)
    const clsStartCol = Math.floor(classroomArea.x / CELL_SIZE);
    const clsEndCol = Math.floor((classroomArea.x + classroomArea.width) / CELL_SIZE);
    const clsStartRow = Math.floor(classroomArea.y / CELL_SIZE);
    const clsEndRow = Math.floor((classroomArea.y + classroomArea.height) / CELL_SIZE);

    const classroomCellSet = new Set<string>();
    for (let c = clsStartCol; c <= clsEndCol; c++) {
      for (let r = clsStartRow; r <= clsEndRow; r++) {
        classroomCellSet.add(`${c},${r}`);
      }
    }

    const walls: Obstacle[] = [];
    let wallId = 1;

    // 트랙 셀들의 외곽 경계 벽 생성
    trackCells.forEach(({ col, row }) => {
      const x0 = col * CELL_SIZE;
      const y0 = row * CELL_SIZE;

      // 위쪽 이웃 검사
      const upKey = `${col},${row - 1}`;
      if (!cellSet.has(upKey) && !classroomCellSet.has(upKey)) {
        walls.push({
          id: `w_${wallId++}`,
          type: 'wall',
          x: x0 - WALL_THICK,
          y: y0 - WALL_THICK,
          width: CELL_SIZE + WALL_THICK * 2,
          height: WALL_THICK,
          color: theme.wallColor
        });
      }

      // 아래쪽 이웃 검사
      const downKey = `${col},${row + 1}`;
      if (!cellSet.has(downKey) && !classroomCellSet.has(downKey)) {
        walls.push({
          id: `w_${wallId++}`,
          type: 'wall',
          x: x0 - WALL_THICK,
          y: y0 + CELL_SIZE,
          width: CELL_SIZE + WALL_THICK * 2,
          height: WALL_THICK,
          color: theme.wallColor
        });
      }

      // 왼쪽 이웃 검사
      const leftKey = `${col - 1},${row}`;
      if (!cellSet.has(leftKey) && !classroomCellSet.has(leftKey)) {
        walls.push({
          id: `w_${wallId++}`,
          type: 'wall',
          x: x0 - WALL_THICK,
          y: y0 - WALL_THICK,
          width: WALL_THICK,
          height: CELL_SIZE + WALL_THICK * 2,
          color: theme.wallColor
        });
      }

      // 오른쪽 이웃 검사
      const rightKey = `${col + 1},${row}`;
      if (!cellSet.has(rightKey) && !classroomCellSet.has(rightKey)) {
        walls.push({
          id: `w_${wallId++}`,
          type: 'wall',
          x: x0 + CELL_SIZE,
          y: y0 - WALL_THICK,
          width: WALL_THICK,
          height: CELL_SIZE + WALL_THICK * 2,
          color: theme.wallColor
        });
      }
    });

    // 교실 외곽 벽 생성 (단, 트랙 마지막 셀과 닿는 입구는 열어둠!)
    const clsX = classroomArea.x;
    const clsY = classroomArea.y;
    const clsW = classroomArea.width;
    const clsH = classroomArea.height;

    // 교실 상단 벽
    walls.push({ id: `cls_w_top`, type: 'wall', x: clsX - WALL_THICK, y: clsY - WALL_THICK, width: clsW + WALL_THICK * 2, height: WALL_THICK, color: '#64748B' });
    // 교실 좌측 벽
    walls.push({ id: `cls_w_left`, type: 'wall', x: clsX - WALL_THICK, y: clsY - WALL_THICK, width: WALL_THICK, height: clsH + WALL_THICK * 2, color: '#64748B' });
    // 교실 우측 벽
    walls.push({ id: `cls_w_right`, type: 'wall', x: clsX + clsW, y: clsY - WALL_THICK, width: WALL_THICK, height: clsH + WALL_THICK * 2, color: '#64748B' });

    // 교실 하단 벽 (트랙 마지막 셀이 들어오는 입구 부분은 뚫어두기)
    const entryX = lastCell.col * CELL_SIZE;
    if (entryX > clsX) {
      walls.push({ id: `cls_w_bot_l`, type: 'wall', x: clsX - WALL_THICK, y: clsY + clsH, width: entryX - clsX + WALL_THICK, height: WALL_THICK, color: '#64748B' });
    }
    if (entryX + CELL_SIZE < clsX + clsW) {
      walls.push({ id: `cls_w_bot_r`, type: 'wall', x: entryX + CELL_SIZE, y: clsY + clsH, width: (clsX + clsW) - (entryX + CELL_SIZE) + WALL_THICK, height: WALL_THICK, color: '#64748B' });
    }

    // 4. 테마별 고유 장애물 배치 (트랙 셀 중앙 일부만 차지하여 3차선 중 1개 차선만 막고 2차선은 통과 가능)
    const obstacles: Obstacle[] = [];
    trackCells.forEach((c, idx) => {
      // 4칸마다 1개씩 장애물 배치
      if (idx > 2 && idx < trackCells.length - 2 && idx % 4 === 1) {
        const cx = c.col * CELL_SIZE + CELL_SIZE / 2;
        const cy = c.row * CELL_SIZE + CELL_SIZE / 2;
        const obsType = themeId === 'space' ? 'speed_pad' : (themeId === 'ice' ? 'ice_patch' : (idx % 2 === 0 ? 'oil' : 'rock'));

        obstacles.push({
          id: `obs_${idx}`,
          type: obsType,
          x: cx - 25,
          y: cy - 25,
          width: 50,
          height: 50,
          color: themeId === 'space' ? '#06B6D4' : (themeId === 'ice' ? '#E0F2FE' : (obsType === 'oil' ? '#0F172A' : '#475569'))
        });
      }
    });

    // 5. 아이템 상자 (? 박스) 배치 (3칸마다 균일 배치)
    const itemBoxes: ItemBox[] = [];
    trackCells.forEach((c, idx) => {
      if (idx > 1 && idx < trackCells.length - 1 && idx % 3 === 2) {
        itemBoxes.push({
          id: `ib_${idx}`,
          x: c.col * CELL_SIZE + CELL_SIZE / 2,
          y: c.row * CELL_SIZE + CELL_SIZE / 2,
          size: 34,
          isAvailable: true,
          respawnTimer: 0
        });
      }
    });

    return {
      id: themeId,
      name: theme.name,
      description: theme.description,
      worldWidth,
      worldHeight,
      bgColors: {
        primary: theme.bgColor,
        secondary: '#0F172A',
        track: theme.trackColor,
        curb1: theme.curbColor1,
        curb2: theme.curbColor2,
        wall: theme.wallColor
      },
      startLine,
      finishLine,
      classroomArea,
      trackPolygons: [],
      trackCells,
      cellSize: CELL_SIZE,
      walls,
      obstacles,
      itemBoxes
    };
  }

  /**
   * 6종 테마별로 완전히 다른 고유한 서킷 타일 경로 [col, row] 생성기
   */
  private static getThemeLayout(themeId: CircuitThemeId, cellSize: number) {
    let cells: Array<{ col: number; row: number }> = [];
    let classroomArea = { x: 9 * cellSize, y: 1 * cellSize, width: 4 * cellSize, height: 3 * cellSize };
    let startHeading = 0; // 북쪽 출발

    if (themeId === 'classic') {
      // 🏁 1. 정통 레이싱장: 롱 스트레이트 -> 고속 코너 -> S자 시케인
      classroomArea = { x: 8 * cellSize, y: 1 * cellSize, width: 5 * cellSize, height: 3 * cellSize };
      cells = [
        // 출발선 및 롱 직선 주로
        { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 }, { col: 1, row: 5 }, { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 },
        // 1번 고속 우회전
        { col: 2, row: 2 }, { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 },
        // 다운힐
        { col: 5, row: 3 }, { col: 5, row: 4 }, { col: 5, row: 5 },
        // S자 시케인
        { col: 6, row: 5 }, { col: 7, row: 5 }, { col: 7, row: 6 }, { col: 8, row: 6 }, { col: 8, row: 7 }, { col: 9, row: 7 }, { col: 10, row: 7 },
        // 결승선 피니시 상승
        { col: 10, row: 6 }, { col: 10, row: 5 }, { col: 10, row: 4 }
      ];
    } else if (themeId === 'classroom') {
      // ✏️ 2. 교실 어드벤처: 책상 사이 90도 직각 크랭크 미로
      classroomArea = { x: 8 * cellSize, y: 1 * cellSize, width: 5 * cellSize, height: 3 * cellSize };
      cells = [
        { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 },
        { col: 2, row: 6 }, { col: 3, row: 6 }, { col: 3, row: 7 }, { col: 3, row: 8 },
        { col: 4, row: 8 }, { col: 5, row: 8 }, { col: 5, row: 7 }, { col: 5, row: 6 }, { col: 5, row: 5 }, { col: 5, row: 4 },
        { col: 4, row: 4 }, { col: 3, row: 4 }, { col: 3, row: 3 }, { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 }, { col: 6, row: 2 }, { col: 7, row: 2 },
        { col: 7, row: 3 }, { col: 7, row: 4 }, { col: 8, row: 4 }
      ];
    } else if (themeId === 'space') {
      // 🌌 3. 우주 정거장: 외곽 대형 오비탈 루프 궤도
      classroomArea = { x: 5 * cellSize, y: 3 * cellSize, width: 4 * cellSize, height: 3 * cellSize };
      cells = [
        { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 }, { col: 1, row: 5 }, { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 },
        { col: 2, row: 2 }, { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 }, { col: 6, row: 2 }, { col: 7, row: 2 }, { col: 8, row: 2 }, { col: 9, row: 2 }, { col: 10, row: 2 }, { col: 11, row: 2 }, { col: 12, row: 2 },
        { col: 12, row: 3 }, { col: 12, row: 4 }, { col: 12, row: 5 }, { col: 12, row: 6 }, { col: 12, row: 7 }, { col: 12, row: 8 },
        { col: 11, row: 8 }, { col: 10, row: 8 }, { col: 9, row: 8 }, { col: 8, row: 8 }, { col: 7, row: 8 },
        { col: 7, row: 7 }, { col: 7, row: 6 }
      ];
    } else if (themeId === 'europe') {
      // 🏛️ 4. 유럽 도시: 시가지 골목 & 분수대 광장 로터리
      classroomArea = { x: 7 * cellSize, y: 1 * cellSize, width: 5 * cellSize, height: 3 * cellSize };
      cells = [
        { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 }, { col: 1, row: 5 }, { col: 1, row: 4 },
        { col: 2, row: 4 }, { col: 3, row: 4 },
        // 분수대 로터리 순환
        { col: 4, row: 4 }, { col: 5, row: 4 }, { col: 6, row: 4 }, { col: 6, row: 5 }, { col: 6, row: 6 }, { col: 5, row: 6 }, { col: 4, row: 6 }, { col: 3, row: 6 }, { col: 3, row: 5 },
        // 로터리 탈출 후 피니시
        { col: 4, row: 7 }, { col: 5, row: 7 }, { col: 6, row: 7 }, { col: 7, row: 7 }, { col: 8, row: 7 },
        { col: 8, row: 6 }, { col: 8, row: 5 }, { col: 8, row: 4 }
      ];
    } else if (themeId === 'colosseum') {
      // ⚔️ 5. 고대 콜로세움: 웅장한 원형 투기장 아치 코스
      classroomArea = { x: 4 * cellSize, y: 3 * cellSize, width: 4 * cellSize, height: 3 * cellSize };
      cells = [
        { col: 2, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 }, { col: 1, row: 5 }, { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 2, row: 2 },
        { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 }, { col: 6, row: 2 }, { col: 7, row: 2 }, { col: 8, row: 2 }, { col: 9, row: 2 }, { col: 10, row: 2 }, { col: 11, row: 3 },
        { col: 11, row: 4 }, { col: 11, row: 5 }, { col: 11, row: 6 }, { col: 11, row: 7 }, { col: 10, row: 8 },
        { col: 9, row: 8 }, { col: 8, row: 8 }, { col: 7, row: 8 }, { col: 6, row: 8 }, { col: 5, row: 8 }, { col: 5, row: 7 }, { col: 5, row: 6 }
      ];
    } else if (themeId === 'ice') {
      // ❄️ 6. 얼음왕국: 4단 연속 헤어핀 드리프트 코스
      classroomArea = { x: 7 * cellSize, y: 1 * cellSize, width: 5 * cellSize, height: 3 * cellSize };
      cells = [
        { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 },
        { col: 2, row: 6 }, { col: 3, row: 6 }, { col: 4, row: 6 }, { col: 5, row: 6 },
        { col: 5, row: 5 }, { col: 4, row: 5 }, { col: 3, row: 5 }, { col: 2, row: 5 },
        { col: 2, row: 4 }, { col: 3, row: 4 }, { col: 4, row: 4 }, { col: 5, row: 4 }, { col: 6, row: 4 }, { col: 7, row: 4 },
        { col: 7, row: 3 }, { col: 8, row: 3 }, { col: 8, row: 4 }
      ];
    }

    return { trackCells: cells, classroomArea, startHeading };
  }
}
