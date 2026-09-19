// src/components/GameCanvas.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { GameRoom, Player, Seat, CircuitMapData, ItemBox } from '@/types/game';
import { CartPhysics, ControlInput, DEFAULT_PHYSICS_CONFIG } from '@/engine/CartPhysics';
import { CircuitMaps } from '@/engine/CircuitMaps';
import { CameraSystem, CameraState } from '@/engine/CameraSystem';
import { SoundSystem } from '@/engine/SoundSystem';
import { SyncBridge } from '@/lib/syncBridge';
import { CHARACTERS } from '@/constants/characters';

interface GameCanvasProps {
  room: GameRoom;
  role: 'teacher' | 'student';
  currentPlayerId?: string;
  onSeatClaimed?: (seatId: string) => void;
  onFinishRace?: () => void;
}

export function GameCanvas({
  room,
  role,
  currentPlayerId,
  onSeatClaimed,
  onFinishRace
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 로컬 플레이어 물리 상태 (학생 화면일 때 딜레이 없이 60FPS 구동)
  const localPlayerRef = useRef<Player | null>(null);
  const inputRef = useRef<ControlInput>({
    forward: false,
    backward: false,
    left: false,
    right: false
  });

  // 스프라이트 이미지 캐시
  const cartImagesRef = useRef<Record<string, HTMLImageElement>>({});

  // 카메라 상태
  const cameraRef = useRef<CameraState>({
    x: 0,
    y: 0,
    zoom: 1.0,
    targetZoom: 1.0
  });

  // 교사용 마우스 드래그 패닝 상태
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 맵 데이터
  const mapDataRef = useRef<CircuitMapData>(CircuitMaps.getMap(room.themeId));

  // Throttling용 이전 전송 시각
  const lastSyncTimeRef = useRef(0);

  // 이미지 프리로드
  useEffect(() => {
    mapDataRef.current = CircuitMaps.getMap(room.themeId);

    Object.values(CHARACTERS).forEach((char) => {
      const img = new Image();
      img.src = char.imageSrc;
      cartImagesRef.current[char.id] = img;
    });
  }, [room.themeId]);

  // 로컬 플레이어 초기화
  useEffect(() => {
    if (role === 'student' && currentPlayerId && room.players?.[currentPlayerId]) {
      localPlayerRef.current = { ...room.players[currentPlayerId] };
    }
  }, [currentPlayerId]);

  // 키보드 이벤트 리스너 (학생 크롬북/PC 조작)
  useEffect(() => {
    if (role !== 'student') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) inputRef.current.forward = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) inputRef.current.backward = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) inputRef.current.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) inputRef.current.right = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) inputRef.current.forward = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) inputRef.current.backward = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) inputRef.current.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) inputRef.current.right = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [role]);

  // 교사 마우스 휠 줌인/줌아웃 & 패닝 핸들러
  useEffect(() => {
    if (role !== 'teacher') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      cameraRef.current.targetZoom = Math.max(0.2, Math.min(2.5, cameraRef.current.targetZoom * zoomFactor));
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = (e.clientX - dragStartRef.current.x) / cameraRef.current.zoom;
      const dy = (e.clientY - dragStartRef.current.y) / cameraRef.current.zoom;
      cameraRef.current.x -= dx;
      cameraRef.current.y -= dy;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [role]);

  // 메인 60FPS 애니메이션 렌더링 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width = window.innerWidth;
      const height = canvas.height = window.innerHeight;
      const map = mapDataRef.current;
      const now = Date.now();

      // 1. 학생인 경우 로컬 물리 연산 (60FPS Client Prediction)
      if (role === 'student' && localPlayerRef.current && room.status === 'RACING') {
        let p = CartPhysics.update(localPlayerRef.current, inputRef.current, room.themeId);

        // 벽 충돌 검사
        map.walls.forEach((wall) => {
          p = CartPhysics.handleWallCollision(p, wall);
        });
        map.obstacles.forEach((obs) => {
          if (obs.type === 'wall' || obs.type === 'rock') {
            p = CartPhysics.handleWallCollision(p, obs);
          }
        });

        // 아이템 상자 충돌 검사
        map.itemBoxes.forEach((box) => {
          if (box.isAvailable) {
            const dist = Math.hypot(p.x - box.x, p.y - box.y);
            if (dist < box.size + 18) {
              box.isAvailable = false;
              box.respawnTimer = now + 12000;
              SoundSystem.playItemPickup();

              // 랜덤 아이템 부여
              const items: Array<'confuse' | 'booster' | 'shield' | 'teleport'> = ['confuse', 'booster', 'shield', 'teleport'];
              const chosen = items[Math.floor(Math.random() * items.length)];

              if (chosen === 'teleport') {
                // 미착석 다른 플레이어와 즉시 위치 교환
                const otherUnseated = Object.values(room.players || {}).filter(
                  other => other.id !== p.id && !other.isSeated
                );
                if (otherUnseated.length > 0) {
                  const target = otherUnseated[Math.floor(Math.random() * otherUnseated.length)];
                  const tempX = p.x;
                  const tempY = p.y;
                  p.x = target.x;
                  p.y = target.y;
                  SyncBridge.updatePlayerPosition(room.code, {
                    ...target,
                    x: tempX,
                    y: tempY
                  });
                }
              } else {
                p.activeEffect = chosen;
                p.effectEndTime = now + (chosen === 'confuse' ? 3000 : 2500);
              }
            }
          } else if (box.respawnTimer > 0 && now >= box.respawnTimer) {
            box.isAvailable = true;
          }
        });

        // ㄷ자 좌석 진입 선점 검사
        if (!p.isSeated && room.seatConfig?.seats) {
          for (const seat of Object.values(room.seatConfig.seats)) {
            if (CartPhysics.checkSeatEntry(p, seat)) {
              // 진입 감지 -> 원자적 선점 요청!
              p.isSeated = true;
              p.seatedId = seat.id;
              p.speed = 0;
              p.vx = 0;
              p.vy = 0;
              p.x = seat.x;
              p.y = seat.y;

              SoundSystem.playSeatSuccess();
              SyncBridge.claimSeat(room.code, seat.id, p);
              onSeatClaimed?.(seat.id);
              break;
            }
          }
        }

        localPlayerRef.current = p;

        // 초당 12회 (약 80ms 간격) Throttling 네트워크 전송
        if (now - lastSyncTimeRef.current > 80) {
          lastSyncTimeRef.current = now;
          SyncBridge.updatePlayerPosition(room.code, p);
        }
      }

      // 2. 카메라 업데이트
      if (role === 'student' && localPlayerRef.current) {
        cameraRef.current = CameraSystem.updateStudentCamera(
          cameraRef.current,
          localPlayerRef.current.x,
          localPlayerRef.current.y,
          width,
          height
        );
      } else if (role === 'teacher') {
        cameraRef.current = CameraSystem.updateTeacherCamera(
          cameraRef.current,
          width,
          height,
          map.worldWidth,
          map.worldHeight
        );
      }

      const cam = cameraRef.current;

      // 3. 월드 렌더링 시작 (카메라 변환 적용)
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // 교사 화면 줌 / 오프셋 적용
      ctx.translate(width / 2, height / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x - width / 2, -cam.y - height / 2);

      // (1) 월드 배경색 (잔디, 우주, 빙판 등)
      ctx.fillStyle = map.bgColors.primary;
      ctx.fillRect(0, 0, map.worldWidth, map.worldHeight);

      // (2) 서킷 아스팔트/트랙 굵은 경로 렌더링
      drawTrackGuides(ctx, map);

      // (3) 결승선 및 교실 영역 렌더링
      drawClassroomArea(ctx, map, room.seatConfig?.seats || {});

      // (4) 장애물 및 아이템 박스 렌더링
      drawObstaclesAndItems(ctx, map, now);

      // (5) 플레이어 카트 렌더링
      const playersToRender = { ...room.players };
      if (role === 'student' && localPlayerRef.current) {
        playersToRender[localPlayerRef.current.id] = localPlayerRef.current;
      }

      Object.values(playersToRender).forEach((player) => {
        drawCart(ctx, player, cartImagesRef.current[player.characterId], now);
      });

      ctx.restore();

      // 4. 학생 화면: Fog of War (원형 스포트라이트 시야) 마스크 오버레이
      if (role === 'student' && localPlayerRef.current) {
        // 화면 중앙(플레이어 위치) 기준으로 어둠 마스킹
        CameraSystem.applyFogOfWar(ctx, width, height, width / 2, height / 2, 320);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [room.status, room.themeId, room.players, role]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 select-none">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

// --- 캔버스 드로잉 서브 루틴들 ---

function drawTrackGuides(ctx: CanvasRenderingContext2D, map: CircuitMapData) {
  ctx.save();
  // 1. 아스팔트 트랙 도로망 렌더링 (폐쇄형 고속 서킷)
  ctx.fillStyle = map.bgColors.track;

  // 1구간: 출발선 및 서쪽 메인 직선 주로 (x: 60 ~ 580, y: 480 ~ 2100)
  ctx.fillRect(60, 480, 520, 1620);

  // 2구간: 1번 코너 및 상단 직선 주로 (x: 60 ~ 1900, y: 60 ~ 480)
  ctx.fillRect(60, 60, 1840, 420);

  // 3구간: 중앙 지그재그 슬라럼 테크니컬 코스
  // 우측 다운힐 (x: 1050 ~ 1900, y: 480 ~ 850)
  ctx.fillRect(1050, 480, 850, 370);
  // 좌측 슬라럼 턴 (x: 640 ~ 1400, y: 850 ~ 1250)
  ctx.fillRect(640, 850, 760, 400);
  // 우측 슬라럼 턴 (x: 1400 ~ 1920, y: 1250 ~ 1650)
  ctx.fillRect(1400, 1250, 520, 400);
  // 하단 턴 (x: 640 ~ 1920, y: 1650 ~ 2150)
  ctx.fillRect(640, 1650, 1280, 500);

  // 4구간: 교실 진입 도로 (x: 1920 ~ 2450, y: 1250 ~ 2150)
  ctx.fillRect(1920, 1250, 530, 900);

  ctx.restore();

  // 2. 가드레일 (외벽 및 트랙 분리벽) 렌더링
  map.walls.forEach((wall) => {
    ctx.save();
    ctx.fillStyle = wall.color || '#334155';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

    // 가드레일 옐로우/화이트 스트라이프 디테일
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(wall.x + 2, wall.y + 2, wall.width - 4, wall.height - 4);
    ctx.restore();
  });

  // 3. 출발선 체크무늬 깃발 패턴 (x: 180, y: 1950)
  ctx.save();
  const sl = map.startLine;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(sl.x, sl.y, sl.width, sl.height);
  const tileSize = 20;
  ctx.fillStyle = '#0F172A';
  for (let x = sl.x; x < sl.x + sl.width; x += tileSize) {
    for (let y = sl.y; y < sl.y + sl.height; y += tileSize) {
      if (((x - sl.x) / tileSize + (y - sl.y) / tileSize) % 2 === 0) {
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  // START 텍스트 바닥 마킹
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'black 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏁 S T A R T 🏁', sl.x + sl.width / 2, sl.y - 15);
  ctx.restore();

  // 4. 결승선 아치 및 교실 정문 게이트 (x: 1980, y: 1250)
  ctx.save();
  const fl = map.finishLine;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(fl.x, fl.y, fl.width, fl.height);
  for (let x = fl.x; x < fl.x + fl.width; x += tileSize) {
    for (let y = fl.y; y < fl.y + fl.height; y += tileSize) {
      if (((x - fl.x) / tileSize + (y - fl.y) / tileSize) % 2 === 0) {
        ctx.fillStyle = '#10B981';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  // 진입로 바닥 대형 유도 화살표
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'black 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▲ ▲ ▲ 교 실 정 문 (F I N I S H) ▲ ▲ ▲', fl.x + fl.width / 2, fl.y + 110);
  ctx.fillText('▲ ▲ ▲ 원하는 자리에 주차하세요! ▲ ▲ ▲', fl.x + fl.width / 2, fl.y + 160);
  ctx.restore();
}

function drawClassroomArea(
  ctx: CanvasRenderingContext2D,
  map: CircuitMapData,
  seats: Record<string, Seat>
) {
  const ca = map.classroomArea;

  ctx.save();
  // 교실 바닥 (클래식 학교 마룻바닥)
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(ca.x, ca.y, ca.width, ca.height);

  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 6;
  ctx.strokeRect(ca.x, ca.y, ca.width, ca.height);

  // 칠판 (상단)
  ctx.fillStyle = '#065F46';
  ctx.fillRect(ca.x + ca.width / 2 - 240, ca.y + 20, 480, 50);
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 3;
  ctx.strokeRect(ca.x + ca.width / 2 - 240, ca.y + 20, 480, 50);
  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'black 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('칠  판 (교탁 / 앞 쪽)', ca.x + ca.width / 2, ca.y + 52);

  // ㄷ자 좌석 박스 렌더링
  Object.values(seats).forEach((seat) => {
    if (!seat.active) return;

    const left = seat.x - seat.width / 2;
    const top = seat.y - seat.height / 2;
    const w = seat.width;
    const h = seat.height;
    const wallThick = 6;

    ctx.save();
    if (seat.occupiedBy !== null) {
      // 1) 점유된 좌석 (초록빛 완주 & 바리케이드 잠금)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.fillRect(left, top, w, h);

      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = wallThick;
      ctx.strokeRect(left, top, w, h);

      // 학생 이름 & 번호 뱃지
      ctx.fillStyle = '#10B981';
      ctx.fillRect(left + 4, top + 4, w - 8, 22);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${seat.studentNumber}번 ${seat.studentName}`, seat.x, top + 19);

      // 착석 완료 도장 마크
      ctx.fillStyle = '#34D399';
      ctx.font = 'black 11px sans-serif';
      ctx.fillText('착석 완료', seat.x, top + h - 14);
    } else {
      // 2) 빈 좌석 (디귿자(ㄷ) 한 면이 열린 사각형)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      ctx.fillRect(left, top, w, h);

      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = wallThick;

      // ㄷ자 벽 그리기 (상단, 좌측, 우측 막힘 / 하단 열림)
      ctx.beginPath();
      ctx.moveTo(left, top + h);       // 좌측 하단 시작
      ctx.lineTo(left, top);           // 좌측 벽
      ctx.lineTo(left + w, top);       // 상단 벽
      ctx.lineTo(left + w, top + h);   // 우측 벽
      ctx.stroke();

      // 입구 표시 화살표 (▲ 진입 방향)
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲ 입구', seat.x, top + h - 6);

      // 좌석 번호
      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${seat.row + 1}-${seat.col + 1}`, seat.x, seat.y);
    }
    ctx.restore();
  });

  ctx.restore();
}

function drawObstaclesAndItems(ctx: CanvasRenderingContext2D, map: CircuitMapData, now: number) {
  // 테마 장애물
  map.obstacles.forEach((obs) => {
    ctx.save();
    ctx.fillStyle = obs.color || '#475569';
    if (obs.type === 'oil') {
      // 오일 슬릭 타원형
      ctx.beginPath();
      ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
    ctx.restore();
  });

  // ? 아이템 상자 (둥둥 떠다니는 애니메이션)
  map.itemBoxes.forEach((box) => {
    if (!box.isAvailable) return;

    const floatOffset = Math.sin(now * 0.005 + box.x) * 4;

    ctx.save();
    ctx.translate(box.x, box.y + floatOffset);

    // 상자 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 네온 큐브 상자
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 12;
    ctx.fillRect(-box.size / 2, -box.size / 2, box.size, box.size);
    ctx.strokeRect(-box.size / 2, -box.size / 2, box.size, box.size);

    // 물음표 (?)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'black 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 0);

    ctx.restore();
  });
}

function drawCart(
  ctx: CanvasRenderingContext2D,
  player: Player,
  cartImg: HTMLImageElement | undefined,
  now: number
) {
  ctx.save();
  ctx.translate(player.x, player.y);
  // 카트 일러스트 원본이 아래쪽을 바라보고 있으므로, 카트 앞머리가 진행 방향(북쪽 0도)을 향하도록 180도 회전
  ctx.rotate(((player.angle + 180) * Math.PI) / 180);

  const w = DEFAULT_PHYSICS_CONFIG.cartWidth;
  const h = DEFAULT_PHYSICS_CONFIG.cartHeight;

  // 1. 카트 스프라이트 이미지 또는 고품질 절차적 벡터 렌더링
  if (cartImg && cartImg.complete && cartImg.naturalWidth > 0) {
    ctx.drawImage(cartImg, -w / 2, -h / 2, w, h);
  } else {
    // 백업 벡터 카트 렌더링
    ctx.fillStyle = player.color || '#EF4444';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 8, w - 8, 14); // 윈드실드
  }

  // 활성 디버프/아이템 이펙트 링
  if (player.activeEffect && player.effectEndTime > now) {
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    if (player.activeEffect === 'confuse') {
      ctx.strokeStyle = '#E879F9'; // 핑크 혼란
    } else if (player.activeEffect === 'booster') {
      ctx.strokeStyle = '#06B6D4'; // 시안 부스터
    } else if (player.activeEffect === 'shield') {
      ctx.strokeStyle = '#38BDF8'; // 블루 쉴드
    }
    ctx.stroke();
  }

  ctx.restore();

  // 2. 카트 회전과 무관한 수평 플레이어 이름표 및 번호 뱃지
  ctx.save();
  ctx.translate(player.x, player.y - 36);

  // 번호 뱃지
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 1.5;
  const label = `${player.number}번 ${player.name}`;
  ctx.font = 'bold 11px sans-serif';
  const textWidth = ctx.measureText(label).width;

  ctx.beginPath();
  ctx.roundRect(-textWidth / 2 - 6, -10, textWidth + 12, 18, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 0);

  ctx.restore();
}
