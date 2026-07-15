import { Card as CardT } from '@shared/types';
import { COLOR_HEX, RANK_GLYPH, RANK_LABEL } from '@shared/types';

interface Props {
  card: CardT;
  selected?: boolean;
  small?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

// Quân bài tứ sắc: màu quân nằm ở nền; toàn bộ chữ dùng màu đen.
export function CardView({ card, selected, small, onClick, disabled }: Props) {
  const background = COLOR_HEX[card.color];
  return (
    <button
      className={`card ${selected ? 'card--selected' : ''} ${small ? 'card--small' : ''}`}
      style={{ background, color: '#0b0b0b' }}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${RANK_LABEL[card.rank]} ${card.color}`}
    >
      <span className="card__glyph">{RANK_GLYPH[card.rank]}</span>
      <span className="card__label">{RANK_LABEL[card.rank]}</span>
    </button>
  );
}
