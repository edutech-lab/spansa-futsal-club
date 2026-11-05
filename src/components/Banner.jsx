import { DEFAULT_LOGO } from '../config.js';

function Player({ x, y, s = 1, o = 0.34, flip }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} opacity={o} fill="#06123F" stroke="#06123F" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="0" cy="-92" r="10" stroke="none" />
      <path d="M-4 -80 L-16 -50 L-2 -34 L8 -52 Z" stroke="none" />
      <path d="M-14 -72 L-34 -52" strokeWidth="8" fill="none" />
      <path d="M10 -72 L30 -88" strokeWidth="8" fill="none" />
      <path d="M-2 -38 L-22 -4 L-12 16" strokeWidth="10" fill="none" />
      <path d="M4 -38 L26 -12 L48 -4" strokeWidth="10" fill="none" />
    </g>
  );
}

export default function Banner({ settings }) {
  const nama = settings.namaKlub || 'Spansa Futsal Club';
  const parts = nama.split(' ');
  const first = parts.slice(0, -1).join(' ') || nama;
  const last = parts.length > 1 ? parts[parts.length - 1] : 'Management';
  const bannerUrl = settings.bannerUrl;
  return (
    <div className="banner">
      {bannerUrl ? <img className="bimg" src={bannerUrl} alt="" referrerPolicy="no-referrer" /> : (
        <svg className="bg" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="bn-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0A2A94" /><stop offset=".6" stopColor="#0B3FC9" /><stop offset="1" stopColor="#1D5FE8" /></linearGradient>
            <radialGradient id="bn-l" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
            <linearGradient id="bn-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1D5FE8" stopOpacity=".05" /><stop offset="1" stopColor="#06123F" stopOpacity=".45" /></linearGradient>
          </defs>
          <rect width="1200" height="240" fill="url(#bn-bg)" />
          {[560, 700, 840, 980, 1120].map((x, i) => <circle key={x} cx={x} cy={18 + (i % 2) * 8} r="46" fill="url(#bn-l)" opacity=".55" />)}
          <rect y="150" width="1200" height="90" fill="url(#bn-floor)" />
          <g stroke="#fff" strokeOpacity=".28" strokeWidth="2" fill="none">
            <path d="M500 240 L640 150 L1200 150" /><path d="M700 240 L760 150" /><path d="M900 240 L880 150" /><path d="M1100 240 L1000 150" />
            <ellipse cx="900" cy="205" rx="140" ry="26" />
            <path d="M540 190 L1200 190" />
          </g>
          <Player x={700} y={206} s={1.05} /><Player x={800} y={198} s={.95} flip /><Player x={940} y={208} s={1.1} /><Player x={1050} y={200} s={.9} flip />
          <g transform="translate(1000 170)">
            <circle r="34" fill="#fff" /><circle r="34" fill="none" stroke="#0A2A94" strokeWidth="2" />
            <path d="M0 -12 L12 -4 L8 10 L-8 10 L-12 -4 Z" fill="#0A2A94" />
            <path d="M0 -12 V-34 M12 -4 L32 -10 M8 10 L20 28 M-8 10 L-20 28 M-12 -4 L-32 -10" stroke="#0A2A94" strokeWidth="2.5" fill="none" />
          </g>
          <g fill="#FFC20E"><path d="M1090 0 H1150 L1050 130 H990 Z" opacity=".95" /><path d="M1160 0 H1200 V40 L1130 130 H1110 Z" opacity=".75" /></g>
        </svg>
      )}
      <div className="bt">
        <img src={settings.logoUrl || DEFAULT_LOGO} alt="" width="86" height="86" style={{ objectFit: 'contain', flex: 'none', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.35))' }} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div className="bar" />
        <div>
          <h2>{first}<span>{last === 'Club' ? 'Management' : last}</span></h2>
          <p>Kelola tim, atur pertandingan, dan raih prestasi yang lebih tinggi bersama.</p>
        </div>
      </div>
    </div>
  );
}
