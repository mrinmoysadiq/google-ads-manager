export default function Avatar({ name = '', avatarUrl, size = 32 }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0].toUpperCase()).slice(0, 2).join('');
  if (avatarUrl) return <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#575ECF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, userSelect: 'none', letterSpacing: '0.02em' }}>
      {initials || '?'}
    </div>
  );
}
