// src/components/SeatBuilder.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Bookmark, RotateCcw, Check, Sparkles } from 'lucide-react';

interface SeatBuilderProps {
  initialRows?: number;
  initialCols?: number;
  onChange: (rows: number, cols: number, activeGrid: boolean[][]) => void;
}

export function SeatBuilder({ initialRows = 5, initialCols = 6, onChange }: SeatBuilderProps) {
  const [rows, setRows] = useState(initialRows);
  const [cols, setCols] = useState(initialCols);
  const [grid, setGrid] = useState<boolean[][]>(() => 
    Array.from({ length: initialRows }, () => Array(initialCols).fill(true))
  );
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<Array<{ name: string; rows: number; cols: number; grid: boolean[][] }>>([]);

  // 로컬스토리지에서 프리셋 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('racing_seat_presets');
      if (stored) {
        try {
          setSavedPresets(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  // 행, 열 변경 시 그리드 재구성
  useEffect(() => {
    setGrid(prev => {
      const newGrid = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (prev[r]?.[c] !== undefined ? prev[r][c] : true))
      );
      onChange(rows, cols, newGrid);
      return newGrid;
    });
  }, [rows, cols]);

  const toggleSeat = (r: number, c: number) => {
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = !copy[r][c];
      onChange(rows, cols, copy);
      return copy;
    });
  };

  const applyPreset = (pattern: 'all' | 'paired' | 'u_shape' | 'single') => {
    const newGrid = Array.from({ length: rows }, () => Array(cols).fill(true));

    if (pattern === 'paired') {
      // 2-2-2 분단형 (짝꿍 대열)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (c % 3 === 2) newGrid[r][c] = false; // 2자리마다 복도
        }
      }
    } else if (pattern === 'u_shape') {
      // ㄷ자형 토론 대열
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
            newGrid[r][c] = false; // 중앙 비우기
          }
        }
      }
    } else if (pattern === 'single') {
      // 1인 1책상 시험 대열 (지그재그 또는 띄어앉기)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if ((r + c) % 2 === 1) newGrid[r][c] = false;
        }
      }
    }

    setGrid(newGrid);
    onChange(rows, cols, newGrid);
  };

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return;
    const newPreset = {
      name: presetName.trim(),
      rows,
      cols,
      grid
    };
    const updated = [...savedPresets.filter(p => p.name !== newPreset.name), newPreset];
    setSavedPresets(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('racing_seat_presets', JSON.stringify(updated));
    }
    setPresetName('');
  };

  const loadSavedPreset = (preset: { rows: number; cols: number; grid: boolean[][] }) => {
    setRows(preset.rows);
    setCols(preset.cols);
    setGrid(preset.grid);
    onChange(preset.rows, preset.cols, preset.grid);
  };

  const activeCount = grid.flat().filter(Boolean).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-black tracking-wide text-amber-400 flex items-center gap-2">
            🪑 교실 자리 배치 에디터
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            원하는 책상을 클릭하여 켜고 끄거나 빠른 프리셋을 적용하세요.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
            총 활성 좌석: {activeCount}석
          </span>
        </div>
      </div>

      {/* 행 & 열 크기 조절 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
          <label className="block text-xs font-semibold text-slate-400 mb-1">세로 줄 (행, Rows)</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRows(Math.max(2, rows - 1))}
              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-lg"
            >
              -
            </button>
            <span className="font-bold text-lg w-8 text-center">{rows}</span>
            <button
              onClick={() => setRows(Math.min(8, rows + 1))}
              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-lg"
            >
              +
            </button>
          </div>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
          <label className="block text-xs font-semibold text-slate-400 mb-1">가로 줄 (열, Cols)</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCols(Math.max(2, cols - 1))}
              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-lg"
            >
              -
            </button>
            <span className="font-bold text-lg w-8 text-center">{cols}</span>
            <button
              onClick={() => setCols(Math.min(8, cols + 1))}
              className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-lg"
            >
              +
            </button>
          </div>
        </div>

        {/* 기본 프리셋 버튼 */}
        <div className="col-span-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => applyPreset('all')}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          >
            모두 채우기
          </button>
          <button
            onClick={() => applyPreset('paired')}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 border border-blue-700/50 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> 2인 짝꿍 분단
          </button>
          <button
            onClick={() => applyPreset('u_shape')}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-700/50 transition"
          >
            ㄷ자 토론 대형
          </button>
          <button
            onClick={() => applyPreset('single')}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-700/50 transition"
          >
            시험 띄어앉기
          </button>
        </div>
      </div>

      {/* 시각적 교실 칠판 & 좌석 그리드 미리보기 */}
      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center mb-6">
        {/* 앞쪽 칠판/교탁 표시 */}
        <div className="w-48 h-8 rounded-lg bg-emerald-800/80 border border-emerald-600 text-emerald-200 text-xs font-black flex items-center justify-center tracking-widest shadow-inner mb-6">
          칠 판 (앞 쪽)
        </div>

        {/* ㄷ자 박스 좌석 그리드 */}
        <div 
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.map((isActive, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => toggleSeat(r, c)}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl relative transition-all duration-200 flex flex-col items-center justify-center font-bold text-xs ${
                  isActive
                    ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10 hover:scale-105'
                    : 'bg-slate-900/50 border-2 border-dashed border-slate-800 text-slate-700 hover:border-slate-600'
                }`}
                title={`좌석 (${r + 1}행, ${c + 1}열) - 클릭하여 켜기/끄기`}
              >
                {isActive ? (
                  <>
                    <div className="absolute top-1 text-[10px] text-amber-500/80">ㄷ</div>
                    <span className="mt-1 text-sm font-black">{r + 1}-{c + 1}</span>
                    <div className="absolute bottom-1 w-6 h-1 bg-amber-400/40 rounded-full" />
                  </>
                ) : (
                  <span className="text-slate-700 text-xs">통로</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* 프리셋 저장 및 불러오기 */}
      <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="프리셋 이름 (예: 1학기 분단)"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={saveCurrentAsPreset}
            disabled={!presetName.trim()}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Bookmark className="w-3.5 h-3.5" /> 배치 저장
          </button>
        </div>

        {savedPresets.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold">저장된 배치:</span>
            {savedPresets.map((p) => (
              <button
                key={p.name}
                onClick={() => loadSavedPreset(p)}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium transition"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
