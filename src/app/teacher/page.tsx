// src/app/teacher/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SeatBuilder } from '@/components/SeatBuilder';
import { GameCanvas } from '@/components/GameCanvas';
import { TeacherHUD } from '@/components/TeacherHUD';
import { ResultBoard } from '@/components/ResultBoard';
import { THEME_LIST, THEMES } from '@/constants/themes';
import { CHARACTERS } from '@/constants/characters';
import { CircuitThemeId, GameRoom, SeatConfig } from '@/types/game';
import { CircuitMaps } from '@/engine/CircuitMaps';
import { SeatManager } from '@/engine/SeatManager';
import { SoundSystem } from '@/engine/SoundSystem';
import { SyncBridge } from '@/lib/syncBridge';
import { Users, Play, ArrowLeft, Settings2, Sparkles } from 'lucide-react';

export default function TeacherPage() {
  const router = useRouter();

  // 방 설정 단계 상태
  const [stage, setStage] = useState<'SETUP' | 'GAME'>('SETUP');
  const [selectedTheme, setSelectedTheme] = useState<CircuitThemeId>('classic');
  const [seatConfig, setSeatConfig] = useState<SeatConfig | null>(null);

  // 진행 중인 룸 객체
  const [room, setRoom] = useState<GameRoom | null>(null);

  // 좌석 그리드 변경 콜백
  const handleSeatGridChange = (rows: number, cols: number, activeGrid: boolean[][]) => {
    const map = CircuitMaps.getMap(selectedTheme);
    const config = SeatManager.generateSeats(rows, cols, activeGrid, map.classroomArea);
    setSeatConfig(config);
  };

  // 방 생성하기
  const handleCreateRoom = async () => {
    if (!seatConfig) return;

    // 선택된 테마의 정확한 교실 영역(classroomArea)으로 좌석 좌표 최종 생성
    const map = CircuitMaps.getMap(selectedTheme);
    const rows = seatConfig.rows;
    const cols = seatConfig.cols;
    const activeGrid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const id = `seat_${r}_${c}`;
        return seatConfig.seats[id]?.active ?? true;
      })
    );
    const finalSeatConfig = SeatManager.generateSeats(rows, cols, activeGrid, map.classroomArea);

    // 6자리 무작위 방 코드 생성
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: GameRoom = {
      code,
      hostTeacherUid: `teacher_${Date.now()}`,
      status: 'LOBBY',
      themeId: selectedTheme,
      countdown: 3,
      createdAt: Date.now(),
      seatConfig: finalSeatConfig,
      players: {}
    };

    await SyncBridge.createRoom(newRoom);
    setRoom(newRoom);
    setStage('GAME');
  };

  // 방 상태 실시간 구독
  useEffect(() => {
    if (!room?.code) return;

    const unsub = SyncBridge.subscribeRoom(room.code, (updated) => {
      if (updated) {
        setRoom(updated);
      }
    });

    return () => unsub();
  }, [room?.code]);

  // 카운트다운 시작 및 사운드 트리거
  const handleStartCountdown = async () => {
    if (!room) return;

    // 카운트다운 상태로 진입
    await SyncBridge.updateRoomStatus(room.code, 'COUNTDOWN', 3);
    SoundSystem.playCountdown(false);

    // 1초 간격 3 -> 2 -> 1 -> GO!
    setTimeout(async () => {
      await SyncBridge.updateRoomStatus(room.code, 'COUNTDOWN', 2);
      SoundSystem.playCountdown(false);
    }, 1000);

    setTimeout(async () => {
      await SyncBridge.updateRoomStatus(room.code, 'COUNTDOWN', 1);
      SoundSystem.playCountdown(false);
    }, 2000);

    setTimeout(async () => {
      await SyncBridge.updateRoomStatus(room.code, 'RACING', 0);
      SoundSystem.playCountdown(true); // GO!
    }, 3000);
  };

  // 교사 비상 권한: 레이싱 종료 및 미착석자 무작위 자동 배정
  const handleFinishRace = async () => {
    if (!room) return;

    const { updatedSeats, updatedPlayers } = SeatManager.forceRandomAssignment(
      room.seatConfig,
      room.players || {}
    );

    const updatedConfig: SeatConfig = {
      ...room.seatConfig,
      seats: updatedSeats
    };

    await SyncBridge.updateSeatsAndPlayers(room.code, updatedConfig, updatedPlayers);
  };

  // 결과 화면에서 대기실로 돌아가기
  const handleBackToLobby = async () => {
    if (!room) return;
    setStage('SETUP');
  };

  // 1. 방 설정 화면 (SETUP)
  if (stage === 'SETUP') {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6 sm:p-10 flex flex-col items-center">
        <div className="w-full max-w-5xl">
          {/* 상단 네비게이션 */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-bold text-sm flex items-center gap-2 hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" /> 홈으로
            </button>

            <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
              <Settings2 className="w-4 h-4" />
              <span>선생님 게임 개설 모드</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              새로운 레이싱 자리바꾸기 방 개설
            </h1>
            <p className="text-slate-400 text-sm mt-2">
              교실 좌석 형태를 지정하고 원하는 서킷 테마를 선택하세요.
            </p>
          </div>

          {/* 1) 좌석 배치 에디터 */}
          <div className="mb-8">
            <SeatBuilder onChange={handleSeatGridChange} />
          </div>

          {/* 2) 6종 테마 서킷 선택기 */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 mb-8">
            <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" /> 서킷 테마 선택 (6종)
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              아이들이 질주할 서킷의 분위기와 고유 기믹 장애물을 선택하세요.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {THEME_LIST.map((th) => {
                const isSelected = selectedTheme === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => setSelectedTheme(th.id)}
                    className={`p-5 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow-xl shadow-amber-500/20 scale-[1.02]'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-3xl">{th.icon}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {th.gimmickName}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-white">{th.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {th.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 방 생성 완료 버튼 */}
          <div className="flex justify-center">
            <button
              onClick={handleCreateRoom}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-lg shadow-2xl shadow-amber-500/40 flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95"
            >
              <Play className="w-6 h-6 fill-slate-950" /> 레이싱 방 개설 및 학생 대기실 열기
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 2. 게임 단계 (대기실 LOBBY, 레이싱 RACING, 결과 FINISHED)
  if (!room) return null;

  // 완주 완료 화면 (ResultBoard)
  if (room.status === 'FINISHED') {
    return <ResultBoard room={room} onBackToLobby={handleBackToLobby} />;
  }

  const players = Object.values(room.players || {});

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* 2D 레이싱 캔버스 (전체 맵 렌더러) */}
      <GameCanvas
        room={room}
        role="teacher"
        onFinishRace={handleFinishRace}
      />

      {/* 교사용 중계 HUD 헤더 */}
      <TeacherHUD
        room={room}
        onStartCountdown={handleStartCountdown}
        onFinishRace={handleFinishRace}
        onViewResults={() => SyncBridge.updateRoomStatus(room.code, 'FINISHED')}
      />

      {/* 대기실 (LOBBY) 상태일 때 중앙 대형 방 코드 및 참가 학생 명단 오버레이 */}
      {room.status === 'LOBBY' && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-20">
          <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border-2 border-slate-800 rounded-3xl p-8 max-w-2xl w-full text-center shadow-2xl">
            <div className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">
              교실 대기실 (Lobby)
            </div>

            <div className="text-slate-400 text-sm mb-4">
              학생들은 크롬북/스마트폰으로 아래 방 코드를 입력하고 들어오세요!
            </div>

            {/* 대형 방 코드 배너 */}
            <div className="inline-block px-8 py-4 rounded-3xl bg-slate-950 border-2 border-amber-500/60 shadow-2xl shadow-amber-500/20 mb-6">
              <span className="text-5xl sm:text-6xl font-mono font-black text-amber-400 tracking-widest">
                {room.code}
              </span>
            </div>

            {/* 실시간 참가 학생 명단 */}
            <div className="border-t border-slate-800/80 pt-5">
              <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-400">
                <span>참가한 학생 ({players.length}명)</span>
                <span className="text-emerald-400">모두 준비되면 위 'Start your engine!' 클릭</span>
              </div>

              {players.length === 0 ? (
                <div className="py-8 text-sm text-slate-500 font-medium">
                  학생들의 입장을 기다리는 중입니다...
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {players.map((p) => {
                    const char = CHARACTERS[p.characterId] || CHARACTERS.speed_racer;
                    return (
                      <div
                        key={p.id}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 flex items-center gap-2"
                      >
                        <div className="w-6 h-8 flex items-center justify-center">
                          <img src={char.imageSrc} alt={char.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="text-left truncate">
                          <div className="text-[10px] text-amber-400 font-bold">{p.number}번</div>
                          <div className="text-xs font-bold text-white truncate">{p.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
