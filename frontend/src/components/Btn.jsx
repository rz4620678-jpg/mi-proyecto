export default function Btn({ c = 'bl', icon: I, children, ...p }) {
  return <button className={'btn ' + c} {...p}>{I && <I size={16} />}{children}</button>;
}
