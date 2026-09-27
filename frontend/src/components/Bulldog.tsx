// Handsome Dan, the Campus Customs bulldog guide. Drawn in SVG so it stays crisp at any size
// (chat avatar, launcher, hero mascot) and follows the black-and-blue theme.

interface BulldogProps {
  size?: number
  className?: string
  title?: string
  collar?: boolean
}

export default function Bulldog({ size = 48, className, title = 'Handsome Dan the bulldog', collar = true }: BulldogProps) {
  const ink = '#16223b'
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      // An empty title means decorative (a visible label says who Dan is), so screen readers skip it.
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      {/* folded "rose" ears, set wide on the sides */}
      <path d="M31 36 C22 26 7 28 5 43 C14 48 25 45 33 40 Z" fill="#a9794f" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M89 36 C98 26 113 28 115 43 C106 48 95 45 87 40 Z" fill="#a9794f" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      {/* wide, flat bulldog head */}
      <path
        d="M17 60 C17 35 37 25 60 25 C83 25 103 35 103 60 C103 82 89 97 60 97 C31 97 17 82 17 60 Z"
        fill="#f7f2e8"
        stroke={ink}
        strokeWidth="3"
      />
      {/* brindle patch over one eye */}
      <path d="M70 37 C84 34 97 44 94 57 C90 65 77 64 71 58 C65 52 63 41 70 37 Z" fill="#d7b48c" />
      {/* forehead wrinkles */}
      <path d="M49 38 Q60 32 71 38" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M52 44 Q60 40 68 44" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 46 V50" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      {/* eyes with heavy lids */}
      <circle cx="41" cy="57" r="5.6" fill={ink} />
      <circle cx="79" cy="57" r="5.6" fill={ink} />
      <circle cx="43" cy="55" r="1.9" fill="#fff" />
      <circle cx="81" cy="55" r="1.9" fill="#fff" />
      <path d="M33 52 Q41 48 49 52" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M71 52 Q79 48 87 52" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      {/* big muzzle with drooping jowls */}
      <path
        d="M27 75 C27 63 44 61 60 63 C76 61 93 63 93 75 C95 89 83 98 72 93 C66 97 54 97 48 93 C37 98 25 89 27 75 Z"
        fill="#fffaf1"
        stroke={ink}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      {/* wide flat nose */}
      <path d="M47 66 Q60 59 73 66 Q73 74 60 76 Q47 74 47 66 Z" fill={ink} />
      <ellipse cx="55" cy="66" rx="3.4" ry="1.6" fill="#5a6886" />
      {/* lips and underbite */}
      <path d="M60 76 V81" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M60 81 Q51 88 41 83" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M60 81 Q69 88 79 83" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M47 89 Q60 96 73 89" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M48.5 89.5 L51 83 L53.5 91 Z" fill="#fff" stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M66.5 91 L69 83 L71.5 89.5 Z" fill="#fff" stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
      {collar && (
        <>
          {/* Yale-blue collar with a gold Y tag */}
          <path d="M25 91 Q60 111 95 91 L96 99 Q60 119 24 99 Z" fill="#00366b" stroke={ink} strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="60" cy="110" r="7.5" fill="#f2c230" stroke={ink} strokeWidth="2.2" />
          <text x="60" y="114" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="11" fill={ink}>
            Y
          </text>
        </>
      )}
    </svg>
  )
}
