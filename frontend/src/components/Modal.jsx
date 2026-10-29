export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="mod" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'box' + (wide ? ' wide' : '')}>
        <div className="mh"><b>{title}</b><button onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}
