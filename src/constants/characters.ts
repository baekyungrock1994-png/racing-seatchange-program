// src/constants/characters.ts
import { CharacterId } from '@/types/game';

export interface CharacterMeta {
  id: CharacterId;
  name: string;
  themeTitle: string;
  imageSrc: string;
  themeColor: string;
  accentColor: string;
  description: string;
}

export const CHARACTERS: Record<CharacterId, CharacterMeta> = {
  speed_racer: {
    id: 'speed_racer',
    name: '스피드 레이서',
    themeTitle: '🏁 정통 서킷',
    imageSrc: '/assets/carts/speed_racer.png',
    themeColor: '#EF4444', // Red
    accentColor: '#FCA5A5',
    description: '날렵한 레드 포뮬러 카트와 당찬 학생 드라이버'
  },
  cosmo_rider: {
    id: 'cosmo_rider',
    name: '코스모 라이더',
    themeTitle: '🌌 우주 정거장',
    imageSrc: '/assets/carts/cosmo_rider.png',
    themeColor: '#06B6D4', // Cyan / Neon
    accentColor: '#67E8F9',
    description: '사이버 네온 블랙 카트와 미래형 우주 헬멧'
  },
  winter_penguin: {
    id: 'winter_penguin',
    name: '윈터 펭귄',
    themeTitle: '❄️ 얼음왕국',
    imageSrc: '/assets/carts/winter_penguin.png',
    themeColor: '#38BDF8', // Ice Blue
    accentColor: '#BAE6FD',
    description: '눈꽃 문양 스노우 썰매와 귀여운 펭귄 후드'
  },
  gladiator: {
    id: 'gladiator',
    name: '글래디에이터',
    themeTitle: '⚔️ 고대 콜로세움',
    imageSrc: '/assets/carts/gladiator.png',
    themeColor: '#EAB308', // Gold / Stone
    accentColor: '#FDE047',
    description: '신전 기둥과 방패를 두른 석조 전차 & 검투사'
  },
  pencil_scholar: {
    id: 'pencil_scholar',
    name: '펜슬 스칼라',
    themeTitle: '✏️ 교실 어드벤처',
    imageSrc: '/assets/carts/pencil_scholar.png',
    themeColor: '#F97316', // Orange / Wooden
    accentColor: '#FDBA74',
    description: '노란 연필과 지우개 범퍼 카트 & 자를 든 모범생'
  }
};

export const CHARACTER_LIST = Object.values(CHARACTERS);
