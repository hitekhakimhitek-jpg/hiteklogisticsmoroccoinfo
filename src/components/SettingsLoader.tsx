const SettingsLoader = () => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
    <svg className="pl" viewBox="0 0 176 160" width="176" height="160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(33,90%,55%)" />
          <stop offset="30%" stopColor="hsl(33,90%,55%)" />
          <stop offset="100%" stopColor="hsl(3,90%,55%)" />
        </linearGradient>
      </defs>
      <g fill="none" strokeWidth="16" strokeLinecap="round">
        <circle className="pl__ring" r="56" cx="88" cy="96" stroke="hsla(0,10%,10%,0.1)" />
        <path className="pl__worm1" d="M144,96A56,56,0,0,1,32,96" stroke="url(#pl-grad)" strokeDasharray="43.98 307.87" />
        <path className="pl__worm2" d="M32,136V96s-.275-25.725,14-40" stroke="hsl(33,90%,55%)" strokeDasharray="0 40 0 44" strokeDashoffset="0.001" visibility="hidden" />
        <path className="pl__worm3" d="M144,136V96s.275-25.725-14-40" stroke="hsl(33,90%,55%)" strokeDasharray="0 40 0 44" strokeDashoffset="0.001" visibility="hidden" />
      </g>
    </svg>
    <style>{`
      .pl { --dur: 3s; }
      .pl__ring { opacity: 0.3; }
      .pl__worm1 {
        animation: worm1 var(--dur) linear infinite;
        transform-origin: 88px 96px;
      }
      .pl__worm2 {
        animation: worm2 var(--dur) linear infinite;
      }
      .pl__worm3 {
        animation: worm3 var(--dur) linear infinite;
      }
      @keyframes worm1 {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes worm2 {
        0%, 24.99% { visibility: hidden; stroke-dasharray: 0 40 0 44; }
        25% { visibility: visible; stroke-dasharray: 0 40 0 44; }
        50% { stroke-dasharray: 40 0 0 44; visibility: visible; }
        50.01%, 100% { visibility: hidden; }
      }
      @keyframes worm3 {
        0%, 49.99% { visibility: hidden; stroke-dasharray: 0 40 0 44; }
        50% { visibility: visible; stroke-dasharray: 0 40 0 44; }
        75% { stroke-dasharray: 40 0 0 44; visibility: visible; }
        75.01%, 100% { visibility: hidden; }
      }
    `}</style>
    <p className="mt-4 text-sm font-medium text-muted-foreground animate-pulse">
      Gathering and analyzing information…
    </p>
  </div>
);

export default SettingsLoader;
