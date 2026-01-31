
import { TileType } from './types';

export const TOTAL_TILES = 48;

export const SUBJECTS = ['Matemáticas', 'Ciencias', 'Historia', 'Lenguaje', 'Geografía', 'Astronomía'];

export const BOARD_TILES = Array.from({ length: TOTAL_TILES }, (_, i) => {
  if (i === 0) return { type: TileType.EMPTY, label: '🚀' };
  // Aumentamos la frecuencia de eventos para que el juego sea más intenso
  if (i % 5 === 0) return { type: TileType.MYSTERY, label: '🌀' };
  if (i % 2 === 0) return { type: TileType.SUBJECT, label: '?' };
  if (i % 3 === 0) return { type: TileType.BONUS, label: '⭐' };
  return { type: TileType.EMPTY, label: '' };
});

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
export const AVATARS = ['🚀', '🤖', '👾', '🧬', '🧠', '🧙', '🦖', '🌟'];
