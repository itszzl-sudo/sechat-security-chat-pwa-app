import { SponsorRole, SPONSOR_ROLE_DISPLAY } from '../store/useStore'

interface Props {
  role: SponsorRole
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
}

export default function RoleBadge({ role, size = 'small', showLabel = false }: Props) {
  if (role === 'none') return null
  const info = SPONSOR_ROLE_DISPLAY[role]
  const sizeMap = { small: { font: 9, padding: '1px 5px' }, medium: { font: 11, padding: '2px 8px' }, large: { font: 13, padding: '3px 10px' } }
  const sz = sizeMap[size]

  return (
    <span title={info.label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: sz.font, fontWeight: 600,
      padding: sz.padding,
      borderRadius: 4,
      background: info.color + '22',
      color: info.color,
      border: '1px solid ' + info.color + '44',
      verticalAlign: 'middle',
      lineHeight: 1.2
    }}>
      {info.badge}
      {showLabel && <span style={{ fontSize: sz.font - 1, fontWeight: 400 }}>{info.label}</span>}
    </span>
  )
}
