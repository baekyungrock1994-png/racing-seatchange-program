// src/app/practice/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GameCanvas } from '@/components/GameCanvas';
import { THEME_LIST, THEMES } from '@/constants/themes';
import { CHARACTERS, CHARACTER_LIST } from '@/constants/characters';
import { CircuitThemeId, CharacterId, GameRoom, Player, SeatConfig } from '@/types/game';
import { CircuitMaps } from '@/engine/CircuitMaps';
import { SeatManager } from '@/engine/SeatManager';
import { SoundSystem } from '@/engine/SoundSystem';
import { AIBotManager, AIBotState, BotDifficulty } from '@/engine/AIBotManager';
import { 
  Bot, 
  Play, 
  RotateCcw, 
  ArrowLeft, 
  Settings2, 
  Trophy, 
  Gauge, 
  Timer, 
  Users, 
  Sparkles, 
  Check, 
  Volume2, 
  VolumeX, 
  Home 
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PracticePage() {
  const router = useRouter();

  // 1. 설정 단계 상태
  const [stage, setStage] = useState<'SETUP' | 'GAME' | 'FINISHED'>('SETUP');
  const [selectedTheme, setSelectedTheme] = useState<CircuitThemeId>('classic');
  const [botCount, setBotCount] = useState<number>(3);
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>('normal');
  const [selectedCharId, setSelectedCharId] = useState<CharacterId>('speed_racer');
  const [playerName, setPlayerName] = useState('연습 드라이버');
  const [playerNumber, setPlayerNumber] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // 2. 인게임 실행 상태
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentRank, setCurrentRank] = useState(1);

  const botStatesRef = useRef<AIBotState[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const myPlayerIdRef = useRef<string>('practice_player');

  // 연습 레이스 시작
  const handleStartPractice = () => {
    const map = CircuitMaps.getMap(selectedTheme);
    const sl = map.startLine;

    // 1. 내 플레이어 객체 생성
    const myId = `player_practice_${Date.now()}`;
    myPlayerIdRef.current = myId;

    const myPlayer: Player = {
      id: myId,
      name: playerName.trim() || '연습 드라이버',
      number: playerNumber || 1,
      characterId: selectedCharId,
      color: CHARACTERS[selectedCharId].themeColor,
      x: sl.x + 40,
      y: sl.y + 40,
      vx: 0,
      vy: 0,
      angle: sl.angle || 0,
      speed: 0,
      isSeated: false,
      seatedId: null,
      activeEffect: null,
      effectEndTime: 0,
      lastActive: Date.now()
    };

    // 2. AI 봇들 생성
    const bots = AIBotManager.createBots(botCount, botDifficulty, map);
    botStatesRef.current = bots;

    // 3. 플레이어 목록 통합
    const allPlayers: Record<string, Player> = {
      [myId]: myPlayer
    };
    bots.forEach(b => {
      allPlayers[b.player.id] = b.player;
    });

    // 4. 좌석 배치표 생성 (5행 6열 기본)
    const activeGrid = Array.from({ length: 5 }, () => Array(6).fill(true));
    const seatCfg = SeatManager.generateSeats(5, 6, activeGrid, map.classroomArea);

    // 5. 로컬 연습방 룸 객체 조립
    const practiceRoom: GameRoom = {
      code: 'SOLO_AI',
      hostTeacherUid: 'practice_host',
      status: 'COUNTDOWN',
      themeId: selectedTheme,
      countdown: 3,
      createdAt: Date.now(),
      startedAt: Date.now(),
      seatConfig: seatCfg,
      players: allPlayers,
      activeDuel: null
    };

    setRoom(practiceRoom);
    setCountdown(3);
    setElapsedMs(0);
    setStage('GAME');

    // 6. 카운트다운 시작
    SoundSystem.playBGM('lobby');
    let count = 3;
    const cdTimer = setInterval(() => {
      count -= 1;
      setCountdown(count);
      SoundSystem.playCountdown();

      if (count <= 0) {
        clearInterval(cdTimer);
        SoundSystem.playBGM('racing');
        startTimeRef.current = Date.now();

        setRoom(prev => prev ? {
          ...prev,
          status: 'RACING',
          countdown: 0,
          startedAt: Date.now()
        } : null);

        // 스톱워치 가동
        timerIntervalRef.current = setInterval(() => {
          setElapsedMs(Date.now() - startTimeRef.current);
        }, 100);
      }
    }, 1000);
  };

  // AI 봇 60FPS 프레임 업데이트 핸들러
  const handleBotFrameUpdate = useCallback((now: number) => {
    if (!room || room.status !== 'RACING') return;

    const map = CircuitMaps.getMap(room.themeId);
    const updatedBots = AIBotManager.updateBots(
      botStatesRef.current,
      map,
      room.seatConfig,
      (seatId, botPlayer) => {
        // AI 봇이 자리에 착석했을 때 좌석 점유 갱신
        setRoom(prev => {
          if (!prev) return null;
          const seats = { ...prev.seatConfig.seats };
          if (seats[seatId] && !Boolean(seats[seatId].occupiedBy)) {
            seats[seatId] = {
              ...seats[seatId],
              occupiedBy: botPlayer.id,
              studentName: botPlayer.name,
              studentNumber: botPlayer.number,
              characterId: botPlayer.characterId
            };
          }
          return {
            ...prev,
            seatConfig: { ...prev.seatConfig, seats }
          };
        });
      },
      new Date(now)
    );

    // 봇들의 최신 물리 좌표를 room.players에 반영하여 화면에 렌더링
    setRoom(prev => {
      if (!prev) return null;
      const players = { ...prev.players };
      updatedBots.forEach(b => {
        players[b.id] = b;
      });

      // 내 실시간 순위 계산 (교실 결승선과의 거리 비교)
      const myP = players[myPlayerIdRef.current];
      if (myP) {
        const finishY = map.finishLine.y;
        const myDist = Math.hypot(map.finishLine.x - myP.x, finishY - myP.y);
        let rank = 1;
        updatedBots.forEach(b => {
          if (b.isSeated && !myP.isSeated) {
            rank += 1;
          } else if (!b.isSeated && !myP.isSeated) {
            const botDist = Math.hypot(map.finishLine.x - b.x, finishY - b.y);
            if (botDist < myDist) rank += 1;
          }
        });
        setCurrentRank(rank);
      }

      // 만약 내가 착석 완료되었고, 봇들도 착석을 완료했는지 체크
      const allSeated = Object.values(players).every(p => p.isSeated);
      if (allSeated && prev.status === 'RACING') {
        setTimeout(() => {
          setStage('FINISHED');
          SoundSystem.playBGM('finish');
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        }, 1500);
      }

      return {
        ...prev,
        players
      };
    });
  }, [room]);

  // 플레이어가 자리에 착석했을 때
  const handleSeatClaimed = (seatId: string) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    SoundSystem.playSeatSuccess();
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

    // 2.5초 후 완주 결과 보드로 전환
    setTimeout(() => {
      setStage('FINISHED');
      SoundSystem.playBGM('finish');
    }, 2500);
  };

  const handleToggleSound = () => {
    const muted = SoundSystem.toggleMute();
    setIsMuted(muted);
  };

  // 경과 시간 포맷터 (00:00.0)
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m}:${s}.${tenths}`;
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      SoundSystem.stopBGM();
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-white select-none">
      {/* ============================================================ */}
      {/* 1단계: 커스텀 연습방 설정 뷰 */}
      {/* ============================================================ */}
      {stage === 'SETUP' && (
        <div className="min-h-screen overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-between">
          <header className="w-full max-w-5xl flex items-center justify-between py-2 mb-6">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-sm flex items-center gap-2 transition shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" /> 메인 화면으로
            </button>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black text-xs flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5" /> AI 솔로 연습 모드
              </span>
            </div>
          </header>

          <main className="w-full max-w-5xl bg-slate-900/90 border-2 border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black mb-3">
                <Sparkles className="w-3.5 h-3.5" /> 언제든 자유롭게 실전처럼 연습하세요!
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                🤖 커스텀 레이싱 연습방
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-2">
                서킷 테마, AI 봇 인원수와 난이도를 설정하고 혼자서 신나게 레이싱을 즐겨보세요!
              </p>
            </div>

            <div className="space-y-8">
              {/* 1. 서킷 테마 선택 (6종) */}
              <div>
                <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-3">
                  🏁 1. 주행할 서킷 테마 선택 (6개 코스)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {THEME_LIST.map((t) => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setSelectedTheme(t.id)}
                        className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center text-center ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 shadow-xl shadow-amber-500/20 scale-105'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-3xl mb-2">{t.icon}</span>
                        <span className="text-xs font-black text-white">{t.name}</span>
                        <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">{t.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. AI 봇 인원 및 난이도 설정 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-950/60 border border-slate-800 rounded-3xl p-5 sm:p-6">
                {/* 봇 인원수 선택 */}
                <div>
                  <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-2">
                    👥 2. 함께 달릴 AI 봇 인원수
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 5, 7].map((num) => (
                      <button
                        type="button"
                        key={num}
                        onClick={() => setBotCount(num)}
                        className={`py-2.5 rounded-xl border font-black text-xs transition ${
                          botCount === num
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {num}명
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    나 + AI 봇 {botCount}명 = 총 <strong className="text-cyan-400">{botCount + 1}명</strong> 레이스
                  </p>
                </div>

                {/* 봇 난이도 선택 */}
                <div>
                  <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-2">
                    ⚡ 3. AI 봇 주행 실력 (난이도)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'easy', label: '🟢 쉬움', desc: '초보 연습용' },
                      { id: 'normal', label: '🟡 보통', desc: '표준 실력' },
                      { id: 'hard', label: '🔴 어려움', desc: '베테랑 봇' }
                    ].map((d) => (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => setBotDifficulty(d.id as BotDifficulty)}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          botDifficulty === d.id
                            ? 'bg-amber-500 border-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold">{d.label}</div>
                        <div className="text-[10px] opacity-80">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. 내 카트 & 드라이버 설정 */}
              <div>
                <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-3">
                  🏎️ 4. 내 레이싱 머신 & 이름 설정
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">드라이버 이름</label>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">출석 등번호</label>
                    <input
                      type="number"
                      value={playerNumber}
                      onChange={(e) => setPlayerNumber(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
                      min={1}
                      max={60}
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-400 font-bold w-full truncate">
                      머신: {CHARACTERS[selectedCharId].name}
                    </div>
                  </div>
                </div>

                {/* 5종 카트 선택 버튼 */}
                <div className="grid grid-cols-5 gap-2">
                  {CHARACTER_LIST.map((char) => {
                    const isSelected = selectedCharId === char.id;
                    return (
                      <button
                        type="button"
                        key={char.id}
                        onClick={() => setSelectedCharId(char.id)}
                        className={`relative p-2 rounded-2xl border-2 transition-all flex flex-col items-center ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 scale-105 shadow-lg shadow-amber-500/20'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="w-12 h-16 flex items-center justify-center">
                          <img src={char.imageSrc} alt={char.name} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-300 mt-1 truncate w-full text-center">
                          {char.name}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 시작 액션 버튼 */}
              <button
                onClick={handleStartPractice}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 hover:from-red-500 hover:to-yellow-300 text-slate-950 font-black text-lg shadow-2xl shadow-amber-500/30 flex items-center justify-center gap-2 transition transform hover:scale-[1.01] active:scale-95"
              >
                <Play className="w-6 h-6 fill-slate-950" /> 연습 레이싱 START!
              </button>
            </div>
          </main>

          <footer className="w-full max-w-5xl text-center py-4 text-xs text-slate-500">
            실제 교실 자리바꾸기와 100% 동일한 서킷, 장애물, 물리 및 좌석 도킹 시스템이 작동합니다.
          </footer>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2단계: 인게임 연습 레이싱 뷰 */}
      {/* ============================================================ */}
      {stage === 'GAME' && room && (
        <div className="relative w-full h-full">
          {/* 60FPS 2D 레이싱 캔버스 */}
          <GameCanvas
            room={room}
            role="student"
            currentPlayerId={myPlayerIdRef.current}
            onFrameUpdate={handleBotFrameUpdate}
            onSeatClaimed={handleSeatClaimed}
          />

          {/* 상단 연습 레이싱 전용 HUD */}
          <header className="fixed top-0 inset-x-0 p-4 pointer-events-none flex items-start justify-between z-30">
            {/* 좌측: 실시간 순위 & 랩 타이머 */}
            <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-amber-400">
                  {currentRank === 1 ? '🥇 1위' : currentRank === 2 ? '🥈 2위' : currentRank === 3 ? '🥉 3위' : `${currentRank}위`}
                </span>
                <span className="text-xs text-slate-400">/ {botCount + 1}명</span>
              </div>
              <div className="w-px h-4 bg-slate-800" />
              <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-sm font-bold">
                <Timer className="w-4 h-4" />
                <span>{formatTime(elapsedMs)}</span>
              </div>
            </div>

            {/* 우측: 연습 컨트롤 액션 버튼들 */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={handleToggleSound}
                className="w-10 h-10 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-300 flex items-center justify-center hover:text-white transition shadow-lg"
                title={isMuted ? '소리 켜기' : '소리 끄기'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              <button
                onClick={handleStartPractice}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition shadow-lg"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> 다시 하기
              </button>

              <button
                onClick={() => setStage('SETUP')}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition shadow-lg"
              >
                <Settings2 className="w-3.5 h-3.5 text-cyan-400" /> 설정 변경
              </button>
            </div>
          </header>

          {/* 카운트다운 오버레이 */}
          {room.status === 'COUNTDOWN' && (
            <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm">
              <div className="text-8xl md:text-9xl font-black text-amber-400 animate-bounce tracking-widest drop-shadow-[0_0_50px_rgba(245,158,11,0.8)]">
                {countdown > 0 ? countdown : 'GO!'}
              </div>
              <p className="text-lg font-bold text-slate-200 mt-4 tracking-wider">
                방향키 또는 WASD로 신나게 달려보세요!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 3단계: 연습 레이스 완주 결과 보드 */}
      {/* ============================================================ */}
      {stage === 'FINISHED' && room && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 sm:p-10 max-w-lg w-full text-center shadow-2xl shadow-amber-500/20">
            <div className="text-5xl mb-3">🏆</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
              연습 레이싱 완주 성공!
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mb-6">
              완주 기록: <strong className="text-amber-400 font-mono text-base">{formatTime(elapsedMs)}</strong> (순위: {currentRank}위)
            </p>

            {/* 착석 결과 표 요약 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-6 max-h-48 overflow-y-auto">
              <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                좌석 착석 결과
              </div>
              <div className="space-y-1.5">
                {Object.values(room.players || {}).map((p) => {
                  const isMe = p.id === myPlayerIdRef.current;
                  const seat = p.seatedId ? room.seatConfig.seats[p.seatedId] : null;
                  const seatText = seat ? `${seat.row + 1}분단 ${seat.col + 1}열` : '미착석';
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold ${
                        isMe ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' : 'bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{p.number}번</span>
                        <span className="text-white">{p.name}</span>
                        {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black">나</span>}
                      </div>
                      <span className="text-cyan-400 font-mono">{seatText}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 하단 액션 버튼 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleStartPractice}
                className="py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition active:scale-95"
              >
                <RotateCcw className="w-4 h-4" /> 다시 연습하기
              </button>

              <button
                onClick={() => setStage('SETUP')}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Settings2 className="w-4 h-4" /> 설정 변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
