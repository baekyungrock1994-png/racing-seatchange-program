// src/types/game.ts

export type CircuitThemeId = 
  | 'classic'      // 🏁 정통 레이싱장
  | 'classroom'    // ✏️ 교실 어드벤처
  | 'space'        // 🌌 우주 정거장
  | 'europe'       // 🏛️ 유럽 도시
  | 'colosseum'    // ⚔️ 고대 콜로세움
  | 'ice';         // ❄️ 얼음왕국

export type CharacterId = 
  | 'speed_racer'     // 스피드 레이서 (빨간 포뮬러)
  | 'cosmo_rider'     // 코스모 라이더 (사이버 네온)
  | 'winter_penguin'  // 윈터 펭귄 (스노우 썰매)
  | 'gladiator'       // 글래디에이터 (신전 기둥 전차)
  | 'pencil_scholar'; // 펜슬 스칼라 (연필 우든 카트)

export type RoomStatus = 
  | 'LOBBY'        // 대기실 (학생 입장 중, 교사 세팅)
  | 'COUNTDOWN'    // 3, 2, 1 카운트다운
  | 'RACING'       // 레이싱 진행 중
  | 'FINISHED';    // 레이스 종료 및 자리배치 완료

export type ItemType = 
  | 'confuse'     // 💫 3초간 좌우 조작 반전
  | 'teleport'    // 🌀 미착석 다른 학생과 위치 맞교환
  | 'booster'     // 🚀 순간 가속
  | 'shield';     // 🛡️ 장애물 1회 방어

export interface Seat {
  id: string;              // e.g. "seat_0_1"
  row: number;
  col: number;
  active: boolean;         // 실제 책상이 있는지 여부
  occupiedBy: string | null;     // 점유한 플레이어 ID
  studentName: string | null;    // 학생 이름
  studentNumber: number | null;  // 학생 번호
  characterId: CharacterId | null;
  x: number;               // 맵 상의 좌석 중심 X
  y: number;               // 맵 상의 좌석 중심 Y
  width: number;           // 좌석 박스 폭
  height: number;          // 좌석 박스 높이
  openSide: 'bottom' | 'top' | 'left' | 'right'; // 열린 면 (기본 bottom)
  claimTime?: number;      // 좌석 진입 선점 시간 (ms)
  underDuel?: boolean;     // 주사위 대결 진행 중 여부
}

export interface SeatDuelParticipant {
  id: string;
  name: string;
  number: number;
  characterId: CharacterId;
  roll?: number;           // 주사위 눈금 (1~6)
}

export interface SeatDuel {
  id: string;              // e.g. "duel_seat_0_1_1726800000"
  seatId: string;
  seatName: string;        // e.g. "1분단 2열 (자리 3번)"
  player1: SeatDuelParticipant;
  player2: SeatDuelParticipant;
  winnerId?: string;       // 승자 ID
  loserId?: string;        // 패자 ID
  status: 'rolling' | 'resolved';
  createdAt: number;
}

export interface SeatConfig {
  rows: number;
  cols: number;
  seats: Record<string, Seat>;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  characterId: CharacterId;
  color: string;
  
  // 물리 상태 (로컬 및 동기화)
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;           // 각도 (도 degree, 0은 북쪽/위쪽)
  speed: number;
  
  // 상태
  isSeated: boolean;
  seatedId: string | null;
  seatTime?: number;       // 결승선 도착 시간
  
  // 아이템/디버프 상태
  activeEffect: ItemType | null;
  effectEndTime: number;   // Timestamp (ms)
  
  lastActive: number;
}

export interface Obstacle {
  id: string;
  type: 'wall' | 'rock' | 'oil' | 'ice_patch' | 'speed_pad';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface ItemBox {
  id: string;
  x: number;
  y: number;
  size: number;
  isAvailable: boolean;
  respawnTimer: number;
}

export interface CircuitMapData {
  id: CircuitThemeId;
  name: string;
  description: string;
  worldWidth: number;
  worldHeight: number;
  bgColors: {
    primary: string;
    secondary: string;
    track: string;
    curb1: string;
    curb2: string;
    wall: string;
  };
  startLine: {
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
  };
  finishLine: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  classroomArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  trackPolygons: Array<Array<{ x: number; y: number }>>;
  trackCells: Array<{ col: number; row: number }>;
  cellSize: number;
  walls: Obstacle[];
  obstacles: Obstacle[];
  itemBoxes: ItemBox[];
}

export interface GameRoom {
  code: string;
  hostTeacherUid: string;
  status: RoomStatus;
  themeId: CircuitThemeId;
  countdown: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  
  seatConfig: SeatConfig;
  players: Record<string, Player>;
  activeDuel?: SeatDuel | null;
  
  // 동기화용 미니멀 패킷
  // key: playerId, value: {x, y, a, s}
}
