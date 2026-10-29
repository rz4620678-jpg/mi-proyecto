import { Fragment, useEffect, useState } from 'react';

// cols: [{h:'Título', k:'campo', render:(fila)=>..., cls:'n'}]
export default function DataTable({ cols, rows, selected, onSelect, numbered = true, expandedId, renderExpanded }) {
  const [page, setPage] = useState(1);
  const allRows = rows || [];
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(allRows.length / pageSize));
  const firstIndex = (page - 1) * pageSize;
  const pageRows = allRows.slice(firstIndex, firstIndex + pageSize);

  // Al cambiar los resultados, vuelve a la primera página.
  useEffect(() => setPage(1), [rows]);

  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead><tr>{numbered && <th>N°</th>}{cols.map((c) => <th key={c.h}>{c.h}</th>)}</tr></thead>
        <tbody>
          {pageRows.map((r, i) => (
            <Fragment key={r.id ?? firstIndex + i}>
              <tr className={selected && selected.id === r.id ? 'sel' : ''} onClick={() => onSelect && onSelect(r)}>
                {numbered && <td>{firstIndex + i + 1}</td>}
                {cols.map((c) => <td key={c.h} className={c.cls}>{c.render ? c.render(r, firstIndex + i) : r[c.k]}</td>)}
              </tr>
              {renderExpanded && String(expandedId) === String(r.id) && (
                <tr className="expanded-row"><td colSpan={cols.length + (numbered ? 1 : 0)}>{renderExpanded(r)}</td></tr>
              )}
            </Fragment>
          ))}
          {rows && !allRows.length && <tr><td colSpan={cols.length + (numbered ? 1 : 0)}>Sin registros</td></tr>}
        </tbody>
      </table>
      {rows && allRows.length > pageSize && (
        <div className="table-pagination">
          <span>{firstIndex + 1}–{Math.min(firstIndex + pageSize, allRows.length)} de {allRows.length}</span>
          <button className="btn nv s" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
          <button className="btn nv s" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Siguiente</button>
        </div>
      )}
    </div>
  );
}
