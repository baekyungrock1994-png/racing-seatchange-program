// src/constants/themes.ts
import { CircuitThemeId } from '@/types/game';

export interface ThemeConfig {
  id: CircuitThemeId;
  name: string;
  icon: string;
  subtitle: string;
  description: string;
  bgColor: string;
  trackColor: string;
  curbColor1: string;
  curbColor2: string;
  wallColor: string;
  accentColor: string;
  gimmickName: string;
  gimmickDesc: string;
}

export const THEMES: Record<CircuitThemeId, ThemeConfig> = {
  classic: {
    id: 'classic',
    name: '정통 레이싱장',
    icon: '🏁',
    subtitle: 'Classic Grand Prix',
    description: '아스팔트 트랙과 체크무늬 연석이 살아 숨쉬는 스피드 서킷',
    bgColor: '#15803D',      // 잔디 녹색
    trackColor: '#334155',   // 짙은 아스팔트
    curbColor1: '#EF4444',   // 빨강 연석
    curbColor2: '#FFFFFF',   // 하양 연석
    wallColor: '#1E293B',    // 타이어 장벽
    accentColor: '#EF4444',
    gimmickName: '오일 슬릭',
    gimmickDesc: '밟으면 카트가 순간적으로 핑그르르 회전합니다.'
  },
  classroom: {
    id: 'classroom',
    name: '교실 어드벤처',
    icon: '✏️',
    subtitle: 'Classroom Adventure',
    description: '거대해진 교실 바닥, 공책과 연필로 만들어진 장애물 코스',
    bgColor: '#78350F',      // 나무 마룻바닥 색
    trackColor: '#B45309',   // 닦여진 복도 마루
    curbColor1: '#F59E0B',   // 노랑 분필
    curbColor2: '#3B82F6',   // 파랑 분필
    wallColor: '#D97706',    // 연필/필통 가드레일
    accentColor: '#F59E0B',
    gimmickName: '엎질러진 우유',
    gimmickDesc: '미끄러운 액체 위에서 제동력이 50% 감소합니다.'
  },
  space: {
    id: 'space',
    name: '우주 정거장',
    icon: '🌌',
    subtitle: 'Cosmic Nebula Track',
    description: '심우주의 성운과 네온 발광 트랙을 가로지르는 하이퍼 스피드웨이',
    bgColor: '#030712',      // 심우주 칠흑
    trackColor: '#0F172A',   // 딥 네이비 트랙
    curbColor1: '#06B6D4',   // 사이안 네온
    curbColor2: '#A855F7',   // 퍼플 네온
    wallColor: '#1E1B4B',    // 에너지 쉴드
    accentColor: '#06B6D4',
    gimmickName: '워프 가속 패드',
    gimmickDesc: '밟으면 전방으로 강력한 부스터가 발동합니다.'
  },
  europe: {
    id: 'europe',
    name: '유럽 도시',
    icon: '🏛️',
    subtitle: 'European Old Town',
    description: '고풍스러운 돌바닥(코블스톤)과 분수 광장, 좁은 골목길 레이스',
    bgColor: '#3F3F46',      // 회색 보도블럭
    trackColor: '#52525B',   // 코블스톤 돌길
    curbColor1: '#F43F5E',   // 붉은 꽃길 연석
    curbColor2: '#E4E4E7',   // 흰 돌 연석
    wallColor: '#27272A',    // 벽돌 건물 벽
    accentColor: '#F43F5E',
    gimmickName: '분수대 로터리',
    gimmickDesc: '회전 구간에서 물보라로 인해 시야가 일시적으로 흐려집니다.'
  },
  colosseum: {
    id: 'colosseum',
    name: '고대 콜로세움',
    icon: '⚔️',
    subtitle: 'Gladiator Arena',
    description: '웅장한 원형 경기장 모래사장과 무너진 대리석 신전 기둥 코스',
    bgColor: '#713F12',      // 거친 흙/모래
    trackColor: '#A16207',   // 다져진 경기장 샌드
    curbColor1: '#EAB308',   // 골드
    curbColor2: '#78350F',   // 고대 갈색
    wallColor: '#451A03',    // 대리석 성벽
    accentColor: '#EAB308',
    gimmickName: '불타는 횃불 트랩',
    gimmickDesc: '화염 장벽에 닿으면 카트가 튕겨져 나갑니다.'
  },
  ice: {
    id: 'ice',
    name: '얼음왕국',
    icon: '❄️',
    subtitle: 'Frozen Glacier',
    description: '반짝이는 고드름과 푸른 빙판길, 익스트림 드리프트 코스',
    bgColor: '#0284C7',      // 눈 덮인 바닥
    trackColor: '#38BDF8',   // 반투명 빙판 트랙
    curbColor1: '#E0F2FE',   // 순백 눈둑
    curbColor2: '#0EA5E9',   // 딥 블루 얼음
    wallColor: '#0369A1',    // 빙산 가드레일
    accentColor: '#38BDF8',
    gimmickName: '익스트림 빙판',
    gimmickDesc: '관성이 매우 커서 미끄러지듯 드리프트 회전합니다.'
  }
};

export const THEME_LIST = Object.values(THEMES);
