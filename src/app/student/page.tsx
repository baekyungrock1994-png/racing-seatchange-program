// src/app/student/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GameCanvas } from '@/components/GameCanvas';
import { StudentHUD } from '@/components/StudentHUD';
import { MobileController } from '@/components/MobileController';
import { GameRoom, Player } from '@/types/game';
import { SyncBridge } from '@/lib/syncBridge';
import { ControlInput } from '@/engine/CartPhysics';
import { CHARACTERS } from '@/constants/characters';
import { Loader2, Flag, ArrowLeft } from 'lucide-react';

function StudentGameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomCode = searchParams.get('room')?.toUpperCase() || '';
  const playerId = searchParams.get('playerId') || '';

  const [room, setRoom] = useState<GameRoom | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isMobileMode, setIsMobileMode] = useState(false);

  // 실시간 방 상태 구독
  useEffect(() => {
    if (!roomCode) return;

    const unsub = SyncBridge.subscribeRoom(roomCode, (updated) => {
      if (updated) {
        setRoom(updated);
        if (playerId && updated.players?.[playerId]) {
          setPlayer(updated.players[playerId]);
        }
      }
    });

    return () => unsub();
  }, [roomCode, playerId]);

  // 로컬 모바일 컨트롤러 입력 핸들러
  const handleMobileInput = (inputUpdate: Partial<ControlInput>) => {
    // 키보드 이벤트와 동등하게 Window KeyboardEvent를 트리거하여 일관된 물리 루프 처리
    const keyMap: Record<keyof ControlInput, string> = {
      forward: 'ArrowUp',
      backward: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      drift: 'Space'
    };

    Object.entries(inputUpdate).forEach(([key, isPressed]) => {
      const code = keyMap[key as keyof ControlInput];
      if (code) {
        const eventType = isPressed ? 'keydown' : 'keyup';
        window.dispatchEvent(new KeyboardEvent(eventType, { code, key: code }));
      }
    });
  };

  if (!roomCode || !playerId) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl max-w-md">
          <p className="text-rose-400 font-bold mb-4">방 코드 또는 참가자 정보가 올바르지 않습니다.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
          >
            홈으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  if (!room || !player) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
        <h2 className="text-xl font-black">레이싱 경기장에 입장 중...</h2>
        <p className="text-xs text-slate-400 mt-1">방 코드: {roomCode}</p>
      </main>
    );
  }

  const charMeta = CHARACTERS[player.characterId] || CHARACTERS.speed_racer;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 2D 캔버스 (학생 1인칭 추적 & Fog of War 시야) */}
      <GameCanvas
        room={room}
        role="student"
        currentPlayerId={player.id}
      />

      {/* 학생 상단 HUD */}
      <StudentHUD
        player={player}
        isMobileMode={isMobileMode}
        onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
        speed={player.speed}
      />

      {/* 모바일 가상 조이스틱 (휴대폰 버전 켰을 때) */}
      {isMobileMode && room.status === 'RACING' && (
        <MobileController
          onInputChange={handleMobileInput}
          activeEffect={player.activeEffect}
        />
      )}

      {/* 대기실 상태: 시작 대기 전광판 */}
      {room.status === 'LOBBY' && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-20">
          <div className="bg-slate-900/95 backdrop-blur-md border-2 border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-pulse-slow">
            <div className="w-16 h-24 mx-auto mb-4 flex items-center justify-center">
              <img src={charMeta.imageSrc} alt={charMeta.name} className="w-full h-full object-contain" />
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {player.number}번 {player.name}
            </span>

            <h2 className="text-2xl font-black text-white mt-3">출전 준비 완료!</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              선생님이 <strong>"Start your engine!"</strong>을 누르면 카운트다운과 함께 레이스가 시작됩니다.
            </p>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400">
              💡 키보드 방향키(`↑`, `↓`, `←`, `→`) 또는 `WASD`로 조작하세요.
            </div>
          </div>
        </div>
      )}

      {/* 카운트다운 전광판 오버레이 */}
      {room.status === 'COUNTDOWN' && (
        <div className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="text-9xl font-black text-amber-400 animate-bounce tracking-widest drop-shadow-[0_0_40px_rgba(245,158,11,0.9)]">
            {room.countdown > 0 ? room.countdown : 'GO!'}
          </div>
          <p className="text-lg font-bold text-white mt-4 tracking-widest">
            START YOUR ENGINE!
          </p>
        </div>
      )}

      {/* 레이싱 종료 후 최종 결과 대기 */}
      {room.status === 'FINISHED' && (
        <div className="absolute inset-0 pointer-events-none z-30 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-md p-6">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="text-4xl mb-2">🏁</div>
            <h2 className="text-2xl font-black text-white mb-2">레이싱이 종료되었습니다!</h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              모든 학생의 자리가 확정되었습니다.<br />
              교실 앞쪽 빔프로젝터 화면의 <strong>최종 자리 배치표</strong>를 확인해 주세요!
            </p>
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-amber-400 font-bold">
              {player.seatedId ? `배정된 자리: ${player.seatedId.replace('seat_', '').replace('_', '행 ')}열` : '자리 배치 완료'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    }>
      <StudentGameContent />
    </Suspense>
  );
}
