import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore, SPONSOR_ROLE_DISPLAY, type SponsorRole } from '../store/useStore'
import { getActiveSponsors } from '../api/sponsor'

interface FlyingSponsor {
  id: string
  displayName: string
  role: SponsorRole
  badge: string
  color: string
  level: number
  y: number
  createdAt: number
}

const VIEWER_LEVEL: Record<SponsorRole, number> = {
  general_sponsor: 1, senior_sponsor: 2, core_sponsor: 3,
  sole_exclusive_sponsor: 4, reserve_fund_sponsor: 5, none: 0
};

// Visibility: viewer sees sponsors with level > their own level
// none(0) -> sees 1-5  |  general(1) -> sees 2-5  |  ...  |  reserve(5) -> sees none
function getVisibleLevels(viewerRole: SponsorRole): [number, number] {
  const vLevel = VIEWER_LEVEL[viewerRole];
  return [vLevel + 1, 5];
}

export default function SponsorEffect() {
  const [flyers, setFlyers] = useState<FlyingSponsor[]>([]);
  const isAuthenticated = useStore(s => s.isAuthenticated);
  const currentUser = useStore(s => s.currentUser);
  const allSponsors = getActiveSponsors();
  const timerRef = useRef<number>(0);
  const isVisible = isAuthenticated && allSponsors.length > 0;

  const getEligibleSponsors = useCallback(() => {
    const role = currentUser?.sponsorRole || 'none';
    const [minLv, maxLv] = getVisibleLevels(role);
    return allSponsors.filter(s => {
      const lv = SPONSOR_ROLE_DISPLAY[s.role].level;
      return lv >= minLv && lv <= maxLv;
    });
  }, [currentUser?.sponsorRole, allSponsors.length]);

  // Calculate base rate: ensure ~1 flyer per 15 minutes
  // The process: pick a random interval centered around 900s
  useEffect(() => {
    if (!isVisible) return;

    const scheduleNext = () => {
      const eligible = getEligibleSponsors();
      if (eligible.length === 0) {
        timerRef.current = window.setTimeout(scheduleNext, 300000);
        return;
      }

      // Weight each sponsor by level^2
      // Higher level = more frequent individually
      // But since low-level sponsors are more numerous,
      // collectively low levels appear more often
      const weights = eligible.map(s => {
        const lv = SPONSOR_ROLE_DISPLAY[s.role].level;
        return lv * lv;
      });
      const totalW = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalW;
      let chosen = eligible[0];
      for (let i = 0; i < eligible.length; i++) {
        r -= weights[i];
        if (r <= 0) { chosen = eligible[i]; break; }
      }

      // Base interval: 900s (15 min), with exponential random variation
      const interval = -Math.log(Math.random()) * 900 * 1000;

      const info = SPONSOR_ROLE_DISPLAY[chosen.role];
      const flyer: FlyingSponsor = {
        id: 'fly_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
        displayName: chosen.displayName,
        role: chosen.role,
        badge: info.badge, color: info.color, level: info.level,
        y: 5 + Math.random() * 75, createdAt: Date.now()
      };

      setFlyers(prev => [...prev.slice(-2), flyer]);
      setTimeout(() => {
        setFlyers(prev => prev.filter(f => f.id !== flyer.id));
      }, 10000);

      timerRef.current = window.setTimeout(scheduleNext, interval);
    };

    timerRef.current = window.setTimeout(scheduleNext, 5000 + Math.random() * 30000);
    return () => { clearTimeout(timerRef.current); };
  }, [isVisible, getEligibleSponsors]);

  if (!isVisible) return null;
  const eligible = getEligibleSponsors();
  if (eligible.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none', zIndex: 9995, overflow: 'hidden'
    }}>
      {flyers.map(f => (
        <div key={f.id}
          onClick={() => window.dispatchEvent(new CustomEvent('sponsor-click', {detail:{displayName:f.displayName}}))}
          style={{
            position: 'absolute', top: f.y + '%',
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 16,
            background: 'linear-gradient(90deg, ' + f.color + '22, ' + f.color + '44)',
            border: '1px solid ' + f.color + '66', color: '#fff',
            fontSize: 11 + f.level * 2, fontWeight: 600,
            cursor: 'pointer', pointerEvents: 'auto',
            animation: 'sfxFly 9s ease-in-out forwards',
            whiteSpace: 'nowrap',
            boxShadow: '0 0 15px ' + f.color + '66', zIndex: 9995,
          }}>
          <span>{'🏅'}</span>
          <span>{f.displayName}</span>
          <span style={{fontSize:10,padding:'1px 4px',borderRadius:3,background:f.color+'44',color:f.color}}>{f.badge}</span>
          <span style={{fontSize:9,opacity:0.6}}>{'✚'}</span>
        </div>
      ))}
      <style>{`
        @keyframes sfxFly {
          0%   { transform: translateX(-150px) scale(0.3); opacity: 0; }
          5%   { transform: translateX(20px) scale(1); opacity: 1; }
          85%  { transform: translateX(calc(100vw - 150px)) scale(1); opacity: 1; }
          100% { transform: translateX(calc(100vw + 100px)) scale(0.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}