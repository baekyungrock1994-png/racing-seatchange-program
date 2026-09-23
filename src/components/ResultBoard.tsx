// src/components/ResultBoard.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { GameRoom, Player } from '@/types/game';
import { Trophy, Printer, ArrowLeft, Users, Move, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CHARACTERS } from '@/constants/characters';
import { SoundSystem } from '@/engine/SoundSystem';
import { SyncBridge } from '@/lib/syncBridge';

interface ResultBoardProps {
  room: GameRoom;
  onBackToLobby: () => void;
}

interface DragItem {
  playerId: string;
  sourceSeatId?: string | null;
}

export function ResultBoard({ room, onBackToLobby }: ResultBoardProps) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverSeatId, setDragOverSeatId] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    // 결과 화면 축하 배경음악 재생
    SoundSystem.playBGM('finish');

    // 팡파르 축하 콘페티
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });

    return () => {
      SoundSystem.stopBGM();
    };
  }, []);

  const seats = room.seatConfig?.seats || {};
  const rows = room.seatConfig?.rows || 5;
  const cols = room.seatConfig?.cols || 6;
  const players = useMemo(() => Object.values(room.players || {}), [room.players]);

  // 좌석별 학생 매핑 (한 좌석에 2명 이상 중복 배정된 경우까지 완벽 수집)
  const { seatPlayersMap, unseatedPlayers, hasDuplicateSeats } = useMemo(() => {
    const map: Record<string, Player[]> = {};
    const assignedPlayerIds = new Set<string>();

    // 1. seatConfig.seats의 occupiedBy 기반 1차 매핑
    Object.entries(seats).forEach(([seatId, seat]) => {
      map[seatId] = [];
      if (seat.occupiedBy && room.players?.[seat.occupiedBy]) {
        map[seatId].push(room.players[seat.occupiedBy]);
        assignedPlayerIds.add(seat.occupiedBy);
      }
    });

    // 2. players 중 seatedId가 부여된 학생 매핑 (혹시 중복이 발생했거나 seatConfig와 다른 경우 감지)
    players.forEach(p => {
      if (p.seatedId && seats[p.seatedId]) {
        if (!map[p.seatedId]) map[p.seatedId] = [];
        if (!map[p.seatedId].some(item => item.id === p.id)) {
          map[p.seatedId].push(p);
          assignedPlayerIds.add(p.id);
        }
      }
    });

    // 3. 미배치 학생 감지
    const unseated = players.filter(p => !assignedPlayerIds.has(p.id));

    // 4. 2명 이상 중복된 자리가 있는지 확인
    const duplicateExists = Object.values(map).some(list => list.length > 1);

    return { seatPlayersMap: map, unseatedPlayers: unseated, hasDuplicateSeats: duplicateExists };
  }, [seats, players, room.players]);

  const handlePrint = () => {
    window.print();
  };

  // 드롭 처리 (자리 이동 또는 맞교환)
  const handleDrop = async (targetSeatId: string) => {
    if (!draggedItem) return;
    const { playerId, sourceSeatId } = draggedItem;

    if (sourceSeatId === targetSeatId) {
      setDraggedItem(null);
      setDragOverSeatId(null);
      return;
    }

    const player = room.players?.[playerId];
    const targetSeat = seats[targetSeatId];
    if (!player || !targetSeat || !targetSeat.active) {
      setDraggedItem(null);
      setDragOverSeatId(null);
      return;
    }

    try {
      await SyncBridge.moveOrSwapSeat(room.code, { playerId, seatId: sourceSeatId }, targetSeatId);
      SoundSystem.playSeatSuccess();
      setNoticeMessage(`✨ [${player.name}] 학생을 ${targetSeat.row + 1}행 ${targetSeat.col + 1}열로 이동했습니다.`);
      setTimeout(() => setNoticeMessage(null), 3500);
    } catch (err) {
      console.error('Error swapping seat:', err);
    } finally {
      setDraggedItem(null);
      setDragOverSeatId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 sm:p-10 flex flex-col items-center select-none">
      {/* 상단 액션 바 (인쇄 시 숨김) */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={onBackToLobby}
          className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-sm flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-4 h-4" /> 새 레이스 준비하기
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/30 transition"
          >
            <Printer className="w-4 h-4" /> 배치표 인쇄 / PDF 저장
          </button>
        </div>
      </div>

      {/* 교사용 드래그 권한 안내 배너 (인쇄 시 숨김) */}
      <div className="w-full max-w-5xl mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-300 print:hidden shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400">
            <Move className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-sm text-white flex items-center gap-2">
              교사 전용 자리 조정 권한 활성화
              {hasDuplicateSeats && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold animate-pulse flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 중복 배정 발생! 드래그로 분리해 주세요
                </span>
              )}
            </div>
            <p className="text-xs text-amber-200/80 mt-0.5">
              학생 카드를 마우스로 <strong>드래그 앤 드롭</strong>하여 빈 자리에 넣거나 다른 학생과 자리를 즉시 맞교환(Swap)할 수 있습니다.
            </p>
          </div>
        </div>

        {noticeMessage && (
          <div className="text-xs font-bold text-cyan-300 bg-cyan-950/80 px-3 py-1.5 rounded-xl border border-cyan-500/30 flex items-center gap-1.5 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            {noticeMessage}
          </div>
        )}
      </div>

      {/* 미배치 학생이 있을 때 노출되는 대기 트레이 (인쇄 시 숨김) */}
      {unseatedPlayers.length > 0 && (
        <div className="w-full max-w-5xl mb-6 p-4 rounded-2xl bg-rose-500/10 border-2 border-dashed border-rose-500/40 text-rose-300 print:hidden shadow-lg">
          <div className="flex items-center gap-2 font-black text-sm mb-3 text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            아직 자리를 찾지 못한 학생 ({unseatedPlayers.length}명) — 학생을 잡고 원하는 좌석으로 드래그하세요!
          </div>
          <div className="flex flex-wrap gap-2.5">
            {unseatedPlayers.map((unseated) => {
              const charMeta = CHARACTERS[unseated.characterId];
              return (
                <div
                  key={unseated.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggedItem({ playerId: unseated.id, sourceSeatId: null });
                    e.dataTransfer.setData('text/plain', unseated.id);
                  }}
                  onDragEnd={() => setDraggedItem(null)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-rose-500/40 hover:border-rose-400 text-white flex items-center gap-2 cursor-grab active:cursor-grabbing shadow-md hover:scale-105 transition transform"
                >
                  <span className="text-xs font-black text-amber-400">{unseated.number}번</span>
                  <span className="text-xs font-bold">{unseated.name}</span>
                  {charMeta && (
                    <span className="text-[10px] text-slate-400">({charMeta.name.slice(0, 2)})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 최종 자리배치표 메인 인쇄 영역 */}
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl print:bg-white print:text-black print:border-none print:p-0">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm mb-3">
            <Trophy className="w-4 h-4" /> 레이싱 교실 자리바꾸기 최종 결과
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white print:text-black">
            우리 반 자리 배치표
          </h1>
          <p className="text-sm text-slate-400 print:text-gray-600 mt-2">
            방 코드: {room.code} • 총 학생: {players.length}명
          </p>
        </div>

        {/* 칠판 (앞 쪽) */}
        <div className="w-full max-w-md mx-auto h-12 rounded-xl bg-emerald-800 border-2 border-emerald-600 text-emerald-100 font-black text-base flex items-center justify-center tracking-widest shadow-inner mb-8 print:bg-gray-200 print:text-black print:border-gray-400">
          칠 판 (교탁 / 앞 쪽)
        </div>

        {/* 좌석 그리드 */}
        <div
          className="grid gap-4 max-w-4xl mx-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const seatId = `seat_${r}_${c}`;
              const seat = seats[seatId];

              if (!seat || !seat.active) {
                return (
                  <div
                    key={seatId}
                    className="h-28 sm:h-32 rounded-2xl border-2 border-dashed border-slate-800/60 print:border-gray-200 flex items-center justify-center text-xs text-slate-700 print:text-gray-300"
                  >
                    통로
                  </div>
                );
              }

              const occupants = seatPlayersMap[seatId] || [];
              const isOccupied = occupants.length > 0;
              const isDuplicate = occupants.length > 1;
              const isDragOver = dragOverSeatId === seatId;

              return (
                <div
                  key={seatId}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverSeatId(seatId);
                  }}
                  onDragLeave={() => {
                    if (dragOverSeatId === seatId) setDragOverSeatId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(seatId);
                  }}
                  className={`h-28 sm:h-32 rounded-2xl p-2.5 flex flex-col justify-between shadow-lg relative transition-all duration-150 ${
                    isDragOver
                      ? 'bg-cyan-950/70 border-2 border-cyan-400 ring-4 ring-cyan-500/40 scale-[1.04]'
                      : isDuplicate
                      ? 'bg-rose-950/40 border-2 border-rose-500 ring-2 ring-rose-500/30'
                      : isOccupied
                      ? 'bg-slate-800/90 border-2 border-amber-500/40 hover:border-amber-400'
                      : 'bg-slate-900/60 border-2 border-dashed border-slate-700/80 hover:border-slate-500'
                  } print:bg-gray-50 print:border-black print:ring-0 print:scale-100`}
                >
                  {/* 좌석 번호 및 중복 배지 헤더 */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 print:text-gray-600 font-bold">
                    <span>{r + 1}-{c + 1}</span>
                    {isDuplicate && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[9px] font-black tracking-tight animate-bounce print:hidden">
                        2명 겹침!
                      </span>
                    )}
                  </div>

                  {/* 좌석 내부 학생 카드 렌더링 */}
                  <div className="my-auto flex flex-col gap-1 w-full overflow-hidden">
                    {occupants.length === 0 ? (
                      <div className="text-center py-2 text-xs text-slate-500 font-medium">
                        빈 자리
                        <div className="text-[10px] text-slate-600 print:hidden mt-0.5">여기로 드래그</div>
                      </div>
                    ) : (
                      occupants.map((occ) => {
                        const charMeta = CHARACTERS[occ.characterId];
                        const isDraggingThis = draggedItem?.playerId === occ.id;

                        return (
                          <div
                            key={occ.id}
                            draggable
                            onDragStart={(e) => {
                              setDraggedItem({ playerId: occ.id, sourceSeatId: seatId });
                              e.dataTransfer.setData('text/plain', occ.id);
                            }}
                            onDragEnd={() => setDraggedItem(null)}
                            title="마우스로 드래그하여 다른 자리로 옮기거나 맞교환하세요"
                            className={`p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 print:bg-transparent print:border-none text-center cursor-grab active:cursor-grabbing hover:border-cyan-400 hover:bg-slate-800/90 transition-all ${
                              isDraggingThis ? 'opacity-40 scale-95' : ''
                            } ${isDuplicate ? 'ring-1 ring-rose-400' : ''}`}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-xs font-black text-amber-400 print:text-black">
                                {occ.number}번
                              </span>
                              <span className="text-xs sm:text-sm font-black text-white print:text-black truncate max-w-[90px]">
                                {occ.name}
                              </span>
                            </div>
                            {charMeta && (
                              <div className="text-[10px] text-slate-400 print:hidden truncate">
                                {charMeta.name.slice(0, 4)}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 하단 책상 하이라이트 바 */}
                  <div
                    className={`w-full h-1 rounded-full ${
                      isDuplicate
                        ? 'bg-rose-500'
                        : isOccupied
                        ? 'bg-amber-500/40'
                        : 'bg-slate-800'
                    } print:hidden`}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
