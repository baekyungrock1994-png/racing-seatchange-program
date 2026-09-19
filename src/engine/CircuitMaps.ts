// src/engine/CircuitMaps.ts
import { CircuitMapData, CircuitThemeId, Obstacle, ItemBox } from '@/types/game';
import { THEMES } from '@/constants/themes';

/**
 * 6개 테마별 서킷 맵을 생성합니다.
 * 월드 크기는 가로 3200px, 세로 2400px의 대형 맵으로 구성하여 
 * 복잡한 서킷 주행감과 결승선 교실 좌석 영역을 충분히 제공합니다.
 */
export class CircuitMaps {
  static getMap(themeId: CircuitThemeId): CircuitMapData {
    const theme = THEMES[themeId] || THEMES.classic;
    const worldWidth = 3200;
    const worldHeight = 2400;

    // 공통 시작 지점 (맵 좌측 하단에서 출발하여 시계/반시계 방향 주행)
    const startLine = {
      x: 350,
      y: 1950,
      width: 280,
      height: 60,
      angle: 0 // 북쪽을 바라보고 출발
    };

    // 결승선 및 교실 영역 (맵 우측 상단/중앙)
    const finishLine = {
      x: 2150,
      y: 1200,
      width: 250,
      height: 40
    };

    const classroomArea = {
      x: 2100,
      y: 350,
      width: 950,
      height: 800
    };

    // 맵 외곽 벽 (테두리 방벽)
    const outerWalls: Obstacle[] = [
      { id: 'wall_top', type: 'wall', x: 0, y: 0, width: worldWidth, height: 60, color: theme.wallColor },
      { id: 'wall_bottom', type: 'wall', x: 0, y: worldHeight - 60, width: worldWidth, height: 60, color: theme.wallColor },
      { id: 'wall_left', type: 'wall', x: 0, y: 0, width: 60, height: worldHeight, color: theme.wallColor },
      { id: 'wall_right', type: 'wall', x: worldWidth - 60, y: 0, width: 60, height: worldHeight, color: theme.wallColor }
    ];

    // 내부 서킷 트랙 가이드 벽 (미로 및 코너링을 유도하는 주요 장벽들)
    const trackWalls: Obstacle[] = [
      // 1구간: 출발 후 첫 번째 북쪽 직선 가벽
      { id: 't_wall_1', type: 'wall', x: 680, y: 800, width: 60, height: 1400, color: theme.wallColor },
      // 2구간: 상단 코너 유도 가벽
      { id: 't_wall_2', type: 'wall', x: 680, y: 800, width: 900, height: 60, color: theme.wallColor },
      // 3구간: S자 슬라럼 유도 중앙 기둥 벽들
      { id: 't_wall_3', type: 'wall', x: 1250, y: 1200, width: 60, height: 1000, color: theme.wallColor },
      { id: 't_wall_4', type: 'wall', x: 1650, y: 500, width: 60, height: 1100, color: theme.wallColor },
      // 교실 입구 가이드 벽
      { id: 't_wall_5', type: 'wall', x: 2050, y: 1200, width: 60, height: 1100, color: theme.wallColor },
      { id: 't_wall_classroom_left', type: 'wall', x: 2050, y: 350, width: 50, height: 850, color: '#94A3B8' }
    ];

    // 테마별 고유 장애물 배치
    const themeObstacles: Obstacle[] = [];
    if (themeId === 'classic') {
      // 타이어 더미 & 오일 슬릭
      themeObstacles.push(
        { id: 'oil_1', type: 'oil', x: 420, y: 1400, width: 80, height: 80, color: '#0F172A' },
        { id: 'oil_2', type: 'oil', x: 950, y: 550, width: 90, height: 90, color: '#0F172A' },
        { id: 'rock_1', type: 'rock', x: 1450, y: 1500, width: 70, height: 70, color: '#475569' },
        { id: 'oil_3', type: 'oil', x: 1850, y: 1000, width: 85, height: 85, color: '#0F172A' }
      );
    } else if (themeId === 'classroom') {
      // 거대 지우개 & 엎질러진 우유
      themeObstacles.push(
        { id: 'milk_1', type: 'oil', x: 450, y: 1300, width: 90, height: 90, color: '#F1F5F9' },
        { id: 'eraser_1', type: 'rock', x: 1000, y: 600, width: 120, height: 60, color: '#F43F5E' },
        { id: 'eraser_2', type: 'rock', x: 1400, y: 1400, width: 120, height: 60, color: '#3B82F6' },
        { id: 'milk_2', type: 'oil', x: 1850, y: 1200, width: 100, height: 100, color: '#F1F5F9' }
      );
    } else if (themeId === 'space') {
      // 워프 패드 & 우주 소행성 파편
      themeObstacles.push(
        { id: 'warp_1', type: 'speed_pad', x: 450, y: 1200, width: 80, height: 120, color: '#06B6D4' },
        { id: 'asteroid_1', type: 'rock', x: 1100, y: 650, width: 80, height: 80, color: '#4C1D95' },
        { id: 'warp_2', type: 'speed_pad', x: 1450, y: 1600, width: 80, height: 120, color: '#06B6D4' },
        { id: 'asteroid_2', type: 'rock', x: 1850, y: 900, width: 90, height: 90, color: '#4C1D95' }
      );
    } else if (themeId === 'ice') {
      // 미끄러운 빙판 패치 & 거대 눈덩이
      themeObstacles.push(
        { id: 'ice_1', type: 'ice_patch', x: 450, y: 1100, width: 160, height: 160, color: '#E0F2FE' },
        { id: 'snow_1', type: 'rock', x: 1000, y: 600, width: 90, height: 90, color: '#FFFFFF' },
        { id: 'ice_2', type: 'ice_patch', x: 1400, y: 1500, width: 180, height: 180, color: '#E0F2FE' },
        { id: 'snow_2', type: 'rock', x: 1850, y: 1100, width: 90, height: 90, color: '#FFFFFF' }
      );
    } else if (themeId === 'colosseum') {
      // 무너진 대리석 기둥 & 불타는 바닥
      themeObstacles.push(
        { id: 'pillar_1', type: 'rock', x: 450, y: 1350, width: 80, height: 80, color: '#FEF08A' },
        { id: 'fire_1', type: 'oil', x: 1050, y: 650, width: 100, height: 100, color: '#EA580C' },
        { id: 'pillar_2', type: 'rock', x: 1450, y: 1450, width: 90, height: 90, color: '#FEF08A' },
        { id: 'fire_2', type: 'oil', x: 1850, y: 1000, width: 110, height: 110, color: '#EA580C' }
      );
    } else if (themeId === 'europe') {
      // 분수대 로터리 & 가로등
      themeObstacles.push(
        { id: 'fountain_1', type: 'rock', x: 450, y: 1200, width: 100, height: 100, color: '#38BDF8' },
        { id: 'table_1', type: 'wall', x: 1050, y: 600, width: 90, height: 90, color: '#713F12' },
        { id: 'fountain_2', type: 'rock', x: 1450, y: 1550, width: 110, height: 110, color: '#38BDF8' },
        { id: 'table_2', type: 'wall', x: 1850, y: 1100, width: 80, height: 80, color: '#713F12' }
      );
    }

    // 트랙 주요 지점에 배치되는 기믹 아이템 상자 (? 상자)
    const itemBoxes: ItemBox[] = [
      { id: 'item_box_1', x: 480, y: 1550, size: 36, isAvailable: true, respawnTimer: 0 },
      { id: 'item_box_2', x: 500, y: 950, size: 36, isAvailable: true, respawnTimer: 0 },
      { id: 'item_box_3', x: 950, y: 450, size: 36, isAvailable: true, respawnTimer: 0 },
      { id: 'item_box_4', x: 1450, y: 850, size: 36, isAvailable: true, respawnTimer: 0 },
      { id: 'item_box_5', x: 1450, y: 1850, size: 36, isAvailable: true, respawnTimer: 0 },
      { id: 'item_box_6', x: 1850, y: 1550, size: 36, isAvailable: true, respawnTimer: 0 },
      { id: 'item_box_7', x: 1850, y: 700, size: 36, isAvailable: true, respawnTimer: 0 }
    ];

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
      walls: [...outerWalls, ...trackWalls],
      obstacles: themeObstacles,
      itemBoxes
    };
  }
}
