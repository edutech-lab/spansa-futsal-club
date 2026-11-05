import { shortName } from '../utils.js';

export const POLA = {
  '1-2-1': [['Kiper', 150, 360], ['Anak', 150, 280], ['Flank Kiri', 62, 200], ['Flank Kanan', 238, 200], ['Pivot', 150, 100]],
  '2-2': [['Kiper', 150, 360], ['Bek Kiri', 90, 280], ['Bek Kanan', 210, 280], ['Depan Kiri', 90, 130], ['Depan Kanan', 210, 130]],
  '3-1': [['Kiper', 150, 360], ['Bek Kiri', 62, 272], ['Bek Tengah', 150, 292], ['Bek Kanan', 238, 272], ['Pivot', 150, 112]],
  '1-1-2': [['Kiper', 150, 360], ['Anak', 150, 285], ['Tengah', 150, 205], ['Depan Kiri', 95, 108], ['Depan Kanan', 205, 108]]
};
export const POLA_LIST = Object.keys(POLA);

export default function Pitch({ pola = '1-2-1', lineup = {}, nameOf }) {
  const slots = POLA[pola] || POLA['1-2-1'];
  return (
    <svg className="pitch cd" viewBox="0 0 300 400" role="img" aria-label={`Formasi ${pola}`}>
      <defs>
        <linearGradient id="pt-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1646B8" /><stop offset="1" stopColor="#0B2E8F" /></linearGradient>
      </defs>
      <rect width="300" height="400" fill="url(#pt-g)" />
      <g stroke="#fff" strokeOpacity=".8" strokeWidth="2" fill="none">
        <rect x="14" y="14" width="272" height="372" rx="4" />
        <path d="M14 200 H286" /><circle cx="150" cy="200" r="38" />
        <path d="M82 14 A68 68 0 0 0 218 14" /><path d="M82 386 A68 68 0 0 1 218 386" />
        <rect x="118" y="2" width="64" height="12" /><rect x="118" y="386" width="64" height="12" />
      </g>
      {slots.map(([label, x, y], i) => {
        const nm = nameOf ? nameOf(lineup[`s${i}`]) : '';
        return (
          <g key={label + i}>
            <circle cx={x} cy={y} r="17" fill={i === 0 ? '#FFC20E' : '#fff'} stroke={i === 0 ? '#fff' : '#FFC20E'} strokeWidth="3" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0A2A94">{i === 0 ? 'GK' : i}</text>
            <text x={x} y={y + 33} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" stroke="#06123F" strokeWidth="3" paintOrder="stroke">{nm ? shortName(nm) : label}</text>
          </g>
        );
      })}
    </svg>
  );
}
