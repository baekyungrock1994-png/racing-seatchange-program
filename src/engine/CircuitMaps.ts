// src/engine/CircuitMaps.ts
import { CircuitMapData, CircuitThemeId, Obstacle, ItemBox } from '@/types/game';
import { THEMES } from '@/constants/themes';

export class CircuitMaps {
  static getMap(themeId: CircuitThemeId): CircuitMapData {
    const theme = THEMES[themeId] || THEMES.classic;
    // 카트 3대(32px * 3 = 96px)가 여유롭게 주행 및 추월할 수 있는 200px 광폭 도로
    const CELL_SIZE = 200;
    const WALL_THICK = 32; // 견고하고 두꺼운 방호벽

    const worldWidth = 3200;
    const worldHeight = 2400;

    // 테마별 고유 트랙 셀 경로 [col, row] 및 교실 영역 정의
    const { trackCells, classroomArea, startHeading } = this.getThemeLayout(themeId, CELL_SIZE);

    // 1. 출발선: 첫 번째 트랙 셀 내부
    const firstCell = trackCells[0];
    const startLine = {
      x: firstCell.col * CELL_SIZE + 15,
      y: firstCell.row * CELL_SIZE + 80,
      width: CELL_SIZE - 30,
      height: 40,
      angle: startHeading
    };

    // 2. 결승선: 교실 남쪽 정문 게이트(col 11, row 7의 상단 경계)
    const finishLine = {
      x: 11 * CELL_SIZE + 15,
      y: classroomArea.y + classroomArea.height - 20,
      width: CELL_SIZE - 30,
      height: 40
    };

    // 3. 빈틈없는 가드레일 자동 생성 알고리즘:
    // 진행 경로상 직전 타일(idx - 1), 직후 타일(idx + 1), 그리고 교실 게이트만을 개방하고,
    // 그 외의 모든 면(외곽, 비연속 인접 타일, 샛길 등)에 두꺼운 가드레일 방호벽을 배치하여
    // "중간에 밖으로 새어나가거나 숏컷으로 빠지는 현상"을 원천 차단합니다!
    const walls: Obstacle[] = [];
    let wallId = 1;

    const isConnected = (idx: number, targetCol: number, targetRow: number) => {
      // 1) 이전 타일과 연결
      if (idx > 0 && trackCells[idx - 1].col === targetCol && trackCells[idx - 1].row === targetRow) {
        return true;
      }
      // 2) 다음 타일과 연결
      if (idx < trackCells.length - 1 && trackCells[idx + 1].col === targetCol && trackCells[idx + 1].row === targetRow) {
        return true;
      }
      // 3) 교실 정문 게이트(마지막 타일의 북쪽이 교실 게이트인 경우)
      if (idx === trackCells.length - 1 && targetCol === 11 && targetRow === 6) {
        return true;
      }
      return false;
    };

    trackCells.forEach(({ col, row }, idx) => {
      const x0 = col * CELL_SIZE;
      const y0 = row * CELL_SIZE;

      // 위쪽(North) 가드레일 검사
      if (!isConnected(idx, col, row - 1)) {
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

      // 아래쪽(South) 가드레일 검사
      if (!isConnected(idx, col, row + 1)) {
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

      // 왼쪽(West) 가드레일 검사
      if (!isConnected(idx, col - 1, row)) {
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

      // 오른쪽(East) 가드레일 검사
      if (!isConnected(idx, col + 1, row)) {
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

    // 교실 외곽 벽 생성 (단, 트랙이 들어오는 정문 게이트 col 11은 뚫어둠)
    const clsX = classroomArea.x;
    const clsY = classroomArea.y;
    const clsW = classroomArea.width;
    const clsH = classroomArea.height;
    const gateX = 11 * CELL_SIZE;
    const gateW = CELL_SIZE;

    // 교실 상단 벽
    walls.push({ id: `cls_w_top`, type: 'wall', x: clsX - WALL_THICK, y: clsY - WALL_THICK, width: clsW + WALL_THICK * 2, height: WALL_THICK, color: '#64748B' });
    // 교실 좌측 벽
    walls.push({ id: `cls_w_left`, type: 'wall', x: clsX - WALL_THICK, y: clsY, width: WALL_THICK, height: clsH + WALL_THICK, color: '#64748B' });
    // 교실 우측 벽
    walls.push({ id: `cls_w_right`, type: 'wall', x: clsX + clsW, y: clsY, width: WALL_THICK, height: clsH + WALL_THICK, color: '#64748B' });

    // 교실 하단 벽 (게이트 좌우측만 막고 입구는 개방)
    if (gateX > clsX) {
      walls.push({ id: `cls_w_bot_l`, type: 'wall', x: clsX - WALL_THICK, y: clsY + clsH, width: (gateX - clsX) + WALL_THICK, height: WALL_THICK, color: '#64748B' });
    }
    if (gateX + gateW < clsX + clsW) {
      walls.push({ id: `cls_w_bot_r`, type: 'wall', x: gateX + gateW, y: clsY + clsH, width: (clsX + clsW) - (gateX + gateW) + WALL_THICK, height: WALL_THICK, color: '#64748B' });
    }

    // 4. 월드 4면 외곽 절대 방호벽 (캔버스 밖으로 이탈 방지)
    walls.push({ id: `world_w_top`, type: 'wall', x: 0, y: 0, width: worldWidth, height: WALL_THICK, color: '#0F172A' });
    walls.push({ id: `world_w_bot`, type: 'wall', x: 0, y: worldHeight - WALL_THICK, width: worldWidth, height: WALL_THICK, color: '#0F172A' });
    walls.push({ id: `world_w_left`, type: 'wall', x: 0, y: 0, width: WALL_THICK, height: worldHeight, color: '#0F172A' });
    walls.push({ id: `world_w_right`, type: 'wall', x: worldWidth - WALL_THICK, y: 0, width: WALL_THICK, height: worldHeight, color: '#0F172A' });

    // 5. 테마별 인터랙티브 장애물 (주행을 완전 방해하지 않고 지나갈 수 있는 패드/오일)
    const obstacles: Obstacle[] = [];
    trackCells.forEach((c, idx) => {
      // 5칸마다 1개씩 흥미 요소 배치
      if (idx > 3 && idx < trackCells.length - 3 && idx % 5 === 2) {
        const cx = c.col * CELL_SIZE + CELL_SIZE / 2;
        const cy = c.row * CELL_SIZE + CELL_SIZE / 2;
        const obsType = themeId === 'space' ? 'speed_pad' : (themeId === 'ice' ? 'ice_patch' : 'oil');

        obstacles.push({
          id: `obs_${idx}`,
          type: obsType,
          x: cx - 25,
          y: cy - 25,
          width: 50,
          height: 50,
          color: themeId === 'space' ? '#06B6D4' : (themeId === 'ice' ? '#BAE6FD' : '#0F172A')
        });
      }
    });

    // 6. 아이템 상자 (? 박스) 배치 (4칸마다 트랙 중앙 배치)
    const itemBoxes: ItemBox[] = [];
    trackCells.forEach((c, idx) => {
      if (idx > 2 && idx < trackCells.length - 2 && idx % 4 === 1) {
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
   * 6종 테마별 고유 서킷 레이아웃 [col, row]
   * 모든 맵은 연속된 셀 간격(맨해튼 거리 1)으로만 연결되어 단절 및 숏컷이 전혀 없습니다.
   */
  private static getThemeLayout(themeId: CircuitThemeId, cellSize: number) {
    let cells: Array<{ col: number; row: number }> = [];
    // 대형 교실 영역: 가로 1300px, 세로 1200px (좌석 간격 105px 이상 통로 보장)
    const classroomArea = {
      x: 9 * cellSize,
      y: 1 * cellSize,
      width: 6.5 * cellSize,
      height: 6 * cellSize
    };
    const startHeading = 0; // 북쪽 출발

    if (themeId === 'classic') {
      // 🏁 1. 클래식 그랑프리: 롱 스트레이트 -> 고속 코너 -> S자 시케인 -> 가속 주로
      cells = [
        // 1. 메인 스트레이트 직선 주로 (남->북)
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 },
        { col: 1, row: 5 }, { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 }, { col: 1, row: 1 },
        // 2. 1번 고속 우코너 (서->동)
        { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 }, { col: 5, row: 1 }, { col: 6, row: 1 }, { col: 7, row: 1 },
        // 3. 내리막 고속 코너 (북->남)
        { col: 7, row: 2 }, { col: 7, row: 3 }, { col: 7, row: 4 },
        // 4. S자 테크니컬 시케인
        { col: 6, row: 4 }, { col: 5, row: 4 },
        { col: 5, row: 5 }, { col: 5, row: 6 },
        { col: 6, row: 6 }, { col: 7, row: 6 }, { col: 8, row: 6 },
        // 5. 남쪽 루프
        { col: 8, row: 7 }, { col: 8, row: 8 }, { col: 8, row: 9 }, { col: 8, row: 10 },
        // 6. 최후의 가속 주로 (서->동)
        { col: 9, row: 10 }, { col: 10, row: 10 }, { col: 11, row: 10 },
        // 7. 결승선 진입 (남->북)
        { col: 11, row: 9 }, { col: 11, row: 8 }, { col: 11, row: 7 }
      ];
    } else if (themeId === 'classroom') {
      // ✏️ 2. 교실 어드벤처: 학용품과 책상 사이를 통과하는 직각 90도 크랭크 미로
      cells = [
        // 출발 및 1번 코너
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 }, { col: 1, row: 7 },
        // 연필 크랭크 1
        { col: 2, row: 7 }, { col: 3, row: 7 },
        { col: 3, row: 6 }, { col: 3, row: 5 },
        { col: 2, row: 5 }, { col: 1, row: 5 },
        // 북쪽 진입
        { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 }, { col: 1, row: 1 },
        // 지우개 미로 2 (상단 지그재그)
        { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 },
        { col: 4, row: 2 }, { col: 4, row: 3 },
        { col: 5, row: 3 }, { col: 6, row: 3 },
        { col: 6, row: 2 }, { col: 6, row: 1 },
        { col: 7, row: 1 },
        // 필통 코너 3
        { col: 7, row: 2 }, { col: 7, row: 3 }, { col: 7, row: 4 }, { col: 7, row: 5 },
        { col: 8, row: 5 }, { col: 8, row: 6 }, { col: 8, row: 7 }, { col: 8, row: 8 },
        // 남쪽 우회로
        { col: 7, row: 8 }, { col: 6, row: 8 },
        { col: 6, row: 9 }, { col: 6, row: 10 },
        { col: 7, row: 10 }, { col: 8, row: 10 }, { col: 9, row: 10 }, { col: 10, row: 10 }, { col: 11, row: 10 },
        // 교실 게이트 피니시
        { col: 11, row: 9 }, { col: 11, row: 8 }, { col: 11, row: 7 }
      ];
    } else if (themeId === 'space') {
      // 🌌 3. 우주 정거장: 초대형 외곽 오비탈 루프 및 가속 링
      cells = [
        // 1. 서쪽 오비탈 상승 주로
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 },
        { col: 1, row: 5 }, { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 }, { col: 1, row: 1 },
        // 2. 북쪽 우주 스테이션 외곽 궤도
        { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 }, { col: 5, row: 1 }, { col: 6, row: 1 }, { col: 7, row: 1 },
        // 3. 중력 슬링샷 곡선
        { col: 7, row: 2 }, { col: 7, row: 3 },
        { col: 6, row: 3 }, { col: 5, row: 3 }, { col: 4, row: 3 }, { col: 3, row: 3 },
        { col: 3, row: 4 }, { col: 3, row: 5 }, { col: 3, row: 6 },
        { col: 4, row: 6 }, { col: 5, row: 6 }, { col: 6, row: 6 }, { col: 7, row: 6 },
        // 4. 남쪽 대형 가속 링
        { col: 7, row: 7 }, { col: 7, row: 8 }, { col: 7, row: 9 }, { col: 7, row: 10 },
        { col: 8, row: 10 }, { col: 9, row: 10 }, { col: 10, row: 10 }, { col: 11, row: 10 },
        // 5. 결승 도킹 베이 진입
        { col: 11, row: 9 }, { col: 11, row: 8 }, { col: 11, row: 7 }
      ];
    } else if (themeId === 'europe') {
      // 🏛️ 4. 유럽 도시: 고풍스러운 골목길 -> 중앙 360도 분수대 광장 로터리 -> 대운하 거리
      cells = [
        // 1. 고풍스러운 골목길 (남->북)
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 },
        { col: 2, row: 6 }, { col: 2, row: 5 }, { col: 2, row: 4 }, { col: 2, row: 3 }, { col: 2, row: 2 },
        // 2. 분수대 광장 접근로
        { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 },
        // 3. 중앙 분수대 로터리 순환
        { col: 6, row: 2 }, { col: 6, row: 3 }, { col: 6, row: 4 }, { col: 6, row: 5 },
        { col: 5, row: 5 }, { col: 4, row: 5 },
        // 4. 로터리 남측 출구로 탈출
        { col: 4, row: 6 }, { col: 4, row: 7 }, { col: 4, row: 8 },
        // 5. 운하 옆 그랜드 애비뉴 직선로
        { col: 5, row: 8 }, { col: 6, row: 8 }, { col: 7, row: 8 }, { col: 8, row: 8 }, { col: 9, row: 8 }, { col: 10, row: 8 },
        // 6. 광장 승리 개선문 -> 교실 결승선
        { col: 10, row: 9 }, { col: 11, row: 9 },
        { col: 11, row: 8 }, { col: 11, row: 7 }
      ];
    } else if (themeId === 'colosseum') {
      // ⚔️ 5. 고대 콜로세움: 투기장 원형 외곽 트랙과 2중 전차 헤어핀 시케인
      // 출발선(col 1)과 회귀로(col 3 이후) 사이에 col 2의 200px 완전 버퍼 및 방호벽을 확보하여 숏컷 불가!
      cells = [
        // 1. 투기장 서측 아치 트랙 (남->북)
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 },
        { col: 1, row: 5 }, { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 }, { col: 1, row: 1 },
        // 2. 북측 황제 관람석 아치 (서->동)
        { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 }, { col: 5, row: 1 }, { col: 6, row: 1 }, { col: 7, row: 1 },
        // 3. 전차 1번 헤어핀 시케인
        { col: 7, row: 2 }, { col: 7, row: 3 }, { col: 7, row: 4 },
        { col: 6, row: 4 }, { col: 5, row: 4 }, { col: 4, row: 4 }, { col: 3, row: 4 },
        // 4. 전차 2번 헤어핀 시케인
        { col: 3, row: 5 }, { col: 3, row: 6 },
        { col: 4, row: 6 }, { col: 5, row: 6 }, { col: 6, row: 6 }, { col: 7, row: 6 }, { col: 8, row: 6 },
        // 5. 남측 투기장 외곽 곡선
        { col: 8, row: 7 }, { col: 8, row: 8 },
        { col: 7, row: 8 }, { col: 6, row: 8 }, { col: 5, row: 8 }, { col: 4, row: 8 }, { col: 3, row: 8 },
        // 6. 승리의 전차 질주로 (col 3으로 내려가서 col 1 출발선과 완벽히 격리)
        { col: 3, row: 9 }, { col: 3, row: 10 },
        { col: 4, row: 10 }, { col: 5, row: 10 }, { col: 6, row: 10 }, { col: 7, row: 10 }, { col: 8, row: 10 }, { col: 9, row: 10 }, { col: 10, row: 10 }, { col: 11, row: 10 },
        // 7. 콜로세움 정문 진입 (피니시)
        { col: 11, row: 9 }, { col: 11, row: 8 }, { col: 11, row: 7 }
      ];
    } else if (themeId === 'ice') {
      // ❄️ 6. 얼음왕국: 산악 설벽으로 완전히 격리된 4단 연속 빙판 헤어핀 드리프트 코스
      cells = [
        // 1. 빙벽 등반 (서쪽 주로)
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 }, { col: 1, row: 7 }, { col: 1, row: 6 },
        { col: 1, row: 5 }, { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 }, { col: 1, row: 1 },
        // 2. 빙하 1단 헤어핀 (동쪽 질주)
        { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 }, { col: 5, row: 1 }, { col: 6, row: 1 }, { col: 7, row: 1 },
        // 3. 빙하 2단 헤어핀 (서쪽 질주)
        { col: 7, row: 2 }, { col: 7, row: 3 },
        { col: 6, row: 3 }, { col: 5, row: 3 }, { col: 4, row: 3 }, { col: 3, row: 3 },
        // 4. 빙하 3단 헤어핀 (동쪽 질주)
        { col: 3, row: 4 }, { col: 3, row: 5 },
        { col: 4, row: 5 }, { col: 5, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 }, { col: 8, row: 5 },
        // 5. 빙하 4단 헤어핀 (서쪽 질주)
        { col: 8, row: 6 }, { col: 8, row: 7 },
        { col: 7, row: 7 }, { col: 6, row: 7 }, { col: 5, row: 7 }, { col: 4, row: 7 }, { col: 3, row: 7 },
        // 6. 설원 활강로 (남단)
        { col: 3, row: 8 }, { col: 3, row: 9 },
        { col: 4, row: 9 }, { col: 5, row: 9 }, { col: 6, row: 9 }, { col: 7, row: 9 }, { col: 8, row: 9 }, { col: 9, row: 9 }, { col: 10, row: 9 }, { col: 11, row: 9 },
        // 7. 얼음 궁전(교실) 진입 피니시
        { col: 11, row: 8 }, { col: 11, row: 7 }
      ];
    }

    return { trackCells: cells, classroomArea, startHeading };
  }
}
